# Phase 3: 시뮬레이션 차트 시각화 고도화 - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

현재 추세선만 표시하는 배당 시뮬레이션 차트를 정보 밀도가 높은 인터랙티브 차트로 전면 개선한다.
(데이터 포인트, 툴팁, Y축 눈금/그리드, 복리 영역 채우기 등)

</domain>

<decisions>
## Implementation Decisions

### 차트 렌더링 라이브러리 여부
- **D-01:** 경량 차트 라이브러리 도입은 계속 보류. 현재의 Vanilla JS 기반 직접 SVG 렌더링(`drawSimulationChart`)을 유지하며 고도화한다.

### 툴팁 동작 방식
- **D-02:** 모바일/데스크탑 환경을 고려하여 사용자가 데이터 포인트에 마우스를 올리거나 탭했을 때 근처에 플로팅(Floating) 또는 토스트(Toast) 형태로 표시한다.

### Y축 스케일 및 표시 범위
- **D-03:** 차트의 Y축 스케일과 시각적 기준은 어차피 보여주려는 핵심인 '자산(Asset)' 스케일로 통일한다.
- **D-04:** 배당금 등 수치가 작아 차트 선상에서 구분이 어려운 값들은 호버(툴팁)를 통해서만 재투자 값과 함께 표시한다.

### the agent's Discretion
- 플로팅/토스트 툴팁의 정확한 시각적 배치(상단 vs 포인트 옆)와 애니메이션 효과(Glassmorphism 적용 여부 등)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 3 (SIM-01 ~ SIM-04) 요구사항 및 목표
- `.planning/REQUIREMENTS.md` — 세부 수용 기준 정의

### Design & Conventions
- `DESIGN.md` — Glassmorphism, ISF 색상 팔레트 및 CSS 변수
- `.planning/PROJECT.md` — 단위 무결성(만원 vs 원), No-build 원칙

### Legacy Implementations
- `apps/step2/modules/renderers.js` — 현재 구현되어 있는 `drawSimulationChart` 함수 (SVG 수동 구성 방식)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/step2/modules/renderers.js` 의 `drawSimulationChart`: 기존 `document.createElementNS("http://www.w3.org/2000/svg", ...)` 패턴 유지 및 재활용.

### Established Patterns
- 데이터 단위 변환: `formatCurrency` 등을 이용하여 원 단위의 내부 데이터를 UI(만원) 포맷으로 변환하여 툴팁에 렌더링해야 함.

### Integration Points
- 기존 `renderDividendSimulation` 안에서 `calculateDividendProjection()`을 호출해 받은 데이터를 SVG와 툴팁 렌더링 함수에 공급.

</code_context>

<specifics>
## Specific Ideas

- 배당금 차이가 자산에 비해 너무 작아 축을 나누기보다는, 차트 자체는 자산의 흐름(PR vs TR의 격차)을 보여주는 데 집중하고 구체적인 배당금 재투자 수치는 툴팁으로만 노출.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-chart-visualization*
*Context gathered: 2026-05-03*
