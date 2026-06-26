import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { formatCurrency } from "./formatters.js";
import { buildAllocationMetaText, getMonthlyIncomeTotalWon } from "./input-sanitizer.js";

export function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) return;
  dom.summaryCards.innerHTML = "";

  cards.forEach((card) => {
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
      let headerHtml = `<tr><th>기간</th>`;
      if (showFlow) headerHtml += `<th>월 수입</th><th>월 생활비</th><th>당월 이자</th><th>실제 상환액</th><th>부채 증가분</th>`;
      if (showBalance) headerHtml += `<th>현금</th><th>저축</th><th>투자</th><th>부채</th>`;
      if (showDividend) headerHtml += `<th>연배당 (세전)</th>`;
      headerHtml += `<th>순자산</th><th>실질 순자산 (현재가치)</th></tr>`;
      thead.innerHTML = headerHtml;
    }
  }
  dom.projectionTableBody.innerHTML = records.map((r, i) => {
    if (i > 0 && i % 12 !== 0 && i !== records.length - 1) return "";
    const statusClass = IsfUtils.getFinancialIncomeStatus(r.annualFinancialIncome);
    const trClass = statusClass !== 'normal' ? `status--${statusClass}` : '';
    let rowHtml = `<tr class="${trClass}"><td>${i === 0 ? "현재" : `${i / 12}년 후`}</td>`;
    if (showFlow) rowHtml += `<td>${formatCurrency(r.monthlyIncome)}</td><td>${formatCurrency(r.monthlyExpense)}</td><td>${formatCurrency(r.debtInterest)}</td><td>${formatCurrency(r.actualDebtPayment)}</td><td>${formatCurrency(r.newBorrowing)}</td>`;
    if (showBalance) rowHtml += `<td>${formatCurrency(r.cash)}</td><td>${formatCurrency(r.savings)}</td><td>${formatCurrency(r.invest)}</td><td>${formatCurrency(r.debt)}</td>`;
    if (showDividend) rowHtml += `<td>${formatCurrency(r.annualFinancialIncome)}</td>`;
    rowHtml += `<td class="fw-bold">${formatCurrency(r.netAsset)}</td><td class="text-muted small">${formatCurrency(r.realNetAsset)}</td></tr>`;
    return rowHtml;
  }).join("");
}

export function renderItemList(group, items, options = {}) {
  const list = dom[`${group}List`]; if (!list) return;

  if (group === "account") {
    list.innerHTML = "";
    return;
  }
  if (group === "income") {
    list.innerHTML = items.map((item) => renderIncomeItemHtml(item, options)).join("");
    return;
  }
  const sortMode = state.itemSortModes[group] || "default";
  let sorted = [...(items || [])];
  if (sortMode === "amount-desc") {
    sorted.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  } else if (sortMode === "amount-asc") {
    sorted.sort((a, b) => (a.amount || 0) - (b.amount || 0));
  } else if (sortMode === "name-asc") {
    sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
  }
  const openState = readAllocationGroupOpenState(group, list);
  list.innerHTML = renderGroupedAllocationList(group, sorted, options, openState);
}

function getAllocationGroupName(group, item) {
  const groupName = String(item?.group || "미분류").trim();
  if (!groupName) {
    if (group === "savings") return "저축";
    if (group === "invest") return "투자";
    return "미분류";
  }
  if ((group === "savings" || group === "invest") && (groupName === "저축" || groupName === "투자")) {
    return groupName;
  }
  const pathSegments = groupName.split("-").map((segment) => segment.trim()).filter(Boolean);
  return pathSegments[pathSegments.length - 1] || groupName;
}

function getAllocationGroupKey(group, groupName) {
  return `${group}:${groupName}`;
}

function readAllocationGroupOpenState(group, list) {
  const stateByKey = new Map();
  list.querySelectorAll("details[data-allocation-group-key]").forEach((details) => {
    stateByKey.set(details.dataset.allocationGroupKey, details.open);
  });
  list.querySelectorAll("details[data-allocation-group]").forEach((details) => {
    const groupName = details.dataset.allocationGroup || "";
    const key = getAllocationGroupKey(group, groupName);
    if (!stateByKey.has(key)) stateByKey.set(key, details.open);
  });
  return stateByKey;
}

