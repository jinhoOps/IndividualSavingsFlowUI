# 커뮤니티 검색·필터·정렬 구현 계획

**상태:** 2026-09-28 구현·로컬 검증 및 운영 DB/job 적용 완료. 프런트 PR/Pages 출시 확인 중.

**실행:** native 방식으로 순차 진행한다. Task 1~3 검색·필터와 Task 4 정렬을 순차 구현하고 대화와 한 프런트 출시로 통합한다. [대화·알림 계획](2026-09-28-community-conversation.md) 이후 실행을 추천하며 선행 출시 없이 탐색부터 진행할 경우 알림 슬롯은 추가하지 않는다.

**목표:** 많은 카드에서 원하는 비율 구성을 찾고, 페이지 이동·상세 복귀·30초 갱신에도 맥락을 유지한다.

**구조:** 새 서버 검색 RPC와 조건별 커서를 추가한다. 공감/댓글 정렬은 작은 공용 집계의 세대별 커서로 구현한다. 프런트는 현재 조건·페이지 묶음·초점을 관리하고 실제 조회/정렬은 서버가 담당한다.

**기술:** 기존 React/TypeScript, Supabase PostgreSQL/RLS, 공통 ResponsiveDialog, Vitest/Playwright. 기본 검색은 기존 PostgreSQL 기능으로 시작한다.

**설계:** [대화·탐색 확장 설계](../specs/2026-09-28-community-conversation-discovery-design.md) §6~9.

## 공통 제약

- 로그인 사용자·공개된 비율/구간만 조회한다. workspace·실제 자산액·Auth UID를 검색에 넣지 않는다.
- 게시물 최대 5,000개, 한 번에 12개·서버 13개 조회, 최대 DOM 120개 후 묶음 이동.
- 검색은 1~80자 부분 문자열, NFC/영문 소문자/공백 정리, `% _ \\`는 문자 그대로, IME 완료 후 350ms.
- 최근 수정순 기본. 필터는 전체/내 공유, 최근 수정 전체/7일/30일, 현금 포함, 공개 자산 구간/미공개.
- 공감 많은 순은 distinct 사용자, 댓글 많은 순은 살아 있는 원댓글+답글 합계. 수익률·추천 순위로 부르지 않는다.
- 정렬 집계는 15분·최신 2세대·최대 10,000행. DB 400MiB 신규 저장 차단, 기존 데이터/백업/Storage 계약 유지.
- 읽는 목록의 순서·초점·스크롤·댓글 draft를 30초 갱신으로 바꾸지 않는다.

## 집중 검토할 다섯 가지

1. 한 글자 `금`, `a@b`, `%`, NFC 한글, 붙여넣은 SQL/HTML: literal 검색이며 실행되지 않음 — Task 1/2.
2. 같은 시각/공감 수의 카드와 페이지 사이 등록·삭제·수정: 중복 방지, 변화한 항목과 안정된 항목 구분 — Task 2/4.
3. 검색 A의 응답이 B 뒤에 도착하거나 계정 변경: 다른 조건/계정 결과를 합치지 않음 — Task 3.
4. 정렬 세대 만료·집계 job 실패: 기존 목록 유지, 명시적 새 순서 진입 — Task 4.
5. 상세/OAuth/모바일 필터 복귀, 120개 묶음 경계: 조건·스크롤·안전한 URL·touch/focus 유지 — Task 3/5.

## Task 1. 조회 조건·커서·URL 계약

**파일:** 새 `src/lounge/domain/discovery.ts`, `tests/unit/lounge/discovery.test.ts`. 현재 publication/assetBand parser를 재사용한다.

**인터페이스:** 이후 UI/DB는 아래 한 모델을 사용한다. `AssetBand`는 `src/lounge/domain/assetBand.ts`, `Publication`은 기존 publication 모델이다.

```ts
export interface FeedQuery {
  q:string; scope:'all'|'mine'; period:'all'|'7d'|'30d';
  hasCash:boolean; assetBands:Array<AssetBand|'hidden'>;
  sort:'updated'|'reactions'|'comments';
}
export interface FeedCursor {
  v:1; queryKey:string; asOf:string; epoch:string|null;
  last:{id:string; updatedAt:string; score:number|null};
}
export type FeedPage = {
  status:'ok'; items:Publication[]; nextCursor:FeedCursor|null;
  asOf:string; rankedAt:string|null;
} | {status:'cursor-expired'|'ranking-unavailable'};
export function parseFeedQuery(value:unknown):FeedQuery|null;
export function feedQueryFromSearch(search:string):FeedQuery;
export function feedSearchParams(query:FeedQuery):URLSearchParams;
export function feedQueryKey(query:FeedQuery):string;
export function parseFeedPage(value:unknown):FeedPage|null;
```

