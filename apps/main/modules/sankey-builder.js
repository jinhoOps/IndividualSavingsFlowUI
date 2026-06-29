import {
  SANKEY_SORT_MODES
} from "./constants.js";
import {
  normalizeAllocationGroupName
} from "./input-sanitizer.js";
import { recommendAccountId } from "./account-correction.js";

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

export function buildSankeyData(snapshot, sortMode, sankeyGrouping, options = {}) {
  const incomeSources = (snapshot.incomeBreakdown || [])
    .filter((item) => item.value > 0 && item.id !== "income-deficit" && item.tone !== "deficit");
  if (!incomeSources.length) {
    return null;
  }

  const includeAccountFlow = Boolean(options.includeAccountFlow);
  const nodes = [];
  const links = [];
  const splitGroups = [];

  const accounts = snapshot.accounts || [];
  const accountIds = new Set(accounts.map((a) => a.id));

  function resolveAccountId(itemAccountId, category) {
    if (!includeAccountFlow) return null;
    if (itemAccountId && accountIds.has(itemAccountId)) return itemAccountId;
    return recommendAccountId({ accounts }, category, { accountId: itemAccountId }) || null;
  }

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

  if (includeAccountFlow) {
    // 계좌 노드들 (총수입 이후 계좌 레이어)
    accounts.forEach((acc) => {
      nodes.push({
        id: acc.id,
        label: acc.name || acc.label || `계좌-${acc.id}`,
        value: 0,
        tone: acc.tone || "account",
        column: 1.5
      });
    });
  }

  // 세부 항목 카테고리별 묶음 연산 헬퍼
  const resolveCategoryNodesAndLinks = (category, breakdownItems, groupingSetting, defaultNodeLabel) => {
    const categoryNodes = [];
    const categoryLinks = [];
    const activeItems = (breakdownItems || []).filter((item) => item.value > 0);
    if (activeItems.length === 0) return { nodes: [], links: [] };

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

      // splitGroups 채우기
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
        parentId: nodeId,
        breakdown,
        grouped,
        ungrouped
      });

      if (includeAccountFlow) {
        // 계좌별로 합산 링크
        const accountValues = new Map();
        activeItems.forEach((item) => {
          const sourceAccountId = resolveAccountId(item.accountId, category);
          if (sourceAccountId) {
            accountValues.set(sourceAccountId, (accountValues.get(sourceAccountId) || 0) + item.value);
          }
        });

        accountValues.forEach((val, sourceAccountId) => {
          categoryLinks.push({
            source: sourceAccountId,
            target: nodeId,
            value: val,
            tone: tone
          });
        });
      } else {
        categoryLinks.push({
          source: "total-income",
          target: nodeId,
          value: totalValue,
          tone: tone
        });
      }

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

        // splitGroups 채우기
        const breakdown = itemsInGroup.map(item => ({ label: item.label, value: item.value, tone: item.tone }));
        splitGroups.push({
          parentId: nodeId,
          breakdown,
          grouped: [],
          ungrouped: breakdown
        });

        if (includeAccountFlow) {
          // 계좌별로 합산 링크
          const accountValues = new Map();
          itemsInGroup.forEach((item) => {
            const sourceAccountId = resolveAccountId(item.accountId, category);
            if (sourceAccountId) {
              accountValues.set(sourceAccountId, (accountValues.get(sourceAccountId) || 0) + item.value);
            }
          });

          accountValues.forEach((val, sourceAccountId) => {
            categoryLinks.push({
              source: sourceAccountId,
              target: nodeId,
              value: val,
              tone: tone
            });
          });
        } else {
          categoryLinks.push({
            source: "total-income",
            target: nodeId,
            value: totalValue,
            tone: tone
          });
        }
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
          accountId: item.accountId || null
        });

        const sourceAccountId = resolveAccountId(item.accountId, category);
        if (includeAccountFlow && sourceAccountId) {
          categoryLinks.push({
            source: sourceAccountId,
            target: item.id,
            value: item.value,
            tone: tone
          });
        } else {
          categoryLinks.push({
            source: "total-income",
            target: item.id,
            value: item.value,
            tone: tone
          });
        }
      });
    }

    return { nodes: categoryNodes, links: categoryLinks };
  };

  // 1.2 세부 항목 노드들 (column: 2) 빌드 및 정렬
  const expenseRes = resolveCategoryNodesAndLinks(
    "expense",
    snapshot.expenseBreakdown,
    sankeyGrouping?.expense,
    "고정비(고정지출)"
  );
  const savingsRes = resolveCategoryNodesAndLinks(
    "savings",
    snapshot.savingsBreakdown,
    sankeyGrouping?.savings,
    "저축"
  );
  const investRes = resolveCategoryNodesAndLinks(
    "invest",
    snapshot.investBreakdown,
    sankeyGrouping?.invest,
    "투자"
  );

  const sortedExpenses = sortBreakdownItemsForSankey(expenseRes.nodes, sortMode);
  const sortedSavings = sortBreakdownItemsForSankey(savingsRes.nodes, sortMode);
  const sortedInvests = sortBreakdownItemsForSankey(investRes.nodes, sortMode);

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
      column: 2
    });
  }

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

  // 2. 링크 목록(links) 생성
  // 수입 ➔ 총수입 링크 생성. 계좌 흐름은 별도 네트워크/Account Map 보조 데이터에서만 확장한다.
  const accountIncomeValues = new Map();
  incomeSources.forEach((src) => {
    links.push({
      source: src.id,
      target: "total-income",
      value: src.value,
      tone: src.tone
    });

    if (includeAccountFlow) {
      const allocations = Array.isArray(src.allocations) && src.allocations.length > 0
        ? src.allocations
        : [{ accountId: src.accountId, amount: src.value }];
      allocations.forEach((alloc) => {
        const amount = Number(alloc?.amount) || 0;
        if (amount <= 0) return;
        const targetAccountId = resolveAccountId(alloc.accountId, "income");
        if (!targetAccountId) return;
        accountIncomeValues.set(targetAccountId, (accountIncomeValues.get(targetAccountId) || 0) + amount);
      });
    }
  });

  if (includeAccountFlow) {
    accountIncomeValues.forEach((value, accountId) => {
      if (value <= 0) {
        return;
      }
      links.push({
        source: "total-income",
        target: accountId,
        value,
        tone: "income"
      });
    });
  }

  // 계좌 ➔ 세부 항목 링크들 주입
  links.push(...expenseRes.links, ...savingsRes.links, ...investRes.links);

  // 부채상환 링크
  if (snapshot.debtPayment > 0) {
    const debtSourceId = resolveAccountId(null, "expense");
    if (includeAccountFlow && debtSourceId) {
      links.push({
        source: debtSourceId,
        target: "debt",
        value: snapshot.debtPayment,
        tone: "debt"
      });
    } else {
      links.push({
        source: "total-income",
        target: "debt",
        value: snapshot.debtPayment,
        tone: "debt"
      });
    }
  }

  // 잉여현금 링크
  if (snapshot.surplus > 0) {
    const surplusSourceId = resolveAccountId(snapshot.surplusTransferAccountId, "invest");
    if (includeAccountFlow && surplusSourceId) {
      links.push({
        source: surplusSourceId,
        target: "surplus",
        value: snapshot.surplus,
        tone: "surplus"
      });
    } else {
      links.push({
        source: "total-income",
        target: "surplus",
        value: snapshot.surplus,
        tone: "surplus"
      });
    }
  }

  // 3. 계좌 간 이체(내부 링크) 계산
  const transfers = includeAccountFlow ? (Array.isArray(snapshot.transfers) ? snapshot.transfers : [])
    .map((transfer) => {
      const source = resolveAccountId(transfer?.sourceAccountId, "transfer");
      const target = resolveAccountId(transfer?.targetAccountId, "transfer");
      return {
        id: transfer?.id,
        source,
        target,
        value: Number(transfer?.amount) || 0,
        tone: "transfer",
        label: transfer?.label || "계좌 이체",
        isManual: true
      };
    })
    .filter((transfer) => transfer.source && transfer.target && transfer.source !== transfer.target && transfer.value > 0) : [];

  const providers = [];
  const consumers = [];
 
  if (includeAccountFlow) {
    accounts.forEach((acc) => {
    // 수입 -> 계좌 링크 합산 (계좌 간 분배 링크는 제외하기 위해 source가 계좌가 아닌 것만 필터)
    const totalInflow = links
      .filter((link) => link.target === acc.id && !accountIds.has(link.source))
      .reduce((sum, link) => sum + link.value, 0);
 
    // 계좌 -> 대분류 링크 합산 (계좌 간 분배 링크는 제외하기 위해 target이 계좌가 아닌 것만 필터)
    const totalOutflow = links
      .filter((link) => link.source === acc.id && !accountIds.has(link.target))
      .reduce((sum, link) => sum + link.value, 0);
 
    // 수입 분배에 의한 계좌 간 이동을 반영한 뒤 부족/잉여 계좌를 계산한다.
    const transferInflow = transfers
      .filter((t) => t.target === acc.id)
      .reduce((sum, t) => sum + t.value, 0);
 
    const transferOutflow = transfers
      .filter((t) => t.source === acc.id)
      .reduce((sum, t) => sum + t.value, 0);
 
    const balance = (totalInflow + transferInflow) - (totalOutflow + transferOutflow);
    if (balance > 0.01) {
      providers.push({ id: acc.id, balance });
    } else if (balance < -0.01) {
      consumers.push({ id: acc.id, balance });
    }
    });
  }
 
  // 3.2 항목별 출처 계좌 기준으로 남은 과부족에 대해 자동 Greedy 매칭 적용
  let pIdx = 0, cIdx = 0;
  while (includeAccountFlow && pIdx < providers.length && cIdx < consumers.length) {
    const p = providers[pIdx];
    const c = consumers[cIdx];
    const transfer = Math.min(p.balance, -c.balance);
    if (transfer > 0.01) {
      transfers.push({
        source: p.id,
        target: c.id,
        value: transfer,
        tone: "transfer",
        label: "자동 잔액 맞춤",
        isManual: false
      });
      p.balance -= transfer;
      c.balance += transfer;
    }
    if (p.balance <= 0.01) pIdx++;
    if (-c.balance <= 0.01) cIdx++;
  }

  // 3.5 계좌 노드들의 실제 금액(value) 계산 및 갱신
  nodes.forEach((node) => {
    if (includeAccountFlow && (node.column === 1 || node.column === 1.5)) {
      const totalInflow = [...links, ...transfers]
        .filter((link) => link.target === node.id)
        .reduce((sum, link) => sum + link.value, 0);
      node.value = totalInflow;
    }
  });

  const totalValue = incomeSources.reduce((sum, item) => sum + item.value, 0);

  // 4. 기존 렌더러와의 호환성(회귀 방지)을 위해 아래의 구조로 반환
  return {
    nodes,
    links,
    transfers,
    totalValue,
    hasIncomeInflow: incomeSources.length >= 2,
    hasGroupLayer: false,
    splitGroups,
    topLevelTargetIds: includeAccountFlow ? accounts.map((a) => a.id) : allBreakdowns.map((node) => node.id)
  };
}

