# Phase 3 Code Review Report: Multi-Account Data Model

본 보고서는 **Phase 3 (`03-multi-account-data-model`)** 단계에서 변경 및 추가된 소스 코드 파일들을 상세히 검토하여 발견된 버그, 보안 취약점, 코드 품질 및 아키텍처 제약 사항 준수 여부를 분석한 결과입니다.

---

## 1. 검토 개요
* **검토 대상 파일**:
  * `apps/step1/index.html`
  * `apps/step1/modules/dom.js`
  * `apps/step1/modules/sankey-builder.js`
  * `apps/step1/modules/calculator.js`
  * `apps/step1/modules/list-renderer.js`
  * `apps/step1/app.js`
  * `apps/step1/styles.css`
* **검토 중점**:
  * **단위 정합성**: 모든 금융 데이터의 원(Won) 단위 준수 및 1억 원 이상의 `X억 Y만원` 포맷팅 정합성.
  * **금융종합소득과세 경고**: 연간 이자/배당 소득 임계치(1,900만 원 초과 시 `warn`, 3,400만 원 초과 시 `crit`) 연동 및 UI 표출 상태 검증.
  * **물리적 무결성**: 모바일 반응형 쿼리(760px 이하)의 보존성 및 화면 파손 방지.
  * **3계층 구조**: `app.js`의 상태-헬퍼-UI 역할 분리 구조 유지 여부.

---

## 2. 리뷰 결과 요약 (심각도별 발견 건수)

| 심각도 | 건수 | 핵심 내용 |
| :--- | :---: | :--- |
| 🔴 **Critical** | **1건** | 수동 이체 입력 금액의 단위 변환 오류 (원 ➔ 만원 오해로 인한 10,000배 증폭 계산 버그) |
| 🟡 **Warning** | **2건** | 금융소득 추정 시 초기 잔액 배분 가정을 통한 왜곡 가능성, 수동 이체 시 한도/마이너스 잔액 검증 부재 |
| 🔵 **Info** | **3건** | CSS `!important` 남용으로 인한 유지보수성 저하, 툴팁 파싱 로직의 관심사 분리 필요성, HTML 인젝션 방어책 권장 사항 |

---

## 3. 상세 분석 및 문제점

### 🔴 Critical (치명적 문제)

