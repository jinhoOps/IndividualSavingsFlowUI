# Phase 2: Core Components & Layout - Research Report

## 1. 개요 및 목적
본 조사의 목적은 **Milestone v1.7 Phase 2: Core Components & Layout**을 성공적으로 계획하고 구현하기 위해 필요한 디자인 사양, 영향이 미치는 코드베이스의 범위, 그리고 기술적 제약 사항을 식별하는 것입니다.
이를 통해 모바일 화면에서의 입력 편의성을 획기적으로 개선하고, Anthropic 에디토리얼 스타일의 신규 Card/Button 및 Flat Hairline 디자인 시스템을 일관되게 이식하고자 합니다.

---

## 2. 핵심 요구사항 분석 (UI-03, UX-01)

| 요구사항 ID | 세부 내용 | 구현 방향 |
|---|---|---|
| **UI-03** | Anthropic 스타일의 신규 Card/Button 적용 및 Flat Hairline 테두리, Sunset `#ea5b2a` / Accent `#1e8b7c` 포커스 링 적용 | 카드와 버튼에서 그림자 제거 및 얇은 실선 테두리(`1px solid var(--color-line)`)만 적용하는 Flat Hairline 스타일을 도입합니다. 입력창 포커스 시 웜톤 크림색에 맞는 Sunset 또는 Accent 계열의 얇은 아웃라인 링 트랜지션을 적용합니다. |
| **UX-01** | 모바일 우선 반응형 레이아웃 및 편리한 모바일 편집 폼 구성 | 모바일 화면(<= 760px)에서 입력 필드(`.control`)는 가로 100%의 1열 세로 스택 구조로 정렬하고, 편집 모드 활성화 시 카드가 수직으로 넓게 펼쳐지는 Inline Expand Card 방식을 도입합니다. 또한, 탭 네비게이션이 모바일 뷰에서 래핑되거나 어수선해지는 현상을 해결하기 위해 가로 스와이프가 가능한 에디토리얼 언더라인 스타일 탭을 적용합니다. |

---

## 3. 핵심 조사 결과

### 3.1. Form Layout & Spacing (모바일 우선 레이아웃)
*   **그리드 정렬 사양**:
    *   모바일(<= 760px)에서 모든 입력 필드(`.control`)는 가로 100%의 1열 세로 스택 구조로 정렬합니다. 카드 내부 여백은 콤팩트하게 `12px` 패딩을 적용하여 좁은 화면에서의 공간 효율성을 높입니다.
    *   PC 화면(>= 768px)에서는 미디어 쿼리를 사용하여 3열 그리드(`grid-template-columns: repeat(3, 1fr)`)로 넓게 펼쳐지도록 기존 레이아웃을 반응형으로 개편합니다.
*   **영향 영역**: `#inputsForm` 내의 `.controls-grid--simple` 및 `.controls-grid--advanced` 구조.

### 3.2. Inline Expand Card (모바일 항목 편집 모드)
*   **세로 3단 편집 구조**:
    *   모바일 화면에서 항목 편집 모드가 활성화(`is-editing` 클래스 부여 시)될 때, 가로 한 줄에 입력 필드가 우겨넣어져 깨지는 기존 현상을 방지하기 위해 Inline Expand Card 구조를 CSS로 구현합니다.
    *   1층: 이름 필드 (가로 100% 차지)
    *   2층: 계좌 선택 셀렉트 박스 + 금액 입력 필드 (좌우 flex 또는 grid 배치)
    *   3층: 변경 적용 및 삭제 버튼 (가로 100% 또는 하단 배치)
*   **PC 뷰 호환**: 화면 폭이 768px 이상인 PC 환경에서는 기존처럼 가로 1줄 형태로 편집 필드들이 자연스럽게 배치되도록 미디어 쿼리로 오버라이드합니다.

### 3.3. Swipeable Underline Tab (모바일 탭 개편)
*   **가로 스크롤 및 스크롤바 숨김**:
    *   탭 네비게이션(`.mgmt-tabs`)이 모바일에서 줄바꿈이 일어나 레이아웃이 엉키는 현상을 해결합니다.
    *   `display: flex; flex-wrap: nowrap; overflow-x: auto;` 속성을 주어 좌우로 터치 스와이프가 가능하게 만듭니다.
    *   `-webkit-overflow-scrolling: touch;` 속성으로 모바일 스크롤 관성 및 터치 가속도를 제공하여 부드러운 사용감을 줍니다.
    *   `scrollbar-width: none;` 및 `&::-webkit-scrollbar { display: none; }` 속성을 적용해 스크롤바를 시각적으로 숨겨 단정한 에디토리얼 스타일을 완성합니다.
