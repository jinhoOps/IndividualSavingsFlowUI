import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { formatCurrency } from "./formatters.js";
import { buildAllocationMetaText, getMonthlyIncomeTotalWon } from "./input-sanitizer.js";

export function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) return;
  dom.summaryCards.innerHTML = "";
  cards.forEach(card => {
    const el = document.createElement("article");
    el.className = `card ${card.variant || ""}`;
    el.innerHTML = `<span class="label">${card.label}</span><span class="value">${card.value}</span><span class="sub">${card.sub}</span>`;
    dom.summaryCards.appendChild(el);
  });
}

export function renderProjectionTable(records, horizonYears, expenseGrowth) {
  if (!dom.projectionTableBody) return;
  const { showFlow, showBalance, showDividend } = state.projectionOptions;
  const table = dom.projectionTableBody.closest("table");
  if (table) {
    const thead = table.querySelector("thead");
    if (thead) {
      let headerHtml = `<tr><th>시점</th>`;
      if (showFlow) headerHtml += `<th>월 수입</th><th>월 생활비</th><th>당월 이자</th><th>실제 상환액</th><th>부채 증가분</th>`;
      if (showBalance) headerHtml += `<th>현금</th><th>저축</th><th>투자</th><th>부채</th>`;
      if (showDividend) headerHtml += `<th>연배당 (세전)</th>`;
      headerHtml += `<th>순자산</th><th>실질 순자산</th></tr>`;
      thead.innerHTML = headerHtml;
    }
  }
  dom.projectionTableBody.innerHTML = records.map((r, i) => {
    if (i > 0 && i % 12 !== 0 && i !== records.length - 1) return "";
    const statusClass = IsfUtils.getFinancialIncomeStatus(r.annualFinancialIncome);
    const trClass = statusClass !== 'normal' ? `status--${statusClass}` : '';
    const badge = statusClass === 'warn' ? '<span class="status-badge status-badge--warn">과세주의</span>' : 
                  statusClass === 'crit' ? '<span class="status-badge status-badge--crit">과세경고</span>' : '';
    let rowHtml = `<tr class="${trClass}"><td>${i === 0 ? "현재" : `${i / 12}년 후`}</td>`;
    if (showFlow) rowHtml += `<td>${formatCurrency(r.monthlyIncome)}</td><td>${formatCurrency(r.monthlyExpense)}</td><td>${formatCurrency(r.debtInterest)}</td><td>${formatCurrency(r.actualDebtPayment)}</td><td>${formatCurrency(r.newBorrowing)}</td>`;
    if (showBalance) rowHtml += `<td>${formatCurrency(r.cash)}</td><td>${formatCurrency(r.savings)}</td><td>${formatCurrency(r.invest)} ${badge}</td><td>${formatCurrency(r.debt)}</td>`;
    if (showDividend) rowHtml += `<td>${formatCurrency(r.annualFinancialIncome)}</td>`;
    rowHtml += `<td class="fw-bold">${formatCurrency(r.netAsset)}</td><td class="text-muted small">${formatCurrency(r.realNetAsset)}</td></tr>`;
    return rowHtml;
  }).join("");
}

export function renderItemList(group, items, options = {}) {
  const list = dom[`${group}List`]; if (!list) return;
  list.innerHTML = items.map((item, idx) => group === "income" ? renderIncomeItemHtml(item, options) : renderAllocationItemHtml(group, item, options)).join("");
}

export function renderIncomeItemHtml(item, opts) {
  const isEditing = !!opts.editing;
  return `
    <div class="income-row">
      <input type="text" value="${IsfUtils.escapeHtml(item.name)}" data-income-id="${item.id}" data-field="name" ${isEditing ? "" : "readonly"} placeholder="이름" />
      <input type="number" value="${IsfUtils.toMan(item.amount)}" data-income-id="${item.id}" data-field="amount" ${isEditing ? "" : "readonly"} inputmode="decimal" placeholder="금액" />
      ${isEditing ? `
        <button class="income-remove" data-remove-income="${item.id}" title="삭제">
          <svg class="income-remove-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span class="income-remove-text">삭제</span>
        </button>
      ` : ""}
    </div>
  `;
}

