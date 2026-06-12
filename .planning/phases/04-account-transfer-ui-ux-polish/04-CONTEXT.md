# Phase 4: Account Transfer UI & UX Polish - Context

**Gathered:** 2026-06-12
**Status:** In Progress / Planning Phase 4 (Feedback Applied)

<domain>
## Phase Boundary

계좌 간 이체/분배 UI 구현 및 시각화 슬라이드/전환 애니메이션 적용 (요구사항: CORE-03, UX-02).
- 기존의 Sankey 다이어그램은 수입 ➔ 계좌 ➔ 지출/저축/투자 대분류의 3단 흐름만 렌더링하는 용도로 역할을 국한시킵니다.
- 계좌 간의 복잡한 다대다(N:N) 이체 흐름을 나타내기 위해, 독립적인 **"계좌 간 자금 흐름 지도(Account Flow Network Map)"** 시각화 컴포넌트를 신설합니다 (경량 외부 라이브러리 사용 혹은 SVG 자체 구현).
- 데이터 모델을 확장하여 사용자가 직접 계좌 간 이체(출발 계좌 ➔ 도착 계좌, 금액)를 관리할 수 있는 수동 이체 룰 및 직관적인 편집 UI를 도입하여 사용성 난이도를 제어합니다.
- Step 1 내부 시각화 영역(Sankey ↔ Network Map)의 가로 슬라이딩 전환 트랜지션 애니메이션을 구현합니다.
- 화면 내의 긴 텍스트 기반 설명들을 모두 `?` 아이콘으로 통합하고 마우스 호버 시 뜨는 Glassmorphism 툴팁으로 리팩토링합니다.
</domain>

<decisions>
## Implementation Decisions

### 1. Account Flow Network Map (계좌 간 자금 흐름 지도 신설)
- **D-01:** Sankey Diagram과 영역을 교체할 수 있는 전용 네트워크 흐름 맵 `#accountFlowNetworkMap`을 구축합니다.
  - **라이브러리 및 구현체:** 빌드 후 파일 크기가 가볍다면 외부 경량 라이브러리(예: `d3-force` 모듈 일부 활용 등) 도입을 적극 허용하되, 라이브러리 번들 오버헤드가 크다면 순수 SVG 기반 노드-링크 배치 구현을 기본으로 삼습니다. 최종 빌드 산출물의 파일 용량 변화를 모니터링합니다.
  - **이체 펄스 애니메이션:** 화살표 선 상에 작은 점(Particle)이 출발지에서 목적지로 부드럽게 반복 이동하는 CSS `stroke-dashoffset` 기반의 흐름 애니메이션을 가미하여 자금의 방향성을 극대화합니다.
  - **호버 포커스 필터링:** 특정 계좌 노드를 마우스 호버하면, 해당 노드에서 출발하거나 들어오는 이체 경로만 진해지고(Opacity 1.0) 무관한 다른 노드 및 연결선들은 페이드아웃(Opacity 0.15) 처리되어 복잡한 N:N 관계도 한눈에 필터링해 볼 수 있게 합니다.

### 2. Manual Transfer Rules & UX Polish (수동 이체 설정 및 편집기 도입)
- **D-02:** 사용자가 명시적으로 이체 관계를 제어할 수 있도록 스키마와 사용성을 고려한 UI를 확장합니다.
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
  - **사용자 편의성(UX) 강화:** 복잡한 인풋 폼 구조 대신 가독성이 높은 문장형(Sentence UI) 구조 혹은 직관적인 카드 형식으로 구현합니다. (예: `[출발 계좌 ▾]에서 ➔ [도착 계좌 ▾]로 [금액]만 원을 ➔ [이체 추가 버튼]`)
  - **도움말 힌트 제공:** 출발 계좌를 선택할 때, 해당 계좌에 유입된 금액과 이미 지출/이체 설정 등으로 배분되고 남은 "출금 가능 예상 잔액"을 인풋 필드 옆에 미세 텍스트로 보완하여 오입력을 미연에 방지합니다.
  - **목록 인터랙션:** 등록 완료된 이체 카드는 심플하게 표시하고, 마우스 오버 시에만 `삭제(X)` 버튼이 페이드인으로 노출되도록 하여 시각적 잡음을 줄입니다.

### 3. Step 내 시각화 슬라이드 전환 (Visual Slide Transition)
- **D-03:** 화면 높이 낭비 및 인지 과부하를 막기 위해, Sankey Diagram과 계좌 간 자금 흐름 지도는 단일 시각화 카드 패널 내에 공존하며 탭/토글 제어기로 서로 스위칭됩니다.
  - 전환 시 두 차트 영역이 좌우로 부드럽게 슬라이드(Slide Transition)하거나 페이드되는 모션 클래스(`.visual-slide-container`)를 설계합니다.
  - 이와 함께, Step 1의 전체 카드 및 로우 컴포넌트(입력 폼 영역, 스냅샷 영역 등)에 마우스 호버 시 `transform: translateY(-2px);` 및 테두리/섀도우 변화를 일괄 이식하여 프리미엄 에디토리얼 테마의 완성도를 전역에서 확보합니다.

### 4. Real-time Safety Margin Indicator (디자인 스펙 정의)
- **D-04:** 금융소득종합과세 한도 초과 경고 인디케이터(경고 링, 뱃지 등)의 점등 기준 및 시각 효과를 명확한 디자인 규격으로 수립하여 적용합니다.
  - **Warn 스펙 (1,900만 원 초과):** Border `#f59e0b` (Yellow), Glow `box-shadow: 0 0 8px rgba(245, 158, 11, 0.35)`, Badge 글자색 `#d97706`/배경 `rgba(245, 158, 11, 0.1)`.
  - **Crit 스펙 (3,400만 원 초과):** Border `#dc2626` (Red), Glow `box-shadow: 0 0 12px rgba(220, 38, 38, 0.45)`, Badge 글자색 `#b91c1c`/배경 `rgba(220, 38, 38, 0.1)`.
  - **애니메이션 트랜지션:** 상태 변화 시 `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`를 적용하여 부드럽게 점등/소등되도록 설계합니다.

### 5. 가이드 텍스트의 툴팁 및 `?` 아이콘 통합
- **D-05:** 화면 곳곳에 산재해 있는 긴 설명 문구들(금융소득종합과세 설명, 잉여현금 자동이체 힌트, 과거 지출 비교 안내 등)을 전부 `?` 아이콘 형태로 축소하고, 아이콘 호버 시 Glassmorphism 디자인의 부유형 툴팁(`.isf-tooltip`)이 노출되도록 정리하여 레이아웃을 극도로 깔끔하게 비워냅니다.
</decisions>

<specifics>
## Specific Ideas
- "차트를 한 화면에 위아래로 길게 늘어놓지 않고, '전체 흐름(Sankey)' ↔ '계좌 이체망(Network Map)'을 시각화 패널 내 탭으로 슬라이딩하여 골라보게 하면 한층 세련된 핀테크 UX를 제공한다."
- "수동 이체 설정 시 출발 계좌의 남은 잉여금을 실시간 힌트로 띄워주면 UX 장벽이 획기적으로 낮아질 것이다."
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
