# Portfolio 종합 이미지 저장·48시간 링크 공유 계획

**상태:** 2026-09-21 사용자 후속 요청을 반영해 제품 코드와 migration·Edge Function 원본을 구현했다. 원격 Supabase migration, 함수 배포, 정리 Cron과 실제 48시간 만료 증거는 아직 적용하지 않았다.
**기준 문서:** [전체 설계 §5.4/6](../specs/2026-09-21-responsive-overlays-and-result-card-design.md), [이미지 생성 C1~C4](2026-09-21-financial-result-image.md), [총괄 계획](2026-09-21-responsive-experience.md).
**목표:** Portfolio를 세 앱 결과의 마지막 보관·공유 지점으로 사용한다. 같은 3:4 이미지를 기기에 저장하거나, 로그인 없이 열리는 48시간 링크로 전달한다.

**2026-09-22 후속 적용:** 500MB 이미지 예산 요청에 따른 [저장 용량·자동 삭제 설계](../specs/2026-09-22-result-card-storage-budget-design.md)와 [실행 계획](2026-09-22-result-card-storage-budget.md)을 작성했다. 사용자 승인에 따라 구현·운영 적용했고 이 문서의 파일당 5MiB, 예약·정리와 기간 안내 계약을 대체한다. 아래 본문은 초기 계획 이력이며 현재 값은 후속 설계와 [운영 기록](../evidence/2026-09-22-result-card-storage-budget.md)을 따른다.

## 1. 사용자 경험과 디자인

기존 [이미지 디자인 예시](../evidence/2026-09-21-responsive-overlays/07-result-card-concept.png)의 종이색 배경, 월 자금 → 미래 자산 → 투자 배분 순서를 유지한다. 이미지 안에 앱 버튼을 넣지 않는다.

```text
포트폴리오 결과 / 전체 투자 대상 목록

        ↓ 저장하기       ↗ 공유하기
       공유 링크는 2일 뒤에 만료돼요.
```

- 결과 본문 끝의 중앙에 두 버튼을 동등한 강조로 가로 배치한다. 윤곽선·채움 배경·그림자는 없고 아이콘과 텍스트만 사용한다. focus ring, hover/pressed 상태, 각 44px 이상의 누름 영역은 유지한다.
- viewport 고정 footer나 추가 스크롤을 요구하는 숨김 영역은 만들지 않는다. 목록·배분 수정 버튼 뒤에 충분한 간격과 safe-area를 둔다.
- `저장하기`: 이미지 미리보기 → 금액 포함 여부 확인 → `이미지 저장`. 서버 업로드 없이 PNG 다운로드를 요청한다.
- `공유하기`: 같은 미리보기 → `링크를 가진 사람은 누구나 이 이미지를 볼 수 있어요.` / `공유 링크는 생성 후 2일 뒤에 만료돼요.` → `공유 링크 만들기`.
- 업로드 중 `링크 만드는 중…`을 표시하고 중복 제출을 막는다. 성공하면 URL과 `9월 23일 오후 3:20까지 볼 수 있어요`처럼 서버 만료 시각을 수신자의 현지 시각으로 표시한다. `링크 공유`와 `링크 복사`를 제공한다.
- Web Share는 준비된 URL만 전달한다. 이미지 생성·업로드 뒤 자동으로 공유 시트를 열지 않고, 다시 누른 `링크 공유`에서 호출한다. 미지원이면 복사를 기본 동작으로 쓰고, 복사 실패 시 선택 가능한 URL을 남긴다. 공유 시트 취소는 오류가 아니다.
- 최초 금액 옵션은 Portfolio 보기 설정을 따르며, export에서 바꿔도 원래 설정을 저장하지 않는다. 옵션 변경 후에는 예전 링크를 새 미리보기의 링크처럼 표시하지 않는다.
- 수신 화면은 이미지와 만료 안내만 보여준다. 계정 로그인·앱 편집·복원 없이 열린다. 만료/잘못된 링크는 `공유 기간이 끝났거나 사용할 수 없는 링크예요.`와 앱 홈 이동을 제공한다. 네트워크 오류는 만료와 구분해 재시도를 제공한다.

