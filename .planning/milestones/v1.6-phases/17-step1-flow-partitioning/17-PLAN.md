# Phase 17: Step 1 Income Flow & Wallet Partitioning - Plan

## Goal Description

이 페이즈는 사용자의 월 수입 및 지출/저축/투자 자금의 흐름에 "통장 쪼개기(계좌 관리)" 모델을 안전하게 도입하여, 사용자가 가상의 금융 흐름을 현실 가계부처럼 직관적으로 매핑하고 시각화할 수 있도록 합니다.

구체적으로 다음 네 가지 핵심 요구사항을 구현합니다:
1. **커스텀 계좌 데이터 모델 및 입력 UI 구축(D-01, D-02):**
   - 사용자가 `급여계좌`, `생활비계좌`, `주식계좌` 등 계좌 목록(별칭)을 직접 추가, 수정, 삭제할 수 있는 계좌 관리 에디터를 제공합니다.
   - 항목 추가 시 자동으로 매핑을 유도하는 '매직 매핑(수입 ➔ 급여계좌, 지출 ➔ 생활비계좌, 투자 ➔ 주식계좌)' 규칙을 적용하여 사용자의 입력 인지 부하를 완화합니다.
2. **잉여현금 자동 이체 지정 문장형 UI 제공(D-03):**
   - 수입/지출 요약 카드 바로 하단에 직관적인 문장형 UI(`💡 이번 달 남는 잉여현금 [X만 원]은 [주식계좌 ▾]로 자동 이체합니다.`)를 배치하여 잉여현금의 최종 도착지 계좌를 간편하게 지정합니다.
3. **Sankey 차트 상의 중간 계좌 레이어 융합 시각화(D-04):**
   - 기존의 고정 대분류 노드(`생활비`, `저축`, `투자` 등)를 사용자가 정의한 '계좌/통장' 노드로 완전히 대체하여 4단계 레이어 구조(`[수입원] ➔ [계좌들] ➔ [세부 항목들]`)를 유지합니다.
   - 각 계좌별로 직접 유입되는 수입 합계와 직접 유출되는 세부 항목 합계의 차액을 계산하여, 공급 계좌에서 수요 계좌로의 내부 자금 이체 링크를 자동으로 연산/생성해 Sankey의 완벽한 흐름 무결성을 확보합니다.

## User Review Required

- **데이터 하위 호환성 유지:**
  - 기존 로컬 스토리지에 저장되어 있던 사용자의 데이터가 누락되지 않도록 `input-sanitizer.js` 내에서 `accounts` 목록과 `surplusTransferAccountId`를 살균 및 초기화할 때 기본 프리셋(`급여계좌`, `생활비계좌`, `주식계좌`)을 자동으로 하이드레이션합니다.
  - 기존 항목들에 `accountId` 필드가 없을 경우, 수입은 `acc-salary`, 생활비는 `acc-living`, 저축은 `acc-salary`(또는 `acc-living`), 투자는 `acc-stock`으로 매직 매핑하여 정상 동작을 유도합니다.

## Proposed Changes

### Core Constants & Data Model

#### [MODIFY] [constants.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/constants.js)
- `DEFAULT_INPUTS`와 `SAMPLE_INPUTS`에 기본 `accounts` 리스트 및 `surplusTransferAccountId`를 추가합니다:
  ```javascript
  accounts: [
    { id: "acc-salary", name: "급여계좌" },
    { id: "acc-living", name: "생활비계좌" },
    { id: "acc-stock", name: "주식계좌" }
  ],
  surplusTransferAccountId: "acc-stock"
  ```
- 각 항목군별 매직 매핑에 필요한 기본 계좌 ID 규칙을 상수로 정의합니다:
  ```javascript
  export const MAGIC_MAPPING_DEFAULTS = {
    income: "acc-salary",
    expense: "acc-living",
    savings: "acc-salary",
    invest: "acc-stock"
  };
  ```

#### [MODIFY] [input-sanitizer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/input-sanitizer.js)
- `sanitizeInputs` 함수가 `accounts` 목록과 `surplusTransferAccountId`를 정상적으로 반환하도록 살균 로직을 추가합니다.
  - `accounts`가 존재하지 않거나 빈 배열일 경우 기본 3대 프리셋 계좌를 강제 주입합니다.
  - 각 계좌 아이템은 `{ id, name }` 형식으로 살균 및 정규화합니다.
  - `surplusTransferAccountId`가 가리키는 계좌가 실제 `accounts` 목록에 없을 경우 `acc-stock` 또는 첫 번째 계좌 ID로 포백 처리합니다.
- `sanitizeIncomeItems`, `sanitizeAllocationItems`에서 각 아이템별 `accountId` 속성을 수집 및 보존합니다. 만약 `accountId`가 비어있거나 올바르지 않은 경우 `MAGIC_MAPPING_DEFAULTS`에 따라 매직 매핑 기본값을 할당합니다.

### Application State & Helpers

