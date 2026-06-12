# Phase 2: Core Components & Layout - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

주요 컴포넌트(버튼, 폼, 카드 등) 신규 디자인 규칙 적용 및 레이아웃 개편 (요구사항: UI-03, UX-01).
- 개선된 입력 폼의 렌더링 및 입력 편의성 확보.
- Anthropic 에디토리얼 스타일의 신규 Card/Button 적용 및 모바일 우선 반응형 레이아웃 구현.

</domain>

<decisions>
## Implementation Decisions

### Form Layout & Spacing (모바일 우선 레이아웃)
- **D-01:** 모바일 화면(<= 760px)을 기준으로 모든 입력 필드(`.control`)는 가로 100%를 차지하는 1열 스택 구조로 정렬합니다. 카드 내부 여백은 콤팩트하게 `12px` 패딩으로 설정하여 가독성과 밀도를 확보합니다. PC 화면 확장(768px 이상) 시에는 미디어 쿼리를 통해 자동으로 3열 그리드(`repeat(3, 1fr)`) 구조로 확장되도록 구현합니다.

### Inline Expand Card (모바일 항목 편집 모드)
- **D-02:** 모바일의 좁은 가로 폭에서 항목 편집 시 폼이 찌그러지거나 깨지는 현상을 방지하기 위해, 편집 모드 활성화 시 해당 항목 카드가 수직으로 펼쳐지는 Inline Expand Card 방식을 도입합니다. 모바일에서는 1행(이름) / 2행(계좌 select + 금액) / 3행(변경 적용 및 삭제 버튼)의 3층 세로 스택 구조로 정렬되고, PC 확장 시에는 기존의 가로 1줄 편집 행으로 배치됩니다.

### Swipeable Underline Tab (모바일 탭 개편)
- **D-03:** 탭 네비게이션이 모바일 뷰에서 개행되거나 어수선해지는 현상을 해결하기 위해 가로 스와이프(`overflow-x-auto flex-nowrap`)가 가능한 에디토리얼 언더라인 스타일 탭을 적용합니다. 데스크톱 확장 시 스크롤바가 숨겨지고 화면 좌측 또는 중앙에 자연스럽게 정렬되는 넓은 플랫 탭 구조로 스케일링됩니다.

### Flat Hairline & Focus Design (컴포넌트 스타일링)
- **D-04:** 카드(Card)와 버튼(Button)에 그림자를 제거하고 정갈한 얇은 실선 테두리(`1px solid var(--color-line)`)만 두르는 Flat Hairline 스타일을 적용해 에디토리얼 톤앤매너를 수호합니다. 또한, 입력 필드 포커스 시 기존의 파란색 링 대신 웜톤 크림색에 어울리는 브랜딩 포인트 컬러(Sunset `#ea5b2a` 또는 Accent `#1e8b7c`)의 얇은 아웃라인 링을 적용합니다.

### Claude's Discretion (에이전트 재량)
- 각 마이크로 여백(Padding/Margin) 수치의 정확한 픽셀 보정.
- 모바일 가로 스크롤 탭의 터치 가속도 및 감쇠 디테일.
- 포트폴리오 인풋 필드 포커스 시 테두리 색상 변화의 트랜지션 애니메이션 속도.

</decisions>

<specifics>
## Specific Ideas

- "모바일 화면에서는 콤팩트하게 1열 스택으로 수직 스크롤을 최적화하고, PC 화면에서는 와이드 3열로 시원하게 배치한다."
- "이름 수정과 금액 수정이 모바일 가로 한 줄에 좁게 들어가는 대신 카드가 펼쳐져서 큰 인풋으로 바뀌면 오입력 확률이 획기적으로 줄어든다."

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Guidelines & CSS
- `DESIGN.md` — 전체 디자인 시스템 가이드라인.
- [src/styles/globals.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/src/styles/globals.css) — 테마와 폰트가 선언되는 공통 CSS 엔트리.
- [apps/step1/styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css) — Step 1 앱의 상세 CSS 스타일 규칙 및 반응형 미디어 쿼리 선언 파일.

### Page Markup
- [apps/step1/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/index.html) — Step 1의 마크업 구조 및 주요 탭/폼 요소 마크업.

### Milestone Specifications
- [.planning/PROJECT.md](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/PROJECT.md) — 프로젝트 마스터 계획서 및 v1.7 목표 정의.
- [.planning/REQUIREMENTS.md](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/REQUIREMENTS.md) — v1.7 마일스톤 상세 요구사항 정의.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/styles/globals.css` 내에 선언된 `@apply` 기본 컴포넌트(`panel`, `btn`, `btn-primary`, `btn-sm`, `input`) 스타일을 상속하여 수월하게 에디토리얼 버튼과 패널을 구현할 수 있습니다.

### Established Patterns
- 모바일 미디어 쿼리(`@media (max-width: 760px)`)를 이용한 반응형 레이아웃 오버라이드 패턴 (`apps/step1/styles.css` 하단 구조 대조군 참고).

### Integration Points
- `apps/step1/index.html` 내의 `#inputsForm`에 포함된 각종 입력 컴포넌트들 및 `.mgmt-tabs`가 신규 CSS 스타일과 마크업 조정이 결합되는 주요 통합 지점입니다.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-core-components-layout*
*Context gathered: 2026-06-12*
