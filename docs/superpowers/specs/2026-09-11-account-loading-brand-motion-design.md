# 로그인 후 계획 로딩의 브랜드 모션

상태: 2026-09-11 사용자 승인·구현. 기존 Main 웰컴 인트로의 노출·완료·건너뛰기 계약을 대체한다.

## 동작

- 이메일 로그인·재인증 성공 후, 또는 Google callback 성공 후 계정 workspace를 조회·검증하는 동안 기존 브랜드 SVG를 한 번 조립한다.
- 데이터 준비가 끝나면 애니메이션 진행 상태와 관계없이 즉시 앱 또는 최초 계획 선택 화면으로 넘어간다. 최소 대기 시간과 건너뛰기 버튼은 없다.
- 네트워크가 느리면 완성된 로고와 `계정의 계획을 불러오고 있어요.`를 유지한다. 반복 재생하지 않는다. 실패·만료는 기존 복구·재인증 화면으로 넘어간다.
- 기존 세션의 새로고침과 앱 간 이동은 정적인 로고만 사용한다. fresh Main, 다시 시작, 초기화, 빈 Main 백업 복원은 별도 인트로 없이 기존 setup으로 바로 진입한다.
- 브랜드 앱 이름을 추가로 강조하지 않는다. SVG geometry와 setup/review의 기존 모션은 보존한다.

## 책임과 접근성

`AccountWorkspaceGate`가 실제 요청의 수명을 소유한다. `AccountLoadingScreen`은 화면과 모션만 소유하며 계정 데이터·라우팅·저장 완료를 판단하지 않는다. unmount 때 Anime scope를 정리한다. 로딩 상태를 보조 기술에 알리고 SVG는 장식으로 처리한다. 조작할 항목이 없으므로 임의 버튼으로 초점을 옮기지 않는다. setup 진입 후 기존 heading focus를 유지한다.

reduced motion과 모션 생성 실패에서는 완성된 정적 로고와 로딩 문구를 표시한다. 390px, 768px, 1280px에서 로고·문구가 viewport 안에 들어온다.

Google 리디렉션 경계에만 `sessionStorage`의 `isf-login-loading-once`를 사용한다. 성공 시각만 기록하고 첫 인증된 workspace 조회에서 삭제한다. 60초를 넘거나 유효하지 않은 값은 무시한다. 저장소 접근 실패는 정적 로딩으로 처리한다. 금융 payload·계정 식별자·workspace schema·기존 저장 키와 관계없으며 구버전이 무시해도 기능 손실이 없다. 이메일 경로는 메모리 ref만 사용한다.

Main bootstrap의 fresh/resume 메타데이터와 fresh welcome 진행 기록 저장은 그대로 보존한다. UI 인트로 완료 타이머는 제거한다. 초기화와 다시 시작의 데이터 계약은 [지출 도우미 설계](2026-09-10-main-expense-assistant-design.md)를 따른다.

## 검증

- 실제 브라우저의 이메일 로그인 이벤트 → 지연된 workspace 응답 → 완성 프레임 유지 → 데이터 표시.
- 390px, 768px, desktop containment, 장식 SVG·loading status, 앱 이동 재생 없음.
- OAuth 일회성 표시 소비와 애니메이션 시간을 멈춘 상태에서도 응답 즉시 앱 진입.
- reduced motion 정적 프레임, 조회 실패의 복구 화면 전환, 모션 실패·unmount cleanup.
- Main 최초 설정·재시작·재개·키보드 전용 설정 및 전체 공유 인증 E2E 회귀.
