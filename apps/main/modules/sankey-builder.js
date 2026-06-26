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

export function buildSankeyData(snapshot, sortMode, sankeyGrouping) {
  const incomeSources = (snapshot.incomeBreakdown || [])
    .filter((item) => item.value > 0 && item.id !== "income-deficit" && item.tone !== "deficit");
  if (!incomeSources.length) {
    return null;
  }

  const nodes = [];
  const links = [];
  const splitGroups = [];

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

  nodes.push({
    id: "total-income",
    label: "총수입",
    value: incomeSources.reduce((sum, src) => sum + src.value, 0),
    tone: "income",
    column: 1
  });

  const createSplitGroup = (parentId, activeItems) => {
    const breakdown = activeItems.map(item => ({ label: item.label, value: item.value, tone: item.tone }));
    const groupsMapForSplit = new Map();
    const ungrouped = [];
    activeItems.forEach(item => {
      const groupName = normalizeAllocationGroupName(item.group);
      if (groupName) {
        if (!groupsMapForSplit.has(groupName)) {
          groupsMapForSplit.set(groupName, []);
        }
        groupsMapForSplit.get(groupName).push({ label: item.label, value: item.value, tone: item.tone });
      } else {
        ungrouped.push({ label: item.label, value: item.value, tone: item.tone });
      }
    });
    const grouped = [];
    groupsMapForSplit.forEach((groupItems, groupName) => {
      grouped.push({
        label: groupName,
        value: groupItems.reduce((sum, i) => sum + i.value, 0),
        items: groupItems
      });
    });

    splitGroups.push({
      parentId,
      breakdown,
      grouped,
      ungrouped
    });
  };

  // 세부 항목 카테고리별 묶음 연산 헬퍼
  const resolveCategoryNodes = (category, breakdownItems, groupingSetting, defaultNodeLabel) => {
    const categoryNodes = [];
    const activeItems = (breakdownItems || []).filter((item) => item.value > 0);
    if (activeItems.length === 0) return [];

    const setting = groupingSetting || "total";

    if (setting === "total") {
      const totalValue = activeItems.reduce((sum, item) => sum + item.value, 0);
      const tone = activeItems[0]?.tone || category;
      const nodeId = `total-${category}`;
      
      categoryNodes.push({
        id: nodeId,
        label: defaultNodeLabel,
        value: totalValue,
        tone: tone,
        column: 2,
        group: null,
        accountId: null
      });

      createSplitGroup(nodeId, activeItems);

    } else if (setting === "group") {
      const groupsMap = new Map();
      activeItems.forEach((item) => {
        const groupName = normalizeAllocationGroupName(item.group) || "미분류";
        if (!groupsMap.has(groupName)) {
          groupsMap.set(groupName, []);
        }
        groupsMap.get(groupName).push(item);
      });

      groupsMap.forEach((itemsInGroup, groupName) => {
        const totalValue = itemsInGroup.reduce((sum, item) => sum + item.value, 0);
        const tone = itemsInGroup[0]?.tone || category;
        const nodeId = `group-${category}-${groupName}`;

        categoryNodes.push({
          id: nodeId,
          label: groupName,
          value: totalValue,
          tone: tone,
          column: 2,
          group: groupName,
          accountId: null
        });

        createSplitGroup(nodeId, itemsInGroup);
      });

    } else {
      activeItems.forEach((item) => {
        const tone = item.tone || category;
        categoryNodes.push({
          id: item.id,
          label: item.label,
          value: item.value,
          tone: tone,
          column: 2,
          group: item.group || null,
          accountId: null
        });
        createSplitGroup(item.id, [item]);
      });
    }

    return categoryNodes;
  };

  // 1.2 세부 항목 노드들 (column: 2) 빌드 및 정렬
  const expenseNodes = resolveCategoryNodes(
    "expense",
    snapshot.expenseBreakdown,
    sankeyGrouping?.expense,
    "고정비(고정지출)"
  );
  const savingsNodes = resolveCategoryNodes(
    "savings",
    snapshot.savingsBreakdown,
    sankeyGrouping?.savings,
    "저축"
  );
  const investNodes = resolveCategoryNodes(
    "invest",
    snapshot.investBreakdown,
    sankeyGrouping?.invest,
    "투자"
  );

  const sortedExpenses = sortBreakdownItemsForSankey(expenseNodes, sortMode);
  const sortedSavings = sortBreakdownItemsForSankey(savingsNodes, sortMode);
  const sortedInvests = sortBreakdownItemsForSankey(investNodes, sortMode);

  const allBreakdowns = [...sortedExpenses, ...sortedSavings, ...sortedInvests];
  allBreakdowns.forEach((node) => {
    nodes.push(node);
  });

  // 부채상환 노드
  if (snapshot.debtPayment > 0) {
    nodes.push({
      id: "debt",
      label: "부채상환",
      value: snapshot.debtPayment,
      tone: "debt",
      column: 2,
      group: null,
      accountId: null
    });
  }

  // 잉여현금 노드
  if (snapshot.surplus > 0) {
    nodes.push({
      id: "surplus",
      label: "잉여현금",
      value: snapshot.surplus,
      tone: "surplus",
      column: 2,
      group: null,
      accountId: null
    });
  }

  // 2. 링크 목록(links) 생성
  // 수입 ➔ 총수입 링크 생성
  incomeSources.forEach((src) => {
    links.push({
      source: src.id,
      target: "total-income",
      value: src.value,
      tone: src.tone
    });
  });

  allBreakdowns.forEach((target) => {
    links.push({
      source: "total-income",
      target: target.id,
      value: target.value,
      tone: target.tone
    });
  });

  // 부채상환 링크
  if (snapshot.debtPayment > 0) {
    links.push({
      source: "total-income",
      target: "debt",
      value: snapshot.debtPayment,
      tone: "debt"
    });
  }

  // 잉여현금 링크
  if (snapshot.surplus > 0) {
    links.push({
      source: "total-income",
      target: "surplus",
      value: snapshot.surplus,
      tone: "surplus"
    });
  }

  // 3. 단순 Step 1 기본 Sankey에서는 계좌 간 이체를 렌더링하지 않는다.
  const transfers = [];

  const totalValue = incomeSources.reduce((sum, item) => sum + item.value, 0);
  const topLevelTargetIds = allBreakdowns.map((node) => node.id);
  if (snapshot.debtPayment > 0) topLevelTargetIds.push("debt");
  if (snapshot.surplus > 0) topLevelTargetIds.push("surplus");

  // 4. 기존 렌더러와의 호환성(회귀 방지)을 위해 아래의 구조로 반환
  return {
    nodes,
    links,
    transfers,
    totalValue,
    hasIncomeInflow: incomeSources.length >= 2,
    hasGroupLayer: false,
    splitGroups,
    topLevelTargetIds
  };
}

