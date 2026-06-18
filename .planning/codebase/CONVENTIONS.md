# 코드베이스 컨벤션 (Codebase Conventions)

본 문서는 개인 저축 흐름 UI(Individual Savings Flow UI) 프로젝트에서 준수해야 하는 핵심 코딩 컨벤션 및 개발 표준을 규정합니다.

## 1. 아키텍처 무결성 (Architectural Integrity)

*   **3계층 구조 (Three-Tier Architecture):** 각 앱(예: [apps/step1/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js))의 내부 로직은 명확하게 `State` (상태), `Helpers` (비즈니스 로직/유틸), `UI` (UI 및 렌더러)의 3계층으로 분리되어 있습니다. 리팩터링 및 기능 추가 시 이 구조를 엄격히 보존해야 합니다.
    *   **상태 계층:** [state.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state.js)에서 전역 상태를 관리합니다.
    *   **헬퍼 계층:** [state-helpers.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/state-helpers.js) 및 [utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/utils.js) 등에서 순수 함수 형태의 데이터 처리를 제공합니다.
    *   **UI 계층:** [ui-controller.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/ui-controller.js) 등에서 상태를 UI 요소와 동기화합니다.
*   **핵심 헬퍼 함수 보존:** 상태 변화와 저장 동기화의 근간을 이루는 필수 헬퍼 함수(예: `markDirty` 및 상태 변경 추적용 14종 이상의 함수)는 임의로 삭제하거나 형태를 변경해서는 안 됩니다.
*   **Modern Hybrid 지향 (No-build 우선 가용성):** Vite, TypeScript, Tailwind CSS 인프라를 활용하여 타입 안정성과 미래의 React 컴포넌트 점진 도입을 지원하지만, 레거시 바닐라 HTML/JS 모듈의 즉각적인 브라우저 실행 가용성 및 순수 CSS/JS의 간결함을 최대한 존중해야 합니다.
*   **외과적 수정 (Surgical Changes) 지침:** 작업 요청 범위에 직접 관련된 코드로 수정을 제한합니다. 무의미한 스타일 개선이나 리팩터링으로 인해 불필요한 변경 사항이 발생하는 것을 방지하고, 쓰이지 않는 변수/임포트만 정밀하게 정리해야 합니다.

## 2. 스타일 및 반응형 규칙 (Style and Responsive Rules)

*   **물리적 CSS 무결성 방어:** CSS/HTML 수정 시 파일 하단에 선언된 `@media` 쿼리나 유틸리티 클래스가 잘려 나가지(Truncate) 않도록, 수정 전후의 파일 용량 및 줄 수(Line Count)를 면밀히 검증해야 합니다.
*   **반응형 레이아웃 우선:** 모바일 해상도(760px 이하)에서 레이아웃이 파손되지 않도록 설계하고 검증해야 합니다. Evaluator 검증 단계에서 시각적 확인이 반드시 동반되어야 합니다.
*   **명명 규칙 (BEM / Snake Case):** CSS 클래스는 BEM 표기법(`block__element--modifier`) 또는 Snake Case(단어 간 하이픈/언더스코어 일관 적용)를 철저히 지켜 코드 스타일의 균일성을 유지합니다.

## 3. 단위 및 금액 정합성 (Unit & Currency Consistency)

애플리케이션 내 모든 자산 데이터의 통일성을 지키기 위한 강제 규칙입니다.

