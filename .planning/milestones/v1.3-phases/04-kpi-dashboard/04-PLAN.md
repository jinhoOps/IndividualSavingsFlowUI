# Phase 4 Implementation Plan: KPI Dashboard & Table Refinement

## Step 1: Markup Update (`apps/step2/index.html`)
- `sim-chart-wrap` 상단에 `<div id="simKpiGrid" class="kpi-grid"></div>` 추가.
- `simTable`의 `thead` 내 텍스트 수정:
    - `(만원)` 제거.
    - `명목`, `실질` 텍스트는 `span class="th-sub"` 등으로 감싸 스타일링 제어 가능하게 변경 또는 제거 검토.

## Step 2: Styling Update (`apps/step2/styles.css`)
- `.kpi-grid` 및 `.kpi-card` 스타일 구현 (UI-SPEC 준수).
- 모바일 대응 `@media` 쿼리 추가 (1열 레이아웃).
- 테이블 헤더 텍스트 크기 조정 및 간격 최적화.

## Step 3: Logic Update (`apps/step2/modules/renderers.js`)
- `renderKpiCards(data)` 함수 신설.
    - `data[data.length - 1]`에서 최종 자산, 배당금 추출.
    - 수익률 계산: `((finalAsset / totalPrincipal) - 1) * 100`.
    - HTML 템플릿 리터럴을 사용하여 `#simKpiGrid` 내용 갱신.
- `renderDividendSimulation()` 내에서 `renderKpiCards(data)` 호출 추가.

## Step 4: Verification (Evaluator Phase)
- KPI 수치가 테이블의 마지막 행 수치와 일치하는지 확인.
- 모바일(760px 이하)에서 KPI 카드가 깨지지 않고 세로로 정렬되는지 확인.
- 테이블 헤더에서 불필요한 단위 표기가 제거되어 가독성이 향상되었는지 확인.