## 2. 선택한 구조와 대안

| 방식 | 특징 | 결정 |
| --- | --- | --- |
| PNG 파일을 기기 공유 | 서버가 필요 없지만 전달된 파일의 기간 제한이 불가능 | 로컬 저장만 유지 |
| Storage signed URL을 직접 공유 | 구현량이 작지만 만료 화면과 캐시까지 제어하기 어려움 | 이번 기본안에서 제외 |
| 앱의 공유 페이지 + 서버 만료 검사 + private 이미지 | 링크 UX, 서버 시각에 따른 48시간 차단, 삭제 재시도를 분리 가능 | 채택 |

브라우저에서 완성한 PNG만 Supabase에 올린다. 별도 렌더 서버나 workspace JSON 업로드는 없다. 공유는 생성 당시의 고정 이미지이며 이후 원본 계획 수정·로그아웃이 링크 내용을 바꾸지 않는다. 같은 링크를 다시 복사해도 만료 시각을 연장하지 않는다. 만료 후 새 공유는 새 링크를 만든다.

Supabase 공식 문서는 signed URL 만료와 CDN 캐시 수명이 별개임을 설명한다. 따라서 URL 만료만을 48시간 차단의 근거로 사용하지 않는다. [Storage 캐시 문서](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

## 3. 저장·열람·삭제 계약

- private bucket `result-card-shares`, 최대 `5 MiB`, `image/png`만 허용한다. 서버에서 실제 PNG signature/IHDR의 1080×1440 치수를 검사한다. MIME 문자열만 신뢰하지 않는다.
- 별도 `result_card_shares` 테이블에 내부 id, owner_id, token_hash, object_path, state(`pending`/`ready`), created_at, published_at, expires_at을 둔다. workspace·원화 수치·종목 이름은 메타데이터에 복제하지 않는다.
- 생성은 로그인한 사용자만 가능하다. JWT를 검증해 owner를 결정하고 client가 준 owner/만료 시각/path는 사용하지 않는다. private Storage와 테이블은 일반 anon/authenticated 직접 읽기·쓰기·목록 조회를 허용하지 않으며 함수의 서버 권한만 사용한다. service-role secret은 frontend에 넣지 않는다.
- 초기 제한은 계정당 24시간에 생성 예약 20회, PNG당 5 MiB로 둔다. 재시도는 같은 예약을 사용하며 요청 크기·quota를 업로드 전에 서버에서 검사한다. 제한 도달 시 다음 가능 시각과 로컬 저장을 안내한다.
- 브라우저는 공유 시도마다 암호학적 난수 32바이트의 base64url token을 생성한다. 서버는 SHA-256 hash만 저장한다. 이 token을 같은 세션의 재시도 식별자로 사용하고, 동일 owner+token의 완료 요청에는 기존 만료 시각을 반환한다. 다른 PNG를 같은 token으로 덮어쓰지 않는다. 서로 다른 owner의 중복 token 요청은 거부한다.
- 생성 순서: quota와 pending 예약을 DB에서 원자적으로 확보 → 임의 내부 경로에 PNG 업로드 → ready 전환과 서버 `published_at`, `expires_at = published_at + interval '48 hours'` 확정 → 링크 반환. ready 이전에는 열람되지 않는다.
- 공유 URL은 배포 base를 포함한 `apps/share/#<token>`으로 한다. token을 URL fragment에 두어 정적 호스팅 요청/Referer에 직접 포함하지 않는다. 열람 페이지는 token을 함수 요청의 별도 헤더로 보내고, 토큰·이미지·요청 본문을 analytics나 앱 로그에 남기지 않는다.
- 비로그인 read 함수는 token hash·ready·서버 현재 시각을 검사하고 private Storage에서 가져온 PNG bytes를 직접 반환한다. signed URL이나 public bucket 주소를 브라우저로 redirect/노출하지 않는다. Storage fetch 이후 응답 직전에도 만료를 검사한다.
- 이미지·실패 응답 모두 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`를 사용한다. 공유 HTML은 noindex를 설정하며 제3자 분석 스크립트를 넣지 않는다. 공유 API와 이미지 Blob은 service worker/runtime cache에 저장하지 않는다.
- 열려 있는 수신 페이지도 만료 시 Blob URL을 해제하고 이미지 제거 후 만료 안내로 전환한다. 백그라운드 복귀 시 서버에 재확인한다. 기기 시계는 최종 허용 판단에 사용하지 않는다.
- **48시간은 새 열람을 허용하는 기간이다.** 이미 저장한 파일·스크린샷·전달받은 사본은 회수할 수 없다. 서비스 저장 파일은 만료 후 Cron이 5분 간격으로 Storage API를 통해 삭제하고, 성공 후 metadata를 지운다. 정상 운영 시 삭제 목표는 만료 후 5분 이내이며 실행 지연·장애 시 다음 주기에 재시도한다. 삭제가 늦어도 서버 만료 검사로 열람은 차단한다.
- 15분 이상 된 pending 업로드도 같은 정리 작업에서 제거한다. 파일 삭제 실패 시 metadata를 남기고 재시도한다. 파일이 이미 없는 경우 삭제 성공으로 취급한다. SQL로 `storage.objects` 행만 지우지 않는다. [공식 삭제 계약](https://supabase.com/docs/guides/storage/management/delete-objects), [Cron 함수 호출](https://supabase.com/docs/guides/functions/schedule-functions).
- schema v5·protocol 5·Main/Simulation/Portfolio ownership, 보존 accountMap/locations, workspace revision과 backup format은 그대로 유지한다. 공유 데이터는 whole-workspace 백업에 포함하지 않는다.

## 4. 실행 순서와 변경 파일

C1/C2의 snapshot·redaction·PNG renderer를 먼저 완성한다. 아래 S1은 그와 독립적으로 서버 계약을 검증할 수 있고 S2는 완성 PNG와 S1에 의존한다. 공통 dialog는 A 결과를 사용한다. 구현 PR에는 이미지 exporter·공유 함수 원본을 포함하며, Create 목록의 서버 단위/integration test와 운영 적용은 남은 작업이다.

### S1. Supabase 공유 생성·만료·정리

**Create:** `supabase/migrations/202609210001_result_card_shares.sql`, `supabase/functions/result-card-share/index.ts`, `supabase/functions/cleanup-result-card-shares/index.ts`, `supabase/functions/_shared/resultCardShare.ts`, `supabase/functions/result-card-share/index.test.ts`, `supabase/functions/cleanup-result-card-shares/index.test.ts`, `scripts/test-result-card-share.mjs`, `supabase/config.toml`.

- [ ] 함수의 `POST` 생성은 JWT 필수, `GET` PNG 조회는 share token 필수, cleanup은 서버 전용 secret 필수로 나눈다. 게이트웨이의 JWT 검증을 끄는 공개 read 경로에서도 생성 분기의 인증을 생략하지 않는다. CORS allowlist는 배포 origin과 개발 origin으로 한정한다.
- [ ] 위 저장 계약·quota 예약·중복 요청·크기/PNG 검사·서버 clock을 구현한다. 오류에는 내부 Storage path나 owner를 반환하지 않는다.
- [ ] 함수 단위 테스트에 미인증 생성, 타인 token, 잘못된 PNG, 5 MiB 초과, quota 동시 요청, 중복 생성, upload 성공 후 DB 실패, 응답 유실 재시도를 넣는다.
- [ ] 만료 1ms 전 허용/정각 거부/1ms 후 거부, 느린 다운로드 도중 만료, pending 열람 거부, cleanup 실패 재시도·부분 성공·동시 실행을 고정 clock으로 검증한다.
- [ ] 로컬 또는 전용 테스트 Supabase에 fixture를 만들어 실제 RLS·private 파일 직접 접근 차단·Storage 삭제를 검증한다. 기존 workspace revision과 모든 slice가 동일한지 비교한다. 단위 mock만으로 DB 검증을 대체하지 않는다.
- [ ] `deno test --allow-env supabase/functions/result-card-share/index.test.ts supabase/functions/cleanup-result-card-shares/index.test.ts`와 신규 integration runner `node scripts/test-result-card-share.mjs`를 실행한다. runner는 전용 테스트 endpoint/계정 환경변수가 없으면 실패하며 운영 데이터를 테스트 대상으로 자동 선택하지 않는다.

### S2. Portfolio 하단 버튼과 공유 미리보기

**Create:** `src/journey/result-card/resultCardShareClient.ts`, `src/journey/result-card/shareResultCardLink.ts`, `tests/unit/journey/resultCardShareClient.test.ts`, `tests/unit/journey/shareResultCardLink.test.ts`.
**Modify/Create from C3:** `src/portfolio/ui/PortfolioApp.tsx`, `portfolio.css`, `PortfolioResultCardPreview.tsx`, `src/auth/productRepositories.ts`, `tests/portfolio.spec.ts`, `tests/result-card.spec.ts`.

```ts
interface ResultCardShareClient {
  create(png: Blob, token: string, signal: AbortSignal): Promise<{expiresAt: string}>;
}
// shareResultCardLink(url: string): Promise<'shared'|'cancelled'|'unsupported'|'error'>
```

- [ ] §1의 하단 두 버튼과 같은 미리보기의 save/share intent를 구현한다. `저장하기` 테스트에서는 Storage/function 호출이 0회여야 한다.
- [ ] source revision, 옵션 generation, 계정 identity가 일치하는 PNG만 생성 요청에 사용한다. 변경·로그아웃·닫기 후 늦게 도착한 응답은 UI에 연결하지 않는다. 이미 서버에 게시된 링크는 원래 TTL로 정리되며 취소가 게시 취소를 보장한다고 표시하지 않는다.
- [ ] 같은 PNG의 반복 클릭·네트워크 재시도는 같은 token을 재사용한다. 옵션/기준 revision 변경 시 token과 링크를 버리고 새 미리보기 확인 후 새 시도를 만든다. URL은 메모리에만 보관한다.
- [ ] 업로드 실패에는 `링크를 만들지 못했어요. 다시 시도해 주세요.`를 표시하고 PNG 저장을 유지한다. 만료된 인증이면 재인증, quota 초과이면 가능 시각을 구분한다.
- [ ] `navigator.share({url})`에 files/금융 text가 없는지, 미지원·취소·clipboard 거절·잘못된 서버 응답·늦은 요청 완료·금액 숨김 PNG 실제 bytes 업로드를 검증한다.
- [ ] `npm run check`, `npm run test:unit -- tests/unit/journey tests/unit/portfolio`, `npx playwright test tests/result-card.spec.ts tests/portfolio.spec.ts tests/account-workspace.spec.ts`를 실행한다.

### S3. 로그인 없는 수신 화면과 캐시 검증

**Create:** `apps/share/index.html`, `src/journey/share/main.tsx`, `src/journey/share/SharedResultPage.tsx`, `tests/result-card-share.spec.ts`.
**Modify:** `vite.config.ts`, 필요 시 `src/main/infrastructure/pwaRoutes.ts`와 관련 테스트.

- [ ] Vite MPA entry에 share 페이지를 등록하고 배포 base를 사용한다. `AccountWorkspaceGate` 밖에서 렌더하며 수신자의 계정 workspace를 조회하거나 수정하지 않는다. 새 금융 앱/launcher 목적지는 추가하지 않는다.
- [ ] token을 읽어 PNG를 fetch하고 Blob URL로 표시한다. 접근 가능한 이미지 설명과 원본 확대 보기, 서버 만료 시각, 로딩·만료·네트워크 실패 UI를 제공한다.
- [ ] 공유 페이지 HTML의 정적 캐시는 허용하되 token·이미지·함수 응답은 캐시하지 않는다. 기존 SW가 제어하는 재방문 환경과 시크릿 창 모두에서 48시간 경계와 오프라인 이미지 미복원을 확인한다.
- [ ] 390/768/1280px에서 overflow·이미지 전체 보기·44px target·focus 복귀를 검증한다. 로그인 없는 직접 URL 진입/새로고침, 원래 앱 로그인 사용자의 링크 열람, 여러 링크 탭을 검증한다.
- [ ] `npm run check`, `npx playwright test tests/result-card-share.spec.ts tests/app-journey.spec.ts` 실행 후 실제 배포 base의 직접 진입도 확인한다.

### S4. 통합·운영·문서 인계

- [ ] Main → Simulation → Portfolio → 금액 숨김/포함 PNG 저장 → 링크 생성 → 비로그인 열람 → 만료의 전체 흐름과 workspace 무변경을 검증한다.
- [ ] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=line`, `npm run build`, `git diff --check`를 수행한다. build는 버전 파일을 수정하므로 발생 diff를 별도로 확인한다.
- [ ] 운영 적용 단계에서 bucket private 설정, 함수 secret, CORS, Cron 등록/실행 권한, 캐시 응답 헤더를 확인한다. 실제 테스트 링크의 만료·자동 삭제 증거를 기록한다. 삭제 지연이 반복되면 expired 잔존 개수와 가장 오래된 expires_at만 운영 로그에 기록하고 token/금융 이미지 내용은 남기지 않는다.
- [ ] iOS Safari/Android Chrome에서 PNG 다운로드, URL 공유 시트/취소, 복사 fallback을 직접 확인한다. 메신저가 저장한 미리보기와 수신자가 저장한 사본은 회수 대상이 아님을 검증 한계에 기록한다. 개인정보 이미지의 동적 OG preview는 1차에서 만들지 않는다.
- [ ] PRD·README·DESIGN에 실제 지원 범위를 반영한다. 이번 계획 단계에서는 미래 제안으로만 연결한다. 원격 migration·함수 배포·Cron 운영 활성화 여부와 증거는 제품 구현과 구분해 인계한다.

## 5. 완료 기준과 다음 작업

두 하단 버튼이 보이고 동일 PNG를 사용하며, 저장은 업로드하지 않고 공유는 확인한 PNG만 게시해야 한다. 링크를 가진 비로그인 사용자가 생성 후 48시간 안에 볼 수 있고, 경계 이후 캐시·직접 파일 경로로 새 열람할 수 없어야 한다. 정리 작업은 실패 후 재시도하고 workspace를 바꾸지 않아야 한다.

다음 소유자는 이미지/공유 구현 담당자다. C1/C2에서 시작해 S1 → C3/S2 → S3 → C4/S4 순서로 연결한다. Supabase 프로젝트의 Cron 활성 상태·배포 권한은 이번 계획에서 조회하지 않았으며 운영 적용 전 확인한다. 여기의 wireframe은 배치 지시이고 구현 화면의 시각 검증 증거가 아니다.

## 계획 문서 검증

- 변경 문서 5개의 상대 링크 53개 존재 확인: PASS.
- `git diff --check`, 신규 계획의 `git diff --no-index --check /dev/null <file>` whitespace 검사: 오류 없음(no-index는 신규 파일 차이 때문에 exit 1).
- PRD의 Future Product Direction에만 제안을 연결하고 README·DESIGN의 현재 지원 상태와 구분했다. 기존 C 계획의 파일 공유·업로드 제외 조건은 이번 링크 공유 계약으로 갱신했다.
- 문서만 변경했으므로 타입/단위/E2E는 실행하지 않았다. 운영 Supabase·실기기·48시간 만료 검증은 구현 단계의 미완료 항목이다.
