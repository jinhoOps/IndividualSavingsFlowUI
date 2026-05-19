# Phase 12-02: Step 2 Architecture Modernization (Plan)

## Goal
Step 2(배당 시뮬레이션)의 코드를 Step 1과 동일한 현대적 모듈 패턴(`ui-controller.js`, `feature-controllers.js`)으로 리팩토링하여 아키텍처 일관성을 확보하고 유지보수성을 향상한다.

## Research Findings
- **Current Structure**: `app.js`가 오케스트레이션을 담당하며, `renderers.js`와 `storage-handler.js`에 UI 업데이트와 기능 로직이 혼재되어 있음.
- **Identified Issues**: 
  - `renderers.js`가 너무 비대함 (17KB).
  - 이벤트 바인딩과 상태 동기화 로직이 `app.js`에 집중되어 있음.
  - `shared/styles/step-theme.css`와의 스타일 통합이 더 필요함.

## Proposed Changes
1.  **`modules/ui-controller.js` 생성**:
    - `renderers.js`의 단순 DOM 업데이트 로직 이관.
    - `syncBackupUi`, `syncSyncBanner` 등 UI 동기화 함수 통합.
    - 상태(Dirty 등)에 따른 UI 피드백 관리.
2.  **`modules/feature-controllers.js` 생성**:
    - `storage-handler.js`의 핵심 기능 로직 이관.
    - `step1-connector.js` 연동 기능 통합.
    - 백업/복원, 스냅샷 관리 등의 기능 단위 제어.
3.  **`app.js` 경량화**:
    - 초기화 로직(`initApp`) 및 컨트롤러 호출 위주로 재구성.
4.  **스타일 정리**:
    - `apps/step2/styles.css`에서 `step-theme.css`와 중복되는 변수 및 클래스 제거.

## Success Criteria (DoD)
- [ ] Step 2 기능(계산, 차트, 데이터 허브 연동)이 리팩토링 전후 동일하게 작동함.
- [ ] `app.js`가 컨트롤러 패턴으로 재구성됨.
- [ ] `IsfUtils` 기반의 단위 변환(만원/원)이 정확히 유지됨.
- [ ] 모바일 레이아웃(760px 이하) 정합성이 유지됨.
