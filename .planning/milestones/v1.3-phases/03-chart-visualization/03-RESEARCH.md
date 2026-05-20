# Phase 3: 시뮬레이션 차트 시각화 고도화 - Research

## 1. Objective
본 Research는 Phase 3의 차트 고도화(데이터 포인트, 툴팁, Y축 기준 변경, 복리 영역 표시, 반응형) 구현을 위해 기존 구현을 분석하고 플랜(PLAN)을 위한 기술적 접근 방식을 정의한다.

## 2. Existing Implementation Analysis
- **위치:** `apps/step2/modules/renderers.js` 의 `drawSimulationChart(svg, data)`
- **현재 상태:** 
  - 순수 SVG(`document.createElementNS`)를 이용해 하드코딩된 width(600), height(220)로 렌더링.
  - 배당금(`dividendNominalTR`)을 기준으로 `maxVal`을 산정하여 선(PR, TR)만 그리고 있음.
  - X축 라벨과 단순한 범례만 존재하며 인터랙션 요소 부재.

## 3. Technical Approach

### 3.1. Y축 스케일 및 렌더링 기준 변경 (D-03)
- **현재:** `const maxVal = Math.max(...data.map(d => d.dividendNominalTR), 1);`
- **변경:** 자산 스케일로 통일해야 하므로 `data.map(d => d.assetNominalTR)` 기반으로 `maxVal` 설정.
- Y축 라벨(금액 눈금)과 수평 그리드(선) 추가 렌더링 필요. SVG `<line>`과 `<text>`를 이용해 3~5개의 균등 간격 그리드 생성.

### 3.2. 반응형 차트 설정 (SIM-04)
- 기존의 하드코딩된 크기 대신, `svg.setAttribute("viewBox", "0 0 600 250")` 와 `svg.style.width = "100%"; svg.style.height = "auto";` 를 적용해 부모 컨테이너 비율에 맞춰 축소/확대되도록 수정.

### 3.3. 복리 효과 영역 채우기 (SIM-04)
- PR 선과 TR 선 사이의 차이를 시각화하기 위해 SVG `<polygon>` 요소 추가.
- `points` 속성에 TR 선의 좌표를 순방향으로, PR 선의 좌표를 역방향으로 나열하여 닫힌 다각형을 만듦.
- `fill: rgba(234, 91, 42, 0.1)` (ISF 주황색의 반투명 버전) 등 적용.

### 3.4. 데이터 포인트 및 툴팁 구현 (SIM-01, SIM-02)
- 각 연도마다 TR 및 PR 위치에 `<circle>` 요소를 추가 (투명하거나 작은 크기로 렌더링).
- **마우스 호버/터치 영역 최적화:** 정확히 점에 올리기 어려울 수 있으므로, 해당 연도의 x좌표를 포괄하는 투명한 수직 직사각형(`<rect>`)을 SVG 전체 높이만큼 배치하여 이벤트 수신 영역(`hover/mousemove/mouseleave/touchstart`)으로 활용하는 패턴이 유리함.
- **툴팁 UI:** 차트를 감싸는 부모 컨테이너(`position: relative`) 내부에 절대 배치되는 `div` (또는 토스트)를 생성. 호버 이벤트 발생 시 해당 연도의 `data` 객체를 참조해 `formatCurrency()` (또는 `utils.toMan`)로 자산 및 배당금 수치를 포맷팅하여 표시.

### 3.5. 프리셋 UI 추가 (D-05, D-06)
- 차트 자체의 수정과 함께, 배당 시뮬레이션 가정 파라미터(기대 수익률, 배당 성장률, 주가 상승률) 설정 부근에 "프리셋 버튼 3종(SCHD 100%, SCHD+QQQI, SCHD+JEPI+QQQI)" 렌더링 로직 추가.
- 버튼 클릭 시 해당 파라미터 값이 input 에 자동 할당되고 `renderDraft()` 및 차트 갱신 트리거.

## 4. Required Changes for PLAN
1. `apps/step2/modules/renderers.js`: `drawSimulationChart` 함수 개편 (viewBox, Y축/그리드, Area polygon, hover rects).
2. 툴팁 관련 HTML/CSS: 기존 `index.css`나 JS 동적 생성으로 툴팁 추가 및 스타일링.
3. 프리셋 기능: `apps/step2/modules/renderers.js` (UI 렌더링) 및 `apps/step2/modules/events.js` (이벤트 바인딩) 에 프리셋 기능 추가.

## 5. Validation Architecture
- 차트 내 `<circle>`, `<polygon>`, Y축 `<line>` 렌더링 여부 DOM 검사.
- 호버 영역 이벤트 발생 시 툴팁 `div`의 가시성 및 포맷팅된 데이터 일치 여부 확인.
- 프리셋 버튼 클릭 시 input 값(수익률, 성장률 등)이 정확히 변경되고, 차트가 다시 그려지는지 검증.