export function renderAllocationItemHtml(group, item, opts) {
  const isEditing = !!opts.editing;
  const meta = buildAllocationMetaText(item, { showMaturity: group !== "expense" });
  const metaHtml = (!isEditing && meta) ? `<div class="allocation-meta">${meta}</div>` : "";
  const commonClasses = `${group}-row ${isEditing ? "is-editing" : ""}`;
  
  if (!isEditing) {
    return `
      <div class="${commonClasses}">
        <span class="${group}-name">${IsfUtils.escapeHtml(item.name)}</span>
        <span class="value">${formatCurrency(item.amount)}</span>
        ${metaHtml}
      </div>
    `;
  }
  
  const isSavings = group === "savings"; 
  const isInvest = group === "invest";
  
  return `
    <div class="${commonClasses}">
      <div class="editor-field">
        <label class="editor-field-label">이름</label>
        <input type="text" value="${IsfUtils.escapeHtml(item.name)}" data-field="name" data-editor-id="${item.id}" placeholder="항목명" />
      </div>
      <div class="editor-field">
        <label class="editor-field-label">금액(만원)</label>
        <input type="number" value="${IsfUtils.toMan(item.amount)}" data-field="amount" data-editor-id="${item.id}" inputmode="decimal" placeholder="금액" />
      </div>
      <div class="editor-field">
        <label class="editor-field-label">그룹</label>
        <input type="text" value="${IsfUtils.escapeHtml(item.group || "")}" data-field="group" data-editor-id="${item.id}" list="${group}GroupOptions" placeholder="그룹" />
      </div>
      ${isSavings ? `
        <div class="editor-field">
          <label class="editor-field-label">연이율(%)</label>
          <input type="number" value="${item.annualRate || ""}" data-field="annualRate" data-editor-id="${item.id}" step="0.1" inputmode="decimal" placeholder="기본값" />
        </div>
      ` : ""}
      ${(isSavings || isInvest) ? `
        <div class="editor-field">
          <label class="editor-field-label">만기/해지월</label>
          <input type="month" value="${item.maturityMonth || ""}" data-field="maturityMonth" data-editor-id="${item.id}" />
        </div>
      ` : ""}
      <button class="allocation-remove" data-remove-editor-item="${item.id}" title="삭제">×</button>
    </div>
  `;
}

export function getPendingSummaryText(inputs) {
  const monthlyIncome = getMonthlyIncomeTotalWon(inputs.incomes);
  const monthlyOutflow = inputs.monthlyExpense + inputs.monthlySavings + inputs.monthlyInvest + inputs.monthlyDebtPayment;
  return `수입 ${formatCurrency(monthlyIncome)} / 지출 ${formatCurrency(monthlyOutflow)}`;
}

export function renderInputHints(inputs) {
  renderIncomeTotalHint(getMonthlyIncomeTotalWon(inputs.incomes), inputs.incomes.length);
  renderExpenseTotalHint(inputs.monthlyExpense, inputs.expenseItems.length);
  renderSavingsTotalHint(inputs.monthlySavings, inputs.savingsItems.length);
  renderInvestTotalHint(inputs.monthlyInvest, inputs.investItems.length);
}

export function renderIncomeTotalHint(won, count) { if (dom.incomeTotalHint) dom.incomeTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
export function renderExpenseTotalHint(won, count) { if (dom.expenseTotalHint) dom.expenseTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
export function renderSavingsTotalHint(won, count) { if (dom.savingsTotalHint) dom.savingsTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
export function renderInvestTotalHint(won, count) { if (dom.investTotalHint) dom.investTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
