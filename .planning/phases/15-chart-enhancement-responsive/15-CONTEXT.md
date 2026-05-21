# Phase 15: Chart Enhancement & Responsive - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Sankey Chart의 데이터 라벨링 시각 최적화(가독성 개선, 텍스트 겹침 방지 등) 및 768px 이하 모바일 디바이스 해상도에서의 화면 파손을 방지하고 레이아웃 및 줌 배율 제어를 완벽히 최적화하여 프리미엄 시각 효과와 무결성을 보장합니다.

</domain>

<decisions>
## Implementation Decisions

### Sankey Chart 라벨링 & 텍스트 겹침 방지 설계
- **D-01 (1.c 절충안):** 모바일 환경(<=768px)에서는 차트 라벨을 좌/우측에 배치하여 겹치는 레거시 레이아웃을 지양하고, 노드 상단에 얹는 미려한 말풍선/배지 스타일로 배치하여 텍스트 겹침 현상을 원천 방어합니다. 

### Sankey 차트 노드 & 링크 컬러 테마 고도화
- **D-02 (2.A Sunset/Deep Sea 그라디언트):** 자금의 유입과 유출을 담당하는 모든 SVG 링크(`path`)에 `DESIGN.md` 브랜드 포인트 컬러 스키마인 Sunset에서 Deep Sea로 자연스럽게 흐르는 선형 그라디언트(`linearGradient`) 효과를 적용하여 프리미엄 비주얼 완성도를 WOW 수준으로 높입니다.

### 모바일 반응형 뷰포트 최적화 및 줌 제어
- **D-03 (3.B 맞춤 화면 맞춤형):** 가로 스크롤 패널로 래핑하여 피하는 방식 대신, 모바일 가로 너비에 무조건 100% 맞추어 반응형으로 렌더링되도록 처리합니다. 대신 모바일 전용 압축 컬럼 스텝 너비 크기(`SANKEY_MOBILE_MIN_COLUMN_STEP` 등)를 더욱 촘촘하고 세밀하게 튜닝하여 뷰포트 오버플로우나 화면 파손 없이 미려한 비율을 구현합니다.

### Claude's Discretion
- SVG `linearGradient` 요소의 ID 정의 및 `<defs>` 마크업 삽입 방식
- 배지 스타일에 어울리는 세부 폰트 색상 대조 및 패딩 크기
- 마이크로 인터랙션 시 적용될 미세 트랜지션 애니메이션 속도 제어

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & UI Standards
- `DESIGN.md` — Glassmorphism 디자인 토큰 및 스페이싱 가이드라인
- `.gemini/knowledge/wiki/UI_Standards_Reference.md` — UI 표준 및 Sankey Diagram 요구 사항 정의

### Core Visualization Code
- `apps/step1/modules/sankey-renderer.js` — SVG DOM 생성 및 렌더링 전담 로듈
- `apps/step1/modules/sankey-builder.js` — 데이터 가공 및 노드/링크 관계 가공 모듈
- `apps/step1/styles.css` — Step 1 내의 차트 레이아웃 스타일 오버라이드 규칙
- `shared/styles/step-theme.css` — 전역 테마 및 공통 모바일 반응형 뼈대 그리드

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [sankey-renderer.js:drawNode](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js#L296-L333): 노드 및 라벨, 수치 렌더링의 핵심이므로 이 메서드를 오버라이드하여 배지형 라벨 스타일 적용 예정.
- [sankey-renderer.js:buildBandPath](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js#L28-L33): 링크의 SVG path 생성을 제어하는 함수. 그라디언트 적용 시 path 요소의 stroke/fill 스타일과 결합 예정.
- [sankey-renderer.js:renderSankey](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js#L88-L289): 뷰포트 크기와 컬럼 크기(`minColumnStep`)를 조율하고 SVG viewBox를 설정하므로 모바일 밀착형 스텝 계산 오버라이드 지점.

### Established Patterns
- 반응형 뼈대는 768px 미디어 쿼리를 기반으로 `step-theme.css` 에서 공통 제공.
- `@media (max-width: 768px)` 내에 차트가 유연하게 녹아들도록 css rule 유지.

### Integration Points
- `sankey-renderer.js` 내부에서 SVG `<defs>`를 초기화 단계 혹은 첫 렌더링 시점에 삽입하여 그라디언트 재사용 환경 구성.

</code_context>

<specifics>
## Specific Ideas
- 모바일(<=768px) 레이아웃 적용 시, SVG 텍스트 요소(`text`)를 배지 블록 느낌으로 감싸기 위해 텍스트 뒤에 배경용 미니 `rect` 요소를 함께 그려 가독성 확보.
- Sunset에서 Deep Sea로 전환되는 그라디언트는 SVG 상단 `<defs>` 내에 `<linearGradient>`를 구성하여 링크 클래스 혹은 인라인 `stroke`에 `url(#sankey-gradient-...)` 스타일 지정.

</specifics>

<deferred>
## Deferred Ideas
None — 모든 수집된 의사결정 사항이 금번 Phase 15 범위 내에 온전히 매핑됩니다.

</deferred>

---

*Phase: 15-Chart Enhancement & Responsive*
*Context gathered: 2026-05-21*
