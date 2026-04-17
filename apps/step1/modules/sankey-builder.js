import {
  SANKEY_SORT_MODES
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
  const level1Targets = snapshot.targets.filter((item) => item.value > 0);
  if (!level1Targets.length) {
    return null;
  }

  const totalValue = level1Targets.reduce((sum, item) => sum + item.value, 0);
  const incomeSources = (snapshot.incomeBreakdown || []).filter((item) => item.value > 0);
  const showIncomeInflow = incomeSources.length >= 2;

  const toGroupNodeId = (parentId, groupLabel, index) => {
    const slug = String(groupLabel || "")
      .toLowerCase()
      .replace(/[^a-z0-9\uac00-\ud7a3]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const safeSlug = slug || `group-${index + 1}`;
    return `${parentId}-group-${safeSlug}-${index + 1}`;
  };

  const splitConfigs = [
    {
      parentId: "expense",
      tone: "expense",
      breakdown: sortBreakdownItemsForSankey((snapshot.expenseBreakdown || []).filter((item) => item.value > 0), sortMode),
    },
    {
      parentId: "savings",
      tone: "savings",
      breakdown: sortBreakdownItemsForSankey((snapshot.savingsBreakdown || []).filter((item) => item.value > 0), sortMode),
    },
    {
      parentId: "invest",
      tone: "invest",
      breakdown: sortBreakdownItemsForSankey((snapshot.investBreakdown || []).filter((item) => item.value > 0), sortMode),
    },
  ];

  const nodes = [];
  const links = [];
  let currentColumn = 0;

  if (showIncomeInflow) {
    incomeSources.forEach((source) => {
      nodes.push({ id: source.id, label: source.label, value: source.value, tone: source.tone, column: currentColumn });
      links.push({ source: source.id, target: "total-income", value: source.value, tone: source.tone });
    });
    nodes.push({ id: "total-income", label: "총 수입", value: totalValue, tone: "income", column: currentColumn + 1 });
    currentColumn += 1;
  } else {
    nodes.push({ id: "total-income", label: "총 수입", value: totalValue, tone: "income", column: currentColumn });
  }

  const mainNodeId = "total-income";
  const targetColumn = currentColumn + 1;
  level1Targets.forEach((target) => {
    nodes.push({ id: target.id, label: target.label, value: target.value, tone: target.tone, column: targetColumn });
    links.push({ source: mainNodeId, target: target.id, value: target.value, tone: target.tone });
  });

  const splitGroups = [];
  let hasGroupLayer = false;

  splitConfigs.forEach((config) => {
    const parent = level1Targets.find((t) => t.id === config.parentId);
    if (!parent || !config.breakdown.length) return;

    const groupedMap = new Map();
    const ungrouped = [];
    config.breakdown.forEach((item) => {
      const groupName = normalizeAllocationGroupName(item.group);
      if (groupName) {
        if (!groupedMap.has(groupName)) groupedMap.set(groupName, []);
        groupedMap.get(groupName).push(item);
      } else {
        ungrouped.push(item);
      }
    });

    const breakdownNodes = [];
    const groupEntries = [];
    
    if (groupedMap.size > 0) {
      hasGroupLayer = true;
      let gIdx = 0;
      for (const [groupName, groupItems] of groupedMap) {
        const groupId = toGroupNodeId(config.parentId, groupName, gIdx++);
        const groupValue = groupItems.reduce((sum, i) => sum + i.value, 0);
        nodes.push({ id: groupId, label: groupName, value: groupValue, tone: config.tone, column: targetColumn + 1 });
        links.push({ source: config.parentId, target: groupId, value: groupValue, tone: config.tone });
        
        groupItems.forEach((item) => {
          nodes.push({ id: item.id, label: item.label, value: item.value, tone: config.tone, column: targetColumn + 2 });
          links.push({ source: groupId, target: item.id, value: item.value, tone: config.tone });
          breakdownNodes.push(item);
        });
        groupEntries.push({ label: groupName, value: groupValue, items: groupItems });
      }
      ungrouped.forEach((item) => {
        nodes.push({ id: item.id, label: item.label, value: item.value, tone: config.tone, column: targetColumn + 2 });
        links.push({ source: config.parentId, target: item.id, value: item.value, tone: config.tone });
        breakdownNodes.push(item);
      });
    } else {
      config.breakdown.forEach((item) => {
        nodes.push({ id: item.id, label: item.label, value: item.value, tone: config.tone, column: targetColumn + 1 });
        links.push({ source: config.parentId, target: item.id, value: item.value, tone: config.tone });
        breakdownNodes.push(item);
      });
    }

    splitGroups.push({
      parentId: config.parentId,
      breakdown: breakdownNodes,
      grouped: groupEntries,
      ungrouped: ungrouped
    });
  });

  return {
    nodes,
    links,
    totalValue,
    hasIncomeInflow: showIncomeInflow,
    hasGroupLayer,
    splitGroups,
    topLevelTargetIds: level1Targets.map(t => t.id)
  };
}
