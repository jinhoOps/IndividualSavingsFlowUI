---
wave: 1
depends_on: []
files_modified:
  - apps/step2/modules/renderers.js
  - apps/step2/modules/events.js
  - apps/step2/index.css
autonomous: true
requirements_addressed: [SIM-01, SIM-02, SIM-03, SIM-04]
---

# Plan 01: 시뮬레이션 차트 인터랙티브 고도화 및 프리셋 UI

## Objective
배당 시뮬레이션 차트에 인터랙티브 요소(데이터 포인트, 툴팁, 호버 이벤트), 자산 기준 Y축 그리드, PR/TR 복리 효과 영역 색칠을 적용하고 사용자 편의를 위한 3종 프리셋 버튼을 구현한다.

## Tasks

<task>
<id>1</id>
<title>차트 반응형 설정 및 Y축 그리드 렌더링</title>
<read_first>
- apps/step2/modules/renderers.js
- .planning/phases/03-chart-visualization/03-CONTEXT.md
- .planning/phases/03-chart-visualization/03-RESEARCH.md
</read_first>
<action>
`apps/step2/modules/renderers.js`의 `drawSimulationChart(svg, data)` 함수를 다음과 같이 수정한다:
1. 하드코딩된 width/height 속성을 제거하고, `svg.setAttribute("viewBox", "0 0 600 250");`와 `svg.style.width = "100%"; svg.style.height = "auto";`를 설정하여 반응형 차트로 변경한다.
2. `maxVal` 계산을 기존 `dividendNominalTR`에서 `data.map(d => d.assetNominalTR)` 기반으로 변경하여 자산 스케일로 맞춘다. (D-03)
3. Y축 금액 눈금과 수평 그리드를 그리기 위해 SVG `<line>`과 `<text>` 요소를 추가한다. 세로 방향으로 3~5개의 균등 간격(예: 0, 25%, 50%, 75%, 100%)을 가진 라인(`stroke: #e5e7eb`, `stroke-dasharray: 4`)을 렌더링하고, 해당 라인 옆에 Y축 값 텍스트를 배치한다. (만원 단위 포맷 활용)
</action>
<acceptance_criteria>
- `apps/step2/modules/renderers.js` contains `setAttribute("viewBox"`
- `apps/step2/modules/renderers.js` calculates `maxVal` based on `assetNominalTR`
- `apps/step2/modules/renderers.js` generates `<line>` and `<text>` elements for Y-axis grids
</acceptance_criteria>
</task>

<task>
<id>2</id>
<title>복리 영역 채우기 (Area Polygon)</title>
<read_first>
- apps/step2/modules/renderers.js
</read_first>
<action>
`apps/step2/modules/renderers.js`의 `drawSimulationChart(svg, data)` 내에서 PR(미투자) 선과 TR(재투자) 선 사이의 면적을 채운다.
1. SVG `<polygon>` 요소를 생성한다.
2. `points` 속성에 TR 선의 좌표를 순방향으로 나열하고, 그 뒤에 이어서 PR 선의 좌표를 역방향으로 나열하여 닫힌 다각형의 좌표열을 구성한다.
3. 면적 채우기 스타일을 적용한다: `fill: rgba(234, 91, 42, 0.1)`. (SIM-04)
</action>
<acceptance_criteria>
- `apps/step2/modules/renderers.js` contains `<polygon>` element generation
- `apps/step2/modules/renderers.js` sets polygon fill to `rgba(234, 91, 42, 0.1)`
- `apps/step2/modules/renderers.js` constructs polygon points using both TR and PR data
</acceptance_criteria>
</task>

