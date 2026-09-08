# 계정 기능의 설정 메뉴 통합

사용자 요청에 따라 별도 `내 계정` 버튼을 없애고 네 앱의 기존 톱니바퀴 하단 `계정` 그룹으로 이동했다. UI 계약은 [DESIGN](../../../DESIGN.md)에 반영했다.

## 변경 범위

- `AccountWorkspaceGate`가 계정 정보와 백업·브라우저 계획 교체·복구·로그아웃 동작을 공통 메뉴에 제공한다. 인증·DB·revision·백업 형식은 변경하지 않는다.
- `AppShell`, Main 초기 설정·intro와 메뉴가 계정 컨텍스트를 사용한다. 오프라인에는 금융 입력과 복원 확인창을 잠그되 계정 백업·로그아웃은 사용할 수 있다.
- 오류·충돌·오프라인 피드백은 메뉴 밖에 유지한다. 메뉴 높이 제한과 긴 이메일 줄바꿈을 추가했다.
- 로컬 모드에서 컨텍스트가 없으면 기존 화면 구조를 유지한다. 사용자 DB 데이터·Google provider·배포 설정은 변경하지 않았다.

## 검증

- 새 테스트에서 별도 계정 버튼 노출, 오프라인 앱 변경 가능, 초기 설정 메뉴 누락, 열린 복원 확인창의 오프라인 차단 누락을 먼저 실패로 재현하고 수정 후 통과했다.
- `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·source/unit 타입 검사, 140개 파일·1,317개 단위 테스트 통과. 옵션 없는 Node 26 실행은 README에 기재된 jsdom/Web Storage 충돌로 실패했으며 성공 증거로 사용하지 않는다.
- `npx vite build && node scripts/test-account-pwa.mjs`: production build와 30개 shell cache 항목, Auth/Data/code 비캐시, 인증된 오프라인 Main 읽기 전용 검증 통과.
- 네 앱을 390px·768px·1280px에서 확인하며 메뉴 containment, 44px 터치 타깃, Escape 후 gear 초점 복귀, 가로 overflow를 검사한다. 생성된 Main 모바일·Account Map 태블릿 메뉴 스크린샷도 확인했다.
- 독립 리뷰에서 초기 설정 메뉴와 별도 복원 확인창 경계를 보완했고 재검토에서 추가 Critical/Important finding이 없었다.
- 전체 E2E 실행 중 기존 Simulation 390px 스크롤 검사가 한 번 2.1px 초과로 실패했다(162 통과·1 실패·1 skip). 코드·허용 오차를 변경하지 않은 focused 3회 반복은 모두 통과했다. 전체 재실행 결과는 아래에 기록한다.
- 최종 `npm run test:e2e -- --reporter=list`: 163 통과·1 기존 PWA skip, 실패 0. 해당 PWA 경로는 위 production PWA 전용 검사로 별도 검증했다. Main desktop 메뉴 스크린샷도 확인했다.
- 변경 문서의 상대 링크 6개와 `git diff --check` 통과.

## 남은 범위

Google SSO 설정과 기존 설치 PWA의 사용자 환경 확인은 [운영 안내](../../supabase-account-setup.md)를 따른다. 이번 작업은 계정 기능의 위치 변경이며 저장 계약 변경이나 사용자 계획의 대리 가져오기를 포함하지 않는다.
