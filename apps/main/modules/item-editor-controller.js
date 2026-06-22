import { IsfUtils } from "../../../shared/core/utils.js";

import { MAX_ALLOCATION_ITEMS } from "./constants.js";
import {
  cloneInputs,
  sanitizeInputs,
  createIncomeItem,
  getMonthlyIncomeTotalWon,
  getMonthlyAllocationTotalWon,
  normalizeAllocationGroupName,
  parseSavingsAnnualRateInput,
  createAllocationItemId,
  normalizeMaturityMonth,
} from "./input-sanitizer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import {
  setActiveAdvancedTab,
  syncGroupOptionsFor,
  syncItemSortModeUi,
  syncMobileItemEditorFab,
  syncPendingBar,
} from "./ui-controller.js";

const EDITOR_GROUPS = ["income", "expense", "savings", "invest", "account"];

export function createItemEditorController({ markPendingChanges, getVisibleInputs, activateMgmtTab, openFinancialModal }) {
  function setItemEditorUi(group, active) {
    const actions = dom[`${group}EditorActions`];
    if (actions) actions.hidden = !active;
    const addButton = dom[`add${group.charAt(0).toUpperCase() + group.slice(1)}Item`];
    if (addButton) addButton.hidden = !active;
    const editButton = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (editButton) editButton.textContent = active ? "편집 완료" : "항목 편집";
    const applyButton = dom[`apply${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (active && applyButton) {
      const currentSignature = helpers.getItemEditorSignature(state.itemEditors[group].items);
      const changed = currentSignature !== state.itemEditors[group].baselineSignature;
      applyButton.disabled = !changed;
      if (dom.mobileEditorApply) dom.mobileEditorApply.disabled = !changed;
    }
    syncMobileItemEditorFab();
    syncPendingBar();
    syncGroupOptionsFor(group);
  }

  function renderTotalHint(group) {
    const totalWon = group === "income"
      ? getMonthlyIncomeTotalWon(state.itemEditors[group].items)
      : getMonthlyAllocationTotalWon(state.itemEditors[group].items);
    if (group === "income") listRenderer.renderIncomeTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "expense") listRenderer.renderExpenseTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "savings") listRenderer.renderSavingsTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "invest") listRenderer.renderInvestTotalHint(totalWon, state.itemEditors[group].items.length);
  }

  function handleItemInput(group, event) {
    if (state.suspendInputTracking) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
    if (!state.itemEditors[group].active) return;

    const itemId = target.dataset.editorId || target.dataset.incomeId;
    const field = target.dataset.field;
    if (!itemId || !field) return;
    const item = state.itemEditors[group].items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    if (field === "name") item.name = target.value.slice(0, 24);
    if (field === "amount") item.amount = IsfUtils.toWon(target.value);
    if (field === "group") item.group = normalizeAllocationGroupName(target.value);
    if (field === "accountId") item.accountId = target.value;
    if (field === "allocationAccountId") {
      const index = parseInt(target.dataset.allocationIndex, 10);
      if (item.allocations && item.allocations[index]) item.allocations[index].accountId = target.value;
    }
    if (field === "allocationAmount") {
      const index = parseInt(target.dataset.allocationIndex, 10);
      if (item.allocations && item.allocations[index]) item.allocations[index].amount = IsfUtils.toWon(target.value);
    }
    if (field === "annualRate") {
      const parsed = parseSavingsAnnualRateInput(target.value, getVisibleInputs().annualSavingsYield);
      if (parsed === null) delete item.annualRate;
      else item.annualRate = parsed;
    }
    if (field === "maturityMonth") {
      const normalized = normalizeMaturityMonth(target.value);
      if (!normalized) delete item.maturityMonth;
      else item.maturityMonth = normalized;
    }

    renderTotalHint(group);
    setItemEditorUi(group, true);
  }

  function handleItemClick(group, event) {
    const target = event.target;
    if (target.closest?.(".allocation-group__summary")) return;

    // 1. Clickable row 클릭하여 편집 시작
    const clickableRow = target.closest(".clickable-row");
    if (clickableRow) {
      const itemId = clickableRow.dataset.itemId;
      if (itemId) {
        if (state.itemEditors[group]) {
          state.itemEditors[group].creatorActive = false;
        }
        startItemEditor(group, itemId);
      }
      return;
    }

    // 2. 금액 stepper (-/+) 버튼 처리
    const stepBtn = target.closest(".btn-step-amount");
    if (stepBtn && state.itemEditors[group].active) {
      const parentField = stepBtn.closest(".amount-stepper-container") || stepBtn.closest(".editor-field") || stepBtn.closest(".allocation-amount-wrapper");
      if (parentField) {
        const input = parentField.querySelector("input[data-money-input='won']");
        if (input) {
          const stepVal = parseInt(stepBtn.dataset.step, 10) || 0;
          const currentVal = IsfUtils.toWon(input.value);
          let newVal = currentVal + stepVal;
          if (newVal < 0) newVal = 0;
          input.value = IsfUtils.formatWonInputValue(newVal);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      return;
    }

    // 3. Quick amount (+1만 등) 버튼 처리
    const quickBtn = target.closest(".btn-quick-amount");
    if (quickBtn && state.itemEditors[group].active) {
      const parentField = quickBtn.closest(".editor-field") || quickBtn.closest(".allocation-amount-wrapper");
      if (parentField) {
        const input = parentField.querySelector("input[data-money-input='won']");
        if (input) {
          const addVal = parseInt(quickBtn.dataset.add, 10) || 0;
          const currentVal = IsfUtils.toWon(input.value);
          const newVal = currentVal + addVal;
          input.value = IsfUtils.formatWonInputValue(newVal);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      return;
    }

    const addAllocationButton = target.closest(".add-allocation-btn");
    if (addAllocationButton && group === "income" && state.itemEditors[group].active) {
      const incomeId = addAllocationButton.dataset.incomeId;
      const item = state.itemEditors[group].items.find((candidate) => candidate.id === incomeId);
      if (item) {
        if (!Array.isArray(item.allocations)) item.allocations = [];
        const defaultAccountId = (state.inputs.accounts || [])[0]?.id || "";
        item.allocations.push({ accountId: defaultAccountId, amount: 0 });
        
        listRenderer.renderItemList(group, state.itemEditors[group].items, { editingItemId: incomeId });
        setItemEditorUi(group, true);
      }
      return;
    }

    const removeAllocationButton = target.closest(".remove-allocation-btn");
    if (removeAllocationButton && group === "income" && state.itemEditors[group].active) {
      const incomeId = removeAllocationButton.dataset.incomeId;
      const index = parseInt(removeAllocationButton.dataset.allocationIndex, 10);
      const item = state.itemEditors[group].items.find((candidate) => candidate.id === incomeId);
      if (item && Array.isArray(item.allocations)) {
        item.allocations.splice(index, 1);
        
        listRenderer.renderItemList(group, state.itemEditors[group].items, { editingItemId: incomeId });
        setItemEditorUi(group, true);
      }
      return;
    }

    const button = target.closest ? target.closest("[data-remove-income], [data-remove-editor-item]") : null;
    if (!button || !state.itemEditors[group].active) return;
    const removeId = button.dataset.removeIncome || button.dataset.removeEditorItem;
    if (!removeId || state.itemEditors[group].items.length <= 1) return;
    state.itemEditors[group].items = state.itemEditors[group].items.filter((item) => item.id !== removeId);
    
    if (state.itemEditors[group].editingItemId === removeId) {
      state.itemEditors[group].editingItemId = state.itemEditors[group].items[0]?.id || null;
    }
    
    listRenderer.renderItemList(group, state.itemEditors[group].items, { editingItemId: state.itemEditors[group].editingItemId });
    renderTotalHint(group);
    setItemEditorUi(group, true);
  }

  function closeAllItemEditors(except = "") {
    EDITOR_GROUPS.forEach((group) => {
      if (group !== except && state.itemEditors[group].active) cancelItemEditor(group);
    });
  }

  function startItemEditor(group, itemId = null) {
    closeAllItemEditors(group);
    if (!state.itemEditors[group].active) {
      const rawItems = group === "income"
        ? getVisibleInputs().incomes
        : (group === "account" ? getVisibleInputs().accounts : getVisibleInputs()[`${group}Items`]);
      const items = cloneInputs(rawItems);
      state.itemEditors[group] = {
        active: true,
        items,
        baselineSignature: helpers.getItemEditorSignature(items),
        editingItemId: itemId
      };
    } else {
      state.itemEditors[group].editingItemId = itemId;
    }
    listRenderer.renderItemList(group, state.itemEditors[group].items, { editingItemId: state.itemEditors[group].editingItemId });
    setItemEditorUi(group, true);
  }

  function cancelItemEditor(group) {
    state.itemEditors[group].active = false;
    state.itemEditors[group].editingItemId = null;
    const rawItems = group === "income"
      ? getVisibleInputs().incomes
      : (group === "account" ? getVisibleInputs().accounts : getVisibleInputs()[`${group}Items`]);
    listRenderer.renderItemList(group, rawItems);
    setItemEditorUi(group, false);
  }

  function toggleItemEditor(group) {
    if (state.itemEditors[group].active) cancelItemEditor(group);
    else startItemEditor(group);
  }

  function applyItemEditor(group) {
    const editor = state.itemEditors[group];
    const draft = helpers.ensureDraftInputs(state);

    if (group === "income") {
      for (let i = 0; i < editor.items.length; i++) {
        const item = editor.items[i];
        const displayIndex = i + 1;
        if (!item.name || !item.name.trim()) {
          alert(`${displayIndex}번째 수입 항목의 이름을 입력해 주세요.`);
          return;
        }
        const amountVal = Number(item.amount) || 0;
        if (amountVal < 1000) {
          alert(`'${item.name || displayIndex + '번째 수입 항목'}'의 금액은 최소 1,000원 이상이어야 합니다.`);
          return;
        }
        if (amountVal % 1000 !== 0) {
          alert(`'${item.name}' 수입 항목의 금액은 1,000원 단위로 입력해 주세요.`);
          return;
        }
        if (Array.isArray(item.allocations) && item.allocations.length > 0) {
          const allocationTotal = item.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
          if (allocationTotal > item.amount) {
            alert(`오류: '${item.name}' 항목의 계좌별 분배 금액 합계(${allocationTotal.toLocaleString()}원, ${IsfUtils.convertToKoreanWon(allocationTotal)})가 전체 수입 금액(${item.amount.toLocaleString()}원, ${IsfUtils.convertToKoreanWon(item.amount)})을 초과할 수 없습니다. 금액 조정을 해 주십시오.`);
            return;
          }
        }
      }
      draft.incomes = editor.items;
    } else if (group === "account") {
      for (let i = 0; i < editor.items.length; i++) {
        const item = editor.items[i];
        if (!item.name || !item.name.trim()) {
          alert(`${i + 1}번째 통장의 이름을 입력해 주세요.`);
          return;
        }
      }
      draft.accounts = editor.items;
    } else {
      const groupKo = group === "expense" ? "지출" : (group === "savings" ? "저축" : "투자");
      for (let i = 0; i < editor.items.length; i++) {
        const item = editor.items[i];
        const displayIndex = i + 1;
        if (!item.name || !item.name.trim()) {
          alert(`${displayIndex}번째 ${groupKo} 항목의 이름을 입력해 주세요.`);
          return;
        }
        const amountVal = Number(item.amount) || 0;
        if (amountVal < 1000) {
          alert(`'${item.name || displayIndex + '번째 항목'}'의 금액은 최소 1,000원 이상이어야 합니다.`);
          return;
        }
        if (amountVal % 1000 !== 0) {
          alert(`'${item.name}' 항목의 금액은 1,000원 단위로 입력해 주세요.`);
          return;
        }
      }
      draft[`${group}Items`] = editor.items;
    }

    state.inputs = sanitizeInputs(draft);
    cancelItemEditor(group);
    markPendingChanges();
  }

  function handleCreatorApply(group, container) {
    const editor = state.itemEditors[group];
    if (!editor) return;

    let newItemId = "";
    if (group === "income") {
      const nameInput = container.querySelector("#newIncomeName");
      const amountInput = container.querySelector("#newIncomeAmount");
      const accountSelect = container.querySelector("#newIncomeAccountId");

      const name = nameInput?.value?.trim();
      const amountVal = IsfUtils.toWon(amountInput?.value || "0");
      const accountId = accountSelect?.value || "";

      if (!name) {
        alert("수입 항목의 이름을 입력해 주세요.");
        return;
      }
      if (amountVal < 1000) {
        alert("수입 금액은 최소 1,000원 이상이어야 합니다.");
        return;
      }
      if (amountVal % 1000 !== 0) {
        alert("수입 금액은 1,000원 단위로 입력해 주세요.");
        return;
      }

      newItemId = `inc-${Date.now()}`;
      editor.items.push({
        id: newItemId,
        name,
        amount: amountVal,
        accountId,
        tone: "income",
        allocations: []
      });
    } else if (group === "account") {
      const nameInput = container.querySelector("#newAccountName");
      const name = nameInput?.value?.trim();

      if (!name) {
        alert("계좌(통장) 이름을 입력해 주세요.");
        return;
      }

      newItemId = `acc-${Date.now()}-${editor.items.length}`;
      editor.items.push({
        id: newItemId,
        name
      });
    } else {
      const nameInput = container.querySelector("#newItemName");
      const amountInput = container.querySelector("#newItemAmount");
      const accountSelect = container.querySelector("#newItemAccountId");
      const groupInput = container.querySelector("#newItemGroup");

      const name = nameInput?.value?.trim();
      const amountVal = IsfUtils.toWon(amountInput?.value || "0");
      const accountId = accountSelect?.value || "";
      const groupName = normalizeAllocationGroupName(groupInput?.value || "");

      if (!name) {
        alert("항목의 이름을 입력해 주세요.");
        return;
      }
      if (amountVal < 1000) {
        alert("금액은 최소 1,000원 이상이어야 합니다.");
        return;
      }
      if (amountVal % 1000 !== 0) {
        alert("금액은 1,000원 단위로 입력해 주세요.");
        return;
      }

      newItemId = createAllocationItemId(group, editor.items.length);
      const newItem = {
        id: newItemId,
        name,
        amount: amountVal,
        accountId,
        group: groupName,
        tone: group
      };

      if (group === "savings") {
        const rateInput = container.querySelector("#newItemAnnualRate");
        const maturityInput = container.querySelector("#newItemMaturityMonth");
        const parsedRate = parseSavingsAnnualRateInput(rateInput?.value || "", getVisibleInputs().annualSavingsYield);
        if (parsedRate !== null) newItem.annualRate = parsedRate;
        
        const normMaturity = normalizeMaturityMonth(maturityInput?.value || "");
        if (normMaturity) newItem.maturityMonth = normMaturity;
      } else if (group === "invest") {
        const maturityInput = container.querySelector("#newItemMaturityMonth");
        const normMaturity = normalizeMaturityMonth(maturityInput?.value || "");
        if (normMaturity) newItem.maturityMonth = normMaturity;
      }

      editor.items.push(newItem);
    }

    editor.creatorActive = false;
    editor.editingItemId = newItemId;
    
    listRenderer.renderItemList(group, editor.items, { editingItemId: newItemId });
    setItemEditorUi(group, true);
    renderTotalHint(group);
  }

  function handleCreatorCancel(group) {
    const editor = state.itemEditors[group];
    if (!editor) return;
    editor.creatorActive = false;
    
    listRenderer.renderItemList(group, editor.items, { editingItemId: editor.editingItemId || null });
  }

  function addItemToEditor(group) {
    const editor = state.itemEditors[group];
    if (!editor || !editor.active || editor.items.length >= MAX_ALLOCATION_ITEMS) return;
    editor.creatorActive = true;
    listRenderer.renderItemList(group, editor.items, { editing: true });
  }

  function navigateToAdvancedGroup(group) {
    setActiveAdvancedTab(group);
    activateMgmtTab("flow");
    const panel = document.getElementById("mgmtPanelFlow");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    startItemEditor(group);
  }

  function getActiveItemEditorGroupKey() {
    return helpers.getActiveItemEditorGroupKey(state.itemEditors);
  }

  function setItemSortMode(group, mode) {
    state.itemSortModes[group] = mode;
    const inputs = getVisibleInputs();
    listRenderer.renderItemList(group, inputs[`${group}Items`], {
      editingItemId: state.itemEditors[group].active ? state.itemEditors[group].editingItemId : null,
    });
    syncItemSortModeUi();
  }

  function bindItemEditorEvents() {
    EDITOR_GROUPS.forEach((group) => {
      const list = dom[`${group}List`];
      if (list) {
        list.addEventListener("input", (event) => handleItemInput(group, event));
        list.addEventListener("change", (event) => handleItemInput(group, event));
        list.addEventListener("click", (event) => {
          const target = event.target;
          const applyBtn = target.closest(".creator-apply-btn");
          const cancelBtn = target.closest(".creator-cancel-btn");
          if (applyBtn) {
            handleCreatorApply(group, list);
            return;
          }
          if (cancelBtn) {
            handleCreatorCancel(group);
            return;
          }
          handleItemClick(group, event);
        });
      }
      const capitalized = group.charAt(0).toUpperCase() + group.slice(1);
      const editButton = dom[`edit${capitalized}Items`];
      const addButton = dom[`add${capitalized}Item`];
      const applyButton = dom[`apply${capitalized}Items`];
      const cancelButton = dom[`cancel${capitalized}Items`];
      if (editButton) {
        editButton.addEventListener("click", () => {
          if ((group === "savings" || group === "invest") && typeof openFinancialModal === "function") {
            openFinancialModal(group);
            return;
          }
          toggleItemEditor(group);
        });
      }
      if (addButton) addButton.addEventListener("click", () => addItemToEditor(group));
      if (applyButton) applyButton.addEventListener("click", () => applyItemEditor(group));
      if (cancelButton) cancelButton.addEventListener("click", () => cancelItemEditor(group));
    });
    if (dom.mobileEditorAdd) dom.mobileEditorAdd.addEventListener("click", () => addItemToEditor(getActiveItemEditorGroupKey()));
    if (dom.mobileEditorApply) dom.mobileEditorApply.addEventListener("click", () => applyItemEditor(getActiveItemEditorGroupKey()));
    if (dom.mobileEditorCancel) dom.mobileEditorCancel.addEventListener("click", () => cancelItemEditor(getActiveItemEditorGroupKey()));

    if (dom.pendingSaveBtn) {
      dom.pendingSaveBtn.addEventListener("click", () => {
        const activeGroup = getActiveItemEditorGroupKey();
        if (activeGroup) applyItemEditor(activeGroup);
      });
    }
    if (dom.pendingCancelBtn) {
      dom.pendingCancelBtn.addEventListener("click", () => {
        const activeGroup = getActiveItemEditorGroupKey();
        if (activeGroup) cancelItemEditor(activeGroup);
      });
    }
  }

  return {
    bindItemEditorEvents,
    toggleItemEditor,
    startItemEditor,
    applyItemEditor,
    cancelItemEditor,
    addItemToEditor,
    closeAllItemEditors,
    navigateToAdvancedGroup,
    getActiveItemEditorGroupKey,
    setItemSortMode,
  };
}
