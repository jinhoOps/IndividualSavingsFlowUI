# 결과 이미지 저장 예산 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. 사용자에게서 받은 Native 실행 선호를 유지한다. Steps use checkbox (`- [ ]`) syntax for tracking.

**상태:** 2026-09-22 사용자가 구현과 운영 적용을 승인했다. 실행 중 판단은 아래 변경 기록과 evidence를 따른다.
**Goal:** 공유 이미지의 예약·실제 파일·정리를 연결하여 500MB 운영 예산 안에서 신규 업로드를 제한한다.
**Architecture:** 단일 정책 행 잠금 아래 바이트·일일 횟수를 원자적으로 예약한다. 기존 private bucket과 두 Edge Function을 확장하고, 실제 파일 삭제가 확인되어야 용량을 반환한다. 클라이언트는 서버 오류와 정확한 만료 시각을 표시한다.
**Tech Stack:** PostgreSQL migration/RPC, Supabase Storage/Edge Functions/Cron, Deno tests, React/TypeScript, Vitest, Playwright, Docker PostgreSQL 17.
**Spec:** [저장 예산 설계](../specs/2026-09-22-result-card-storage-budget-design.md)

## Global Constraints

- 신규 PNG 최대 1,000,000B; 기본 예약 상한 400,000,000B; 이미지 예산 500,000,000B. 모두 십진 단위다.
- 최근 24시간 계정당 예약 20회. 기본 48시간, 변경 시 신규 게시만 24시간. 기존 만료 시각 불변.
- 정리 5분, heartbeat 15분 초과 또는 inventory 24시간 초과/불일치 시 신규 생성 중지.
- 만료·삭제 실패·불명확한 업로드는 용량을 계속 차지한다. `storage.objects` SQL 삭제 금지.
- schema v5·protocol 5·앱 소유권·보존된 Account Map/locations·백업 계약 유지.
- 금액을 제외한 PNG 모델, 1080×1440 해상도, 글자 비율, 명시적 업로드, private Storage, token hash 유지.
- 운영 자격 증명은 서버에서만 사용하고 채팅·커밋·정적 빌드에 넣지 않는다.

## Review Focus

1. 남은 1MB에 동시 요청 두 개가 들어와도 하나만 예약한다. → Task 1 실제 DB 병렬 연결 테스트.
2. 성공 응답이 유실된 재시도가 새 파일·추가 quota·만료 연장을 만들지 않는다. → Task 2 멱등성 테스트.
3. 삭제 이후 늦게 끝나는 업로드와 계정 삭제가 장부에서 사라지지 않는다. → Task 3 지연·실패 주입 테스트.
4. 기존 큰 PNG나 100개 넘는 실패 backlog가 새 정책에서 조기 삭제·누락되지 않는다. → Task 3/5 이관·cursor 테스트.
5. 용량 차단·24시간 정책에서도 모바일 저장 대안과 정확한 만료 안내가 보인다. → Task 4 responsive E2E.

## 파일 구성과 작업 순서

| 작업 | 산출물 | 의존성 |
| --- | --- | --- |
| 1 | 새 migration, 원자적 예약·게시·삭제 완료 RPC, DB 테스트 | 없음 |
| 2 | 생성/열람 함수와 함수 테스트 | 1 |
| 3 | 정리·대조 함수와 장애 테스트 | 1, 2 |
| 4 | 공유 오류·기간·수신 화면, 클라이언트 테스트 | 2 응답 계약 |
| 5 | 운영 절차·이관·전체 검증 증거 | 1–4 |

### Task 1: 정책과 원자적 예약

**Files:**
- Create: `supabase/migrations/202609220001_result_card_storage_budget.sql`
- Create: `scripts/test-result-card-storage-db.mjs`
- Reference: `scripts/test-workspace-db.mjs`의 disposable Docker PostgreSQL 패턴. 기존 runner를 이미지 전용 fixture로 오염시키지 않는다.

**Interfaces:** service role 전용 RPC. UUID·hash·크기를 검증하고 고정 `search_path`와 명시적 권한 회수를 적용한다.

