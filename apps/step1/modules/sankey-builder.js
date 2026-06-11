import {
  SANKEY_SORT_MODES,
  MAGIC_MAPPING_DEFAULTS
} from "./constants.js";
import {
  normalizeAllocationGroupName
} from "./input-sanitizer.js";

function normalizeSankeySortMode(mode) {
  return Object.values(SANKEY_SORT_MODES).includes(mode) ? mode : SANKEY_SORT_MODES.GROUP;
}

function clusterAllocationItemsByGroup(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const grouped = new Map();
  const groupOrder = [];
  const ungrouped = [];

  safeItems.forEach((item) => {
    const groupName = normalizeAllocationGroupName(item?.group);
    if (!groupName) {
      ungrouped.push(item);
      return;
    }
    if (!grouped.has(groupName)) {
      grouped.set(groupName, []);
      groupOrder.push(groupName);
    }
    grouped.get(groupName).push(item);
  });

  const groupedItems = groupOrder.flatMap((groupName) => grouped.get(groupName) || []);
  return [...groupedItems, ...ungrouped];
}

function sortBreakdownItemsForSankey(items, sortMode) {
  const safeItems = Array.isArray(items) ? [...items] : [];
  const mode = normalizeSankeySortMode(sortMode);
  
  const byNameAsc = (left, right) => String(left?.label || "")
    .localeCompare(String(right?.label || ""), "ko-KR", { sensitivity: "base" });
  const byValueAsc = (left, right) => (Number(left?.value) || 0) - (Number(right?.value) || 0);

  if (mode === SANKEY_SORT_MODES.AMOUNT_DESC) {
    safeItems.sort((left, right) => byValueAsc(right, left) || byNameAsc(left, right));
    return safeItems;
  }
  if (mode === SANKEY_SORT_MODES.AMOUNT_ASC) {
    safeItems.sort((left, right) => byValueAsc(left, right) || byNameAsc(left, right));
    return safeItems;
  }
  if (mode === SANKEY_SORT_MODES.NAME_ASC) {
    safeItems.sort((left, right) => byNameAsc(left, right) || byValueAsc(right, left));
    return safeItems;
  }
  return clusterAllocationItemsByGroup(safeItems);
}

