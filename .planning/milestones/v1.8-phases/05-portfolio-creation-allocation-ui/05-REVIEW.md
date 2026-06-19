---
status: urgent_fix
files_reviewed: 6
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
---

# Phase 05 코드 리뷰 결과 보고서 (05-REVIEW.md)

본 문서는 **Phase 05 (나만의 적립식 포트폴리오 및 자산 배분 UI)** 개발 결과물에 대한 심층 코드 리뷰 및 검증 결과를 담고 있습니다. 분석은 `GEMINI.md`에 명시된 핵심 원칙 및 `05-01-PLAN.md`에 정의된 설계 요구사항을 기반으로 진행되었습니다.

---

## 1. 검토 개요
* **대상 파일**:
  1. `apps/step3/index.html`
  2. `apps/step3/modules/state.js`
  3. `apps/step3/modules/dom.js`
  4. `apps/step3/modules/calculator.js`
  5. `apps/step3/app.js`
  6. `apps/step3/styles.css`
* **중점 검증 사항**:
  * 금액 표시 및 계산의 '원' 단위 정합성 유지 여부
  * 실시간 한글 금액 변환 힌트 제공 및 모바일 반응형 파손 여부
  * BEM/Kebab 명명 규칙 준수 및 HTML/CSS 물리적 무결성
  * 3계층 구조 보존 및 주요 헬퍼 누락 여부
  * XSS(Cross-Site Scripting) 보안 취약점 점검

---

## 2. 요약 및 상태 판정
* **최종 상태**: <span style="color:red; font-weight:bold;">urgent_fix (즉시 수정 필요)</span>
* **판정 사유**:
  * 1,000원 단위 소액 적립이 허용되는 스펙에서, 총액 표시부에 만원 단위 포맷터인 `IsfUtils.formatMoney`를 적용함에 따라 1,000원 단위가 `0만원` 또는 반올림되어 왜곡 표시되는 중대 버그(Critical)가 식별되었습니다.
  * UAT-6 기준인 "유효하지 않은 금액 입력 시 시각적 에러/경고 표시"가 UI 상에 누락되어 있어 보완이 필요합니다(Warning).

---

## 3. 상세 분석 결과 (Findings)