function renderGroupedAllocationList(group, items, options, openState) {
  const groups = new Map();
  items.forEach((item) => {
    const groupName = getAllocationGroupName(group, item);
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(item);
  });

  return Array.from(groups.entries()).map(([groupName, groupItems], index) => {
    const total = groupItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const itemHtml = groupItems.map((item) => renderAllocationItemHtml(group, item, options)).join("");
    const groupKey = getAllocationGroupKey(group, groupName);
    const isUnclassified = groupName === "미분류";
    const knownOpen = openState && openState.has(groupKey) ? openState.get(groupKey) : null;
    const isOpen = isUnclassified || (knownOpen === null ? true : knownOpen);
    return `
      <details class="allocation-group" data-allocation-group="${IsfUtils.escapeHtml(groupName)}" data-allocation-group-key="${IsfUtils.escapeHtml(groupKey)}" ${isOpen ? "open" : ""}>
        <summary class="allocation-group__summary">
          <span class="allocation-group__name">${IsfUtils.escapeHtml(groupName)}</span>
          <span class="allocation-group__meta">${groupItems.length}개 · ${formatCurrency(total)}</span>
        </summary>
        <div class="allocation-group__items">
          ${itemHtml}
        </div>
      </details>
    `;
  }).join("");
}

export function renderIncomeItemHtml(item, opts) {
  return `
    <div class="income-row clickable-row" data-item-id="${item.id}" data-group="income" style="cursor: pointer;">
      <span class="income-name">${IsfUtils.escapeHtml(item.name)}</span>
      <span class="value">${formatCurrency(item.amount)}</span>
    </div>
  `;
}

export function renderAllocationItemHtml(group, item, opts) {
  const baseMeta = buildAllocationMetaText(item, { showMaturity: group !== "expense" });
  const metaHtml = baseMeta ? `
    <div class="allocation-meta">
      <span class="allocation-base-meta">${baseMeta}</span>
    </div>
  ` : "";

  return `
    <div class="${group}-row clickable-row" data-item-id="${item.id}" data-group="${group}" style="cursor: pointer;">
      <span class="${group}-name">${IsfUtils.escapeHtml(item.name)}</span>
      <span class="value">${formatCurrency(item.amount)}</span>
      ${metaHtml}
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

export function renderAccountItemHtml(item, opts) {
  return "";
}

export function renderTransferBoard(transfers, accounts) {
  if (!dom.transferCardList) return;
  dom.transferCardList.innerHTML = "";

  const safeTransfers = Array.isArray(transfers) ? transfers : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  if (safeTransfers.length === 0) {
    dom.transferCardList.innerHTML = `<p class="empty">자동 이체 흐름이 없습니다.</p>`;
    return;
  }

  dom.transferCardList.innerHTML = safeTransfers.map((t) => {
    const srcAcc = safeAccounts.find((a) => a.id === t.source);
    const tgtAcc = safeAccounts.find((a) => a.id === t.target);
    const srcName = srcAcc ? srcAcc.name : t.source;
    const tgtName = tgtAcc ? tgtAcc.name : t.target;

    return `
      <div class="transfer-card">
        <div class="transfer-card__flow">
          <span class="transfer-card__acc transfer-card__acc--source">${IsfUtils.escapeHtml(srcName)}</span>
          <span class="transfer-card__arrow">➔</span>
          <span class="transfer-card__acc transfer-card__acc--target">${IsfUtils.escapeHtml(tgtName)}</span>
        </div>
        <div class="transfer-card__amount">
          <span class="badge-transfer">${IsfUtils.formatMoney(t.value)}</span>
        </div>
      </div>
    `;
  }).join("");
}

export function renderTransferRulesList(transfers, accounts) {
  if (!dom.transferRuleList) return;
  dom.transferRuleList.innerHTML = "";

  const safeTransfers = Array.isArray(transfers) ? transfers : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  if (safeTransfers.length === 0) {
    dom.transferRuleList.innerHTML = `<p class="empty" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px 0;">설정된 수동 이체 규칙이 없습니다.</p>`;
    return;
  }

  dom.transferRuleList.innerHTML = safeTransfers.map(tr => {
    const src = safeAccounts.find(a => a.id === tr.sourceAccountId);
    const tgt = safeAccounts.find(a => a.id === tr.targetAccountId);
    const srcName = src ? src.name : "알 수 없음";
    const tgtName = tgt ? tgt.name : "알 수 없음";
    return `
      <div class="transfer-rule-card">
        <div class="transfer-rule-card__info">
          <span class="transfer-rule-card__label">${IsfUtils.escapeHtml(tr.label)}</span>
          <span class="transfer-rule-card__flow">${IsfUtils.escapeHtml(srcName)} ➔ ${IsfUtils.escapeHtml(tgtName)}</span>
        </div>
        <div class="transfer-rule-card__action">
          <span class="badge-transfer">${tr.amount.toLocaleString()}원 <small style="font-size: 0.72rem; opacity: 0.85;">(${IsfUtils.convertToKoreanWon(tr.amount)})</small></span>
          <button type="button" class="btn-delete-transfer" data-delete-transfer-id="${tr.id}" title="이체 규칙 삭제">×</button>
        </div>
      </div>
    `;
  }).join("");
}