*   **언더라인 에디토리얼 룩**:
    *   기존의 알약(Pill) 형태의 탭 디자인에서 탭 아래에 얇은 밑줄(`border-bottom: 2px solid var(--income)`)이 표시되도록 개편합니다.

### 3.4. Flat Hairline & Focus Design (컴포넌트 styling)
*   **그림자 제거 및 Hairline 테두리**:
    *   불필요한 `box-shadow`를 제거하여 정갈한 에디토리얼 룩을 완성합니다.
    *   패널 및 카드는 `border: 1px solid var(--color-line)` 또는 `border: 1px solid rgba(16, 34, 32, 0.12)` 실선 테두리만 남겨 평면적인 느낌을 줍니다.
*   **포커스 피드백 개선**:
    *   입력 필드(`.control input:focus`, `.control select:focus`) 포커스 시 기존의 굵고 이질적인 파란색 링 대신, Sunset 오렌지(`--color-sunset` 또는 `#ea5b2a`) 또는 Accent 그린(`--color-accent` 또는 `#1e8b7c`)의 얇은 아웃라인 링(`box-shadow: 0 0 0 2px var(--color-focus-ring)`)과 테두리 변화 트랜지션을 제공합니다.
    *   트랜지션 속도는 `transition: border-color 0.2s ease, box-shadow 0.2s ease;` 로 부드럽게 연출합니다.

---

## 4. 코드베이스 영향도 및 수정 범위 매핑

1.  **`shared/styles/step-theme.css`**
    *   버튼(`.btn`, `.btn-primary`), 카드(`.card`), 탭(`.mgmt-tabs`, `.mgmt-tab`) 등의 공통 스타일 정의 갱신.
    *   그림자(box-shadow) 제거 및 Flat Hairline 스타일 적용.
    *   포커스 링 테마 변수 및 기본 포커스 효과 갱신.
2.  **`apps/step1/styles.css`**
    *   Step 1에 특화된 `.control` 및 입력 필드 정렬 갱신.
    *   모바일 미디어 쿼리(`@media (max-width: 760px)`) 섹션 내의 `.mgmt-tabs`를 Swipeable 구조로 갱신.
    *   모바일 편집 모드(`.is-editing`) 시 `.editor-field`, `.allocation-remove` 등을 세로 3층 구조(1층: 이름, 2층: 계좌+금액, 3층: 삭제 버튼)로 배열하기 위한 CSS 규칙 작성.
    *   768px 이상 PC 뷰에서의 3열 그리드 오버라이드 룰 확인 및 정렬 보강.
3.  **`apps/step1/modules/list-renderer.js`**
    *   렌더링 시 부여되는 클래스와 마크업 구조가 CSS 반응형 규칙과 완벽히 호환되는지 확인.
    *   (기본적으로 HTML 마크업이 이미 충분히 클래스화되어 있으므로, 렌더러의 외과적 수정을 피하고 CSS 스타일링을 통한 레이아웃 수정에 집중합니다.)

---

## 5. 계획 수립 시 주의사항 & 성공 기준 (DoD)

1.  **물리적 무결성 수호 (styles.css 절삭 방지)**:
    *   `apps/step1/styles.css` 파일은 약 1,900라인에 달하는 큰 파일입니다. 수정 시 하단의 미디어 쿼리나 유틸리티 클래스가 훼손되지 않도록 주의하고, 수정 전후의 파일 크기 및 끝 라인을 반드시 비교 검증해야 합니다.
2.  **단위 정합성 준수**:
    *   본 단계는 UI/레이아웃 개편이므로 직접적인 데이터 모델 계산의 수정은 없으나, 입력 폼의 placeholder와 라벨 등에서 `만원` 단위 표기가 유지되도록 UI 정합성을 수호합니다.
3.  **반응형 레이아웃 회귀 방지**:
    *   760px 이하의 모바일 기기 화면 폭에서 탭이 깨지지 않고 가로 스크롤되는지, 입력 폼이 1열로 단정하게 떨어지는지 시각적 회귀 여부를 철저히 검증합니다.

---

## RESEARCH COMPLETE
 본 단계의 조사가 성공적으로 끝났습니다. 이제 도출된 파일 수정 범위와 디자인 스펙을 바탕으로 세부 구현 계획(PLAN.md)을 수립할 준비가 되었습니다.