#### [MODIFY] [state.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state.js)
- `state.itemEditors` 에 `account` 편집 영역 상태를 추가합니다:
  ```javascript
  itemEditors: {
    ...
    account: { active: false, items: [], baselineSignature: "" }
  }
  ```

#### [MODIFY] [state-helpers.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state-helpers.js)
- `getItemEditorSignature` 에서 `account` 아이템의 변경 여부를 정상 식별할 수 있도록 `name` 변경을 수집할 수 있게 보완합니다.
- `readInputsFromForm`와 `applyInputsToForm`이 폼의 기타 단일 필드처럼 `surplusTransferAccountId` 정보를 폼 엘리먼트와 양방향 연동하도록 기능을 보완합니다.

### User Interface & List Rendering

#### [MODIFY] [index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/index.html)
- `summaryCards` 요약 카드 컨테이너 바로 밑에 문장형 잉여현금 이체 배너 영역을 마크업합니다:
  ```html
  <div id="surplusTransferBanner" class="surplus-transfer-banner" hidden>
    💡 이번 달 남는 잉여현금 <span id="surplusAmountText">0만 원</span>은 
    <select id="surplusTransferAccountSelect" class="surplus-select" aria-label="잉여현금 자동 이체 계좌"></select> 
    으로 자동 이체합니다.
  </div>
  ```
- 입력값 폼(`inputsForm`) 내 "월 수입 항목" 밑에 계좌 목록을 추가/삭제/편집할 수 있는 계좌 관리 블록을 마크업합니다:
  ```html
  <div class="controls-block">
    <div class="block-head">
      <h3>통장(계좌) 관리</h3>
      <div class="block-head-tools">
        <button id="editAccountItems" class="btn btn-ghost btn-sm" type="button">항목 편집</button>
      </div>
    </div>
    <p class="hint">자산 흐름의 중간 통로가 되는 통장을 추가하거나 이름을 편집합니다.</p>
    <div id="accountList" class="account-list" aria-live="polite"></div>
    <div id="accountEditorActions" class="editor-actions" hidden>
      <button id="addAccountItem" class="btn btn-ghost btn-sm" type="button">통장 추가</button>
      <button id="applyAccountItems" class="btn btn-primary btn-sm" type="button">변경 적용</button>
      <button id="cancelAccountItems" class="btn btn-ghost btn-sm" type="button">편집 취소</button>
    </div>
  </div>
  ```

#### [MODIFY] [dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/dom.js)
- 계좌 관리 UI 엘리먼트들과 잉여현금 자동 이체 배너/선택 상자 엘리먼트들을 매핑합니다:
  - `surplusTransferBanner`, `surplusAmountText`, `surplusTransferAccountSelect`
  - `accountList`, `editAccountItems`, `accountEditorActions`, `addAccountItem`, `applyAccountItems`, `cancelAccountItems`

#### [MODIFY] [list-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/list-renderer.js)
- `renderItemList` 가 `group === "account"` 인 경우 계좌 관리 에디터용 전용 HTML을 렌더링하도록 `renderAccountItemHtml` 분기를 추가합니다.
- `renderIncomeItemHtml` 및 `renderAllocationItemHtml` 수정:
  - 편집 모드가 아닐 때는 계좌 정보가 레이블 형태로 우하단 또는 이름 옆에 노출되도록 `(급여계좌)`, `(생활비계좌)` 와 같이 표시합니다.
  - 편집 모드(`editing: true`)일 때는 매핑된 계좌를 변경할 수 있는 `<select data-field="accountId">` 드롭다운을 제공합니다.
  - 드롭다운 내부 옵션 리스트는 `state.inputs.accounts`를 바인딩하여 동적으로 출력합니다.

### Application Logic & Events

#### [MODIFY] [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js)
- `bindControls` 함수에 잉여현금 자동 이체 드롭다운 `surplusTransferAccountSelect` 에 대한 `change` 이벤트를 바인딩하여 변경 시 `state.draftInputs` (또는 `state.inputs`)에 반영하고 `markDirty()` 및 `renderAll()`을 트리거하도록 구현합니다.
- `bindItemEditorEvents` 함수의 에디터 대상 루프에 `"account"`를 포함시킵니다:
  `["income", "expense", "savings", "invest", "account"].forEach(...)`
- `applyItemEditor`, `cancelItemEditor`, `addItemToEditor` 등 항목 에디터 통합 제어 함수에서 `group === "account"` 일 때 `draft.accounts` 및 `state.inputs.accounts`를 타깃으로 CRUD를 처리할 수 있게 분기 로직을 정교하게 다듬습니다.
- `renderAll`에서 `buildSummaryCards`를 수행한 후, `snapshot.surplus > 0`인 경우 잉여현금 문장형 UI 배너를 노출하고 텍스트 및 드롭다운을 업데이트합니다. `surplus === 0`일 때는 배너를 숨깁니다.

### Flow Computation & Sankey Rendering

#### [MODIFY] [calculator.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/calculator.js)
- `buildMonthlySnapshot` 에서 계좌 정보와 각 세부 항목별 `accountId` 바인딩 관계를 snapshot 메타데이터로 함께 리턴하도록 반환 스키마를 갱신합니다.

