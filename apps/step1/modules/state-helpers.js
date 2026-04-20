import { cloneInputs, sanitizeInputs } from "./input-sanitizer.js";

/**
 * 상태 관리 및 데이터 무결성을 위한 핵심 헬퍼 함수 모음
 * Architecture_Reference.md의 '14종 필수 헬퍼' 가이드라인 준수
 */

/**
 * 1. 편집용 드래프트 생성
 */
export function createEmptyDraft(baseInputs) {
  return sanitizeInputs(cloneInputs(baseInputs));
}

/**
 * 2. 드래프트 상태 보장
 */
export function ensureDraftInputs(state) {
  if (!state.draftInputs) {
    state.draftInputs = createEmptyDraft(state.inputs);
  }
  return state.draftInputs;
}

/**
 * 3. 현재 유효한 입력값 가져오기 (드래프트 우선)
 */
export function getVisibleInputs(state) {
  return state.draftInputs || state.inputs;
}

/**
 * 4. 변경 사항 있음 표시 (Dirty)
 */
export function markDirty(state) {
  if (state.isViewMode) return;
  ensureDraftInputs(state);
}

/**
 * 5. 변경 사항 없음 표시 (Clean)
 */
export function markClean(state) {
  state.draftInputs = null;
}

/**
 * 6. 변경 사항 존재 여부 확인
 */
export function hasPendingChanges(state) {
  if (!state.draftInputs) return false;
  // 단순 비교를 위해 JSON stringify 사용 (성능 최적화 필요 시 개별 필드 비교로 전환)
  return JSON.stringify(state.draftInputs) !== JSON.stringify(state.inputs);
}

/**
 * 7. ID로 항목 찾기 (계좌/항목 통합)
 */
export function getAccountById(inputs, id) {
  if (!id) return null;
  const groups = [inputs.incomes, inputs.expenseItems, inputs.savingsItems, inputs.investItems];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const found = group.find(item => item.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * 8. 상태 초기화
 */
export function resetState(state, defaultInputs) {
  state.inputs = sanitizeInputs(cloneInputs(defaultInputs));
  state.draftInputs = null;
  state.isDashboardMode = false;
}

/**
 * 9. 드래프트 필드 업데이트
 */
export function updateDraftField(state, key, value) {
  const draft = ensureDraftInputs(state);
  draft[key] = value;
  return draft;
}

/**
 * 10. 수입/지출 합계 정합성 동기화 (Derived Values)
 */
export function syncDerivedValues(inputs, { getMonthlyAllocationTotalWon }) {
  inputs.monthlyExpense = getMonthlyAllocationTotalWon(inputs.expenseItems);
  inputs.monthlySavings = getMonthlyAllocationTotalWon(inputs.savingsItems);
  inputs.monthlyInvest = getMonthlyAllocationTotalWon(inputs.investItems);
}

/**
 * 11. 폼 데이터 읽기 (단위 변환 포함)
 * app.js의 readInputsFromForm 로직 이전
 */
export function readInputsFromForm(form, baseInputs, { FORM_FIELD_KEYS, toWon }) {
  const raw = cloneInputs(baseInputs);
  if (!form) return raw;
  
  FORM_FIELD_KEYS.forEach(key => {
    const field = form.elements[key];
    if (!field) return;
    const value = Number(field.value);
    const wonFields = ["monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment", "startCash", "startSavings", "startInvest", "startDebt"];
    
    if (wonFields.includes(key)) {
      raw[key] = toWon(value);
    } else {
      raw[key] = value;
    }
  });
  return raw;
}

/**
 * 12. 폼에 데이터 적용 (단위 변환 포함)
 */
export function applyInputsToForm(form, inputs, { FORM_FIELD_KEYS, toMan }) {
  if (!form) return;
  FORM_FIELD_KEYS.forEach(key => {
    const field = form.elements[key];
    if (!field) return;
    const wonFields = ["monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment", "startCash", "startSavings", "startInvest", "startDebt"];
    
    if (wonFields.includes(key)) {
      field.value = String(toMan(inputs[key]));
    } else {
      field.value = String(inputs[key]);
    }
  });
}

/**
 * 13. 아이템 편집 서명 생성 (변경 감지용)
 */
export function getItemEditorSignature(items) {
  if (!Array.isArray(items)) return "";
  return JSON.stringify(items.map(i => ({ name: i.name, amount: i.amount })));
}

/**
 * 14. 현재 활성화된 아이템 에디터 그룹 찾기
 */
export function getActiveItemEditorGroupKey(itemEditors) {
  return Object.keys(itemEditors).find(group => itemEditors[group].active) || null;
}
