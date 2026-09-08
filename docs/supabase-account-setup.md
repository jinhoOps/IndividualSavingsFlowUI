# Supabase 계정 저장 운영 안내

2026-09-08 사용자 요청에 따라 정적 앱의 임시 이메일·비밀번호 로그인과 `okho04@gmail.com` 계정을 준비하고, 운영 Supabase 프로젝트에 workspace v4까지 네 DB migration을 적용했다. 최신 main UI와 통합한 코드의 실제 로그인·저장·충돌·권한 격리, 계획 이체와 Main overlay의 두 브라우저 저장·갱신을 확인하고 로컬 main에 병합했다. Google 로그인 왕복·Git push·Pages 배포는 수행하지 않았다. 최신 상태와 정확한 검증 범위는 [v4 통합 기록](superpowers/evidence/2026-09-08-supabase-workspace-v4-integration.md)을 따른다.

데이터 계약은 [승인 설계](superpowers/specs/2026-09-07-supabase-account-workspace-design.md), 기존 계정 저장 개발 순서는 [실행 계획](superpowers/plans/2026-09-07-supabase-account-workspace.md)을 따른다. [2026-09-07 검증 기록](superpowers/evidence/2026-09-07-supabase-account-workspace.md)과 [임시 로그인 구현 기록](superpowers/evidence/2026-09-08-temporary-password-login.md)은 각각 당시 범위의 증거로 유지한다.

최신 main과 통합하는 현재 계약은 [workspace v4 통합 설계](superpowers/specs/2026-09-08-supabase-workspace-v4-integration-design.md)다. 최초 v3 적용 이후의 v4 migration·앱 검증과 실제 운영 상태는 [v4 통합 기록](superpowers/evidence/2026-09-08-supabase-workspace-v4-integration.md)에 별도로 기록한다.

2026-09-08 공개 `/auth/v1/settings`의 읽기 전용 확인 결과는 `email=true`, `google=false`, `disable_signup=false`, `mailer_autoconfirm=false`였다. 전역 이메일 확인 설정을 바꾸지 않고 대상 계정만 확인 완료 상태로 준비했다. 적용 전 workspace 조회의 HTTP 404 / `PGRST205`는 테이블 생성 후 해소됐으며, 실제 인증 세션의 본인 행 조회는 HTTP 200과 빈 결과를 반환했다. 최초 가져오기/새 시작 전까지 대상 계정의 금융 workspace는 생성하지 않는다.

## 1. 비밀정보와 DB 사전 확인

사용자는 2026-09-08 전달한 DB 비밀번호로 직접 운영 적용하는 것을 승인했고 이후 교체할 예정이다. 실제 값은 문서·소스·환경변수 파일에 기록하지 않았으며 운영자는 적용 후 교체한다. DB 비밀번호·연결 문자열 인증정보·service-role/secret key는 `VITE_*`, GitHub 공개 변수나 정적 빌드에 넣지 않는다.

후속 운영 변경 전에는 프로젝트 백업과 아래 읽기 전용 확인을 수행한다. 이번 적용 전 점검에서는 제품 테이블과 기존 migration 이력이 없었으며 PostgreSQL 17.6, `CREATEROLE`을 가진 비-superuser `postgres` 역할, 필요한 ICU collation과 hash 함수를 확인했다. 다른 버전·권한에서는 먼저 동일 검증을 재현한다.

```sql
show server_version;
select current_user, rolcreaterole from pg_roles where rolname = current_user;
select collname from pg_collation where collname = 'en-US-x-icu';
select to_regprocedure('pg_catalog.sha256(bytea)');
```