<task>
<id>3</id>
<title>데이터 포인트 및 툴팁 호버 인터랙션 구현</title>
<read_first>
- apps/step2/modules/renderers.js
- apps/step2/index.css
</read_first>
<action>
1. `apps/step2/index.css`: `.chart-tooltip` 클래스를 생성하여 `position: absolute`, `background: rgba(255, 255, 255, 0.1)`, `backdrop-filter: blur(10px)`, `pointer-events: none` 등의 Glassmorphism 패널 스타일을 정의한다.
2. `apps/step2/modules/renderers.js`: 
  - 각 연도의 TR 및 PR 데이터 위치에 투명하거나 작은 반경의 `<circle>` 요소를 추가한다.
  - 마우스/터치 이벤트를 쉽게 잡기 위해, 차트 너비를 데이터 개수만큼 등분하여 각 연도의 영역에 보이지 않는 넓은 `<rect>`(fill: transparent)를 전체 높이만큼 생성하고 차트 위에 겹쳐 올린다.
  - 이 `<rect>`에 `mouseenter`, `mouseleave`, `mousemove` (또는 `touchstart`) 이벤트를 리스너로 등록한다.
  - 이벤트 발생 시, 부모 컨테이너(상대 좌표) 내에서 툴팁 div를 렌더링/위치 이동시키며, 해당 연도의 `assetNominalTR`, `assetNominalPR`, `dividendNominalTR` 값들을 `IsfUtils.formatMoney()`나 `IsfUtils.toMan()`를 활용해 만원 단위로 포맷팅하여 표시한다. (D-02, D-04)
</action>
<acceptance_criteria>
- `apps/step2/index.css` contains `.chart-tooltip` with absolute positioning
- `apps/step2/modules/renderers.js` generates `<rect>` elements for hover areas
- `apps/step2/modules/renderers.js` handles mouse/touch events to display the tooltip
- `apps/step2/modules/renderers.js` uses `IsfUtils` for formatting tooltip values
</acceptance_criteria>
</task>

<task>
<id>4</id>
<title>프리셋 버튼 3종 UI 및 이벤트 바인딩</title>
<read_first>
- apps/step2/modules/renderers.js
- apps/step2/modules/events.js
</read_first>
<action>
1. `apps/step2/modules/renderers.js` (또는 HTML 뼈대를 그리는 부분): 배당 시뮬레이션 파라미터(수익률, 배당성장률 등) 입력 필드 상단이나 근처 영역에 3개의 프리셋 버튼("단일 100%", "SCHD+QQQI (1:1)", "3종 혼합 (40:30:30)")을 렌더링한다. (D-05)
2. `apps/step2/modules/events.js`: 프리셋 버튼들에 클릭 이벤트 리스너를 추가한다.
  - 클릭 시 선택된 프리셋에 맞는 기대 배당수익률, 배당 성장률, 주가 상승률 값을 입력 필드(input)에 자동으로 설정한다.
  - 상태 객체 업데이트(markDirty 등 14종 헬퍼 규칙 유지) 및 재렌더링 로직(`renderDraft` 또는 `renderSimulation` 등)을 호출하여 차트와 요약 테이블이 즉시 갱신되도록 한다.
3. 사용자가 수동으로 파라미터를 변경할 수 있는 기존 input 로직은 그대로 보존되어야 한다. (D-06)
</action>
<acceptance_criteria>
- HTML/JS contains buttons for presets: "단일 100%", "SCHD+QQQI (1:1)", "3종 혼합"
- `apps/step2/modules/events.js` contains click event listeners for the preset buttons
- Preset button click updates the input values and triggers a re-render
</acceptance_criteria>
</task>

## Verification
- 차트가 브라우저 창 크기에 맞춰 리사이즈 되는지 확인
- PR/TR 선 사이가 반투명 주황색 면적으로 채워져 있는지 확인
- 차트 영역 위에 마우스를 올리면 툴팁이 마우스를 따라다니며 연도, 총 자산, 연 배당금을 만원 단위로 올바르게 표시하는지 확인
- 배당 시뮬레이션 섹션에 프리셋 버튼 3종이 표시되며, 클릭 시 파라미터가 변경되고 차트가 즉각 반영되는지 확인

## must_haves
- [ ] 반응형 viewBox 설정 (SIM-04)
- [ ] 자산(Asset) 기준 Y축 maxVal 산정 (D-03)
- [ ] PR/TR 사이 Area Polygon 렌더링 (SIM-04)
- [ ] 툴팁을 통한 세부 데이터 노출 및 호버 영역 보정 (SIM-01, SIM-02, D-02)
- [ ] 프리셋 버튼 3종 추가 및 파라미터 연동 기능 보존 (D-05, D-06)