- [x] 먼저 query parser/URL 왕복 테스트를 작성한다. unknown sort/extra field/81자/control characters는 거부하고, URL의 모르는 키는 drop한다. queryKey는 정렬된 자산 구간까지 포함한다.

```ts
const query={q:'금',scope:'all',period:'all',hasCash:false,assetBands:[],sort:'updated'} as const;
expect(feedQueryFromSearch(feedSearchParams({...query,assetBands:[]}).toString())).toEqual(query);
expect(parseFeedQuery({...query,sort:'return-rate'})).toBeNull();
expect(parseFeedQuery({...query,q:'x'.repeat(81)})).toBeNull();
expect(parseFeedQuery({...query,q:"%_'; DROP TABLE x; --"})).not.toBeNull();
```

- [x] `npx vitest run tests/unit/lounge/discovery.test.ts`로 실패 확인 후 구현한다. q는 SQL 문법으로 해석하지 않으므로 문법처럼 보이는 텍스트도 길이/제어문자 기준만 통과하면 허용한다.
- [x] unit과 `npm run check`를 통과시키고 커밋한다. 작성자는 `KIM JINHO <okho04@gmail.com>`을 사용한다.

## Task 2. 서버 검색·필터·최근 수정순 커서

**파일:** 새 `supabase/migrations/202609280008_lounge_discovery.sql`, `scripts/verify-lounge-discovery-db.mjs`. 수정 `scripts/test-workspace-db.mjs`, `src/lounge/infrastructure/loungeRepository.ts`, repository unit. 번호 충돌은 구현 시작 시 확인한다.

**인터페이스:** `search_lounge_portfolios(p_query jsonb, p_cursor jsonb default null) -> FeedPage`; repository는 `search(query:FeedQuery,cursor?:FeedCursor):Promise<FeedPage>`를 제공한다. 기존 `list()`는 기존 소비자를 위해 유지한다.

- [x] 25개 동일시각·다른 ID 카드, 여러 공개 구간/미공개, `금`·`VOO`·닉네임 fixture로 DB assertions를 먼저 추가한다. 현재보다 큰 5,000개 fixture 성능 검증은 Task 5에서 실행한다.
- [x] JSON key/enum/문자수/자산 구간을 서버에서 검증한다. 문자열 검색은 정규화된 각 필드에 `strpos(field, q)>0`를 적용한다. 종목명은 최대 10개 배열 항목에서 검사한다. 사용자가 입력한 SQL·wildcard·정규식을 실행하지 않는다.

```sql
-- 최근 수정순의 페이지 경계. 필터를 적용한 동일 query에서만 사용한다.
where p.updated_at <= as_of
  and (before_time is null or (p.updated_at, p.id) < (before_time, before_id))
order by p.updated_at desc, p.id desc
limit 13;
```

- [x] 첫 조회 asOf를 서버가 만들고 다음 페이지 기간 기준도 같은 asOf를 사용한다. 커서는 queryKey/asOf/시간/ID/score 형태를 검증한다. 최근 수정순 커서는 최대 24시간까지 허용하며 미래 시각을 거부한다. ID는 인증 권한을 대신하지 않는다.
- [x] 최근 수정 7일/30일은 asOf 기준이다. assetBands 안은 OR, 서로 다른 조건은 AND, hidden은 null, hasCash는 `cashShareUnits>0`으로 정의한다. name 기반 추정 자산군 필터는 넣지 않는다.
- [x] 서버에서 13번째 행 존재 여부로 nextCursor를 만들고 응답 12개를 제한한다. 변경되지 않은 같은 조건의 데이터는 전체 순회 시 정확히 한 번씩 나오게 한다. 페이지 시작 후 수정된 글은 다음 새 탐색에서만 재등장한다.

```text
25개 동일시각 카드 => 12 / 12 / 1 / nextCursor=null
VOO가 2페이지 위치의 종목에만 있음 => 첫 검색 응답에 포함
assetBand hidden 조건 => null만, 실제 Simulation 금액 조회 0
조건 A 커서를 조건 B에 사용 => invalid
페이지 사이 새 카드 추가 => 현재 asOf 탐색 제외, 새 탐색 포함
페이지 사이 이전 카드 수정 => 중복 0, 새 탐색에서 최신 위치
```

- [x] 기존 authenticated/RLS/직접 테이블 접근 차단을 유지한다. SQL과 repository의 status/error mapping을 `node scripts/test-workspace-db.mjs`, focused unit으로 검증하고 커밋한다.

