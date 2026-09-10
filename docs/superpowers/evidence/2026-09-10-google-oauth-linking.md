# Google OAuth 연결 및 기존 ISF 계정 보존 — 2026-09-10

사용자가 Orca에 로그인해 둔 Google 계정으로 ISF 연결을 요청했다. Google Cloud와 Supabase 설정을 실제로 등록하고 공개 ISF에서 로그인·로그아웃·재로그인을 확인했다. 기존 이메일 사용자를 삭제하거나 workspace를 새로 만들지 않았다. 현재 Google OAuth는 **등록한 테스트 사용자용**이며 일반 사용자 공개 완료가 아니다.

## 운영 설정

- Google Cloud: `isf-jinhoops` / Individual Savings Flow, Web client `ISF Web — Supabase`.
- 앱 표시 이름: `나의 가계 흐름 (ISF)`, 지원·개발자 이메일 및 테스트 사용자: `okho04@gmail.com`.
- 선언한 범위: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`. 실제 동의 화면도 이름·프로필 사진·이메일만 요청했다.
- Supabase: `fqongmuyfmxjqmefekbg`의 Google provider 활성화. nonce 검사와 이메일 필수 조건을 유지하고 수동 identity linking은 켜지 않았다.
- 기존 `http://localhost:3000` Site URL을 공개 Main 주소로 변경하고 공개·개발 callback 두 주소를 정확히 등록했다. 전체 값은 [운영 안내](../../supabase-account-setup.md#22-google-설정과-계정-유지)에 있다.
- Client Secret은 Google 생성 화면에서 Supabase 설정으로 직접 전달했다. 소스·문서·빌드 환경변수·임시 파일에 저장하지 않았다. 금융 DB migration이나 금융 payload 쓰기는 수행하지 않았다.

설정 기준: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## 실제 계정 확인

기존 공개 배포 `0.11.96`에서 Orca의 같은 브라우저/origin으로 Google → Supabase → 정적 앱 callback → Main 왕복에 성공했다. 처음 가져오기/새 시작 화면 없이 기존 계획이 열렸다. 관리 메뉴에서 대상 이메일을 확인했으며, 로그아웃 후 Google 버튼으로 재로그인하고 Main·Simulation·Portfolio·Account Map을 조회했다.

`auth.users`, `auth.identities`, `public.user_workspaces`를 읽기 전용으로 비교했다. UI 조회와 callback 재방문까지 마친 뒤에도 아래 상태를 재확인했다. 금융 금액과 전체 payload는 이 기록에 넣지 않는다.

| 확인 항목 | 연결 전 | 연결 후 |
| --- | --- | --- |
| 기존 UID | `450c4995…3074` | 동일 |
| 확인된 이메일 | `okho04@gmail.com` | 동일 |
| identities | `email` | `email`, `google` |
| workspace schema / revision | 5 / 5 | 동일 |
| workspace payload MD5 | `0df7a7b1a5b14ac3daa1cde8565b3ed3` | 동일 |
| workspace updated_at | `2026-09-10T04:36:30.102787+00:00` | 동일 |
| 대상 이메일 사용자 / 전체 workspace 행 수 | 1 / 1 | 동일 |

code 없이 공개 callback을 직접 방문하면 안전한 실패 안내와 로그인 복귀 링크를 제공하고, 복귀 후 기존 세션의 Main이 열린다. 이 확인은 실제 verifier 유실·세션 강제 만료 검증을 대신하지 않는다.

## 앱 변경과 로컬 검증

- `AccountSignIn.tsx`, `account.css`: Google 버튼을 먼저 표시하고 이메일 제출은 보조 강조로 유지. 준비 중 문구를 제거하고 이메일 폼의 접근 가능한 이름을 정리했다. 인증 SDK·저장 계약은 변경하지 않았다.
- 기존 단위 테스트의 폼 이름과 브라우저 테스트의 focus 순서를 갱신했다.
- PRD·README·DESIGN·운영 안내에 등록 계정의 연결 성공과 일반 공개 미완료를 구분했다.

| 실행 | 결과 |
| --- | --- |
| `npm run check` | source·unit TypeScript 통과 |
| `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/unit/auth` | 4 files, 13 passed |
| `npm run test:e2e -- --reporter=list` | 176 passed, 1 PWA skipped; 3.1분 |
| GitHub Pages 공개 설정을 전달한 `npx vite build` | 통과; 정적 callback·서비스워커 산출물 생성 |
| 390 / 768 / 1280px 로그인 | overflow 없음, 조작 영역 44px 이상, Google → 이메일 → 비밀번호 → 제출 focus 순서 통과 |

스크린샷: [390px](../../reviews/2026-09-10-google-login/login-390.png), [768px](../../reviews/2026-09-10-google-login/login-768.png), [1280px](../../reviews/2026-09-10-google-login/login-1280.png). 세 크기를 시각적으로 확인했다. 로그인 표면에는 overlay나 금융 시각화가 없으며 전체 E2E에서 네 앱의 기존 관련 계약을 확인했다.

최초 `npm run build`는 로컬 Supabase 공개 설정이 없어 fail-closed로 실패했다. 버전 스크립트는 0.11.96으로 갱신됐으므로 추가 bump 없이 GitHub Pages의 공개 URL·publishable key를 프로세스 환경에 전달한 `npx vite build`로 산출물 생성을 확인했다. DB·service-role·Google Client Secret은 빌드에 전달하지 않는다.

## 남은 운영 범위

Google 콘솔의 게시 상태는 `테스트 중`이며 앱 게시 버튼이 브랜딩 설정 미완료로 비활성화되어 있다. 현재 동의 화면에는 앱 이름 대신 Supabase 프로젝트 도메인이 표시된다. 전체 사용자 공개를 위해서는 운영자가 브랜딩 정보와 앱 게시를 완료해야 한다. 요청 범위에서 정책 문서를 임의 작성·게시하지 않았다.

기존 임시 비밀번호는 조회·변경하지 않았다. Google 연결 성공을 기존 비밀번호 폐기로 간주하지 않으며 교체는 운영 후속 항목으로 남긴다. 실제 원격 세션 만료, OAuth verifier 유실과 복구 검증도 별도 항목이다. 다음 담당자는 프로젝트 운영자이며 [운영 안내](../../supabase-account-setup.md#5-운영-rollout-확인)에서 시작한다.
