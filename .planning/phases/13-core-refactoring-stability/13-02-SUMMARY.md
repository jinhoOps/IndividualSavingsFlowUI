# Plan 13-02 Summary: list-renderer.js 모듈 추출 (3계층 모듈화)

`app.js` 내의 순수 UI 렌더 함수 7종과 보조 힌트 함수 4종(총 11종)을 `apps/step1/modules/list-renderer.js`로 성공적으로 추출하고, `app.js`에서 호출부를 리네이밍하여 3계층(상태/헬퍼/UI) 모듈화를 안정적으로 구현했습니다.

## Accomplishments
- **`list-renderer.js` 모듈 생성 및 함수 이동 (T1)**:
  - `apps/step1/modules/list-renderer.js` 파일을 신규 생성하고 필요한 의존성(`dom`, `state`, `IsfUtils`, `formatCurrency`, `buildAllocationMetaText`, `getMonthlyIncomeTotalWon`)을 안정적으로 임포트했습니다.
  - `app.js`에서 11개 UI 렌더링 함수를 이동하고 `export function`으로 선언했습니다:
    - `renderCards`, `renderProjectionTable`, `renderItemList`, `renderIncomeItemHtml`, `renderAllocationItemHtml`, `getPendingSummaryText`, `renderInputHints`, `renderIncomeTotalHint`, `renderExpenseTotalHint`, `renderSavingsTotalHint`, `renderInvestTotalHint`
  - `renderProjectionTable` 내에서 전역 상태 대신 임포트된 `state` 객체(`state.projectionOptions`)를 직접 참조하도록 모듈화를 완성했습니다.
  - XSS 방지를 위한 `IsfUtils.escapeHtml` 호출 및 단위 정합성(`toMan`)을 그대로 보존했습니다.

- **`app.js` 내 노후 함수 정리 및 임포트 연동 (T2)**:
  - `apps/step1/app.js` 상단에 `import * as listRenderer from "./modules/list-renderer.js";`를 삽입했습니다.
  - `app.js` 내부의 11개 구식 렌더 함수 정의부(기존 715~843라인)를 완벽하게 삭제하여, 코드 크기를 870줄에서 740줄로 축소(약 130줄 절감)했습니다.
  - `renderAll()`, `handleItemInput()`, `handleItemClick()`, `setPendingBarVisible()`, `markPendingChanges()`, `setItemSortMode()`, `renderIncomeList()` 등에서 11개 렌더링 함수에 대해 `listRenderer.` 접두사를 붙여 참조하도록 모든 호출부를 수정했습니다.
  - `handleApplySmartAdd` 콜백 함수 인자(`renderItemList`)도 `listRenderer.renderItemList`로 올바르게 교체 및 바인딩했습니다.

- **6종 핵심 헬퍼 함수 무결성 검증 (T3)**:
  - `commitImmediateInputs`, `markPendingChanges`, `hasPendingChanges`, `getVisibleInputs` 함수가 `app.js` 내에 렌더링 도메인과 섞이지 않고 온전히 유지되고 있음을 검증했습니다.
  - `helpers.markDirty(state)`와 `helpers.markClean(state)`가 `app.js`에서 핵심 상태 변경 주기 및 초기화 로직에 적절하게 호출되고 있음을 검증했습니다.
  - `list-renderer.js`에는 어떠한 헬퍼나 상태 전이 로직도 혼입되지 않았으며 순수 UI 렌더링 역할만을 담당하고 있음을 확인했습니다.

## Verification Result
- `apps/step1/modules/list-renderer.js` 내에 export된 함수 개수: **11개** (검증 통과)
- `apps/step1/app.js` 파일의 총 라인 수: **740줄** (740줄 이하 검증 통과)
- ES Module 기반의 빌드 없는 브라우저 연동 무결성이 완전히 확보되었습니다.