## Task 3. 검색·필터 도구 영역과 읽기 위치 보존

**파일:** 새 `src/lounge/ui/DiscoveryToolbar.tsx`, `src/lounge/ui/usePublicationFeed.ts`, `tests/unit/lounge/usePublicationFeed.test.tsx`. 수정 `LoungeApp.tsx`, `refreshPublications.ts`, `lounge.css`, `src/auth/auth.ts`, `tests/unit/auth/auth.test.ts`, `tests/account-workspace.spec.ts`, `tests/support/loungeCommunityFixture.ts`.

**소유권:** toolbar는 입력/필터 초안, feed hook은 적용된 query·cursor·페이지 묶음·요청 세대·스크롤 복원 위치, LoungeApp은 dialog와 공유 action을 소유한다. 기존 load/refresh를 무관한 앱까지 리팩터링하지 않는다.

- [x] `Lounge discovery` E2E와 hook unit을 먼저 작성한다. 입력 조합, 350ms, Enter, clear, 이전 요청이 늦게 완료되는 경우, 전체/내 공유 전환, 오류에서 기존 목록 보존을 포함한다.
- [x] 한 줄 검색과 오른쪽 정렬/필터, 적용된 조건 칩/초기화를 구현한다. 첫 출시 정렬은 `최근 수정순`만 제공하고 미구현 정렬을 활성 메뉴로 노출하지 않는다.
- [x] 필터는 ResponsiveDialog에서 apply/cancel 모델로 구현한다. 목록 화면에서 실제 금액·수익률·확신할 수 없는 자산군 기준을 추가하지 않는다.
- [x] 처음 120개는 12개 더 보기로 쌓는다. 121번째부터 다음 120개 묶음으로 교체한다. 메모리에는 현재 묶음과 방문한 묶음의 시작 커서만 보관한다. 이전 묶음은 커서로 다시 읽고, 세대가 만료되면 명시적 재시작을 제공한다.
- [x] URL에 q/scope/period/cash/band/sort를 allowlist로 저장한다. `post`/`comment`는 따로 유지하고 dialog 닫기 시 그 두 키만 제거한다. OAuth와 외부 브라우저 반환도 허용된 조건·UUID만 전달한다. token/fragment/외부 redirect는 폐기한다.
- [x] 상세를 닫으면 같은 card DOM/scroll/focus를 유지한다. 브라우저 뒤로/앞으로는 조건 변경을 복원하되 매 글자 history를 만들지 않고 적용된 검색에서만 기록한다. 새로고침은 조건과 첫 페이지만 복원한다.
- [x] 30초 갱신은 현재 조건과 요청 세대를 검사한다. first batch/top/비조작 상태의 기본 최근 수정순만 안전하게 교체한다. 검색·다중 페이지·정렬/필터·입력 중에는 숫자와 알림만 갱신한다.

```text
검색 A 요청 중 B 적용, A가 나중 도착 => B 카드만 표시
필터 열기→변경→취소 => 기존 query/cards/scroll 동일
12→24개 읽기→상세→닫기 => 24개·기존 위치·카드 초점 동일
120→다음 묶음→이전 => DOM 120개 이하, cursor 기준 일관
poll 중 조건 변경 => 이전 조건 응답 폐기
```

- [x] `npx vitest run tests/unit/lounge/usePublicationFeed.test.tsx tests/unit/auth/auth.test.ts` 및 `npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'Lounge discovery'`를 통과시킨다. 390/768/1280 UI·44px·키보드·빈 결과를 직접 확인한다.
- [x] Task 5의 공통 출시 gate를 적용해 검색·필터만 먼저 배포 가능하게 커밋한다.

## Task 4. 공감순·댓글순과 정렬 세대

**파일:** 새 `supabase/migrations/202609280009_lounge_ranking.sql`, `supabase/operations/lounge-ranking-cron.sql`, `scripts/verify-lounge-ranking-db.mjs`. 수정 discovery RPC의 구현, `DiscoveryToolbar.tsx`, feed hook, DB harness, 관련 unit/E2E.

**인터페이스:** FeedQuery/FeedPage의 기존 `reactions|comments`, epoch/rankedAt 필드를 사용한다. 데이터 응답 형식을 다시 바꾸지 않는다.

