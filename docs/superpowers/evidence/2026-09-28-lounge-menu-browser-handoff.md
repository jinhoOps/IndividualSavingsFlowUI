# 닉네임 관리 메뉴 · 카카오톡 브라우저 연결 검증

[계획](../plans/2026-09-28-lounge-menu-browser-handoff.md), [라운지 설계](../specs/2026-09-28-portfolio-lounge-design.md).

## 변경

- `LoungeApp` / `AppManagementMenu`: 헤더의 닉네임 변경 버튼을 관리 메뉴로 이동했다. 메뉴의 닫힘 모션이 끝난 후 기존 편집창을 열며 닫으면 톱니 버튼으로 초점을 돌린다. 계정 닉네임과 48시간 서버 제한은 유지한다.
- `AccountSignIn` / `KakaoBrowserNotice`: Kakao UA의 로그인 화면에 외부 브라우저 열기·주소 복사·수동 열기 안내를 제공한다. 일반 브라우저의 Google/이메일 로그인, 이미 로그인한 사용자, 같은 브라우저의 이메일 재인증과 미저장 입력 복구는 유지한다.
- `externalBrowserLinks`: 현재 origin과 기존 `safeReturnPath`로 허용 앱 경로와 검증한 게시물 UUID만 보존한다. 인증 code/token/fragment/임의 redirect는 전달하지 않으며 callback·자격증명이 있는 URL의 handoff를 거부한다. 로그인 세션·workspace를 브라우저 사이로 복제하지 않는다.
- 자동 redirect/타이머 없이 사용자 클릭으로 Kakao 비공개 scheme을 시도한다. 기본 브라우저 강제 실행이나 성공을 보장하지 않으며 수동 열기·복사 경로를 함께 제공한다.
- DB migration·schema v5/protocol 5·백업·이미지 Storage·Main 소유 금액 변경은 없다.

## 검증

| 명령 | 결과 |
| --- | --- |
| `npm run check:ci` | 타입·harness·136 files / **1,263 tests 통과** |
| `ISF_E2E_PORT=6657 npx playwright test --project=cloud --grep 'Lounge\|Kakao\|password and Google sign-in\|password login\|password reauthentication' --output=/tmp/isf-browser-focused` | **32개 통과**, 재시도 없음 |
| `ISF_E2E_PORT=6657 npx playwright test --project=cloud --grep Kakao --output=/tmp/isf-browser-kakao-final` | 화면 간격 보완·재인증 검증 추가 후 **8개 통과**, 재시도 없음 |
| `ISF_E2E_PORT=6657 npx playwright test --output=/tmp/isf-browser-full` | 291개 통과·1개 실패·1개 기존 PWA 제외. 기존 Portfolio 지연 스크롤 복원 문제가 실패 원인이었으며 아래 재검증으로 해결했다. |
| fixture 공개 Supabase 설정으로 `npx vite build` | production build·47개 precache 성공 |
| 상대 문서 링크·`git diff --check` | 통과 |

- 390/768/1280에서 메뉴→변경창의 순서와 초점 복귀, 화면 내 포함, 44px 조작 영역, 변경 전/후·48시간 제한·실패/재시도·dirty 보호를 확인했다.
- Android/iPhone UA로 카카오톡 안내·Google 요청 미시작·기존 이메일 로그인·주소 복사·복사 거부 후 직접 선택을 검증했다. 일반 브라우저의 Google/이메일 버튼과 초점 순서는 기존대로다.
- 안전한 URL을 별도의 일반 브라우저 계정 fixture로 열면 원래 공유 게시물 상세가 열린다. workspace/profile 쓰기는 발생하지 않는다.
- 카카오톡에서 재인증이 필요한 경우 입력 비이전 안내와 기존 복구 파일이 보이며, 같은 브라우저에서 이메일로 다시 로그인하면 미저장 입력이 복구되되 자동 저장되지 않는다.
- 모바일·태블릿·desktop 스크린샷을 직접 확인하고 새 안내의 버튼/본문 간격을 보완했다. 정상·실패 경로가 가로 overflow 없이 표시된다.

전체 회귀에서 발견한 기존 Portfolio의 50ms 지연 스크롤 복원이 그 사이 새로 이동한 위치를 덮었다. 마지막 복원 위치와 다른 스크롤이 관찰되면 후속 복원을 중단하도록 수정했다. 실패 사례 3회 반복과 `tests/portfolio.spec.ts` 전체 **49개**가 통과했으며, 수정 후 타입·harness·1,263 unit·build도 다시 통과했다.

## 검증 한계

로그인 브라우저는 HTTP fixture, Kakao 감지는 UA를 사용했다. 자동화 Chromium에서는 실제 Kakao 앱의 비공개 scheme 처리·OS 기본 브라우저 선택을 실행할 수 없으므로 휴대폰 실기기 전환을 검증했다고 주장하지 않는다. 실제 Google OAuth 왕복도 수행하지 않았다. DB 계약 변경이 없어 DB suite를 재실행하지 않았다.

[카카오 공식 답변](https://devtalk.kakao.com/t/topic/145256)에 따르면 외부 브라우저 열기는 공식 제공 기능이 아니며 비공식 방식은 정책에 따라 제한될 수 있다. [callback 전환 주의](https://devtalk.kakao.com/t/topic/136998)에 따라 OAuth callback에서는 브라우저를 옮기지 않고, [Google 정책](https://developers.google.com/identity/protocols/oauth2/policies#use-secure-browsers)에 맞춰 외부 브라우저에서 로그인하도록 안내한다.

## 배포·정리

PR #29를 `d743be105ee5a7b87d2af6835cf96e7b8bd00369`로 병합했다. CI run 36384568007과 Pages run 36384568071 성공. 실제 배포 URL에서 일반 브라우저 390/1280, Kakao UA 390/768/1280의 HTTP 200·로그인/안내·안전한 링크·가로 overflow 없음·JS 오류 없음을 확인했다. 해당 원격/로컬 feature branch를 삭제했다. Orca는 이어지는 댓글·공감 작업 진행 상태로 유지한다.

## 화면

- [390px 닉네임 관리 메뉴](2026-09-28-lounge-menu-browser-handoff/nickname-menu-390.png)
- [768px 닉네임 관리 메뉴](2026-09-28-lounge-menu-browser-handoff/nickname-menu-768.png)
- [1280px 닉네임 관리 메뉴](2026-09-28-lounge-menu-browser-handoff/nickname-menu-1280.png)
- [390px 카카오톡 진입 안내](2026-09-28-lounge-menu-browser-handoff/kakao-iPhone-390.png)
- [768px 카카오톡 진입 안내](2026-09-28-lounge-menu-browser-handoff/kakao-Android-768.png)
- [1280px 카카오톡 진입 안내](2026-09-28-lounge-menu-browser-handoff/kakao-iPhone-1280.png)