이번 작업 환경은 direct DB의 IPv6 경로에 연결할 수 없어 서울 리전의 session pooler를 사용했다. 호스트는 `aws-0-ap-northeast-2.pooler.supabase.com`, 포트는 `5432`, database는 `postgres`, user는 `postgres.fqongmuyfmxjqmefekbg`다. [Supabase 공식 Root CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)를 신뢰하도록 설정하고 인증서·호스트명 검증을 유지했다. TLS 검증을 끄거나 프로젝트 SSL 정책을 낮추지 않는다. 다른 프로젝트는 Dashboard에 표시된 해당 프로젝트의 pooler 주소를 사용한다. [연결 방식 안내](https://supabase.com/docs/guides/database/connecting-to-postgres), [SSL 안내](https://supabase.com/docs/guides/platform/ssl-enforcement)

전용 `NOLOGIN` 함수 역할 생성·소유권 이전 권한, ICU collation과 hash 함수 존재를 확인한다. 그다음 아래 migration을 순서대로 적용한다. 적용 권한 오류를 해결하려고 authenticated/anon의 테이블 쓰기나 private schema 접근을 열지 않는다.

1. [workspace validation](../supabase/migrations/202609070001_workspace_validation.sql)
2. [account workspaces](../supabase/migrations/202609070002_account_workspaces.sql)
3. [hosted request identity compatibility](../supabase/migrations/202609080001_workspace_request_identity.sql)
4. [workspace v4 protocol cutover](../supabase/migrations/202609080002_workspace_v4.sql)

세 번째 migration은 hosted `postgres`가 관리형 `auth` schema의 `USAGE`를 전용 함수 역할에 위임할 수 없는 환경을 지원한다. 전용 역할은 PostgREST가 인증한 요청 claim에서 UID를 읽으며, authenticated의 본인 행 SELECT는 기존 `auth.uid()` 정책을 유지한다. anon/authenticated에게 private helper 실행이나 직접 테이블 쓰기를 허용하지 않는다.

이 migration은 기존 브라우저 원본을 읽거나 지우지 않는다. 계정별 workspace는 최초 사용자 선택 전까지 생성하지 않는다. 성공 receipt는 최소 7일 보관하며 현재 자동 정리는 없다. 보관량을 관찰한 뒤 오래된 receipt만 정리하는 운영 작업을 별도로 등록한다.

네 번째 migration은 v3 행 전체를 검증하고 정확한 before-image를 `private.workspace_schema_backups`에 보관한 뒤 `schema_version`만 4로 바꾼다. payload·revision·timestamps·receipt는 유지한다. 테이블 소유 운영자와 기존 제약 이름을 먼저 확인하며 손상된 행 또는 중간 실패는 전부 rollback한다. before-image는 강제 RLS와 계정 삭제 cascade를 사용하고 클라이언트·service_role·RPC 역할에는 접근을 주지 않는다. 안정화 후 별도 운영 판단 전에는 자동 삭제하거나 복원하지 않는다.

v4 앱은 여섯 RPC 모두 필수 `p_schema_version: 4`로 호출한다. 구 signature는 제거하므로 v3 앱의 쓰기는 차단된다. 새 앱과 DB를 같은 rollout에서 맞추고, 장애 때 구 writable 앱으로 되돌리지 않는다. 새 계정 캐시 `isf-account-workspace-v2`는 구 v1 캐시의 미전송 요청을 자동 replay하지 않으며 복구 원문과 기존 브라우저 원본을 보존한다. 명시적 로그아웃만 같은 계정의 두 캐시 세대를 지운다.

## 2. 임시 로그인과 Google 전환

### 2.1. 임시 이메일·비밀번호 로그인 — 2026-09-08 승인

Google 설정 전 운영 대상 계정은 `okho04@gmail.com`이다. 앱의 로그인 화면과 세션 만료 후 재로그인 화면에서 이메일·비밀번호 폼을 사용한다. 폼은 실제 `signInWithPassword` 세션을 발급받으며 기존 `auth.users.id`·RLS·workspace 저장 계약을 따른다. Google 인증을 완료한 것으로 표시하거나 회원가입·계정 자동 생성을 수행하지 않는다. [Supabase 비밀번호 로그인 안내](https://supabase.com/docs/guides/auth/passwords)

대상 계정은 실제 Supabase Auth 사용자로 생성됐고 비밀번호 로그인과 사용자 조회가 성공했다. Google provider identity나 임의 JWT를 만들지 않았다. 사용자의 금융 데이터는 작성하지 않았다.

후속 계정 준비의 기본 경로는 다음 관리자 API다.

1. 관리자 권한으로 대상 이메일의 기존 사용자를 확인한다. 기존 사용자가 있으면 해당 UID와 workspace를 보존하며 비밀번호를 설정한다. 사용자를 삭제·재생성하지 않는다.
2. 신규 사용자일 때만 관리자 `auth.admin.createUser`에 대상 이메일, 비밀번호와 `email_confirm: true`를 지정한다. 기존 계정의 비밀번호 설정에는 `auth.admin.updateUserById`를 사용한다. 이 작업은 신뢰할 수 있는 관리자 환경에서 수행하고 관리자 키를 정적 앱에 넣지 않는다. [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
3. 임시 비밀번호는 사용자 요청에 따라 `admin`을 포함한 입력하기 쉬운 긴 조합으로 준비한다. 실제 값은 문서·소스·공개 빌드 변수·브라우저 저장소에 기록하지 않고 로그인 폼에서 직접 입력한다. 전역 이메일 확인 설정을 끄거나 공개 회원가입을 추가할 필요는 없다.
4. 1절의 DB 사전 확인·migration 적용 후 실제 비밀번호 로그인, 같은 계정의 두 브라우저 조회·저장과 로그아웃·만료 후 재로그인을 확인한다. 계정 생성만으로 workspace 행을 만들지 않으며 최초 가져오기/새 시작은 사용자 선택을 유지한다.

이번 운영 적용은 사용자가 제공한 DB 권한만 있고 Auth Admin API용 secret/service-role key가 없어, 현재 `auth.users`·`auth.identities` 컬럼과 생성 컬럼·trigger·기존 이메일 유무를 먼저 확인한 일회성 transaction으로 계정을 준비했다. 확인한 Auth schema migration은 `20260625000000`이며 bcrypt 비밀번호 hash와 email identity를 저장했다. 평문 비밀번호는 바인딩된 작업 입력으로만 사용했고 파일에 남기지 않았다. 이 경로는 버전 의존적인 운영 예외이며 일반적인 계정 생성 API나 앱 runtime으로 재사용하지 않는다. 기존 계정을 삭제·재생성하거나 전역 이메일 확인을 끄지 않았다. [운영 적용 기록](superpowers/evidence/2026-09-08-supabase-live-setup.md), [Auth identity 모델](https://supabase.com/docs/guides/auth/identities)

### 2.2. Google 설정과 계정 유지

[Supabase 공식 Google 로그인 안내](https://supabase.com/docs/guides/auth/social-login/auth-google)에 따라 Google Web OAuth Client를 만들고 Client ID/Secret을 Supabase Google provider 설정에 등록한다. Client Secret은 브라우저 환경변수가 아니다.

| 설정 위치 | 값 |
| --- | --- |
| Google Authorized JavaScript origin | `https://jinhoops.github.io` |
| Google Authorized redirect URI | `https://fqongmuyfmxjqmefekbg.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://jinhoops.github.io/IndividualSavingsFlowUI/apps/main/` |
| Supabase redirect allowlist | `https://jinhoops.github.io/IndividualSavingsFlowUI/apps/auth/callback/` |
| 개발용 redirect allowlist | `http://localhost:5173/IndividualSavingsFlowUI/apps/auth/callback/` |

별도 개발 포트를 사용하면 그 정확한 URL만 추가한다. Google callback과 앱 callback을 혼동하지 않으며 운영 wildcard는 사용하지 않는다. PKCE verifier가 저장된 동일 브라우저/origin에서 왕복해야 한다.

임시 로그인에서 Google로 전환할 때는 동일한 확인된 이메일을 사용한다. Supabase의 자동 identity linking으로 기존 계정 연결이 예상되지만, 실제 Google 로그인 전후 `auth.users.id`와 기존 workspace가 같은지 확인해야 전환 완료로 판단한다. 기존 사용자나 workspace를 지우고 다시 만들지 않는다. Google 전환 검증 후 임시 비밀번호를 교체한다. 로그인 폼 제거만으로 서버의 비밀번호 인증이 없어졌다고 간주하지 않는다. [Supabase identity linking 안내](https://supabase.com/docs/guides/auth/auth-identity-linking)

## 3. 정적 빌드 환경변수

로컬 `.env.local`은 [.env.example](../.env.example)을 참고한다. GitHub repository 또는 `github-pages` environment의 Variables에는 다음 공개 값만 등록한다.

- `VITE_SUPABASE_URL`: `https://fqongmuyfmxjqmefekbg.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: 프로젝트의 `sb_publishable_...` 공개 키

publishable key는 [공개 클라이언트용 키](https://supabase.com/docs/guides/getting-started/api-keys)다. 계정 권한은 서버의 JWT 검증·RLS·RPC가 강제한다. `.github/workflows/deploy.yml`은 이 두 값을 build 단계에만 전달한다. 값이 누락되거나 비밀 키 형식이면 빌드가 실패한다.

`npx vite build`는 버전을 바꾸지 않는 산출물 검증이고, `npm run build`는 기존 프로젝트 규칙대로 버전 파일을 갱신한다. callback은 `dist/apps/auth/callback/index.html`로 만들어지며 별도 서버 rewrite는 필요 없다. 서비스워커는 Auth/Data API와 code가 붙은 callback navigation을 runtime cache하지 않는다.

## 4. 재현 가능한 로컬 검증

```bash
npm run check
npm run test:unit
npm run test:e2e -- --reporter=list
node scripts/test-workspace-db.mjs
node scripts/test-account-pwa.mjs
```

DB 스크립트는 Docker의 일회용 PostgreSQL 17 컨테이너만 사용하고 종료 시 해당 컨테이너를 정리한다. 운영 연결 문자열을 받지 않는다. TypeScript/SQL의 동일한 170개 fixture와 v3→v4 원자적 이전·구 RPC 차단·RLS·동시성·중복 receipt·rollback·계정 삭제 cascade를 검증한다. PWA 스크립트는 일회용 정적 production build를 16437 포트에서 띄워 실제 서비스워커의 캐시 제외와 오프라인 Main을 검증한다. 현재 결과와 제한은 [v4 통합 기록](superpowers/evidence/2026-09-08-supabase-workspace-v4-integration.md)을 따른다.

E2E의 `cloud` 프로젝트는 실제 production entry와 Supabase SDK를 사용하되 HTTP 경계를 테스트 서버 fixture로 대체한다. `chromium`은 기존 제품 계산/UI/로컬 원본 호환성을 검증하는 테스트 전용 entry다. production에 인증 우회 설정은 없다. Node 25 이상에서 jsdom 저장소와 충돌하면 단위 테스트 앞에 `NODE_OPTIONS=--no-experimental-webstorage`를 지정한다. 임시 로그인 당시 기록과 최종 v4 전체 회귀 결과는 구분하며, 최신 결과는 [v4 통합 기록](superpowers/evidence/2026-09-08-supabase-workspace-v4-integration.md)을 따른다.

## 5. 운영 rollout 확인

운영 DB와 임시 계정 사전 준비는 적용했다. 다음은 실제 프로젝트에서 확인한 범위이며, Google 전환과 Pages 배포의 다음 담당자는 프로젝트 운영자다.

- [x] 운영 DB 사전 점검, v4까지 네 migration 적용과 원본 hash/이력 일치.
- [x] v4 required protocol·구 RPC 차단, fixed/sweep 저장·reload와 Journey Main-only 저장 및 두 브라우저 동기화.
- [x] 실제 두 사용자 세션과 anon으로 본인 행 조회, 타인 행 비노출, 직접 INSERT/UPDATE/DELETE 및 익명 RPC 금지.
- [x] 여섯 저장 RPC, stale revision 충돌, 같은 mutation 재시도, 동시 저장의 한 건 성공·한 건 충돌과 invalid rollback.
- [x] 두 독립 Chromium 브라우저 문맥의 같은 테스트 계정으로 실제 앱 저장·focus 갱신·reload 및 네 제품 진입.
- [x] 실제 대상 계정의 비밀번호 폼 로그인, 최초 계획 선택·이메일 표시와 로그아웃. 대상 계정의 금융 workspace는 아직 없으며 테스트 계정·workspace·receipt는 정리 완료.
- [ ] 실제 원격 세션 만료 후 재인증, 30초 polling과 다중 탭 로그아웃의 운영 배포 검증. 해당 흐름의 로컬 fixture E2E와 실제 원격 검증을 혼동하지 않는다.
- [ ] Google provider 설정·실제 왕복, verifier 유실/재시도, callback 직접 새로고침과 임시 로그인 전후 동일 UID·workspace 유지.
- [ ] GitHub Pages 공개 변수 등록·배포와 운영 URL에서 네 앱의 base 직접 진입·새로고침.

기존 데이터는 자동 업로드하지 않는다. 처음 가져오기/새 시작을 선택하고, 서버가 이미 있으면 백업 후 전체 교체를 명시적으로 확인한다. 장애 시 계정 편집을 중지하고 서버 백업·미전송 복구 파일을 제공한다. 기존 로컬 writable 배포로 무조건 되돌려 두 원본을 만들지 않는다.

정상 백업에는 서버 확정 workspace만 포함한다. 계정별 미전송 복구 기록은 탭별로 분리해 다른 탭의 조회가 덮어쓰지 않도록 하며, logout은 해당 계정의 모든 탭 기록을 명시적 확인 후 지운다. 원래의 비계정 브라우저 이전 원본은 남긴다.