export function buildSankeyData(snapshot, sortMode) {
  const incomeSources = (snapshot.incomeBreakdown || []).filter((item) => item.value > 0);
  if (!incomeSources.length) {
    return null;
  }

  const nodes = [];
  const links = [];

  // 1. 노드 목록(nodes) 생성
  // 수입 노드들 (column: 0)
  incomeSources.forEach((src) => {
    nodes.push({
      id: src.id,
      label: src.label,
      value: src.value,
      tone: src.tone,
      column: 0
    });
  });

  // 계좌 노드들 (column: 1)
  const accounts = snapshot.accounts || [];
  accounts.forEach((acc) => {
    nodes.push({
      id: acc.id,
      label: acc.name || acc.label || `계좌-${acc.id}`,
      value: 0,
      tone: acc.tone || "account",
      column: 1
    });
  });

  // 세부 항목 노드들 (column: 2)
  const sortedExpenses = sortBreakdownItemsForSankey(
    (snapshot.expenseBreakdown || []).filter((item) => item.value > 0),
    sortMode
  );
  const sortedSavings = sortBreakdownItemsForSankey(
    (snapshot.savingsBreakdown || []).filter((item) => item.value > 0),
    sortMode
  );
  const sortedInvests = sortBreakdownItemsForSankey(
    (snapshot.investBreakdown || []).filter((item) => item.value > 0),
    sortMode
  );

  const allBreakdowns = [...sortedExpenses, ...sortedSavings, ...sortedInvests];
  allBreakdowns.forEach((tgt) => {
    nodes.push({
      id: tgt.id,
      label: tgt.label,
      value: tgt.value,
      tone: tgt.tone,
      column: 2
    });
  });

  // 잉여현금 노드
  if (snapshot.surplus > 0) {
    nodes.push({
      id: "surplus",
      label: "잉여현금",
      value: snapshot.surplus,
      tone: "surplus",
      column: 2
    });
  }

  const accountIds = new Set(accounts.map((a) => a.id));

  function resolveAccountId(itemAccountId, magicDefault) {
    if (itemAccountId && accountIds.has(itemAccountId)) return itemAccountId;
    if (magicDefault && accountIds.has(magicDefault)) return magicDefault;
    return accounts[0]?.id || null;
  }

  // 2. 링크 목록(links) 생성
  // 수입 ➔ 계좌 링크
  incomeSources.forEach((src) => {
    const targetAccountId = resolveAccountId(src.accountId, MAGIC_MAPPING_DEFAULTS.income);
    if (!targetAccountId) return;
    links.push({
      source: src.id,
      target: targetAccountId,
      value: src.value,
      tone: src.tone
    });
  });

  // 계좌 ➔ 세부 항목 링크
  sortedExpenses.forEach((tgt) => {
    const sourceAccountId = resolveAccountId(tgt.accountId, MAGIC_MAPPING_DEFAULTS.expense);
    if (!sourceAccountId) return;
    links.push({
      source: sourceAccountId,
      target: tgt.id,
      value: tgt.value,
      tone: tgt.tone
    });
  });

  sortedSavings.forEach((tgt) => {
    const sourceAccountId = resolveAccountId(tgt.accountId, MAGIC_MAPPING_DEFAULTS.savings);
    if (!sourceAccountId) return;
    links.push({
      source: sourceAccountId,
      target: tgt.id,
      value: tgt.value,
      tone: tgt.tone
    });
  });

  sortedInvests.forEach((tgt) => {
    const sourceAccountId = resolveAccountId(tgt.accountId, MAGIC_MAPPING_DEFAULTS.invest);
    if (!sourceAccountId) return;
    links.push({
      source: sourceAccountId,
      target: tgt.id,
      value: tgt.value,
      tone: tgt.tone
    });
  });

  // 잉여현금 링크
  if (snapshot.surplus > 0) {
    const surplusSourceId = resolveAccountId(snapshot.surplusTransferAccountId, MAGIC_MAPPING_DEFAULTS.invest);
    if (surplusSourceId) {
      links.push({
        source: surplusSourceId,
        target: "surplus",
        value: snapshot.surplus,
        tone: "surplus"
      });
    }
  }


  // 3. 계좌 간 이체(내부 링크) 계산
  const providers = [];
  const consumers = [];

  accounts.forEach((acc) => {
    const totalInflow = links
      .filter((link) => link.target === acc.id)
      .reduce((sum, link) => sum + link.value, 0);

    const totalOutflow = links
      .filter((link) => link.source === acc.id)
      .reduce((sum, link) => sum + link.value, 0);

    const balance = totalInflow - totalOutflow;
    if (balance > 0.01) {
      providers.push({ id: acc.id, balance });
    } else if (balance < -0.01) {
      consumers.push({ id: acc.id, balance });
    }
  });

  let pIdx = 0, cIdx = 0;
  while (pIdx < providers.length && cIdx < consumers.length) {
    const p = providers[pIdx];
    const c = consumers[cIdx];
    const transfer = Math.min(p.balance, -c.balance);
    if (transfer > 0.01) {
      links.push({
        source: p.id,
        target: c.id,
        value: transfer,
        tone: "transfer"
      });
      p.balance -= transfer;
      c.balance += transfer;
    }
    if (p.balance <= 0.01) pIdx++;
    if (-c.balance <= 0.01) cIdx++;
  }

  const totalValue = incomeSources.reduce((sum, item) => sum + item.value, 0);

  // 4. 기존 렌더러와의 호환성(회귀 방지)을 위해 아래의 구조로 반환
  return {
    nodes,
    links,
    totalValue,
    hasIncomeInflow: incomeSources.length >= 2,
    hasGroupLayer: false,
    splitGroups: [],
    topLevelTargetIds: accounts.map((a) => a.id)
  };
}

