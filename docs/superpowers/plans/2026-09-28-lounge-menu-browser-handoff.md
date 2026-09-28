# 닉네임 관리 메뉴 · 카카오톡 브라우저 연결

사용자 요청: 닉네임 변경은 관리 메뉴에 두고 카카오톡 공유에서 기본 브라우저의 로그인을 이어갈 수 있게 한다.

## 구현 범위

- 라운지 제목 옆 변경 버튼을 제거하고 관리 메뉴에 `닉네임 변경`을 둔다. 메뉴 닫힘 모션 후 기존 변경 표면을 열며 닫으면 톱니 버튼으로 focus를 돌린다. 48시간 서버 제한과 닉네임 저장 계약은 유지한다.
- 공통 로그인 화면에서 Kakao user agent를 감지한다. 제한되는 Google OAuth 진입 대신 `외부 브라우저로 열기`를 제공하고 이메일 로그인은 유지한다. 기존 로그인 사용자 화면은 가로막지 않는다.
- 사용자가 눌렀을 때만 Kakao 비공개 openExternal scheme을 시도한다. 기본 브라우저 강제 전환·실행 성공을 보장하지 않는다. 자동 redirect·타이머·Chrome 강제 지정은 사용하지 않는다.
- 카카오톡 메뉴의 `다른 브라우저로 열기` 안내와 주소 복사를 항상 제공한다. clipboard 실패는 선택 가능한 주소와 안내로 복구한다.
- 현재 origin과 기존 safeReturnPath로 허용 앱/게시물 UUID만 전달한다. OAuth code, access/refresh token, fragment, 임의 redirect URL은 복사/전달하지 않는다. callback에서는 외부 전환 링크를 만들지 않는다. PKCE는 외부 브라우저에서 새로 시작한다.
- 재인증에는 미저장 입력이 다른 브라우저로 옮겨지지 않음을 안내한다. 로그인 세션·비밀번호·workspace를 브라우저 사이에 복제하지 않는다.

## 검증·운영

1. [x] UI·URL helper·문서 구현.
2. [x] 타입·unit, Lounge/로그인 focused, 390/768/1280 시각·focus·44px·복사 실패 검증.
3. [x] 공유 관리 메뉴/로그인 영향으로 전체 E2E, build, diff·문서 링크.
4. [x] PR·CI·Pages 배포, 원격/로컬·Orca 정리.

OS 앱 실행은 자동화 브라우저에서 검증할 수 없다. Kakao 실기기에서 실제 전환·기본 브라우저 선택 여부는 별도 확인이 필요하며, 수동 열기/복사를 제공한다. DB migration은 없다.

## 근거

- [카카오 공식 답변](https://devtalk.kakao.com/t/topic/145256): 외부 브라우저 오픈은 공식 제공 기능이 아니며 비공식 방법은 정책에 따라 제한될 수 있다.
- [카카오 callback 이동 주의](https://devtalk.kakao.com/t/topic/136998): callback에서 브라우저를 바꾸면 code 중복 소비 문제가 발생할 수 있다.
- [Google OAuth 정책](https://developers.google.com/identity/protocols/oauth2/policies#use-secure-browsers): 안전한 브라우저를 사용한다.

완료: PR #29 병합·CI/Pages 성공. 전체 E2E 291 통과·1 실패·1 기존 제외 후, 발견한 Portfolio 스크롤 복원을 보완하고 해당 반복 3회·Portfolio 전체 49개를 재검증했다. 실제 배포 5개 브라우저/화면 조건 smoke 통과. [검증 증거](../evidence/2026-09-28-lounge-menu-browser-handoff.md).
