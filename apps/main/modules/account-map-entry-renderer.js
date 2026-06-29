const ACCOUNT_MAP_ROUTE = "../account-map/";

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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countIncomeRelationships(inputs) {
  return safeArray(inputs?.incomes).reduce((count, income) => {
    const allocations = safeArray(income?.allocations).filter((allocation) => Number(allocation?.amount) > 0);
    if (allocations.length > 0) {
      return count + allocations.length;
    }
    return Number(income?.amount) > 0 ? count + 1 : count;
  }, 0);
}

function countPositiveItems(items) {
  return safeArray(items).filter((item) => Number(item?.amount) > 0).length;
}

function isFixedExpenseCandidate(item) {
  const group = String(item?.group || "").toLowerCase();
  const name = String(item?.name || "").toLowerCase();
  if (group.includes("고정") || group.includes("fixed")) {
    return true;
  }
  return RECURRING_PAYMENT_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()));
}

function summarizeAccountMapEntry(inputs) {
  const accountCount = safeArray(inputs?.accounts).length;
  const incomeRelationships = countIncomeRelationships(inputs);
  const manualTransfers = countPositiveItems(inputs?.transfers);
  const savingsTransfers = countPositiveItems(inputs?.savingsItems);
  const investTransfers = countPositiveItems(inputs?.investItems);
  const confirmationNeeded = safeArray(inputs?.expenseItems).filter(isFixedExpenseCandidate).length;
  const surplusTarget = typeof inputs?.surplusTransferAccountId === "string" && inputs.surplusTransferAccountId.trim()
    ? 1
    : 0;
  const relationshipCount = incomeRelationships
    + manualTransfers
    + savingsTransfers
    + investTransfers
    + surplusTarget;

  return {
    accountCount,
    relationshipCount,
    confirmationNeeded,
    hasAccountFlow: accountCount > 0 || relationshipCount > 0 || confirmationNeeded > 0,
  };
}

function createMetric(label, value) {
  const metric = document.createElement("span");
  metric.className = "account-map-entry__metric";

  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const text = document.createElement("span");
  text.textContent = label;

  metric.append(strong, text);
  return metric;
}

function createMiniMap(summary) {
  const miniMap = document.createElement("div");
  miniMap.className = "account-map-entry__mini";
  miniMap.setAttribute("aria-hidden", "true");

  ["수입", "계좌", "지출"].forEach((label, index) => {
    const node = document.createElement("span");
    node.className = "account-map-entry__node";
    node.textContent = label;
    miniMap.appendChild(node);

    if (index < 2) {
      const edge = document.createElement("span");
      edge.className = "account-map-entry__edge";
      miniMap.appendChild(edge);
    }
  });

  miniMap.classList.toggle("is-muted", !summary.hasAccountFlow);
  return miniMap;
}

export function renderAccountMapEntry(host, inputs) {
  if (!host) return;

  const summary = summarizeAccountMapEntry(inputs);
  const article = document.createElement("article");
  article.className = "account-map-entry__card";
  article.dataset.accountMapEntry = "lightweight";

  const body = document.createElement("div");
  body.className = "account-map-entry__body";

  const kicker = document.createElement("span");
  kicker.className = "account-map-entry__kicker";
  kicker.textContent = "Account Map";

  const title = document.createElement("h3");
  title.className = "account-map-entry__title";
  title.textContent = "계좌 관계를 별도 맵에서 확인";

  const status = document.createElement("p");
  status.className = "account-map-entry__status";
  status.textContent = summary.confirmationNeeded > 0
    ? "반복 결제 후보를 전용 화면에서 검토할 수 있습니다."
    : "현재 가계 흐름을 계좌 관계 관점으로 열어볼 수 있습니다.";

  const metrics = document.createElement("div");
  metrics.className = "account-map-entry__metrics";
  metrics.append(
    createMetric("계좌", summary.accountCount),
    createMetric("관계", summary.relationshipCount),
    createMetric("확인필요", summary.confirmationNeeded),
  );

  body.append(kicker, title, status, metrics);

  const action = document.createElement("a");
  action.className = "btn btn-ghost btn-sm account-map-entry__link";
  action.href = ACCOUNT_MAP_ROUTE;
  action.dataset.accountMapLink = "dedicated";
  action.textContent = "열기";
  action.setAttribute("aria-label", "Account Map 전용 화면 열기");

  article.append(createMiniMap(summary), body, action);
  host.replaceChildren(article);
}