```ts
type ReserveStatus = 'reserved' | 'pending' | 'ready' | 'expired'
  | 'conflict' | 'daily_limit' | 'capacity_reached' | 'cleanup_unhealthy';
// SQL signatures; RPC returns jsonb with status and applicable fields only.
// reserve_result_card_share(p_owner_id uuid, p_request_id uuid,
//   p_token_hash text, p_content_sha256 text, p_byte_size bigint)
//   -> {status: ReserveStatus, id?: string, objectPath?: string,
//       expiresAt?: string, retryAt?: string}
// publish_result_card_share(p_id uuid)
//   -> {status: 'ready' | 'expired', expiresAt?: string}
// finish_result_card_delete(p_id uuid) -> boolean
```

- [ ] DB runner를 작성한다. `docker run --rm postgres:17`로 고유 이름 컨테이너를 만들고 `finally`에서 삭제한다. 원격 DSN은 받지 않는다. `auth.users`, anon/authenticated/service_role, `storage.buckets` fixture 후 기존 공유 migration과 새 migration만 실행한다. 저장 파일 자체의 검증은 Task 5에서 수행한다.
- [ ] 실제 독립 psql 연결 두 개를 동시에 실행하는 테스트를 먼저 추가한다. 각 1,000,000B 예약, capacity 1,000,000B, 깨끗한 정책 heartbeat/inventory를 fixture로 설정한다. 서버 함수가 없는 초기에는 실패를 확인한다: `node scripts/test-result-card-storage-db.mjs`.

```js
// runner's assertions after two concurrent RPC calls, parsed as JSON:
assert.deepEqual(results.map(r => r.status).sort(), ['capacity_reached', 'reserved']);
assert.equal(Number(sql("select coalesce(sum(byte_size),0) from public.result_card_shares where state <> 'deleted'")), 1_000_000);
```

- [ ] migration에 설계 §3의 필드·정책을 추가한다. 기존 행은 크기를 알기 전 0으로 간주하지 않는다. backfill 전 생성 비활성화/미대조 상태로 두고 nullable legacy 값이 남으면 예약을 거부한다. 기존 object path 정규식도 실제 유효/무효 경로 insert 테스트로 확인한다.
- [ ] bucket의 신규 업로드 제한을 `file_size_limit=1000000`으로 낮춘다. 이 설정 변경이 기존 큰 객체를 지우지 않는지 Task 5 실제 Storage 시험에 포함한다.
- [ ] 예약 RPC의 정책 행 잠금 → 기존 요청 검사 → 건강 상태 → quota → 총 바이트 → insert 순서를 구현한다. 동일 정책 잠금을 게시·삭제 완료 RPC에도 적용한다. 합계 기반으로 구현하여 실패한 트랜잭션이 바이트를 따로 차감하지 않게 한다.

```sql
select * into policy from public.result_card_share_policy where id = 1 for update;
select coalesce(sum(byte_size), 0) into charged
  from public.result_card_shares where state <> 'deleted';
-- Existing-request checks and health/quota guards precede this branch.
if charged + p_byte_size > policy.capacity_bytes then
  return jsonb_build_object('status', 'capacity_reached');
end if;
```

- [ ] 20회 경계 동시 요청, 다른 body/hash의 동일 요청, cleanup 15분/inventory 24시간 경계, deleted tombstone 유지, owner 삭제 시 경로 보존, 일반 사용자 RPC 접근 거부 테스트를 추가한다. 조회 index는 `(owner_id,created_at)`, 정리 대상 `state/expires_at/created_at`을 지원한다.
- [ ] 동일 DB 명령을 다시 실행해 통과를 확인하고 migration·runner만 커밋한다. 커밋 전 `git var GIT_AUTHOR_IDENT`가 `KIM JINHO <okho04@gmail.com>`인지 확인한다.

### Task 2: 업로드와 서버 응답

**Files:**
- Modify: `supabase/functions/result-card-share/index.ts`
- Create: `supabase/functions/result-card-share/index.test.ts`
- Create: `supabase/functions/_shared/resultCardShare.ts`

**Interfaces:**

```ts
export const MAX_RESULT_CARD_BYTES = 1_000_000;
export async function readLimitedPng(request: Request): Promise<Uint8Array>;
// Throws Response with 413/image_too_large, or 400/invalid_image.
// index.ts exports its request handler; Deno.serve only under import.meta.main.
// Handler tests stub outbound fetch for Auth, RPC and Storage, restore in finally.
```

- [ ] Deno tests에 Content-Length 누락/위조, chunked 합계 초과, 잘못된 PNG, 미인증 요청을 추가한다. `deno test --allow-env supabase/functions/result-card-share/index.test.ts`로 미구현 실패를 확인한다. 외부 fetch는 모두 stub하며 실제 Storage에 접속하지 않는다.