### 🚨 CR-01: `IsfUtils.formatMoney` 적용으로 인한 소액 금액 왜곡 및 0원 표기 버그
* **File**: `apps/step3/modules/dom.js` ([dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js#L56))
* **Severity**: Critical
* **Description**:
  * `Step 3` 적립식 포트폴리오 매니저는 개별 종목당 최소 1,000원 이상, 1,000원 단위의 금액을 유효한 입력값으로 인정합니다.
  * 그러나 `dom.js`의 포트폴리오 목록 카드 렌더러와 상세 모달창에서는 총 투자 금액을 렌더링할 때 만원 단위를 한글(X억 Y만원)로 축약해 주는 `IsfUtils.formatMoney`를 적용하고 있습니다.
  * 이로 인해 `p.totalAmount`가 1,000원일 경우 `formatMoney` 내부에서 반올림을 거쳐 **`0만원`**으로 화면에 표기되며, 15,000원일 경우 **`2만원`**으로 포맷되어 실제 데이터와 화면 표시 사이에 금액 불일치가 발생하는 치명적인 왜곡 현상이 일어납니다. 이는 `GEMINI.md` 내 **"모든 사용자 입력, UI 표시, 내부 계산은 '원' 단위로 완전히 통일한다"**는 단위 정합성 원칙을 훼손합니다.
* **Recommendation**:
  * 목록 카드 및 상세 모달 내에서 총액을 표시할 때 `formatMoney` 대신 천 단위 콤마 포맷(`toLocaleString('ko-KR') + '원'`)을 직접 사용하고, 하단 또는 괄호 안에 `IsfUtils.convertToKoreanWon` 한글 변환 힌트를 덧붙이도록 수정할 것을 권장합니다.

  ```diff
  // apps/step3/modules/dom.js - L56 수정
  - <span style="font-size: 1.1rem; font-weight: 700; color: #fff;">${IsfUtils.formatMoney(p.totalAmount)}</span>
  + <span style="font-size: 1.1rem; font-weight: 700; color: #fff;">${p.totalAmount.toLocaleString('ko-KR')}원</span>

  // apps/step3/modules/dom.js - L199 수정
  - modalPortfolioTotal.textContent = `${IsfUtils.formatMoney(totalWon)} (${IsfUtils.convertToKoreanWon(totalWon)})`;
  + modalPortfolioTotal.textContent = `${totalWon.toLocaleString('ko-KR')}원 (${IsfUtils.convertToKoreanWon(totalWon)})`;
  ```

---

### ⚠️ WR-01: 금액 입력 유효성 불통과 시 시각적 경고/에러 피드백 장치 누락 (UAT-6 미준수)
* **File**: `apps/step3/modules/dom.js` ([dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js#L120-L125))
* **Severity**: Warning
* **Description**:
  * `05-UAT.md` 6번 항목에 의하면 개별 종목의 매수 금액이 1,000원 미만이거나 1,000원 단위가 아닐 경우(예: 1,500원 입력 시) 화면상에 에러 또는 경고 상태가 표시되어야 합니다.
  * 현재 `dom.js`의 `renderCreatorForm`은 입력값 검증에 실패하면 제출 버튼만 비활성화할 뿐, 입력창 자체나 힌트 텍스트 영역에 에러 상태를 알리는 시각적인 표시(예: 붉은 보더, 경고 텍스트)가 전혀 없습니다. 사용자는 버튼이 비활성화된 이유를 명확하게 알 수 없어 UX 상 혼란을 겪을 수 있습니다.
* **Recommendation**:
  * 각 종목 행 렌더링 시 금액의 유효성을 실시간으로 판별하여, 유효하지 않을 때 입력란 하단 테두리를 붉게 표시하고 힌트 영역에 경고 메시지를 띄우도록 수정합니다.

  ```diff
  // apps/step3/modules/dom.js - L113 부근 수정 제안
    creatorAssetTable.innerHTML = assetsWithRatios.map(as => {
  +   const amountVal = Number(as.amount) || 0;
  +   const isAmountValid = amountVal === 0 || IsfCalculator.validateAssetAmount(amountVal);
  +   const borderBottomStyle = isAmountValid ? 'rgba(255, 255, 255, 0.15)' : 'var(--status-error, #ff5e5e)';
  +   const hintColor = isAmountValid ? 'var(--primary, #ea5b2a)' : 'var(--status-error, #ff5e5e)';
  +   const hintText = amountVal > 0 
  +     ? (isAmountValid ? `실시간 변환: ${IsfUtils.convertToKoreanWon(amountVal)}` : '⚠️ 1,000원 단위로 입력해 주세요 (최소 1,000원)')
  +     : '';
  
      return `
        <tr data-asset-id="${as.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 10px 4px;">
            <input type="text" class="input-minimal asset-name-input" data-id="${as.id}" data-field="name" value="${IsfUtils.escapeHtml(as.name)}" placeholder="종목명" style="width: 100%; border: none; background: transparent; color: #fff; padding: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); transition: border-color 0.2s; font-size: 0.9rem;" />
          </td>
          <td style="padding: 10px 4px;">
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
  -           <input type="number" class="input-minimal asset-amount-input" data-id="${as.id}" data-field="amount" value="${as.amount || ''}" placeholder="금액 입력" style="width: 100%; border: none; background: transparent; color: #fff; padding: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.9rem;" />
  -           <span class="realtime-won-hint" style="font-size: 0.75rem; color: var(--primary, #ea5b2a); min-height: 14px; margin-top: 2px;">
  -             ${as.amount > 0 ? `실시간 변환: ${IsfUtils.convertToKoreanWon(as.amount)}` : ''}
  -           </span>
  +           <input type="number" class="input-minimal asset-amount-input" data-id="${as.id}" data-field="amount" value="${as.amount || ''}" placeholder="금액 입력" style="width: 100%; border: none; background: transparent; color: #fff; padding: 6px; border-bottom: 1px solid ${borderBottomStyle}; font-size: 0.9rem;" />
  +           <span class="realtime-won-hint" style="font-size: 0.75rem; color: ${hintColor}; min-height: 14px; margin-top: 2px;">
  +             ${hintText}
  +           </span>
            </div>
          </td>
          ...
      `;
    }).join('');
  ```

---

### ℹ️ IF-01: `markDirty` 등 변경 내역 추적 헬퍼 미사용에 대한 아키텍처 분석
* **File**: `apps/step3/app.js` ([app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js))
* **Severity**: Info
* **Description**:
  * `GEMINI.md` 내 Core Logic Protection 규칙에서는 `markDirty` 등 변경 감지 헬퍼의 소실 방지를 강조하고 있습니다.
  * 단, 이번 `Step 3` 모듈은 임시 입력 버퍼(Draft)나 저장 유보 기간을 두지 않고 상태 변경 발생 시 즉시 로컬 스토리지에 동기화(`saveToStorage`) 및 화면을 갱신하는 구조로 아키텍처가 설계되어 있어 `markDirty` 헬퍼가 호출되지 않습니다.
  * 이는 의도적인 고도화 설계로 판단되며, `app.js`는 상태/헬퍼/UI의 3계층 구조 및 독립된 연산/UI 모듈 분리 원칙을 충실히 지키고 있습니다.

---

### ℹ️ IF-02: 금융종합소득과세 경고 UI 미탑재에 대한 기능적 타당성 검증
* **File**: `apps/step3/index.html` ([index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/index.html))
* **Severity**: Info
* **Description**:
  * `GEMINI.md` 핵심 원칙에 따라 연간 이자/배당 소득이 1,900만 원 초과 시 `warn`, 3,400만 원 초과 시 `crit` 경고 UI 제공 여부가 필요합니다.
  * 이번 `Step 3`는 사용자가 매입하려는 적립식 종목 비중과 금액을 설정하는 화면으로서 배당 소득액 산출 및 과세 시뮬레이션 데이터를 수집하지 않습니다.
  * 해당 로직은 공통 모듈인 `shared/core/utils.js`의 `getFinancialIncomeStatus`에 이미 완전히 구현되어 있으며, 배당 시뮬레이터인 `step1` 및 `step2`에서 원칙에 맞게 뱃지 형태로 충실히 활용되고 있으므로 본 화면에서 누락된 것은 타당한 누락으로 평가합니다.

---

## 4. 무결성 및 기타 검증 사항
1. **물리적 무결성**: `styles.css` 하단의 CSS 미디어 쿼리 및 호버 효과 정의부의 잘림 현상 없이 정상 보존되었음을 대조 확인하였습니다.
2. **반응형 디자인**: 760px 이하 모바일 화면의 가독성을 보장하기 위해 `.asset-header`, `.asset-row` 에 별도의 600px 미디어 쿼리가 적용되어 반응형 파손 우려가 낮습니다.
3. **명명 규칙**: 전반적인 CSS 클래스는 Kebab 및 BEM (`floating-btn--left` 등) 명명 표기법을 준수하여 일관성이 높습니다.
4. **보안성 (XSS 방어)**: 동적으로 템플릿 리터럴을 구성할 때 사용자 입력값(`p.name`, `as.name` 등)에 `IsfUtils.escapeHtml` 필터링 및 `textContent` 주입 처리가 올바르게 매핑되어 HTML 주입 위협이 방지되었습니다.

---

## 5. 결론 및 향후 계획
Phase 05 개발 코드는 높은 품질로 작성되었으나, 소액 단위 입력 환경에서 총액이 `0만원` 등으로 왜곡되어 나타나는 치명적인 정보 표기 버그가 존재합니다. UAT-6 준수를 위해 유효하지 않은 입력란의 시각적 경고 처리와 함께 총액 렌더링 부분을 콤마 구분자 및 원 단위 기반으로 신속히 리팩토링할 것을 강력히 권고합니다.
