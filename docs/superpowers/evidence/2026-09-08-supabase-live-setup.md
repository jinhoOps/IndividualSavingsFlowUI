# Supabase 실제 프로젝트 적용 기록

날짜: 2026-09-08. 대상 프로젝트: `fqongmuyfmxjqmefekbg`. 사용자는 기존 [계정 저장 설계](../specs/2026-09-07-supabase-account-workspace-design.md)에 따른 앱 개발뿐 아니라 Supabase 운영 적용도 직접 수행하도록 재확인했고, 전달한 DB 비밀번호의 이번 사용을 승인했다. 비밀번호 원문·인증 토큰·관리자 키는 이 기록이나 소스에 포함하지 않는다.

상태: 운영 DB의 세 migration 적용과 임시 계정 생성·실제 로그인 완료. hosted 환경에서 발견한 RPC 권한 차이를 보완한 뒤 실제 SDK·두 브라우저의 저장·조회 검증도 통과했다. Google provider 설정과 Pages 배포는 미수행이다.

## 연결과 사전 점검

- Direct DB hostname은 IPv6 주소만 반환했고 현재 작업 환경에서 연결할 수 없었다. 공식 연결 방식에 따라 서울 리전 session pooler `aws-0-ap-northeast-2.pooler.supabase.com:5432`를 사용했다.
- `postgres.fqongmuyfmxjqmefekbg` 사용자와 `postgres` database로 연결했다. [공식 Supabase Root CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)를 사용해 TLS 인증서와 호스트명 검증을 유지했다. TLS 검증 우회나 원격 SSL 정책 변경은 없었다. [연결 문서](https://supabase.com/docs/guides/database/connecting-to-postgres)
- PostgreSQL은 17.6이며 migration 실행 역할 `postgres`는 비-superuser, `CREATEROLE=true`였다. `en-US-x-icu`, `pg_catalog.sha256(bytea)`, `extensions.pgcrypto`를 확인했다.
- 적용 전 제품 public table·private schema·migration history가 없었다. 기존 금융 데이터를 덮어쓰는 변환이나 삭제를 수행하지 않았다.
- 대상 이메일의 기존 Auth 사용자·identity와 비내부 Auth trigger가 없음을 확인했다. Auth schema migration 최신값은 `20260625000000`이었다.

## DB 적용

다음 두 원본 migration을 advisory lock과 timeout이 있는 한 transaction에서 적용하고 `supabase_migrations.schema_migrations`에 기록했다. PostgREST schema reload도 요청했다.

| Version | Migration | SHA-256 |
| --- | --- | --- |
| `202609070001` | [workspace validation](../../../supabase/migrations/202609070001_workspace_validation.sql) | `8cdea1489cd40028390d6e4acb6f38c09478097cad3fe05a5a904b30f6a8e1cd` |
| `202609070002` | [account workspaces](../../../supabase/migrations/202609070002_account_workspaces.sql) | `f8bc1094cf210f05f7acd578710d2f2aaeed7ff5e9738bc36791656da77d8167` |

`public.user_workspaces`와 `private.workspace_mutations` 모두 RLS enabled/forced를 확인했다. 적용 전 REST 조회의 HTTP 404 / `PGRST205`는 테이블 생성 후 해소됐다.

첫 실제 RPC 검증에서 전용 함수 역할의 `auth` schema 접근이 hosted 권한 구성과 달라 `42501`이 발생했다. hosted `postgres`에는 관리형 `auth` schema의 `USAGE`를 새 역할에 위임할 권한이 없어, 초기 migration의 grant만으로는 전용 역할이 `auth.uid()`를 호출할 수 없었다.

추가 [request identity migration](../../../supabase/migrations/202609080001_workspace_request_identity.sql)은 `private.request_uid()`가 PostgREST의 인증된 요청 claim에서 기존 `auth.uid()`와 같은 우선순위로 UID를 읽도록 한다. 전용 RPC 역할의 두 RLS 정책과 mutation의 UID 초기화만 교체하고 일반 authenticated SELECT 정책, RPC signature·본문의 나머지 검증·잠금·revision·receipt 계약을 유지한다. helper는 `SECURITY INVOKER`, 빈 `search_path`이며 PUBLIC·anon·authenticated·service_role 실행을 회수하고 전용 RPC 역할만 허용한다. 관리형 schema 권한이나 BYPASSRLS를 열지 않는다.

추가 migration version은 `202609080001`, SHA-256은 `f677aa80ea3ce650de7b5d60ede5bdd8b17342816442241fbb181e436a08d9cc`다. 로컬에서 managed `auth` schema의 grant 제약을 재현하는 실패를 확인한 뒤 수정 migration을 포함한 123 fixture와 RPC 검증이 통과했다. 원본을 운영 DB에 적용·commit하고 migration 이력과 PostgREST schema reload를 반영했다. 해당 구현 commit은 `38e94d3`이다.

실제 authenticated 역할의 초기화 SQL은 `saved`, revision 0을 반환했다. 이 진단 transaction은 rollback해 대상 계정의 workspace가 여전히 0행임을 확인했다. 전용 RPC 역할의 `auth` schema 접근도 계속 불가하므로 광범위 권한 부여로 우회하지 않았다. 최종 검증에서 세 migration 모두 운영 이력에 저장한 SQL의 SHA-256과 저장소 원본이 일치했다.

## 임시 계정

- 대상은 `okho04@gmail.com`이다. 기존 사용자가 없음을 확인한 뒤 확인 완료 email 사용자와 email identity를 한 transaction으로 생성했다.
- Auth Admin API의 secret/service-role key가 없어 DB 권한으로 현재 `auth.users`·`auth.identities`의 컬럼·생성 컬럼·trigger를 확인한 일회성 운영 경로를 사용했다. 비밀번호는 bound parameter로 전달하고 `extensions.crypt`/bcrypt로 hash했다. 이 경로를 앱이나 일반적인 계정 생성 방식으로 추가하지 않았다.
- Google provider identity나 가짜 JWT를 만들지 않았으며 전역 이메일 자동 확인 설정도 바꾸지 않았다. 공개 Auth 설정은 Email 활성, Google 비활성 상태였다.
- 실제 `/auth/v1/token?grant_type=password`와 `/auth/v1/user`가 HTTP 200을 반환했고 같은 사용자 ID를 확인했다. 비밀번호 인증 세션으로 본인 workspace REST SELECT도 HTTP 200과 빈 결과를 반환했다. 확인용 세션의 local logout은 HTTP 204였다.
- 계정 생성만으로 금융 workspace를 만들지 않았다. 최초 브라우저 계획 가져오기/새 시작은 사용자가 선택한다. 기존 브라우저의 로컬 원본은 읽거나 변경하지 않았다.

## 실제 프로젝트 검증

원격 운영 점검 스크립트는 종료 코드 0으로 완료했다. 앱과 동일한 Supabase SDK를 실제 프로젝트에 연결했고 HTTP fixture로 대체하지 않았다. 금융 데이터의 확정 저장은 이번 검증이 만든 일회성 계정에만 수행했다.

- [공유 fixture](../../../supabase/tests/workspace-fixtures.mjs)의 validator 판정 123개를 실제 PostgreSQL에서 확인했다.
- 실제 REST 경계로 `initialize_workspace`·`save_main`·`save_simulation`·`save_portfolio`·`save_account_map`·`restore_workspace`를 호출했다. 최초 생성은 revision 0이며 같은 계정의 두 번째 초기화는 `exists`였다.
- 같은 mutation 재시도는 revision을 추가로 올리지 않았다. 오래된 revision 저장은 `conflict`, 같은 revision의 동시 저장 두 건은 한 건 `saved`·한 건 `conflict`였다. 잘못된 location 참조는 `invalid`이며 기존 revision을 유지했다. 전체 복원까지 revision 6을 확인했다.
- 검증 계정은 본인 행만 조회했다. 별도 실제 사용자 `okho04@gmail.com`의 세션에서 검증 계정 UUID를 지정한 조회는 빈 결과였다. anon의 SELECT/RPC와 authenticated의 직접 INSERT/UPDATE/DELETE는 거절됐다.
- 실제 프런트엔드를 로컬 Vite의 `/IndividualSavingsFlowUI/` base로 실행하고 독립 Chromium 브라우저 문맥 세 개를 사용했다. 첫 두 문맥은 같은 검증 계정으로 비밀번호 로그인했고 첫 화면의 저장 후 월 소비 `250원`을 두 번째 문맥의 focus 갱신과 첫 문맥의 reload에서 확인했다. Main·Simulation·Portfolio·Account Map의 제품 shell도 열렸다.
- 세 번째 문맥은 실제 `okho04@gmail.com`의 로그인 폼으로 인증해 최초 계획 선택 화면과 계정 이메일을 확인한 뒤 로그아웃했다. 최종 DB 확인에서 대상 계정의 workspace는 여전히 0행이었다. 사용자 대신 가져오기/새 시작을 선택하지 않았다.
- 초기 실패와 최종 smoke가 각각 만든 검증 계정은 정확한 사용자 ID와 생성 이메일을 함께 조건으로 정리했다. 최종 검증 계정의 workspace와 mutation receipt가 cascade로 0행임을 확인했다. 사용자 계정과 기존 브라우저 원본은 삭제하지 않았으며 임의의 검증 금융 데이터도 남기지 않았다.

## 이번 변경의 저장소 검증

- `node scripts/test-workspace-db.mjs`: 운영과 같은 auth schema 재위임 불가 조건에서 기존 초기화의 `42501` 실패를 재현한 뒤, 추가 migration 적용 후 123개 TS/SQL fixture와 전체 RPC·RLS·revision·receipt·동시 저장·rollback 검증 통과. JWT claim 누락·우선순위·잘못된 JSON/UUID와 private helper 권한도 확인했다.
- `npm run check`, `npm run check:harness`: 통과. mutation 본문은 UID reader 한 곳 외에 이전 원본과 동일함을 별도로 비교했다. 독립 리뷰에서 추가 migration의 보안상 차단 이슈는 없었다.
- `npm run test:e2e -- --reporter=list`: 150개 통과, 1개 실패, 기존 PWA 전용 1개 skip. 계정 저장 `cloud` 프로젝트의 21개는 모두 통과했다. 전체 성공으로 기록하지 않는다.
- 실패는 `tests/main-react.spec.ts:1327`의 로컬 repository Main 화면 편집기 viewport 경계 검사(`:635`)다. 이 경로는 Supabase를 사용하지 않는다. `npx playwright test tests/main-react.spec.ts:1327 --project=chromium --repeat-each=3 --reporter=list --output=/tmp/isf-main-responsive.GO1qZu --trace=on` 재검증은 3회 모두 통과했고 각 실행에서 390px·768px·1280px를 확인했다. 최초 실패 원인은 확정하지 못했으며 관련 UI/테스트 코드는 변경하지 않았다. 후속 재현 시 Main UI/QA 담당자가 위 명령부터 확인한다.
- 수정 문서 상대 링크 70개, `git diff --check` 통과. DB 비밀번호·임시 로그인 비밀번호가 변경 파일이나 `.env.local`에 포함되지 않았음을 확인했다. 기존 사용자의 `package-lock.json` 변경은 보존하고 커밋에서 제외했다.

전체 단위 테스트·production build·실제 PWA 런타임은 이번 SQL/운영 작업에서 다시 실행하지 않았다. 이전 결과는 [임시 로그인 구현 검증](2026-09-08-temporary-password-login.md)과 [계정 저장 개발 검증](2026-09-07-supabase-account-workspace.md)을 따르며 위 재실행 결과와 구분한다.

## 운영 후속과 제한

- Google provider·OAuth Client·callback allowlist는 설정하지 않았다. 실제 Google 왕복과 임시 로그인 전후 동일 UID·workspace 확인은 후속 작업이다.
- GitHub Pages 공개 변수 등록·push·배포는 수행하지 않았다. 로컬의 무시되는 `.env.local`에는 공개 URL/publishable key만 있고 비밀번호는 없다.
- 실제 원격 세션 만료를 강제한 재인증, 운영 배포의 30초 polling·다중 탭 로그아웃은 이번 live smoke 범위가 아니다. 기존 fixture E2E의 해당 동작 검증을 운영 통과로 바꿔 기록하지 않는다.
- 운영자는 사용자 승인대로 이번 작업에 사용한 DB 비밀번호를 교체한다. 임시 로그인 비밀번호도 Google 전환 검증 후 교체한다.
- 다음 운영 작업의 시작 문서는 [운영 안내](../../supabase-account-setup.md)다. 계정 생성만으로 사용자 계획을 자동 업로드하지 않고, rollout 장애 시 이전 로컬 writable 배포로 되돌려 두 원본을 만들지 않는다.