#### 1) 수동 이체 입력 금액 단위 정합성 오류
* **위치**: `apps/step1/app.js` [L437](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js#L437), [L463](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js#L463)
* **상세**:
  * HTML 폼 (`index.html` L165) 상에서는 수동 이체 금액 입력란의 placeholder가 `"금액 (원)"`으로 설정되어 있어 사용자는 원(Won) 단위 금액을 직접 입력합니다. (예: 1,000,000원 이체 시 `1000000` 입력)
  * 하지만 `app.js` L463에서 `const amount = amountMan * 10000;`을 계산하여 수동 이체 데이터에 저장합니다.
  * 이는 입력값을 '만원' 단위로 오해하여 내부적으로 **10,000배가 곱해진 값**으로 저장하는 치명적인 단위 계산 오류를 발생시킵니다. 결과적으로 100만 원 이체 시 내부 계산 및 UI 표기 상 100억 원으로 증폭됩니다.
* **해결 방안**:
  `app.js` L463 코드를 다음과 같이 수정하여 입력받은 금액을 그대로 원화 단위로 사용해야 합니다.
  ```diff
  - const amount = amountMan * 10000;
  + const amount = amountMan;
  ```

---

### 🟡 Warning (경고)

#### 1) 금융소득 계산 시 초기 잔액 가중 배분 가정에 따른 오차 가능성
* **위치**: `apps/step1/modules/calculator.js` [L435-L483](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/modules/calculator.js#L435-L483)
* **상세**:
  * `calculateAccountFinancialIncomes` 함수는 개별 계좌의 연간 금융소득을 집계할 때 `buildSavingsBuckets`와 `buildInvestBuckets`를 호출합니다.
  * 내부적으로 `allocateByWeights`를 사용하여 **전체 초기 저축잔액(`startSavings`)을 각 상품의 월 저축액(`monthlyTarget`) 비율로 나누어 가상 잔액(`bucket.balance`)을 할당**합니다.
  * 이는 실제 각 통장에 들어있는 현재 잔고를 기반으로 하는 계산이 아니므로, 사용자가 느끼는 실제 금융소득(이자/배당) 과세 한도 예측값과 큰 차이를 유발할 수 있습니다.
* **권장 조치**:
  * 현재의 계산 로직은 '월 저축액 비중 분배 방식'이라는 가정을 바탕으로 시뮬레이션하고 있음을 UI 상(도움말 툴팁 또는 가이드라인)에 명시하거나, 추후 개별 계좌의 기초 잔액을 별도로 입력할 수 있는 데이터 모델 고도화가 권장됩니다.

#### 2) 수동 이체 규칙 설정 시 출발 계좌의 잔액 한도 검증 누락
* **위치**: `apps/step1/app.js` [L433-L481](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js#L433-L481)
* **상세**:
  * 사용자가 계좌 간 수동 이체를 등록할 때, 출발 계좌의 잔액(수입 유입분 - 지출/저축/투자 유출분)이 부족하더라도 어떠한 제어(Alert 경고 또는 이체 차단) 없이 등록이 허용됩니다.
  * 비록 예상 잔액 힌트(`sourceBalanceHint`)를 실시간으로 노출하고 있으나, 적자 흐름이나 마이너스 통장 상태를 방지하기 위해 최소한의 소프트 경고 피드백을 제공할 필요가 있습니다.
* **권장 조치**:
  * 이체 금액 추가 버튼 클릭 시, 예상 잔액이 마이너스가 될 경우 사용자에게 컨펌(Confirm) 팝업을 띄우거나 주의 알림을 노출하도록 보완할 것을 권장합니다.

---

### 🔵 Info (정보 및 개선 제안)

#### 1) CSS 미디어 쿼리 내 `!important` 과도한 남용
* **위치**: `apps/step1/styles.css` [L2071-L2146](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css#L2071-L2146), [L755-L776](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/styles.css#L755-L776)
* **상세**:
  * 모바일 반응형 760px 이하 화면을 구현하기 위해 다수의 CSS 선택자에 `!important`가 선언되어 있습니다.
  * 이는 CSS 명시도(Specificity) 규칙을 깨뜨리고 유지보수성을 극도로 떨어뜨리는 요인입니다.
* **개선 제안**:
  * 모바일 레이아웃 클래스 구조를 강화하거나, 모바일용 body 클래스(`.is-mobile` 등)를 조합하여 구체성을 높이는 방향으로 리팩토링하여 `!important` 제거를 제안합니다.

#### 2) 툴팁 HTML 파싱 및 관심사 분리
* **위치**: `apps/step1/app.js` [L509-L578](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js#L509-L578)
* **상세**:
  * 전역 도움말 툴팁의 특정 마크업 치환(예: `**` -> `<strong>`, `$$` -> `.formula-box` 등) 및 툴팁 박스 위치 연산 로직이 `app.js` 내에 인라인으로 길게 작성되어 있습니다.
  * 이는 `app.js`가 상태 조율 및 이벤트 바인딩이라는 메인 오케스트레이터의 역할에서 벗어나 세부 UI 렌더링 영역까지 깊게 관여하는 현상입니다.
* **개선 제안**:
  * 해당 로직을 `ui-controller.js`나 별도의 `tooltip-helper.js` 모듈로 추출하여 UI 계층의 순수성을 보존하는 것이 좋습니다.

#### 3) 툴팁 마크업 치환 시 잠재적 HTML Injection(XSS) 유의
* **위치**: `apps/step1/app.js` [L537](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/app.js#L537)
* **상세**:
  * `dom.globalTooltip.innerHTML = htmlContent;`를 사용하여 동적 HTML을 바인딩하고 있습니다.
  * 현재는 툴팁의 텍스트 원본이 `index.html` 내의 하드코딩된 `data-tooltip` 속성이므로 안전하지만, 추후 이 툴팁에 사용자가 수정한 계좌명이나 금액 텍스트가 동적으로 포함될 경우 심각한 DOM 인젝션(XSS) 경로로 악용될 우려가 있습니다.
* **권장 조치**:
  * 툴팁 내부적으로 동적 사용자 텍스트가 들어갈 경우, 해당 부분만 `IsfUtils.escapeHtml`을 거친 후에 마크업 치환이 이루어지도록 엄격한 방어 패턴을 유지해야 합니다.

---

## 4. 종합 평가 및 결론
Phase 3 단계의 작업물은 **다중 계좌 기반의 데이터 모델 및 수동 이체 규칙**을 도입하고, **금융소득과세 경고 연동** 등의 중요한 비즈니스 요구사항을 세련되게 반영하였습니다. 모바일 반응형 무결성이나 3계층 구조의 흐름 또한 잘 유지되고 있습니다.

단, **수동 이체 금액에 10,000배가 곱해져 저장되는 단위 정합성 버그(Critical)**는 비즈니스 로직에 심각한 왜곡을 주기 때문에 **반드시 수정되어야 하는 사항**입니다.
이 외에 경고성 및 정보성 제안 조치들을 반영한다면 어플리케이션의 안정성과 코드 품질이 더욱 향상될 것입니다.