```ts
Deno.test('rejects a body over 1 MB before upload', async () => {
  const request = new Request('https://local.test/share', {
    method: 'POST', body: new Uint8Array(1_000_001),
  });
  let error: unknown;
  try { await readLimitedPng(request); } catch (caught) { error = caught; }
  if (!(error instanceof Response) || error.status !== 413) throw new Error('expected 413');
});
```

- [ ] 스트림 reader가 상한을 넘으면 cancel하고, 기존 signature/IHDR 검사와 SHA-256 계산을 수행한다. 인증 후 Task 1 RPC를 호출하고 `reserved`만 Storage upload를 한 번 실행한다. `upsert:false`를 유지한다.
- [ ] 상태를 HTTP로 변환한다: ready=201, pending=202, expired=410, conflict=409, daily_limit=429, capacity/health=503. 실패 body는 `{code}`, 429는 `retryAt`, 202는 `Retry-After: 3`을 제공한다. ready는 기존 `{token,expiresAt}`을 유지한다.
- [ ] 성공 응답 유실 후 재시도 시 upload 한 번·동일 expiresAt, pending 재시도 시 추가 upload 없음, 다른 body는 409, Storage timeout 시 예약 유지, 기한 후 publish 거부, owner 없는 GET 거부를 검증한다. body 읽기와 외부 요청의 timeout은 각각 30초로 두고, timeout을 삭제 완료의 증거로 취급하지 않는다.
- [ ] `deno check supabase/functions/result-card-share/index.ts`와 Deno tests를 통과시키고 생성 함수 변경을 커밋한다.

### Task 3: 실제 파일 삭제와 사용량 대조

**Files:**
- Modify: `supabase/functions/cleanup-result-card-shares/index.ts`
- Create: `supabase/functions/cleanup-result-card-shares/index.test.ts`
- Modify: Task 1 migration(미적용 시에만)과 DB runner. 적용 후 변경이 필요하면 새 migration으로 추가한다.

**Interfaces:** secret으로 인증한 POST만 허용한다. body 없음=cleanup, `{"mode":"inventory"}`=inventory. 응답은 `{processed,deleted,failed,unsettled,remaining,complete}` 집계만 제공한다. token/path를 공개하지 않는다. DB의 `finish_result_card_delete`는 `deleting`이면서 `upload_settled_at`이 있는 행만 deleted로 바꿀 수 있다.

- [ ] Deno fetch stub으로 삭제 500 오류, 삭제 성공 후 DB 실패, 동시 Cron, 105건 중 앞쪽 5건 실패 사례를 먼저 작성한다. `deno test --allow-env supabase/functions/cleanup-result-card-shares/index.test.ts`로 미구현 실패를 확인한다.
- [ ] 조건부 상태 갱신, 100건 cursor, 45초 처리 예산, Storage remove→부재 확인→RPC 순서를 구현한다. RPC 전에는 용량을 반환하지 않는다. complete는 모든 페이지 처리 완료 때만 true이며 실패한 행도 cursor를 진행한다.
- [ ] 정책 행에 cleanup/inventory cursor와 작업 세대를 저장한다. 45초 중단 후 다음 5분 호출에서 이어받고, 동시 호출은 조건부 세대 갱신으로 오래된 cursor를 덮어쓰지 못하게 한다. 시간 예산을 소진하는 앞쪽 실패 파일 때문에 뒤쪽 파일이 영구 대기하지 않는 테스트를 추가한다.

```ts
// After mocked Storage deletion fails, verify the externally observable contract:
const remainingBytes = rows.filter(row => row.state !== 'deleted')
  .reduce((sum, row) => sum + row.byte_size, 0);
if (remainingBytes !== initialBytes) throw new Error('failed deletion released capacity');
```