#### [MODIFY] [sankey-builder.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/sankey-builder.js)
- `buildSankeyData` 연산 로직을 다음과 같이 고도화합니다:
  1. **계좌 노드 생성:** 기존의 대분류 노드(`expense`, `savings`, `invest` 등)를 전면 생략하고, `state.inputs.accounts`에 등록된 커스텀 계좌 노드들을 등록합니다.
  2. **수입원 ➔ 계좌 링크 생성:** 각 수입 항목은 항목에 지정된 입금 계좌 노드(`accountId`)로 직접 링크를 그립니다. (가상의 결손 흐름 역시 결손이 발생한 계좌 또는 주 계좌로 연결)
  3. **계좌 간 이체 연산:**
     - 각 계좌별로 `totalInflow` (해당 계좌로 직접 들어오는 수입 합계)와 `totalOutflow` (해당 계좌에서 직접 나가는 세부 항목 지출/저축/투자 합계 + 잉여현금 이체 타깃금액)를 계산합니다.
     - 각 계좌의 `balance = totalInflow - totalOutflow` 를 연산합니다.
     - `balance > 0` 인 계좌를 **공급처(Providers)**, `balance < 0` 인 계좌를 **수요처(Consumers)**로 분류합니다.
     - 공급처 계좌에서 수요처 계좌로 자금을 공급하는 내부 이체 링크(`source: provider, target: consumer, value: transferAmount`)를 수학적으로 순회 배분하며 자동 연산 생성합니다.
  4. **계좌 ➔ 세부 항목 링크 생성:** 각 지출, 저축, 투자 세부 항목 노드는 자신이 매핑된 출금 계좌 노드로부터 링크를 받습니다.
  5. **잉여현금 링크 생성:** 잉여현금(`surplus`)은 `surplusTransferAccountId`에 해당하는 계좌에서 나가 가상의 `surplus` 항목 노드로 연결되도록 링크를 추가합니다.

### Styles CSS

#### [MODIFY] [styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css)
- 잉여현금 문장형 UI 배너(`.surplus-transfer-banner`) 및 배너 내부 인라인 셀렉트 상자의 슬릭한 Glassmorphism 스타일을 설계합니다.
- 계좌 관리 리스트(`.account-row`, `.account-list`) 및 추가/삭제 버튼의 인터랙션 스타일을 추가합니다.
- 반응형 무결성을 위해 파일 최하단부 미디어 쿼리가 손상되지 않도록 확인하며 정합합니다.

## Verification Plan

### Automated Tests
- Vite 프로덕션 빌드 유효성 확인:
  `npm run build` 명령을 실행하여 번들 빌드 과정에서 TS/CSS 컴파일 에러나 경고 없이 산출물이 완벽하게 빌드되는지 확인합니다.

### Manual Verification
1. **계좌 CRUD 및 매직 매핑 동작 검증:**
   - 통장(계좌) 관리 블록에서 신규 계좌를 추가하고 이름을 변경하여 정상적으로 목록에 나타나는지 확인합니다.
   - 각 수입, 지출, 저축, 투자 상세 항목의 편집 모드에 들어갔을 때, 출금/입금계좌 선택 드롭다운 목록에 방금 수정한 커스텀 계좌명이 완벽히 실시간 연동되어 나타나는지 확인합니다.
   - 새 항목을 추가할 때 수입은 `급여계좌`, 지출은 `생활비계좌`, 투자는 `주식계좌`로 자동 매핑(매직 매핑)이 적용되는지 검증합니다.
2. **잉여현금 이체 문장형 UI 검증:**
   - 수입 금액을 지출 대비 넉넉하게 입력하여 잉여현금이 발생했을 때, 요약 카드 아래에 잉여현금 안내 배너가 즉시 노출되는지 확인합니다.
   - 문장 속 드롭다운을 통해 타깃 계좌(예: `주식계좌` ➔ `생활비계좌`)를 변경했을 때, Sankey 차트 상에서 잉여현금이 변경된 계좌 노드로부터 뻗어나가는지 시각적으로 검증합니다.
3. **중간 계좌 레이어 Sankey 흐름 무결성 검증:**
   - Sankey 차트 상에 기존 `생활비`, `저축`, `투자` 노드 대신 사용자가 정의한 `급여계좌`, `생활비계좌`, `주식계좌` 노드가 들어서는지 확인합니다.
   - `수입원 ➔ 계좌 ➔ 세부항목` 구조가 깨지지 않고, `급여계좌`에서 `생활비계좌` 등으로 돈이 흘러가는 내부 이체 흐름선이 렌더링 에러 없이 매끄럽게 연결되는지 검증합니다.
   - 뷰포트를 760px 이하로 줄였을 때 반응형 레이아웃 깨짐이나 차트의 극단적 축소/중첩 현상이 없는지 브라우저 개발자 도구 시뮬레이터로 확인합니다.
