# 임시 이메일·비밀번호 로그인 검증

날짜: 2026-09-08. 사용자 요청에 따라 [계정 저장 설계](../specs/2026-09-07-supabase-account-workspace-design.md)의 Google 설정 전 임시 인증 경로를 구현했다.

## 변경

- `src/auth/AccountSignIn.tsx`: 실제 Supabase 이메일·비밀번호 로그인, 중복 제출·provider 동시 실행 차단, 실패 안내와 비밀번호 입력 제거.
- `AccountWorkspaceGate.tsx`, `account.css`: 로그인과 세션 만료 화면에 같은 폼을 연결한다. 기존 UID별 workspace hydration과 복구 기록을 사용한다.
- `tests/account-workspace.spec.ts`, `tests/unit/auth/AccountWorkspaceGate.test.tsx`: 잘못된 비밀번호·네트워크 실패·로그인 후 저장/reload·만료 후 입력 복구를 검증한다.
- PRD·README·DESIGN·승인 spec·[운영 안내](../../supabase-account-setup.md): 임시 인증 승인 범위와 실제 운영 준비를 구분한다.
- 무시되는 로컬 `.env.local`에 사용자가 제공한 공개 URL/key를 설정했다. 실제 로그인 비밀번호는 소스·문서·환경변수에 넣지 않았다.

## 검증

- `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: 하네스·TypeScript·128개 파일의 단위 테스트 1,240개 통과.
- `npx vite build`: 버전 변경 없이 production MPA·callback·서비스워커 생성 통과.
- 비밀번호 로그인 관련 focused Playwright: 5개 통과. 390px·768px·1280px에서 입력·버튼 44px, 키보드 순서와 overflow를 확인했다.
- 잘못된 로그인과 재로그인 테스트는 실제 Supabase SDK를 사용하며 외부 HTTP 응답만 fixture로 대체한다. 로그인 후 계정의 데이터 저장·reload, 만료 후 미전송 입력 복구와 자동 write 없음, 평문 비밀번호의 Web Storage/URL 미포함을 확인했다.
- 로그인 폼이 없는 기존 구현에서 추가한 단위·브라우저 검사가 실패한 뒤 구현 후 통과했다.
- 독립 코드 리뷰: 인증 경계, 비밀번호 처리, 중복 제출과 재인증 경로에 차단 이슈 없음.
- `npm run test:e2e -- --reporter=list`: 151개 통과, 기존 PWA 전용 1개 skip, 실패 없음.
- 로그인 화면 390px·768px·1280px 스크린샷을 직접 확인했다. 스크린샷은 `test-results/cloud-login-*.png`이며 Git에 포함하지 않는다.
- 수정 문서의 상대 링크와 `git diff --check` 통과.

SQL·저장 모델과 PWA 캐싱 규칙은 변경하지 않았다. 이번 작업에서 DB integration 및 실제 service worker 런타임 검증을 반복하지 않았으며 기존 결과는 [2026-09-07 기록](2026-09-07-supabase-account-workspace.md)을 따른다.

## 당시 실제 프로젝트 확인과 미완료 항목

아래는 앱 구현 당시의 기록이다. 이후 사용자의 직접 적용 승인으로 운영 DB와 임시 계정 준비·실제 로그인·저장 검증을 완료했다. 현재 운영 상태는 [별도 적용 기록](2026-09-08-supabase-live-setup.md)을 따른다.

공개 키로 수행한 읽기 전용 확인:

- `/auth/v1/settings`: HTTP 200, Email 활성화, Google 비활성화, 이메일 자동 확인 비활성화.
- `/rest/v1/user_workspaces?select=user_id&limit=0`: HTTP 404 / `PGRST205`, schema cache에서 테이블을 찾지 못함. 실제 migration 적용 상태 확인이 필요하다.

관리자 연결이 없어 실제 `okho04@gmail.com` 계정 생성·비밀번호 설정은 수행하지 않았다. 운영 DB 적용·실제 로그인·Google 전환·배포도 미수행이다. 다음 담당자는 프로젝트 운영자이며 [운영 안내](../../supabase-account-setup.md)의 DB 준비와 임시 계정 사전 생성부터 진행한다. 기존 이메일 계정이 있으면 UID를 유지한다.
