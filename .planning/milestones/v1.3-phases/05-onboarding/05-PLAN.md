# Phase 5 Plan: Step 1 Spotlight Onboarding

## 작업 단계 (Task Breakdown)

### Step 1: CSS 인프라 구축
- `apps/step1/styles.css`에 온보딩 전용 클래스(`onboarding-overlay`, `onboarding-tooltip`, `is-onboarding-active`) 추가.

### Step 2: Onboarding Manager 모듈 생성
- `apps/step1/modules/onboarding-manager.js` (신규) 또는 `app.js` 내부에 로직 구현.
- `initOnboarding()`: 상태 확인 및 시작.
- `showSpotlight(targetId)`: 오버레이 및 툴팁 렌더링.
- `closeOnboarding()`: 상태 저장 및 정리.

### Step 3: 이벤트 바인딩
- `#applyPresetBtn` 클릭 이벤트에 `closeOnboarding` 연결.
- 오버레이 배경 클릭 시 닫기 기능 추가 (옵션).

### Step 4: 검증 (UAT)
- 최초 진입 시 가이드가 뜨는지 확인.
- 버튼 클릭 후 새로고침 시 다시 뜨지 않는지 확인.
- 모바일 가로/세로 모드에서 툴팁 위치 확인.
