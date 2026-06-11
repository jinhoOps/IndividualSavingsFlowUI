# Phase 14: Foundation UX & Branding - Discussion Log

> Audit trail only. Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

Date: 2026-05-20
Phase: 14-Foundation UX & Branding
Areas discussed: Glassmorphism panel style, global CSS architecture, scale interactive elements, mobile responsive canvas.

---

## Glassmorphism panel style (UX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | DESIGN.md 지침을 엄격하게 준수하여 globals.css와 step-theme.css의 투명도를 0.9로 상향 조정합니다. 콘텐츠의 글자 가독성이 크게 개선됩니다. | ✓ |
| Option B | 기존의 0.82 투명도를 유지하여 한층 더 반투명하고 몽환적인 느낌을 보존합니다. | |

User's choice: Option A (추천)
Notes: DESIGN.md의 규격을 일치시켜 시인성과 고해상도 디자인 질감을 강화하기로 결정함.

---

## Global CSS architecture (UX-01/UX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | globals.css의 @theme 블록을 변수의 단일 소스(Single Source of Truth)로 규정하고, step-theme.css가 이 변수를 그대로 이어받아 매핑하도록 CSS 결합 구조를 단순화합니다. | ✓ |
| Option B | 각 스텝별 styles.css에서 필요한 변수들을 각자 덮어쓸 수 있도록 느슨한 독립 구조를 유지합니다. | |

User's choice: Option A (추천)
Notes: 테마 스타일 정보의 파편화를 근본적으로 없애기 위해 globals.css를 디자인 토큰의 중심 진실 공급원으로 수립하기로 동의함.

---

## Scale interactive elements (UX-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | 탭 전환 버튼(.tab-btn), 네비게이션 링크(.nav-link), 모달 제어 버튼 등 사용자가 직접 터치하고 클릭하는 모든 핵심 인터랙션 요소에 scale(0.96) 클릭 액션을 전면 적용하여 완성도를 극대화합니다. | ✓ |
| Option B | 기존 지침대로 오직 .btn 클래스를 가진 기본 물리 버튼에만 scale 액션을 한정적으로 적용합니다. | |

User's choice: Option A (추천)
Notes: 풍부한 인터랙션 모션 피드백을 통해 UX에 생동감을 더하고, 사용자의 입력 시각적 반응 체계를 일체화하기 위해 전면 확장을 채택함.

---

## Mobile responsive canvas (UX-03 선대비)

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | 768px 미만일 때 모든 주요 panel의 internal padding을 24px에서 14px(--sp-md)로 줄이고, 다단(Grid) 레이아웃을 1열 세로 스택 구조로 자동 전환하는 미디어 쿼리 뼈대를 step-theme.css 수준에 미리 견고하게 내재화합니다. | ✓ |
| Option B | 공통 뼈대에 반영하지 않고, 향후 Phase 15에서 각 페이지와 모듈별로 반응형 CSS 미디어 쿼리를 개별 조정합니다. | |

User's choice: Option A (추천)
Notes: 모바일 우선의 시각적 안정성을 보다 효율적이고 일관성 있게 다루기 위해 공통 레이아웃 뼈대 단계에서 선대비 자동 1열 스냅 구조를 수용함.

---

## the agent's Discretion

스텝별 독자 스타일 시트(styles.css) 내부에 하드코딩된 테마 외 색상이나 스페이싱 값을 글로벌 CSS 변수 기반으로 외과적으로 정합하여 치환하는 세부 작업은 에이전트의 판단 하에 유연하고 안전하게 수행합니다.

## Deferred Ideas

Sankey Chart의 라벨 겹침 방지 및 차트 노드/링크 컬러 팔레트 브랜드화 작업은 Phase 15 범위로 이관하여 다음 단계에서 심도 있게 보완합니다.
결과물 이미지 캡처 및 공유 내보내기 핵심 기능은 Phase 16(Export Feature)으로 이관하여 집중도 높게 다룹니다.
