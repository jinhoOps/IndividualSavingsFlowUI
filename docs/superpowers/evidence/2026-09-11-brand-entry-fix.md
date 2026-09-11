# 브랜드 화면 재생 조건 정정

2026-09-11 사용자 피드백: 앱을 바꿀 때마다 큰 로고가 보인다. 재생은 앱 실행과 Main의 `처음부터 다시` 진입으로 한정한다.

## 원인과 수정

기존 구현은 `animate=false`로 모션만 껐고, 전체 화면 로고는 모든 AccountWorkspaceGate 조회에 렌더했다. 앱별 HTML로 이동할 때 gate가 다시 mount되므로 정적인 로고가 반복 노출됐다.

- `loginLoadingIntent.ts`: 기존 계정 탭 식별자와 세션 표시 이력으로 새로운 실행을 구분한다. 같은 실행의 앱 이동·새로고침·로그인 완료는 브랜드를 표시하지 않는다. OAuth callback은 같은 실행의 연속으로 처리한다. 금융 데이터와 서버 schema는 변경하지 않는다.
- `BrandWelcome.tsx`: 앱 최초 실행과 명시적인 Main 재시작에 공유하는 한 번의 2.2초 장면이다. 조회는 병렬 진행하고 느리면 완성 프레임을 유지한다. 건너뛰기·Escape·reduced motion을 지원한다.
- `AccountWorkspaceGate.tsx`: 내부 이동은 로고 없는 작은 로딩 상태를 제공하고, 로그인·복구 heading으로 초점을 연결한다.
- `MainApp.tsx`: `처음부터 다시` 확인 후 restart entry만 재생하고 현재 entry의 완료를 메모리에 기록한다. 저장된 setup 재개는 반복하지 않는다. 재시작·초기화의 금액·도우미 데이터 계약은 보존한다.
- [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../../DESIGN.md), [진입 설계](../specs/2026-09-11-account-loading-brand-motion-design.md)를 정정했다.

전체 회귀 도중 건너뛰기의 pointerdown에서 화면을 먼저 교체하면 브라우저의 기본 focus 동작이 setup heading focus를 지우는 문제를 발견했다. 완료를 click 시점으로 옮기고 실제 마우스·키보드 진입 경로로 재검증했다.

## 검증

- `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·TypeScript 통과, 145개 파일·1,333개 unit test 통과.
- 최초 전체 `npx playwright test --output test-results/brand-entry-regression`: 180개 통과, 위 pointerdown focus 문제 2개 실패, 별도 PWA 프로젝트용 1개 skip.
- click 완료로 수정 후 `npx playwright test tests/account-workspace.spec.ts tests/main-react.spec.ts --grep 'app launch landing|signed-out launch|OAuth return continues|Main restart|reduced motion skips the landing|newly opened tab' --repeat-each 2 --output test-results/brand-entry-final`: 18개 모두 통과. 최초 실패 2개와 재생 조건 전체를 각각 2회 검증했다. 새로 연 탭이 복제된 sessionStorage와 다른 탭 ID를 얻어 재생하는 실제 브라우저 경로도 추가했다.
- 각 390/768/1280px에서 실제 앱 메뉴 링크 네 앱 왕복·새로고침 중 로고 DOM이 한 프레임이라도 mount되는지 MutationObserver로 확인했다. 느린 로딩의 완성 프레임·viewport containment·44px 건너뛰기·키보드 focus를 검증했다.
- 최종 `node scripts/test-account-pwa.mjs`: production build 및 service worker의 31개 shell cache, Auth/Data/OAuth code cache 제외, 인증된 offline Main 읽기 전용 통과.
- `git diff --check`와 변경 문서 상대 링크 확인 통과.

[390px](../../reviews/2026-09-11-brand-entry/launch-390.png) · [768px](../../reviews/2026-09-11-brand-entry/launch-768.png) · [1280px](../../reviews/2026-09-11-brand-entry/launch-1280.png)

실제 Google provider 왕복과 사용자 기기의 PWA 재실행은 이번 검증 범위가 아니다. OAuth 연속 진입은 fixture, PWA는 실제 production service worker와 fixture 계정 경계로 확인한다. 별도 Supabase migration은 필요 없다.