- [ ] 업로드 미완료로 15분 지난 예약을 deleting으로 바꾸고, 늦게 upload 응답이 와도 publish 불가·예약 바이트 유지·재업로드 불가를 테스트한다. upload 성공 뒤 DB 갱신 실패도 자동 반환하지 않는다.
- [ ] owner 삭제, 이미 없는 완결된 파일, 만료 전 1MB 초과 기존 파일, deleted 행의 24시간 보존을 DB runner와 함수 tests로 확인한다.
- [ ] inventory 모드에 Storage 전체 페이지 조회, 기존 행 byte_size backfill, 미확인 path/크기 차이 시 생성 중지를 구현한다. active pending을 한 번의 목록 부재로 해제하지 않는다. 모든 페이지 조회 성공·일치 때만 inventory 성공 시각을 갱신한다.
- [ ] heartbeat, 7일 집계·로그 정리를 추가한다. cleanup 성공, 대상 0건, 부분 실패, inventory 중간 실패의 시각 갱신 조건과 secret header 미설정·오류 시 401을 검증한다.
- [ ] DB runner, `deno check supabase/functions/cleanup-result-card-shares/index.ts`, 두 함수 Deno tests를 통과시키고 커밋한다.

### Task 4: 기간·실패 UX와 브라우저 자원 해제

**Files:**
- Modify: `src/journey/result-card/shareClient.ts`
- Modify: `src/portfolio/ui/PortfolioResultCardPreview.tsx`
- Modify: `src/portfolio/ui/PortfolioSummary.tsx`
- Modify: `src/journey/share/SharedResultPage.tsx`
- Modify: `tests/unit/journey/resultCardShareClient.test.ts`, `tests/account-workspace.spec.ts`
- Modify: `DESIGN.md`(승인된 설계대로 구현된 시점에 기간 안내 갱신)

**Interfaces:** 기존 `create(png, requestId, token, signal)`과 `{token,expiresAt}`을 유지한다. HTTP error code를 안내 문구로 변환하고 pending/expired를 UI에서 식별한다. 오류 타입은 `ResultCardShareError extends Error { code: string; retryAt?: string }`로 shareClient에서 export한다.

- [ ] Vitest에 413/429/503/202/410 응답 fixture를 추가한다. workspace를 보내지 않는 것, retryAt이 없으면 임의의 재개 시각을 표시하지 않는 것을 검증한다. `npm run test:unit -- tests/unit/journey/resultCardShareClient.test.ts`로 실패를 확인한다.
- [ ] 설계 §5의 문구와 상태를 구현한다. 1MB 초과를 클라이언트에서도 미리 안내하고 서버에서도 검사한다. 실패 후 현재 PNG 저장은 가능하게 한다. 202는 동일 request로 재시도하고, 410의 새 생성 동작에서만 request/token을 갱신한다.

```ts
// Error mapping contract in shareClient.ts:
const unavailable = '지금은 공유 링크를 만들 수 없어요. 이미지로 저장해 주세요.';
// capacity_reached and cleanup_unhealthy share one user-facing message.
```

- [ ] 생성 전 안내를 최대 2일, 성공 후 안내를 서버 expiresAt으로 통일하고 48h/24h를 모두 E2E로 확인한다.
- [ ] 수신 화면에 expiresAt timer와 visibilitychange 재검사를 추가한다. 만료·종료·교체 시 object URL 해제를 검증하고 Service Worker에 이미지나 token을 담은 응답이 저장되지 않는지 확인한다.
- [ ] 390px/768px/1280px에서 용량 실패→이미지 저장, pending→성공, 만료→새 생성, 금액 제외 흐름을 확인한다. overflow·overlay containment·focus·44px touch target·도표 가시성과 workspace revision 불변을 검증한다.
- [ ] `npm run check`, focused unit, `npx playwright test tests/account-workspace.spec.ts`를 통과시키고 커밋한다. 공유 저장·수신 route 영향을 포함한 전체 E2E는 Task 5에서 실행한다.

### Task 5: 운영 적용·통합 검증·인계

**Files:**
- Modify: `docs/supabase-account-setup.md`, `README.md`, `docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md`의 이미지 공유 범위
- Modify: `docs/superpowers/plans/2026-09-21-result-image-link-sharing.md`의 대체된 정책 표기
- Create: `supabase/config.toml`(로컬 Storage 통합 검증용 project 설정과 두 함수의 gateway JWT 설정)
- Create: `docs/superpowers/evidence/2026-09-22-result-card-storage-budget.md`

**Interfaces:** migration→backfill→Edge→Cron→활성화 적용 기록, 사용량 전후 비교, 테스트 결과, 미완료 항목. secret 자체를 커밋하지 않는다.

