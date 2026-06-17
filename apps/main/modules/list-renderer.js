import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { formatCurrency } from "./formatters.js";
import { buildAllocationMetaText, getMonthlyIncomeTotalWon } from "./input-sanitizer.js";
import { calculateAccountFinancialIncomes } from "./calculator.js";

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
  
  if (state.itemEditors[group]?.creatorActive) {
    list.innerHTML = renderCreatorFormHtml(group);
    IsfUtils.updateAllKoreanWonHints(list);
    return;
  }

  if (group === "account" || group === "income") {
    if (group === "account") {
      let warnings = options.warnings;
      if (!warnings) {
        const inputs = state.inputs;
        const res = calculateAccountFinancialIncomes(inputs);
        warnings = res.warnings;
      }
      list.innerHTML = items.map(item => renderAccountItemHtml(item, { ...options, warnings })).join("");
    } else {
      list.innerHTML = items.map((item) => renderIncomeItemHtml(item, options)).join("");
    }
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
    const hasEditingItem = options.editingItemId && groupItems.some(item => item.id === options.editingItemId);
    const isEditing = !!options.editing || !!hasEditingItem;
    const isUnclassified = groupName === "미분류";
    const knownOpen = openState && openState.has(groupKey) ? openState.get(groupKey) : null;
    const isOpen = isEditing || isUnclassified || (knownOpen === null ? true : knownOpen);
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

function getShortAccountName(name) {
  if (!name) return "";
  return name.replace(/(계좌|통장)$/, "");
}

function escapeOptionAttributeValue(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value ?? "").replace(/[&<>"']/g, (match) => entities[match]);
}

export function renderIncomeItemHtml(item, opts) {
  const isEditing = opts.editing || opts.editingItemId === item.id;
  if (!isEditing) {
    const accounts = (state.inputs.accounts || []);
    let accHtml = "";
    if (Array.isArray(item.allocations) && item.allocations.length > 0) {
      accHtml = item.allocations.map(al => {
        const acc = accounts.find(a => a.id === al.accountId);
        const name = acc ? getShortAccountName(acc.name) : "미지정";
        return `<span class="badge-account badge-account--income">${IsfUtils.escapeHtml(name)}: ${formatCurrency(al.amount)}</span>`;
      }).join(" ");
    } else {
      const acc = accounts.find(a => a.id === item.accountId);
      const name = acc ? getShortAccountName(acc.name) : "미지정";
      accHtml = acc ? `<span class="badge-account badge-account--income">${IsfUtils.escapeHtml(name)}</span>` : `<span class="badge-account badge-account--none">미지정</span>`;
    }
    return `
      <div class="income-row clickable-row" data-item-id="${item.id}" data-group="income" style="cursor: pointer;">
        <span class="income-name">${IsfUtils.escapeHtml(item.name)}</span>
        <span class="value">${formatCurrency(item.amount)}</span>
        <div class="income-meta">${accHtml}</div>
      </div>
    `;
  }

  // 편집 모드일 때
  const accounts = (state.inputs.accounts || []);
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];

  const allocationsHtml = allocations.map((al, idx) => {
    const selectOpts = accounts.map(acc => {
      const selected = acc.id === al.accountId ? "selected" : "";
      return `<option value="${escapeOptionAttributeValue(acc.id)}" ${selected}>${IsfUtils.escapeHtml(acc.name)}</option>`;
    }).join("");

    return `
      <div class="income-allocation-row">
        <select data-income-id="${item.id}" data-allocation-index="${idx}" data-field="allocationAccountId" class="allocation-select">
          <option value="">계좌 선택...</option>
          ${selectOpts}
        </select>
        <div class="allocation-amount-wrapper">
          <div class="amount-stepper-container" style="display: flex; align-items: center; gap: 4px;">
            <button type="button" class="btn-step-amount step-minus" data-step="-1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
            <input type="text" value="${IsfUtils.formatWonInputValue(al.amount || 0)}" data-money-input="won" data-income-id="${item.id}" data-allocation-index="${idx}" data-field="allocationAmount" inputmode="decimal" class="allocation-amount-input" placeholder="분배 금액 (원)" style="flex: 1;" />
            <button type="button" class="btn-step-amount step-plus" data-step="1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
          </div>
          <div class="quick-amount-buttons">
            <button type="button" class="btn-quick-amount" data-add="10000">+1만</button>
            <button type="button" class="btn-quick-amount" data-add="100000">+10만</button>
            <button type="button" class="btn-quick-amount" data-add="1000000">+100만</button>
          </div>
        </div>
        <span class="allocation-unit">원</span>
        <button type="button" class="remove-allocation-btn" data-income-id="${item.id}" data-allocation-index="${idx}" title="분배 제거">×</button>
      </div>
    `;
  }).join("");

  return `
    <div class="income-row is-editing is-multi-allocation">
      <div class="income-row-fields">
        <div class="editor-field">
          <label class="editor-field-label">수입명</label>
          <input type="text" value="${IsfUtils.escapeHtml(item.name)}" data-income-id="${item.id}" data-field="name" placeholder="이름" />
        </div>
        <div class="editor-field">
          <label class="editor-field-label">전체 수입(원)</label>
          <div class="amount-stepper-container" style="display: flex; align-items: center; gap: 4px;">
            <button type="button" class="btn-step-amount step-minus" data-step="-1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
            <input type="text" value="${IsfUtils.formatWonInputValue(item.amount || 0)}" data-money-input="won" data-income-id="${item.id}" data-field="amount" inputmode="decimal" placeholder="금액 (원)" style="flex: 1;" />
            <button type="button" class="btn-step-amount step-plus" data-step="1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
          </div>
          <div class="quick-amount-buttons">
            <button type="button" class="btn-quick-amount" data-add="10000">+1만</button>
            <button type="button" class="btn-quick-amount" data-add="100000">+10만</button>
            <button type="button" class="btn-quick-amount" data-add="1000000">+100만</button>
          </div>
        </div>
        <button class="income-remove" data-remove-income="${item.id}" title="삭제">
          <svg class="income-remove-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1-1H5v2h14V4z"/></svg>
          <span class="income-remove-text">삭제</span>
        </button>
      </div>
      <div class="income-allocations-section">
        <div class="allocations-header">
          <span class="allocations-title">계좌별 분배 설정</span>
          <button type="button" class="btn btn-ghost btn-xs add-allocation-btn" data-income-id="${item.id}">+ 분배 계좌 추가</button>
        </div>
        <div class="allocations-list">
          ${allocationsHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderAllocationItemHtml(group, item, opts) {
  const isEditing = opts.editing || opts.editingItemId === item.id;
  
  let metaHtml = "";
  if (!isEditing) {
    const baseMeta = buildAllocationMetaText(item, { showMaturity: group !== "expense" });
    const acc = (state.inputs.accounts || []).find(a => a.id === item.accountId);
    const name = acc ? getShortAccountName(acc.name) : "미지정";
    const accHtml = acc ? `<span class="badge-account badge-account--outflow">${IsfUtils.escapeHtml(name)}</span>` : `<span class="badge-account badge-account--none">미지정</span>`;
    metaHtml = `
      <div class="allocation-meta">
        ${baseMeta ? `<span class="allocation-base-meta">${baseMeta}</span> · ` : ""}
        ${accHtml}
      </div>
    `;
  }

  const commonClasses = `${group}-row ${isEditing ? "is-editing" : ""}`;
  
  if (!isEditing) {
    return `
      <div class="${commonClasses} clickable-row" data-item-id="${item.id}" data-group="${group}" style="cursor: pointer;">
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
        <label class="editor-field-label">출금계좌</label>
        <select data-field="accountId" data-editor-id="${item.id}">
          <option value="">계좌 선택...</option>
          ${(state.inputs.accounts || []).map(acc => {
            const selected = acc.id === item.accountId ? "selected" : "";
            return `<option value="${escapeOptionAttributeValue(acc.id)}" ${selected}>${IsfUtils.escapeHtml(acc.name)}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="editor-field">
        <label class="editor-field-label">금액(원)</label>
        <div class="amount-stepper-container" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn-step-amount step-minus" data-step="-1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
          <input type="text" value="${IsfUtils.formatWonInputValue(item.amount || 0)}" data-money-input="won" data-field="amount" data-editor-id="${item.id}" inputmode="decimal" placeholder="금액 (원)" style="flex: 1;" />
          <button type="button" class="btn-step-amount step-plus" data-step="1000" style="padding: 6px 10px; border: 1px solid var(--line); background: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
        </div>
        <div class="quick-amount-buttons">
          <button type="button" class="btn-quick-amount" data-add="10000">+1만</button>
          <button type="button" class="btn-quick-amount" data-add="100000">+10만</button>
          <button type="button" class="btn-quick-amount" data-add="1000000">+100만</button>
        </div>
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

export function renderAccountItemHtml(item, opts) {
  const isEditing = opts.editing || opts.editingItemId === item.id;
  const warnings = opts.warnings || {};
  const warning = warnings[item.id];

  if (!isEditing) {
    let warningClass = "";
    if (warning) {
      if (warning.status === "warn") {
        warningClass = "account-row--warn";
      } else if (warning.status === "crit") {
        warningClass = "account-row--crit";
      }
    }

    return `
      <div class="account-row ${warningClass} clickable-row" data-item-id="${item.id}" data-group="account" style="cursor: pointer;">
        <span class="account-name">${IsfUtils.escapeHtml(item.name)}</span>
      </div>
    `;
  }
  return `
    <div class="account-row is-editing">
      <div class="editor-field">
        <label class="editor-field-label">계좌명</label>
        <input type="text" value="${IsfUtils.escapeHtml(item.name)}" data-field="name" data-editor-id="${item.id}" placeholder="계좌 별칭" />
      </div>
      <button class="allocation-remove" data-remove-editor-item="${item.id}" title="삭제">×</button>
    </div>
  `;
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
  if (safeTransfers.length === 0) {
    dom.transferRuleList.innerHTML = `<p class="empty" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px 0;">설정된 수동 이체 규칙이 없습니다.</p>`;
    return;
  }

  dom.transferRuleList.innerHTML = safeTransfers.map(tr => {
    const src = accounts.find(a => a.id === tr.sourceAccountId);
    const tgt = accounts.find(a => a.id === tr.targetAccountId);
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
  
  const defaultSource = dom.transferSourceSelect.value;
  const defaultTarget = dom.transferTargetSelect.value;

  const buildOptions = () => {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "계좌 선택...";
    return [
      placeholder,
      ...accounts.map((account) => {
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

function renderCreatorFormHtml(group) {
  const accounts = state.inputs.accounts || [];
  const isSavings = group === "savings";
  const isInvest = group === "invest";
  
  let fieldsHtml = "";
  if (group === "income") {
    fieldsHtml = `
      <div class="creator-field-row" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <div class="editor-field" style="flex: 0 0 140px; min-width: 120px;">
          <label class="editor-field-label">수입명</label>
          <input type="text" id="newIncomeName" placeholder="예: 급여" class="creator-input" style="width: 100%;" />
        </div>
        <div class="editor-field" style="flex: 1; min-width: 150px;">
          <label class="editor-field-label">금액(원)</label>
          <input type="text" id="newIncomeAmount" data-money-input="won" placeholder="금액 입력" class="creator-input" inputmode="decimal" style="width: 100%;" />
          <div class="quick-amount-buttons">
            <button type="button" class="btn-quick-amount" data-add="10000">+1만</button>
            <button type="button" class="btn-quick-amount" data-add="100000">+10만</button>
            <button type="button" class="btn-quick-amount" data-add="1000000">+100만</button>
          </div>
        </div>
      </div>
      <div class="editor-field" style="margin-top: 12px;">
        <label class="editor-field-label">입금 계좌 선택</label>
        <select id="newIncomeAccountId" class="creator-select" style="width: 100%; border: 1px solid rgba(16, 34, 32, 0.12); border-radius: 4px; padding: 6px 8px; font-size: 0.86rem;">
          <option value="">계좌 선택...</option>
          ${accounts.map(acc => `<option value="${escapeOptionAttributeValue(acc.id)}">${IsfUtils.escapeHtml(acc.name)}</option>`).join("")}
        </select>
      </div>
    `;
  } else if (group === "account") {
    fieldsHtml = `
      <div class="editor-field">
        <label class="editor-field-label">계좌(통장) 이름</label>
        <input type="text" id="newAccountName" placeholder="예: 생활비통장" class="creator-input" style="width: 100%;" />
      </div>
    `;
  } else {
    fieldsHtml = `
      <div class="creator-field-row" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <div class="editor-field" style="flex: 0 0 140px; min-width: 120px;">
          <label class="editor-field-label">이름</label>
          <input type="text" id="newItemName" placeholder="항목명" class="creator-input" style="width: 100%;" />
        </div>
        <div class="editor-field" style="flex: 1; min-width: 150px;">
          <label class="editor-field-label">금액(원)</label>
          <input type="text" id="newItemAmount" data-money-input="won" placeholder="금액 입력" class="creator-input" inputmode="decimal" style="width: 100%;" />
          <div class="quick-amount-buttons">
            <button type="button" class="btn-quick-amount" data-add="10000">+1만</button>
            <button type="button" class="btn-quick-amount" data-add="100000">+10만</button>
            <button type="button" class="btn-quick-amount" data-add="1000000">+100만</button>
          </div>
        </div>
      </div>
      <div class="creator-field-row" style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <div class="editor-field" style="flex: 1; min-width: 120px;">
          <label class="editor-field-label">출금계좌</label>
          <select id="newItemAccountId" class="creator-select" style="width: 100%; border: 1px solid rgba(16, 34, 32, 0.12); border-radius: 4px; padding: 6px 8px; font-size: 0.86rem;">
            <option value="">계좌 선택...</option>
            ${accounts.map(acc => `<option value="${escapeOptionAttributeValue(acc.id)}">${IsfUtils.escapeHtml(acc.name)}</option>`).join("")}
          </select>
        </div>
        <div class="editor-field" style="flex: 1; min-width: 120px;">
          <label class="editor-field-label">그룹</label>
          <input type="text" id="newItemGroup" placeholder="그룹명" list="${group}GroupOptions" class="creator-input" style="width: 100%;" />
        </div>
      </div>
      ${isSavings ? `
        <div class="creator-field-row" style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
          <div class="editor-field" style="flex: 1;">
            <label class="editor-field-label">연이율(%)</label>
            <input type="number" id="newItemAnnualRate" placeholder="연이율 입력" class="creator-input" step="0.1" inputmode="decimal" style="width: 100%;" />
          </div>
          <div class="editor-field" style="flex: 1;">
            <label class="editor-field-label">만기/해지월</label>
            <input type="month" id="newItemMaturityMonth" class="creator-input" style="width: 100%;" />
          </div>
        </div>
      ` : ""}
      ${isInvest && !isSavings ? `
        <div class="editor-field" style="margin-top: 12px;">
          <label class="editor-field-label">만기/해지월</label>
          <input type="month" id="newItemMaturityMonth" class="creator-input" style="width: 100%;" />
        </div>
      ` : ""}
    `;
  }

  const groupKo = group === "income" ? "수입" : (group === "account" ? "계좌" : (group === "expense" ? "지출" : (group === "savings" ? "저축" : "투자")));

  return `
    <div class="item-creator-panel" style="padding: 16px; border: 1.5px dashed var(--tone-primary); border-radius: var(--rd-sm); background: rgba(255,255,255,0.7); margin-bottom: 12px;">
      <h4 style="margin-top: 0; margin-bottom: 16px; color: var(--tone-primary); font-family: 'Gowun Dodum'; font-weight: 700; font-size: 0.95rem;">➕ 새 ${groupKo} 항목 추가</h4>
      <form id="newGroupItemForm" onsubmit="event.preventDefault();">
        ${fieldsHtml}
        <div class="creator-form-buttons" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
          <button type="button" class="btn btn-ghost btn-sm creator-cancel-btn" style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line);">취소</button>
          <button type="button" class="btn btn-primary btn-sm creator-apply-btn" style="padding: 6px 14px; border-radius: 8px;">추가하기</button>
        </div>
      </form>
    </div>
  `;
}