- [x] 여러 emoji를 누른 1명과 1종씩 누른 2명, 댓글/삭제 자리, 동점 fixture를 먼저 만든다. 두 세대가 겹치는 페이지 이동·만료·동시 job을 DB에서 검증한다.
- [x] private 집계는 `epoch, post_id, updated_at, unique_reactors, live_comment_count`만 저장하고 `(epoch, post_id)` UNIQUE를 둔다. FK로 삭제 게시물은 즉시 제외한다. 모든 세대 합계는 10,000행 이하로 유지한다.
- [x] 15분 job은 advisory lock으로 중복 실행을 막고 한 transaction에서 두 번째로 오래된 세대 삭제 → 새 세대 작성 → 현재 세대(max(epoch)) 전환을 처리한다. 중간 상태를 클라이언트가 읽으면 안 된다. 사용자별 검색어·결과·본문은 저장하지 않는다.
- [x] 정렬은 snapshot score DESC + snapshot updated_at DESC + post_id DESC다. 점수는 current community count와 분리한다. query의 검색·공개 조건을 적용하되 새로 등록된 글은 다음 집계에서 정렬 후보에 들어간다. 이후 수정된 글은 해당 집계에서 제외하고 다음 세대에 반영한다.
- [x] job 실패·공간 부족이면 이전 세대 유지, 0세대면 ranking-unavailable, 오래된 커서면 cursor-expired를 반환한다. 클라이언트는 카드를 보존하고 `최신 순서로 다시 보기`로 query를 새로 시작한다.

```text
A: 좋아요+하트(1명), B: 좋아요(2명) => B가 먼저
동점 25개 => ID까지 정렬, 12/12/1 중복·누락 0
첫 페이지 후 공감 변경 => 숫자 갱신, 위치·다음 커서 유지
epoch1 탐색 중 epoch2 작성 => epoch1로 계속 조회
epoch3 작성으로 epoch1 제거 => cursor-expired, 자동 초기화 0
job 실패 => 이전 pointer/집계 동일, 읽기는 가능
댓글 root tombstone+살아 있는 답글 2 => score=2
```

- [x] `node scripts/test-workspace-db.mjs`, discovery 관련 unit/E2E, 숫자 갱신과 순서 보존을 검증한다. 정렬 메뉴 설명에 집계 시점을 표시하고 `인기 추천/수익률순` 같은 표현을 쓰지 않는다.
- [x] 집계 job/세대 정리 SQL과 read 권한을 검토 후 커밋한다.

## Task 5. 규모 검증·단계별 출시

**파일:** PRD·DESIGN·현재 커뮤니티 spec, `docs/supabase-account-setup.md`, 새 `docs/superpowers/evidence/2026-09-28-community-discovery.md`.

- [x] disposable 로컬 DB에 최대 5,000 게시물·20,000 댓글·100,000 반응을 구성한다. `EXPLAIN (ANALYZE, BUFFERS)`와 준비 후 20회 쿼리의 p95를 환경과 함께 기록한다. 초기 SQL 실행 목표는 p95 200ms 이내이며 실제 운영 네트워크 성능 보장과 구분한다.
- [x] 대상은 전체 최근순, 한 글자 `금`, 티커, 미공개 구간, 다중 필터, 공감/댓글 정렬 후반 커서다. 인덱스/집계 크기·최대 DB 증가량·15분 job 시간을 함께 기록한다.
- [x] 검색이 목표를 넘으면 먼저 계획과 읽은 행 수를 확인한다. 그때만 정규화 검색 컬럼+pg_trgm 후보를 비교한다. 한 글자 검색을 삭제하거나 외부 검색 서비스를 즉시 도입하지 않는다. 추가 인덱스는 migration·용량 검증과 같이 커밋한다.
- [ ] 검색·필터와 정렬 각각 출시 전 `npm run check:ci`, `node scripts/test-workspace-db.mjs`, `npx vite build`, `npx playwright test`, 문서 링크·`git diff --check`를 통과시킨다. UI는 390/768/1280·200% 확대·44px·focus·sheet containment를 확인한다.
- [x] 구현된 기능만 README/PRD/DESIGN에 현재 기능으로 적는다. 이름 추정 자산군 필터·번호 페이지·가상 스크롤·팔로우/개인화는 미구현 상태로 남긴다. 필요성은 실제 결과/성능으로 다시 판단한다.
- [ ] 검색 출시: 기존 데이터 비교 → migration008/RPC 권한·v2 호환 검증 → 프런트/CI/Pages → 운영 읽기 확인. 정렬 출시: migration009 → 첫 집계/cron 실행 성공·행/용량 확인 → UI 활성화 → 운영 읽기 확인.
- [x] 정렬 장애 시 정렬 메뉴/cron만 비활성화하고 최근 수정순을 제공한다. 검색 장애 시 이전 프런트/list RPC로 복귀한다. 사용자 게시물·대화·workspace를 rollback 용도로 삭제하지 않는다.
