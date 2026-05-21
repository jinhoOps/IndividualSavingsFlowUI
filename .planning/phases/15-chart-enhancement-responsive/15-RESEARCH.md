# Phase 15: Chart Enhancement & Responsive - Research

본 문서는 Phase 15 (Sankey Chart 데이터 라벨링 및 모바일 레이아웃 고도화)를 위해 필요한 핵심 파일들의 작동 원리를 분석하고, 구체적인 설계 사양을 고도화하여 downstream 구현 에이전트들이 시행착오 없이 코드를 작성할 수 있도록 돕는 기술 연구 문서입니다.

---

## 1. 대상 모듈 정밀 연구

### A. [sankey-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js) 분석
* **노드 렌더링 (`drawNode`)**: 
  - 기본적으로는 노드의 좌측(source) 또는 우측(target) 방향에 `sankey-label` 텍스트와 `sankey-value` 텍스트를 나열하는 2행 텍스트 구조로 되어 있습니다.
  - 현재 노드 높이(`node.h`)가 22px 이상일 때만 수치를 하단에 노출하고 있습니다.
* **그리드 간격 조율**:
  - `minColumnStep`에 따라 컬럼 간의 물리적 거리(`step`)가 조율되며, SVG의 viewBox 너비와 높이가 결정됩니다.
  - 모바일에서는 너비가 1.38배 확대 계산되나(SANKEY_MOBILE_WIDTH_SCALE), 줌 배율이 곱해져 렌더링됩니다.
* **링크 그리기 (`orderedLinks.forEach`)**:
  - 순수 SVG Path 엘리먼트(`sankey-path`)를 생성하며, 클래스명에 `tone-${link.tone}`을 매핑하여 CSS에 따른 색상을 바인딩해 오고 있습니다.

---

## 2. 세부 구현 기술 사양 설계

### [Requirement 1] 모바일 배지형 라벨링 및 텍스트 겹침 방지 (D-01)
- **목적**: 768px 이하 모바일 환경에서 텍스트가 좌/우에 있으면 가로 공간이 협소하여 서로 겹치거나 뷰포트를 벗어나 화면이 깨지는 현상이 발생합니다.
- **해결 방안**: 모바일 뷰포트(`isMobileViewport === true`)일 때, 라벨과 수치 텍스트를 노드의 좌우가 아닌 **노드의 가로 중앙 상단**에 말풍선/배지 스타일로 얹어 좌우 공간 확보율을 극대화합니다.
- **상세 렌더링 공식**:
  - 텍스트 앵커: `"middle"` (`text-anchor: middle`)
  - X 좌표: `labelX = node.x + nodeWidth / 2`
  - Y 좌표: 노드 상단에 배치해야 하므로 `labelY = node.y - 18` (라벨명), `centerY = node.y - 6` (값)
  - **배지 박스(rect) 생성**:
    - 텍스트 뒤에 둥근 사각형(`rx="4" ry="4"`)을 생성하여 글자의 가독성을 극대화합니다.
    - 배경 박스 가로 너비: `labelWidth = Math.max(measureSankeyTextWidth(node.label, 10, 700), measureSankeyTextWidth(formatCurrency(node.value), 9)) + 8` (약간의 패딩 가미).
    - 배경 박스 세로 높이: 2행 텍스트가 모두 렌더링될 경우 약 `26px`, 단행일 경우 `16px`.
    - 배경 박스 X/Y: `rectX = labelX - labelWidth / 2`, `rectY = node.y - (showValue ? 28 : 18)`.
    - 배경 박스 채우기: 반투명 다크 그레이 또는 글래스 톤 (`fill="rgba(255, 255, 255, 0.95)"`, `stroke="rgba(0,0,0,0.15)"`)을 적용해 선명도 극대화.

### [Requirement 2] Sunset/Deep Sea 그라디언트 링크 렌더링 (D-02)
- **목적**: 투박한 단색 혹은 조화롭지 않은 라인 컬러링을 배제하고, `DESIGN.md` 스펙의 두 핵심 브랜드 아이덴티티 컬러(Sunset/Deep Sea)를 시각화에 적용하여 비주얼 WOW 요소를 선사합니다.
- **해결 방안**: SVG 내부에 `<defs>` 블록을 생성하고, Sunset(#ea5b2a)에서 Deep Sea(#1e8b7c)로 부드럽게 흐르는 `<linearGradient>`를 선언하여 링크의 `stroke`에 적용합니다.
- **상세 명세**:
  - SVG 최초 생성 및 렌더링 루프 시, `dom.sankeySvg.innerHTML = ""` 처리 직후 혹은 최초에 `<defs>` 블록을 삽입합니다.
  - `<defs>` 블록 내에 ID가 `isf-sankey-sunset-deepsea-gradient` 인 `linearGradient` 요소를 정의합니다:
    ```xml
    <linearGradient id="isf-sankey-sunset-deepsea-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ea5b2a" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#1e8b7c" stop-opacity="0.5" />
    </linearGradient>
    ```
  - 모든 `sankey-path` 엘리먼트에 클래스 바인딩 외에 `stroke="url(#isf-sankey-sunset-deepsea-gradient)"`를 직접 적용합니다.
  - 마우스 호버(`mousemove`) 시에는 `stop-opacity`를 `0.85`로 올리는 효과를 지원하여 생동감 넘치는 반응형 피드백을 전달합니다.

### [Requirement 3] 모바일 100% 압축 화면 맞춤 최적화 (D-03)
- **목적**: 가로 스크롤바 없이 768px 이하 모바일 화면의 가로 폭 100% 내에 다이어그램 전체가 흐트러짐 없이 안착하도록 조율합니다.
- **해결 방안**:
  - 모바일 세로 뷰포트에서 `sankeySvg.style.width`를 무조건 `100%`로 통일 처리하여 가로 스크롤바의 생성을 미연에 방지합니다.
  - 가로 폭이 압축될 때 텍스트가 서로 충돌하는 현상을 `[Requirement 1]`의 2열 세로 말풍선 배지 배치와 연동하여 레이아웃이 무너지지 않도록 촘촘한 step 설계를 정합시킵니다.
  - 모바일 해상도에서 `nodeGap`을 `hasGroupLayer ? 14 : 10` 수준으로 더 촘촘하게 압축하여 수직 공간 효율을 극대화합니다.

---

## 3. 잠재적 리스크 및 방어 전략
- **텍스트 너비 오차**: SVG 텍스트가 실제 브라우저 폰트("Gowun Dodum")와 오차가 있어 배지 rect가 너무 작게 렌더링될 수 있습니다. `measureSankeyTextWidth` 시 폰트 명세 패밀리를 최신화하여 정확한 너비를 추출하고, 안전 여백(여유 패딩 8px)을 확보합니다.
- **그라디언트 ID 중복**: SVG 재생성 시 `<defs>`가 매번 삽입되어 중복 정의되거나 유실되지 않도록 `renderSankey` 함수 도입부에 확실하게 초기화하고 `<defs>`를 첫 요소로 append하는 방어 로직을 적용합니다.
