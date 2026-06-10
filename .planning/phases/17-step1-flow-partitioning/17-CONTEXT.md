# Phase 17: Step 1 Income Flow & Wallet Partitioning - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

수입 입력 시 단순 금액 입력 외에 '입금/급여 계좌' 매핑 기능이 지원되고, 중간 계좌(통장 쪼개기) 레이어가 도입되어 수입 -> 계좌 -> 지출/저축/투자 항목으로 이어지는 흐름을 설계 및 시각화합니다. 잉여현금에 대해서는 특정 주식계좌나 저축계좌로 흐르는 자동 이체 기능을 구성합니다.

</domain>

<decisions>
## Implementation Decisions

### 계좌(통장) 데이터 모델 및 입력 UI 설계
- **D-01 (커스텀 계좌 모델 도입):** 사용자가 계좌 목록(이름, 초기 잔액 등)을 관리하고 각 수입/지출/저축/투자 항목에서 드롭다운으로 매핑하는 방식을 취합니다 (옵션 1-A).
- **D-02 (UX 복잡도 완화 매커니즘):** 최초 진입 시 `급여계좌`, `생활비계좌`, `주식계좌(투자)` 등의 기본 프리셋 계좌를 자동 제공합니다. 또한 지출 추가 시 `생활비계좌`, 투자 추가 시 `주식계좌` 등으로 자동 매핑(매직 매핑)되도록 하여 사용자가 특수한 상황에서만 드롭다운을 열어 직접 변경하게 유도함으로써 인지 부하를 줄입니다.

### 잉여현금 자동 이체 및 배분 흐름 규칙
- **D-03 (잉여현금 자동 이체 지정):** 잉여현금이 발생할 때 별도의 복잡한 이체 규칙 관리 UI 대신, 수입/지출 요약 카드 바로 하단에 직관적인 문장형 UI (`💡 이번 달 남는 잉여현금 [X만 원]은 [주식계좌 ▾]로 자동 이체합니다.`)를 제공하여 잉여현금의 최종 목적지 계좌를 지정할 수 있게 합니다 (옵션 2-A).

### Sankey 차트 상의 중간 계좌 레이어 시각화 방식
- **D-04 (계좌와 대분류의 융합):** 차트 가독성을 확보하고 토글 조작 등의 추가 피로도를 방지하기 위해, 기존의 고정 대분류(생활비/저축/투자) 노드 자체를 사용자가 설정한 '계좌/통장' 노드로 대체하여 4단계 레이어 구조(`[수입원] ➔ [계좌들] ➔ [세부 항목들]`)를 유지합니다 (대안 A).

### the agent's Discretion
- 기본 프리셋 계좌의 명칭 및 상세 명세 (예: 은행명 입력 여부 등은 생략하고 단순 통장 별칭 중심 구성).
- 항목 추가 시 자동으로 매핑되는 '기본 계좌 매직 매핑'의 내부 규칙 설계.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Configurations & Routing
- `[ROADMAP.md](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/ROADMAP.md)` — Phase 17 목표 및 마일스톤 사양
- `[PROJECT.md](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/PROJECT.md)` — 프로젝트 핵심 비전 및 의사결정 내역

### Step 1 Source Files
- `[apps/step1/modules/sankey-builder.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-builder.js)` — Sankey 차트 노드/링크 빌드 로직
- `[apps/step1/modules/calculator.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/calculator.js)` — 수입/지출 요약 및 시뮬레이션 계산 로직
- `[apps/step1/modules/state.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state.js)` — Step 1 전역 상태 및 에디터 관리

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildMonthlySnapshot` in `calculator.js`: 월 수입 및 지출/저축/투자 총합 계산. 잉여현금(`surplus`) 연산 로직 재사용 가능.
- `buildSankeyData` in `sankey-builder.js`: 노드와 링크를 연결하는 뼈대 로직 활용 가능.

### Established Patterns
- **Modern Hybrid (No-build)**: 브라우저에서 직접 빌드/실행 가능한 순수 JavaScript 및 CSS 분리 구조 유지.
- **만원 vs 원 단위 무결성**: UI는 만원 단위, 내부 계산은 원 단위를 철저히 보존.

### Integration Points
- `sankey-builder.js` 내부에서 기존 대분류(`expense`, `savings`, `invest` 등) 대신, `inputs.accounts` 계좌 리스트를 노드로 사용하고 각 아이템을 해당 계좌 노드 하위로 링크하여 차트 흐름을 재생성해야 합니다.
- `app.js` 및 `ui-controller.js`에서 계좌를 추가하고 설정할 수 있는 미니멀한 UI 모달 또는 입력 폼 바인딩이 요구됩니다.

</code_context>

<specifics>
## Specific Ideas
- 문장형 이체 설정 UI: `"💡 이번 달 남는 잉여현금 [ 80만 원 ] 은 [ 주식계좌 ▾ ] (으)로 자동 이체합니다."`
- 계좌 목록 기본 제공: 사용자가 설정을 건드리지 않고도 바로 쓸 수 있는 `급여계좌`, `생활비계좌`, `주식계좌(투자)` 프리셋 제공.

</specifics>

<deferred>
## Deferred Ideas
- 계좌 간 복잡한 다자간 수동 이체 규칙 설정 (A계좌 -> B계좌 수동 이체 등)은 UX 복잡성을 위해 향후 필요성이 제기될 때까지 구현을 보류합니다.

</deferred>

---

*Phase: 17-Step 1 Income Flow & Wallet Partitioning*
*Context gathered: 2026-06-10*
