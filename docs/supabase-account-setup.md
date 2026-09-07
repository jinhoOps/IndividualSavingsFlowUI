# Supabase 계정 저장 운영 안내

이 브랜치는 정적 앱·migration·로컬 검증을 구현한다. 운영 Supabase 프로젝트 변경, 실제 Google 로그인 왕복, Pages 배포는 아직 수행하지 않았다. 데이터 계약은 [승인 설계](superpowers/specs/2026-09-07-supabase-account-workspace-design.md), 개발 순서는 [실행 계획](superpowers/plans/2026-09-07-supabase-account-workspace.md)을 따른다.

## 1. 비밀정보와 DB 사전 확인

대화에 입력한 문자열이 실제 DB 비밀번호였다면 먼저 교체한다. DB 비밀번호·연결 문자열 인증정보·service-role/secret key는 소스, `.env`의 `VITE_*`, GitHub 공개 변수나 정적 빌드에 넣지 않는다.

운영자는 프로젝트 백업 후 SQL Editor의 migration 실행 역할로 아래 읽기 전용 확인을 수행한다. 로컬 검증은 PostgreSQL 17과 `CREATEROLE`을 가진 비-superuser migration 역할에서 수행했다. 다른 버전·권한에서는 먼저 동일 검증을 재현한다.

```sql
show server_version;
select current_user, rolcreaterole from pg_roles where rolname = current_user;
select collname from pg_collation where collname = 'en-US-x-icu';
select to_regprocedure('pg_catalog.sha256(bytea)');
```

전용 `NOLOGIN` 함수 역할 생성·소유권 이전 권한, ICU collation과 hash 함수 존재를 확인한다. 그다음 아래 migration을 순서대로 적용한다. 적용 권한 오류를 해결하려고 authenticated/anon의 테이블 쓰기나 private schema 접근을 열지 않는다.

1. [workspace validation](../supabase/migrations/202609070001_workspace_validation.sql)
2. [account workspaces](../supabase/migrations/202609070002_account_workspaces.sql)

이 migration은 기존 브라우저 원본을 읽거나 지우지 않는다. 계정별 workspace는 최초 사용자 선택 전까지 생성하지 않는다. 성공 receipt는 최소 7일 보관하며 현재 자동 정리는 없다. 보관량을 관찰한 뒤 오래된 receipt만 정리하는 운영 작업을 별도로 등록한다.

## 2. Google와 Supabase Auth

[Supabase 공식 Google 로그인 안내](https://supabase.com/docs/guides/auth/social-login/auth-google)에 따라 Google Web OAuth Client를 만들고 Client ID/Secret을 Supabase Google provider 설정에 등록한다. Client Secret은 브라우저 환경변수가 아니다.

| 설정 위치 | 값 |
| --- | --- |
| Google Authorized JavaScript origin | `https://jinhoops.github.io` |
| Google Authorized redirect URI | `https://fqongmuyfmxjqmefekbg.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://jinhoops.github.io/IndividualSavingsFlowUI/apps/main/` |
| Supabase redirect allowlist | `https://jinhoops.github.io/IndividualSavingsFlowUI/apps/auth/callback/` |
| 개발용 redirect allowlist | `http://localhost:5173/IndividualSavingsFlowUI/apps/auth/callback/` |

별도 개발 포트를 사용하면 그 정확한 URL만 추가한다. Google callback과 앱 callback을 혼동하지 않으며 운영 wildcard는 사용하지 않는다. PKCE verifier가 저장된 동일 브라우저/origin에서 왕복해야 한다.

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

DB 스크립트는 Docker의 일회용 PostgreSQL 17 컨테이너만 사용하고 종료 시 해당 컨테이너를 정리한다. 운영 연결 문자열을 받지 않는다. TypeScript/SQL의 동일한 123개 fixture와 RLS·동시성·중복 receipt·rollback·계정 삭제 cascade를 검증한다. PWA 스크립트는 일회용 정적 production build를 16437 포트에서 띄워 실제 서비스워커의 캐시 제외와 오프라인 Main을 검증한다. 최종 결과와 제한은 [검증 기록](superpowers/evidence/2026-09-07-supabase-account-workspace.md)에 있다.

E2E의 `cloud` 프로젝트는 실제 production entry와 Supabase SDK를 사용하되 HTTP 경계를 테스트 서버 fixture로 대체한다. `chromium`은 기존 제품 계산/UI/로컬 원본 호환성을 검증하는 테스트 전용 entry다. production에 인증 우회 설정은 없다. Node 25 이상에서 jsdom 저장소와 충돌하면 단위 테스트 앞에 `NODE_OPTIONS=--no-experimental-webstorage`를 지정한다.

## 5. 운영 rollout 확인

다음 담당자는 프로젝트 운영자다. 1절부터 시작해 아래를 완료한 뒤 배포를 승인한다.

- 테스트 계정 두 개와 anon으로 실제 REST/RPC의 본인 행 조회, 타인 접근 차단, 직접 쓰기 금지를 확인한다.
- Google 실제 왕복, verifier 유실/재시도, callback 직접 새로고침과 네 앱의 배포 base를 확인한다.
- 두 브라우저에서 같은 계정 저장·충돌·재시도·30초/focus 갱신, 다른 계정 격리와 다중 탭 로그아웃을 확인한다.
- 기존 데이터는 자동 업로드하지 않는다. 처음 가져오기/새 시작을 선택하고, 서버가 이미 있으면 백업 후 전체 교체를 명시적으로 확인한다.
- 장애 시 계정 편집을 중지하고 서버 백업·미전송 복구 파일을 제공한다. 기존 로컬 writable 배포로 무조건 되돌려 두 원본을 만들지 않는다.

정상 백업에는 서버 확정 workspace만 포함한다. 계정별 미전송 복구 기록은 탭별로 분리해 다른 탭의 조회가 덮어쓰지 않도록 하며, logout은 해당 계정의 모든 탭 기록을 명시적 확인 후 지운다. 원래의 비계정 브라우저 이전 원본은 남긴다.