export function renderTransferSelectOptions(accounts) {
  if (!dom.transferSourceSelect || !dom.transferTargetSelect) return;
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  
  const defaultSource = dom.transferSourceSelect.value;
  const defaultTarget = dom.transferTargetSelect.value;

  const buildOptions = () => {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "계좌 선택...";
    return [
      placeholder,
      ...safeAccounts.map((account) => {
        const option = document.createElement("option");
        option.value = account.id;
        option.textContent = account.name;
        return option;
      }),
    ];
  };

  dom.transferSourceSelect.replaceChildren(...buildOptions());
  dom.transferTargetSelect.replaceChildren(...buildOptions());

  dom.transferSourceSelect.value = defaultSource;
  dom.transferTargetSelect.value = defaultTarget;
}

export function updateSourceBalanceHint(inputs, sourceAccountId) {
  if (!dom.sourceBalanceHint) return;
  if (!sourceAccountId) {
    dom.sourceBalanceHint.hidden = true;
    dom.sourceBalanceHint.textContent = "";
    return;
  }
  
  // 1. 수입원으로부터 sourceAccountId로 들어오는 금액 합산
  let inflow = 0;
  const incomes = Array.isArray(inputs.incomes) ? inputs.incomes : [];
  incomes.forEach(src => {
    if (Array.isArray(src.allocations) && src.allocations.length > 0) {
      src.allocations.forEach(alloc => {
        if (alloc.accountId === sourceAccountId) {
          inflow += alloc.amount;
        }
      });
    } else if (src.accountId === sourceAccountId) {
      inflow += src.amount;
    }
  });

  // 2. 이 계좌에서 나가는 지출, 저축, 투자 합산
  let outflow = 0;
  const expenses = Array.isArray(inputs.expenseItems) ? inputs.expenseItems : [];
  const savings = Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [];
  const invests = Array.isArray(inputs.investItems) ? inputs.investItems : [];
  
  expenses.forEach(item => { if (item.accountId === sourceAccountId) outflow += item.amount; });
  savings.forEach(item => { if (item.accountId === sourceAccountId) outflow += item.amount; });
  invests.forEach(item => { if (item.accountId === sourceAccountId) outflow += item.amount; });

  // 3. 수동 이체에 의한 가감
  const transfers = Array.isArray(inputs.transfers) ? inputs.transfers : [];
  transfers.forEach(tr => {
    if (tr.sourceAccountId === sourceAccountId) outflow += tr.amount;
    if (tr.targetAccountId === sourceAccountId) inflow += tr.amount;
  });

  const available = inflow - outflow;
  
  dom.sourceBalanceHint.hidden = false;
  dom.sourceBalanceHint.textContent = `💡 출금 가능 예상 잔액: ${available.toLocaleString()}원 (${IsfUtils.convertToKoreanWon(available)})`;
}
