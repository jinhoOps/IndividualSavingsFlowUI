# Phase 14: Foundation UX & Branding - Context

Gathered: 2026-05-20
Status: Ready for planning

<domain>
## Phase Boundary

DESIGN.md 가이드라인을 기반으로 전체 캔버스 배경에 ISF Pearl 톤을 주입하고, 투명도 0.9 규격을 만족하는 Glass Panel 공통 스타일을 globals.css 및 step-theme.css에 확립합니다. 이와 더불어, 버튼 스케일 클릭 피드백(scale 0.96)을 전체 인터랙션 요소로 전면 확장하고 모바일 뼈대 레이아웃(768px 이하 스택 구조)을 공통 테마 수준에 선제 통합합니다.

</domain>

<decisions>
## Implementation Decisions

### Glassmorphism 패널 스타일 정합 (UX-01)
- D-01: DESIGN.md의 규격을 엄격하게 준수하여 globals.css와 step-theme.css 내의 카드/패널 투명도 변수(--panel, --color-panel)를 rgba(255, 255, 255, 0.9)로 통일 조정하여 본문 및 숫자 데이터의 글자 가독성을 향상시킵니다.

### 글로벌 CSS 테마 변수의 일원화 (UX-01/UX-02)
- D-02: globals.css의 Tailwind v4 @theme 블록을 프로젝트 디자인 변수의 단일 소스(Single Source of Truth)로 규정합니다. step-theme.css를 비롯한 개별 스타일시트는 이 글로벌 변수를 온전히 상속받고 참조 매핑하여 파편화와 중복 정의를 제거합니다.

### 버튼 터치 인터랙션 범위 확장 (UX-04)
- D-03: 기본 물리 버튼(.btn)뿐만 아니라, 탭 버튼(.tab-btn), 헤더 링크(.nav-link), 모달 내부 액션 버튼 등 클릭 가능한 모든 주요 웹 인터랙션 요소에 transform: scale(0.96) 액티브 모션을 확장 적용하여 즉각적이고 생동감 있는 물리 반응을 선사합니다.

### 모바일 반응형 뼈대 선제 통합 (UX-03 선반영 대비)
- D-04: 768px 이하 뷰포트에서 모든 주요 패널의 internal padding을 24px에서 14px(--sp-md)로 줄이고, 다단(Grid) 레이아웃을 1열 세로 스택 구조로 강제 전환하는 반응형 규칙을 step-theme.css 공통 뼈대에 기본 주입하여 모바일 뷰 파손을 선제적으로 예방합니다.

### the agent's Discretion
- 스텝별 독자 스타일 시트(styles.css) 내부에 하드코딩된 테마 외 색상이나 스페이싱 값을 글로벌 CSS 변수 기반으로 외과적으로 정합하여 치환하는 세부 작업은 에이전트의 판단 하에 유연하고 안전하게 수행합니다.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### 시각 디자인 규격 및 요건
- DESIGN.md — Glassmorphism, ISF Pearl 캔버스, 버튼 인터랙션 등 핵심 시각 명세 규정
- .planning/REQUIREMENTS.md — UX-01, UX-02, UX-04 등 마일스톤 요구사항 명시
- .planning/ROADMAP.md — Phase 14 성공 기준 및 범위 설정 문서

### 핵심 공통 CSS 리소스
- src/styles/globals.css — Tailwind v4 @theme 및 기본 유틸리티 클래스 정의 파일
- shared/styles/step-theme.css — 브라우저 공유 테마 및 컴포넌트 스타일 정의 파일

### 스텝별 독립 스타일 파일
- apps/step1/styles.css — 가계 흐름(Sankey) 뷰 스타일 정의 파일
- apps/step2/styles.css — 자산 배분(Asset Allocation) 뷰 스타일 정의 파일
- apps/step3/styles.css — 포트폴리오 시뮬레이터 뷰 스타일 정의 파일

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/styles/globals.css: @layer components 에 .panel, .btn 등 유틸리티 브릿지 클래스가 선언되어 있어 이를 단일 CSS 토큰 공급처로 삼기 용이합니다.
- shared/styles/step-theme.css: .app-header, .launcher-menu, .btn 등의 공유 스타일을 직접 상속받고 있어, 테마 변수 매핑을 바르게 치환하면 하위 페이지들까지 일시에 시각 스타일이 통합될 수 있습니다.

### Established Patterns
- Vite 빌드 시스템을 통하여 src/entries/*.ts 들이 globals.css와 step-theme.css를 연이어 수입(import)하는 모던 하이브리드 로딩 패턴을 따르고 있습니다.
- 모든 버튼이나 탭 등의 요소에 :active 가상 클래스를 적절히 부여하고 CSS의 transform 전이를 매끄럽게 처리하는 방식으로 모션을 구현합니다.

### Integration Points
- globals.css 와 step-theme.css 에 선언되어 있는 --panel, --bg, --sp-md 등의 CSS 변수 정의부가 핵심 결합 대상입니다.
- 스텝별 index.html 내의 주요 컨테이너 패널(.panel, .card)과 버튼류 요소들이 테마 정합성 통합의 즉각적인 변화 확인 지점입니다.

</code_context>

<specifics>
## Specific Ideas

- globals.css와 step-theme.css에 선언된 Glassmorphism panel 배경을 background: rgba(255, 255, 255, 0.9); 로 맞추고 backdrop-filter: saturate(1.1) blur(10px) 등을 가미하여 풍부한 시각적 효과(rich aesthetics)를 뽐냅니다.
- 버튼 활성화 전이에 transition: transform 0.1s ease-out; 과 active:scale-95 등의 유틸리티 연동을 강화합니다.

</specifics>

<deferred>
## Deferred Ideas

- Sankey Chart의 라벨 겹침 방지 및 차트 노드/링크 컬러 팔레트 브랜드화 작업은 Phase 15 범위로 이관하여 다음 단계에서 심도 있게 보완합니다.
- 결과물 이미지 캡처 및 공유 내보내기 핵심 기능은 Phase 16(Export Feature)으로 이관하여 집중도 높게 다룹니다.

None — 그 외 모든 UI/UX 뼈대 구축 요건은 이번 Phase 14에서 전부 수행합니다.

</deferred>

---

*Phase: 14-Foundation UX & Branding*
*Context gathered: 2026-05-20*
