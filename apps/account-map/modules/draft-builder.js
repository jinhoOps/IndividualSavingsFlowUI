const DEFAULT_ACCOUNT_IDS = {
  income: "acc-salary",
  expense: "acc-living",
  savings: "acc-salary",
  invest: "acc-stock",
};

const RECURRING_PAYMENT_KEYWORDS = [
  "통신",
  "전기",
  "가스",
  "수도",
  "관리비",
  "보험",
  "대출",
  "렌탈",
  "구독",
  "카드",
];

function toAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeGroupName(groupName) {
  const text = cleanText(groupName);
  if (!text) return "";
  const segments = text.split("-").map((segment) => segment.trim()).filter(Boolean);
  return segments[segments.length - 1] || text;
}

function isVariableOrOneOffExpense(item) {
  const group = normalizeGroupName(item?.group);
  return group === "변동비" || group.includes("자유소비") || group.includes("일회") || group.includes("여행") || group.includes("취미");
}

function isFixedExpenseCandidate(item) {
  if (!item || typeof item !== "object") return false;
  if (isVariableOrOneOffExpense(item)) return false;
  const group = normalizeGroupName(item.group);
  const text = `${item.name || ""} ${item.group || ""}`;
  return group.includes("고정") || RECURRING_PAYMENT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function normalizeAccountRole(value) {
  const role = cleanText(value);
  return role === "saving" ? "savings" : role;
}

export function classifyRecurringPaymentCandidate(item) {
  const text = `${item?.name || ""} ${item?.group || ""}`;
  const keyword = RECURRING_PAYMENT_KEYWORDS.find((candidate) => text.includes(candidate)) || "";
  return {
    recommended: Boolean(keyword),
    reason: keyword ? `${keyword} 반복 결제 키워드` : "고정비 검토 필요",
  };
}

function buildAccountNodes(inputs) {
  const accounts = Array.isArray(inputs?.accounts) ? inputs.accounts : [];
  return accounts
    .filter((account) => account && typeof account === "object")
    .map((account, index) => {
      const id = cleanText(account.id, `acc-${index + 1}`);
      const declaredRole = normalizeAccountRole(account.role || account.kind || account.type);
      return {
        ...account,
        id,
        name: cleanText(account.name, `계좌 ${index + 1}`),
        role: declaredRole || (
          id === DEFAULT_ACCOUNT_IDS.income
            ? "income"
            : id === DEFAULT_ACCOUNT_IDS.invest
              ? "investment"
              : "spending"
        ),
        sourceAccountId: id,
      };
    });
}

function buildRelationshipId(prefix, sourceId, index = 0) {
  const id = cleanText(sourceId, `${prefix}-${index + 1}`);
  return `rel-${prefix}-${id}`;
}

function createRelationship({
  id,
  type,
  sourceAccountId,
  targetAccountId,
  label,
  amount,
  paymentDay = "",
  memo = "",
  confidence = "needs-confirmation",
  sourceRef,
}) {
  return {
    id,
    type,
    sourceAccountId: cleanText(sourceAccountId),
    targetAccountId: cleanText(targetAccountId),
    label: cleanText(label, type),
    amount: toAmount(amount),
    paymentDay: cleanText(paymentDay),
    memo: cleanText(memo),
    confidence,
    sourceRef,
  };
}

export function buildRelationshipsFromIncome(inputs) {
  const incomes = Array.isArray(inputs?.incomes) ? inputs.incomes : [];
  const relationships = [];

  incomes.forEach((income, incomeIndex) => {
    const incomeId = cleanText(income?.id, `income-${incomeIndex + 1}`);
    const allocations = Array.isArray(income?.allocations) && income.allocations.length
      ? income.allocations
      : [{ accountId: income?.accountId || DEFAULT_ACCOUNT_IDS.income, amount: income?.amount }];

    allocations.forEach((allocation, allocationIndex) => {
      const targetAccountId = cleanText(allocation?.accountId || income?.accountId, DEFAULT_ACCOUNT_IDS.income);
      const suffix = allocations.length > 1 ? `-${allocationIndex + 1}` : "";
      relationships.push(createRelationship({
        id: `${buildRelationshipId("income", incomeId)}${suffix}`,
        type: "income-deposit",
        sourceAccountId: `income-source-${incomeId}`,
        targetAccountId,
        label: cleanText(income?.name, "수입 입금"),
        amount: allocation?.amount ?? income?.amount,
        confidence: "confirmed",
        sourceRef: { collection: "incomes", id: incomeId },
      }));
    });
  });

  return relationships;
}

export function buildRelationshipsFromTransfers(inputs) {
  const transfers = Array.isArray(inputs?.transfers) ? inputs.transfers : [];
  return transfers
    .filter((transfer) => transfer?.sourceAccountId && transfer?.targetAccountId)
    .map((transfer, index) => {
      const transferId = cleanText(transfer.id, `transfer-${index + 1}`);
      return {
        ...transfer,
        ...createRelationship({
          id: buildRelationshipId("transfer", transferId, index),
          type: "auto-transfer",
          sourceAccountId: transfer.sourceAccountId,
          targetAccountId: transfer.targetAccountId,
          label: cleanText(transfer.label, "자동이체"),
          amount: transfer.amount,
          paymentDay: transfer.paymentDay,
          memo: transfer.memo,
          confidence: "confirmed",
          sourceRef: { collection: "transfers", id: transferId },
        }),
      };
    });
}

export function buildSavingsInvestmentRelationships(inputs) {
  const savings = Array.isArray(inputs?.savingsItems) ? inputs.savingsItems : [];
  const investments = Array.isArray(inputs?.investItems) ? inputs.investItems : [];
  const relationships = [];

  savings.forEach((item, index) => {
    const itemId = cleanText(item?.id, `savings-${index + 1}`);
    relationships.push(createRelationship({
      id: buildRelationshipId("savings", itemId, index),
      type: "savings-transfer",
      sourceAccountId: cleanText(item?.accountId, DEFAULT_ACCOUNT_IDS.savings),
      targetAccountId: `savings-product-${itemId}`,
      label: cleanText(item?.name, "저축 이체"),
      amount: item?.amount,
      memo: cleanText(item?.maturityMonth || item?.annualRate ? [item?.maturityMonth, item?.annualRate ? `연 ${item.annualRate}%` : ""].filter(Boolean).join(" · ") : ""),
      confidence: "recommended",
      sourceRef: { collection: "savingsItems", id: itemId },
    }));
  });

  investments.forEach((item, index) => {
    const itemId = cleanText(item?.id, `invest-${index + 1}`);
    relationships.push(createRelationship({
      id: buildRelationshipId("invest", itemId, index),
      type: "investment-transfer",
      sourceAccountId: cleanText(item?.accountId, DEFAULT_ACCOUNT_IDS.invest),
      targetAccountId: `investment-product-${itemId}`,
      label: cleanText(item?.name, "투자 이체"),
      amount: item?.amount,
      memo: cleanText(item?.maturityMonth),
      confidence: "recommended",
      sourceRef: { collection: "investItems", id: itemId },
    }));
  });

  return relationships;
}

export function buildFixedExpenseCandidates(inputs) {
  const expenses = Array.isArray(inputs?.expenseItems) ? inputs.expenseItems : [];
  return expenses
    .filter(isFixedExpenseCandidate)
    .map((item, index) => {
      const itemId = cleanText(item.id, `expense-${index + 1}`);
      const classification = classifyRecurringPaymentCandidate(item);
      return {
        id: `candidate-expense-${itemId}`,
        type: "fixed-expense-candidate",
        label: cleanText(item.name, "고정 결제"),
        amount: toAmount(item.amount),
        accountId: cleanText(item.accountId, DEFAULT_ACCOUNT_IDS.expense),
        paymentDay: cleanText(item.paymentDay),
        memo: cleanText(item.memo),
        confidence: classification.recommended ? "recommended" : "needs-confirmation",
        recommended: classification.recommended,
        reason: classification.reason,
        sourceRef: { collection: "expenseItems", id: itemId },
      };
    });
}

export function buildAccountMapDraftFromMain(inputs = {}, options = {}) {
  const now = options.importedAt || new Date().toISOString();
  const derivedRelationships = [
    ...buildRelationshipsFromIncome(inputs),
    ...buildRelationshipsFromTransfers(inputs),
    ...buildSavingsInvestmentRelationships(inputs),
  ];
  const relationships = mergeStoredRelationships(inputs, derivedRelationships);
  const claimedExpenseIds = new Set(relationships.flatMap((relationship) => (
    relationship?.sourceRef?.collection === "expenseItems" && relationship.sourceRef.id
      ? [relationship.sourceRef.id]
      : []
  )));

  return {
    schemaVersion: 1,
    source: {
      type: "main",
      storageKey: options.storageKey || "isf-rebuild-v1",
      snapshotId: options.snapshotId || "local-current",
      importedAt: now,
    },
    accounts: buildAccountNodes(inputs),
    relationships,
    candidates: buildFixedExpenseCandidates(inputs)
      .filter((candidate) => !claimedExpenseIds.has(candidate.sourceRef?.id)),
    selectedId: "",
    lastUpdated: now,
  };
}

function sourceRefKey(sourceRef) {
  if (!sourceRef || typeof sourceRef !== "object") return "";
  const collection = cleanText(sourceRef.collection);
  const id = cleanText(sourceRef.id);
  return collection && id ? `${collection}:${id}` : "";
}

function mergeRelationshipMetadata(stored, derived) {
  if (!stored) return derived;
  const merged = { ...stored, ...derived };
  ["paymentDay", "memo", "confidence"].forEach((key) => {
    if (stored[key] !== undefined && stored[key] !== null && String(stored[key]).trim()) {
      merged[key] = stored[key];
    }
  });
  return merged;
}

function refreshStoredRelationship(inputs, relationship) {
  const sourceRef = relationship?.sourceRef;
  const collection = cleanText(sourceRef?.collection);
  const ownerId = cleanText(sourceRef?.id);
  if (!collection || !ownerId) return { ...relationship };

  const collections = {
    incomes: inputs?.incomes,
    expenseItems: inputs?.expenseItems,
    savingsItems: inputs?.savingsItems,
    investItems: inputs?.investItems,
    transfers: inputs?.transfers,
    accounts: inputs?.accounts,
  };
  const owner = (Array.isArray(collections[collection]) ? collections[collection] : [])
    .find((item) => cleanText(item?.id) === ownerId);
  if (!owner) return null;
  if (collection === "accounts") return { ...relationship };
  if (collection === "transfers") {
    return {
      ...relationship,
      sourceAccountId: cleanText(owner.sourceAccountId, relationship.sourceAccountId),
      targetAccountId: cleanText(owner.targetAccountId, relationship.targetAccountId),
      label: cleanText(owner.label, relationship.label),
      amount: toAmount(owner.amount),
      paymentDay: cleanText(relationship.paymentDay, owner.paymentDay),
      memo: cleanText(relationship.memo, owner.memo),
    };
  }

  return {
    ...relationship,
    sourceAccountId: cleanText(owner.accountId, relationship.sourceAccountId),
    label: cleanText(owner.name, relationship.label),
    amount: toAmount(owner.amount),
    paymentDay: cleanText(relationship.paymentDay, owner.paymentDay),
    memo: cleanText(relationship.memo, owner.memo),
  };
}

function mergeStoredRelationships(inputs, derivedRelationships) {
  const storedRelationships = Array.isArray(inputs?.relationships)
    ? inputs.relationships.filter((relationship) => relationship && typeof relationship === "object")
    : [];
  const storedById = new Map(storedRelationships
    .filter((relationship) => cleanText(relationship.id))
    .map((relationship) => [cleanText(relationship.id), relationship]));
  const storedBySourceRef = new Map(storedRelationships
    .filter((relationship) => sourceRefKey(relationship.sourceRef))
    .map((relationship) => [sourceRefKey(relationship.sourceRef), relationship]));
  const usedStored = new Set();

  const merged = derivedRelationships.map((derived) => {
    const stored = storedById.get(derived.id)
      || storedBySourceRef.get(sourceRefKey(derived.sourceRef));
    if (stored) usedStored.add(stored);
    return mergeRelationshipMetadata(stored, derived);
  });

  storedRelationships.forEach((stored) => {
    if (usedStored.has(stored)) return;
    const refreshed = refreshStoredRelationship(inputs, stored);
    if (refreshed) merged.push(refreshed);
  });
  return merged;
}
