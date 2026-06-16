import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { ClipboardParser } from "../../../shared/core/clipboard-parser.js";
import { sanitizeInputs } from "./input-sanitizer.js";
import * as helpers from "./state-helpers.js";
import { markPendingChanges, syncGroupOptionsFor } from "./ui-controller.js";
import { 
  persistStep1Snapshot, listSnapshots, getSnapshotById, deleteSnapshot 
} from "./snapshot-manager.js";
import { formatBackupTimestamp } from "./formatters.js";
import { calculateComparison } from "./comparison-engine.js";
import { renderComparisonChart, renderComparisonSummary } from "./comparison-renderer.js";

/* Smart Add Feature */
export function handleOpenSmartAdd() {
  if (state.isViewMode) return;
  dom.smartAddModal.hidden = false;
  dom.smartAddModal.classList.add("is-active");
  dom.smartAddInput.value = "";
  dom.smartAddResult.hidden = true;
  dom.applySmartAddBtn.disabled = true;

  dom.smartAddCategory.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "new";
  defaultOption.textContent = "+ 새 항목으로 추가";
  dom.smartAddCategory.appendChild(defaultOption);

  state.inputs.expenseItems.forEach(item => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = `${item.name} (${item.group || '미분류'})`;
    dom.smartAddCategory.appendChild(option);
  });

  dom.smartAddInput.focus();
}

export function handleCloseSmartAdd() {
  dom.smartAddModal.classList.remove("is-active");
  setTimeout(() => { dom.smartAddModal.hidden = true; }, 250);
}

export function handleSmartAddInput(e) {
  const text = e.target.value;
  const result = ClipboardParser.parseSms(text);
  
  if (result) {
    dom.smartAddResult.hidden = false;
    dom.smartAddAmount.textContent = `${result.amount.toLocaleString()}원`;
    dom.smartAddMerchant.value = result.merchant;
    dom.smartAddDate.textContent = result.date || "날짜 없음";
    
    const matched = ClipboardParser.matchCategory(result.merchant, state.inputs.expenseItems);
    dom.smartAddCategory.value = matched ? matched.name : "new";
    
    dom.applySmartAddBtn.disabled = false;
    state.lastParsedResult = result;
  } else {
    dom.smartAddResult.hidden = true;
    dom.applySmartAddBtn.disabled = true;
  }
}

export function handleApplySmartAdd(renderItemListCallback) {
  const result = state.lastParsedResult;
  if (!result) return;

  if (state.itemEditors.expense.active) {
    window.IsfFeedback.showFeedback(dom.applyFeedback, "생활비 편집기가 열려 있습니다. 편집을 완료하거나 취소한 후 등록해주세요.", true);
    return;
  }
  
  const selectedName = dom.smartAddCategory.value;
  const merchantName = dom.smartAddMerchant.value.trim() || result.merchant;
  const amountWon = result.amount;
  
  const newItems = [...state.inputs.expenseItems];
  
  if (selectedName === "new") {
    newItems.push({ name: merchantName, amountWon: amountWon, group: "기타" });
  } else {
    const idx = newItems.findIndex(item => item.name === selectedName);
    if (idx !== -1) {
      newItems[idx] = { ...newItems[idx], amountWon: newItems[idx].amountWon + amountWon };
    }
  }
  
  state.inputs.expenseItems = newItems;
  state.inputs = sanitizeInputs(state.inputs);
  
  if (renderItemListCallback) renderItemListCallback("expense", newItems);
  markPendingChanges();
  
  handleCloseSmartAdd();
  window.IsfFeedback.showFeedback(dom.applyFeedback, `${merchantName} 항목에 ${window.IsfUtils.formatMoney(amountWon)}이 합산되었습니다.`);
}

/* Snapshot Feature */
export async function initializeSnapshotSelector() {
  if (!dom.snapshotSelector) return;
  const list = await listSnapshots({ getHubStorage: () => window.IsfStorageHub });
  
  dom.snapshotSelector.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "과거 시점 선택...";
  dom.snapshotSelector.appendChild(defaultOption);

  if (list && list.length > 0) {
    list.forEach(s => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = formatBackupTimestamp(s.updatedAt);
      dom.snapshotSelector.appendChild(option);
    });
  }
}

export async function handleSnapshotSelection(id) {
  if (!id) {
    if (dom.comparisonContent) dom.comparisonContent.hidden = true;
    return;
  }
  const snapshot = await getSnapshotById(id, { getHubStorage: () => window.IsfStorageHub });
  if (snapshot && snapshot.data) {
    const comparison = calculateComparison(snapshot.data, state.inputs);
    renderComparison(comparison);
  }
}

function renderComparison(comparison) {
  if (!comparison) return;
  if (dom.comparisonContent) dom.comparisonContent.hidden = false;
  if (dom.comparisonEmpty) dom.comparisonEmpty.hidden = true;
  renderComparisonSummary(dom.comparisonExpenseSummary, comparison.summary.expense);
  renderComparisonChart(dom.comparisonSvg, comparison.expenses);
}

export async function handleSaveSnapshot() {
  if (state.isViewMode) return;
  await persistStep1Snapshot(state.inputs, { getHubStorage: () => window.IsfStorageHub, isViewMode: state.isViewMode });
  await initializeSnapshotSelector();
  window.IsfFeedback.showFeedback(dom.applyFeedback, "현재 상태가 비교용 스냅샷으로 저장되었습니다.");
}

export async function handleDeleteSnapshot() {
  if (!dom.snapshotSelector || !dom.snapshotSelector.value) {
    window.IsfFeedback.showFeedback(dom.snapshotSelector, "삭제할 스냅샷을 먼저 선택해주세요.", true);
    return;
  }
  if (!window.confirm("선택한 스냅샷을 삭제할까요?")) return;
  const id = dom.snapshotSelector.value;
  const success = await deleteSnapshot(id, { getHubStorage: () => window.IsfStorageHub });
  if (success) {
    await initializeSnapshotSelector();
    handleSnapshotSelection("");
    window.IsfFeedback.showFeedback(dom.applyFeedback, "스냅샷이 삭제되었습니다.");
  }
}