*   **원(Won) 단위 통일:** 모든 내부 계산과 영속화 데이터(IndexedDB, URL 해시 스냅샷 등)는 기본 단위인 **'원'** 단위를 기준으로 연산 및 저장됩니다.
*   **UI 한글 금액 힌트 제공:** 사용자의 입력 편의성을 극대화하기 위해, 숫자를 입력하는 필드(input type="number") 하단에 실시간으로 `convertToKoreanWon` 함수를 거친 한글 금액 힌트(예: "실시간 변환: 1억 2,000만 원")를 동적으로 렌더링합니다.
*   **대형 금액 표기 최적화:** 1억 원(10,000만 원) 이상의 금액을 UI에 표시할 경우 가독성을 극대화하기 위해 `X 억 Y 만원` 형태로 포맷팅합니다.
*   **유틸리티 활용 필수:** 환산 오차를 방지하기 위해 [utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/utils.js)에 구현된 유틸리티 함수들을 적극 사용해야 합니다.
    *   `IsfUtils.toWon()`: 내부 가치의 단위를 원 단위로 안전하게 통일할 때 사용합니다.
    *   `IsfUtils.toMan()`: 원 단위를 만원 단위로 정밀 변환합니다.
    *   `IsfUtils.formatMoney()`: 머니 텍스트 가독성 출력을 지원합니다.
    *   `IsfUtils.convertToKoreanWon()`: 금액을 '억/만/원' 형식의 한글 힌트로 변환합니다.

## 4. 도메인 및 금융 로직 규칙 (Domain & Finance Logic Rules)

*   **금융종합소득과세 UI 경고 기준:** 연간 이자 및 배당 소득 합산액이 일정 임계값을 넘을 경우 사용자 경고를 노출합니다.
    *   연간 이자/배당 소득이 **1,900만 원** 초과 시: `warn` (주의) 수준의 경고 표시.
    *   연간 이자/배당 소득이 **3,400만 원** 초과 시: `crit` (심각) 수준의 경고 표시.
    *   판별 함수: `IsfUtils.getFinancialIncomeStatus()` ([utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/utils.js)에 구현됨).
*   **Step 1 계좌 연결 보정:** 수입/지출/저축/투자 항목의 계좌 연결은 렌더러나 Sankey 내부에서 조용히 fallback하지 말고 [account-correction.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/account-correction.js)와 [input-sanitizer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js) 경계에서 결정적으로 보정해야 합니다. 보정 결과는 `accountCorrections` 메타데이터로 남겨 UI와 시각화가 같은 모델을 소비하게 유지합니다.
*   **Step 1 Sankey 총수입 토폴로지:** Step 1 Sankey 데이터는 개별 수입에서 `total-income` / `총수입` 노드로 모은 뒤 계좌와 지출/저축/투자 outflow로 흘러가야 합니다. 결손 pseudo-income은 총수입을 부풀리지 않는 별도 shortfall 지표로 취급합니다.
*   **Step 1 프리셋 설정 흐름:** 프리셋 데이터 계약은 [presets.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/presets.js)의 순수 preview/apply helper에서 만들고, 모달 lifecycle과 DOM 렌더링은 [preset-setup-controller.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/preset-setup-controller.js)에 둡니다. 프리셋 덮어쓰기는 브라우저 `confirm()`이 아니라 모달 내부 확인 단계에서 원래 퍼센트, 보정 퍼센트, 반올림 금액, 보정 차이를 보여준 뒤 `persistence.commitImmediateInputs()`로만 커밋해야 합니다.
*   **Step 1 재무 요약/모달 흐름:** 기본 화면의 `summaryCards`는 [financial-summary.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/financial-summary.js) view model과 [financial-summary-renderer.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/financial-summary-renderer.js) DOM 렌더러가 소유합니다. 카드 클릭 상세 편집과 새 항목/계좌 생성은 [financial-modal-controller.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/main/modules/financial-modal-controller.js)에서 draft state로 관리하고, 저장은 `persistence.commitImmediateInputs()`로만 커밋해야 합니다.

## 5. 개발 문화 및 가이드라인 (Development Etiquette)

*   **언어 및 인코딩:** 소스 코드 주석, 각종 가이드, 위키 문서, 응답은 반드시 **한국어(존댓말)**와 **UTF-8** 인코딩을 적용합니다.
*   **사람을 위한 주석 최소화:** 가이드라인 및 구현 과정에서 AI 에이전트 간 맥락 보호를 위해, JS 파일 내에 불필요한 주석(예: `// TODO`, 코드 설명용 주석 등)은 포함하지 않습니다. 코드가 자체적으로 명료한 의도를 전달하도록 구현해야 합니다.
