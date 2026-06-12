# Phase 4: Account Transfer UI & UX Polish - Context

**Gathered:** 2026-06-12
**Status:** In Progress / Planning Phase 4

<domain>
## Phase Boundary

계좌 간 이체/분배 UI 구현 및 단계 전환 부드러운 애니메이션 적용 (요구사항: CORE-03, UX-02).
- 기존의 Sankey 다이어그램은 수입 ➔ 계좌 ➔ 지출/저축/투자 대분류의 3단 흐름만 렌더링하는 용도로 역할을 국한시킵니다.
- 계좌 간의 복잡한 다대다(N:N) 이체 흐름을 나타내기 위해, SVG 기반의 독립적인 **"계좌 간 자금 흐름 지도(Account Flow Network Map)"** 시각화 컴포넌트를 신설합니다.
- 데이터 모델을 확장하여 사용자가 직접 계좌 간 이체(출발 계좌 ➔ 도착 계좌, 금액)를 관리할 수 있는 수동 이체 룰 및 편집 UI를 도입합니다.
- Step 화면 간(1단계 ➔ 2단계 ➔ 3단계) 전환 시의 끊김 현상을 제어하기 위해 뷰포트 트랜지션 애니메이션을 적용하고, 전체적인 마이크로 모션 효과를 고도화합니다.
</domain>

<decisions>
## Implementation Decisions

### 1. Account Flow Network Map (계좌 간 자금 흐름 지도 신설)
- **D-01:** Sankey Diagram 하단에 SVG로 자체 렌더링되는 전용 네트워크 흐름 맵 `#accountFlowNetworkMap`을 구축합니다.
  - **기하학적 배치:** 각 계좌 노드(SVG `<rect>` 또는 `<circle>`)를 일정한 수평/수직 정렬 또는 원형 레이아웃으로 균형 있게 배치합니다.
  - **유향 흐름 화살표:** 계좌 노드 간의 이체 관계를 정밀한 SVG `<path>` (곡선 및 직선)와 화살표 마커(`marker-end="url(#arrow)"`)로 연결합니다.
  - **이체 펄스 애니메이션:** 화살표 선 상에 작은 점(Particle)이 출발지에서 목적지로 부드럽게 반복 이동하는 CSS `stroke-dashoffset` 기반의 흐름 애니메이션을 가미하여 자금의 방향성을 극대화합니다.
  - **호버 포커스 필터링:** 특정 계좌 노드를 마우스 호버하면, 해당 노드에서 출발하거나 들어오는 이체 경로만 진해지고(Opacity 1.0) 무관한 다른 노드 및 연결선들은 페이드아웃(Opacity 0.15) 처리되어 복잡한 N:N 관계도 한눈에 필터링해 볼 수 있게 합니다.

### 2. Manual Transfer Rules & UI (수동 이체 설정 및 편집기 도입)
- **D-02:** 자동 이체(Greedy 잔액 맞춤) 외에 사용자가 명시적으로 이체 관계를 제어할 수 있도록 스키마와 UI를 확장합니다.
  - **데이터 모델 확장:** `Step1State` 인터페이스 내에 `transfers` 규칙 배열을 추가로 영속화합니다.
    ```typescript
    export interface TransferRule {
      id: string;
      sourceAccountId: string;
      targetAccountId: string;
      amount: Won; // 내부적 원, UI 표시 만원
      label: string; // 이체 명칭
    }
    ```
  - **이체 설정 폼 UI:** 입력 폼 탭이나 설정 하단에 "계좌 간 이체 설정" 영역을 신설합니다. 사용자는 드롭다운으로 `출발 계좌`, `도착 계좌`를 고르고 금액과 메모를 적어 이체 규칙을 즉각 추가/삭제할 수 있습니다.
  - **밸런싱 논리 통합:** 수동 이체 설정액이 반영된 후 남은 잉여 자금에 대해서만 기존의 자동 이체(Greedy) 연산이 상호 보완적으로 개입하거나, 혹은 수동 이체가 설정되면 자동 이체는 중단되는 명확한 밸런싱 플로우를 정립합니다.

### 3. Step Transitions & Global Micro-motions (화면 전환 및 전역 모션 UX 개선)
- **D-03:** Step 간 탭/화면 전환 시 콘텐츠 영역이 순식간에 툭 바뀌는 하드 컷(Hard Cut)을 지양하고, 부드러운 페이드 슬라이드(Fade & Slide) 트랜지션을 구현합니다.
  - 전환 방향에 따라 오른쪽에서 왼쪽으로 흐르는 부드러운 모션을 CSS 트랜지션으로 처리합니다.
  - Step 1의 전체 카드 및 로우 컴포넌트(입력 폼 영역, 스냅샷 영역 등)에 마우스 호버 시 `transform: translateY(-2px);` 및 테두리/섀도우 변화를 일괄 이식하여 프리미엄 에디토리얼 테마의 완성도를 전역에서 확보합니다.

### 4. Real-time Safety Margin Reactivity (실시간 과세 경고 인디케이터 강화)
- **D-04:** 사용자가 저축/투자 이율이나 금액을 변경할 때 관련 금융소득종합과세 한도 초과 경고(1900만 원 초과 시 경고, 3400만 원 초과 시 위험)의 실시간 상태 변화가 차트 및 경고 뱃지/링에 지연 없이 부드러운 페이드 효과와 함께 즉각 피드백되도록 UI 렌더링 라이프사이클을 견고히 합니다.
</decisions>

<specifics>
## Specific Ideas
- "생키는 돈이 수입원으로부터 대분류 지출/저축/투자로 흘러가는 '전체 맥락적 분포'만 명쾌히 드러내고, 계좌 사이에서 일어나는 모든 디테일한 N:N 이동(예: 월급계좌 ➔ 생활비계좌 ➔ 비상금계좌)은 전용 네트워크 맵이 맡아서 서로 방해하지 않고 아름답게 공존하도록 만든다."
- "이체 선 위를 지나가는 펄스 파티클 애니메이션을 넣으면 대형 핀테크 플랫폼 대시보드를 연상시키는 높은 시각적 완성도와 만족감을 줄 것이다."
</specifics>

<canonical_refs>
## Canonical References
- `DESIGN.md` — 디자인 시스템 가이드.
- [apps/step1/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js) — Step 1 코어 라이프사이클 및 렌더링 컨트롤러.
- [apps/step1/styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css) — 전체 스타일시트 및 미디어 쿼리.
- [apps/step1/modules/sankey-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-renderer.js) — 기존 SVG 렌더링 로직.
- [apps/step1/modules/calculator.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/calculator.js) — 수치 및 금융소득 종합과세 연산 코어.
</canonical_refs>

---
*Phase: 04-account-transfer-ui-ux-polish*
*Context gathered: 2026-06-12*