- [ ] 실행 환경의 Deno/Docker/Supabase CLI와 운영 접근 여부부터 확인한다. 현재 운영 접근이 없어 해당 부분을 완료로 취급하지 않는다. 인증된 관리 환경에서 작업하고 secret을 채팅에 요구하지 않는다.
- [ ] 로컬 설정을 만들고 `supabase start`, `supabase functions serve --env-file supabase/.env.local`로 시험 서버를 연다. `.env.local`은 Git에서 제외하고 로컬 CLI가 발급한 값과 로컬 전용 cleanup secret만 사용한다. config의 두 함수는 `verify_jwt=false`로 두되 POST 내부 인증과 cleanup secret 검증은 유지한다. 시험 후 `supabase stop`으로 종료한다.
- [ ] 로컬 실제 Supabase Storage에서 시험 PNG upload→expire→cleanup 후 Storage 목록·download로 부재를 검증한다. 함수 mock/SQL fixture 성공을 실제 파일 삭제 증거로 사용하지 않는다.
- [ ] `npm run check:ci`, 두 함수 `deno check`/`deno test`, DB runner, `npm run test:e2e`를 실행한다. UI 3개 폭의 이미지, quota 경합, 삭제 장애, DB 복구 결과를 evidence에 기록한다.
- [ ] 운영 신규 생성을 멈추고 현재 migration/함수/Cron/전체 bucket 사용량을 확인한다. 기존 공유를 보존하면서 새 migration을 적용하고 Storage 실제 byte_size를 backfill한다. 미확인 path는 해결 전까지 활성화하지 않는다.
- [ ] 일반 cleanup 5분과 inventory 하루 1회의 secret 보호 Cron을 등록한다. cleanup 2회 성공, 전체 inventory 성공, 삭제 장애 후 재시도를 기록한다. Cron 이력·집계의 7일 정리도 확인한다.
- [ ] 제한된 시험 계정으로 1MB 경계, 작은 시험 용량에서 거부, 48→24시간 변경 시 기존 링크 불변, 새 링크 기한, 미인증 열람, private 직접 접근 거부, workspace 불변을 확인한다. 시험 용량을 기본 400MB에서 다른 bucket분을 차감한 값으로 되돌리고 활성화한다.
- [ ] 실제 48시간이 지난 시험 링크의 거부와 이후 삭제를 기록한다. 시간 가속 시험만 했다면 이 항목은 미완료로 남긴다.
- [ ] 롤백은 생성 중지로 수행하며 읽기·정기 삭제·새 예약 장부를 유지한다. 미적용/적용/검증 완료를 구분해 README·PRD·운영 안내를 갱신하고 문서 링크·`git diff --check`를 확인한다.
- [ ] 최종 변경을 검토하고 커밋 작성자를 확인한 뒤 커밋한다. 사용자 실행 지시에서 요구한 통합·push까지 수행하고 적용 환경과 미해결 항목을 명시한다.

## 계획 자체 검토

- 설계 §2/3 → Task 1/2, §4 → Task 3/5, §5 → Task 4, §6 → Task 5.
- Review Focus 5건에 각 담당 작업의 실패 테스트를 배정했다.
- 현재는 문서 작성만 했다. 새 RPC·runner·함수 테스트는 이 계획에서 만들 대상이며 이미 실행 가능한 결과물로 취급하지 않는다.

## 실행 중 변경 기록

- inventory는 페이지별 Storage 목록 대신 service 전용 RPC에서 `storage.objects`를 읽기 전용으로 대조한다. 일관된 snapshot과 예약 잠금으로 페이지 이동 중 파일 추가·삭제로 인한 누락을 방지한다. 삭제는 여전히 Storage API만 사용한다.
- cleanup은 변경 가능한 만료 시각 대신 UUID 순서의 cursor로 계속 진행하고 전체 순회 후 실패분을 재방문한다.
- 실제 Edge Runtime에서 미소비 POST 조기 오류 응답이 지연되어, 본문을 제한된 스트림으로 읽은 뒤 PNG·JWT·헤더를 검사한다. 1MB 제한은 유지한다.
- 별도 PortfolioResultActions 파일이 없어 기존 PortfolioSummary의 문구를 갱신한다.
- 전역 CLI 설치 대신 `npx --yes deno`/`npx --yes supabase`를 사용하며 제품 의존성을 추가하지 않는다.
- 로컬 실제 Storage 검증은 `node scripts/test-result-card-storage-live.mjs`로 재현한다. localhost만 허용하며 운영 URL을 받지 않는다.
