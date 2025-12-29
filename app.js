const DEFAULT_SETTINGS = {
  baseMonth: getCurrentMonth(),
  horizonYears: 10,
  inflationRate: 2.0,
  viewMode: "nominal",
  currency: "KRW",
};

const SAMPLE_DATA = {
  nodes: [
    {
      id: "income-salary",
      name: "월급",
      type: "Income",
      currency: "KRW",
      monthlyAmount: 4500000,
      annualGrowthRate: 0.03,
      active: true,
      memo: "고정 월급",
    },
    {
      id: "expense-fixed",
      name: "고정지출",
      type: "Expense",
      currency: "KRW",
      monthlyAmount: 0,
      active: true,
      memo: "주거/보험/통신",
    },
    {
      id: "expense-variable",
      name: "변동지출",
      type: "Expense",
      currency: "KRW",
      monthlyAmount: 0,
      active: true,
      memo: "식비/여가/이동",
    },
    {
      id: "bucket-emergency",
      name: "비상금",
      type: "Bucket",
      currency: "KRW",
      monthlyAmount: 0,
      active: true,
      memo: "6개월치 목표",
      cap: 5000000,
      currentAmount: 1200000,
    },
    {
      id: "invest-account",
      name: "투자계좌",
      type: "Invest",
      currency: "KRW",
      monthlyAmount: 0,
      active: true,
      memo: "ETF 자동이체",
    },
  ],
  links: [
    {
      id: "link-fixed-1",
      from: "income-salary",
      to: "expense-fixed",
      type: "Fixed",
      value: 1500000,
      priority: 1,
      active: true,
    },
    {
      id: "link-fixed-2",
      from: "income-salary",
      to: "expense-variable",
      type: "Fixed",
      value: 600000,
      priority: 2,
      active: true,
    },
    {
      id: "link-percent-1",
      from: "income-salary",
      to: "bucket-emergency",
      type: "Percent",
      value: 0.15,
      priority: 3,
      active: true,
    },
    {
      id: "link-percent-2",
      from: "income-salary",
      to: "invest-account",
      type: "Percent",
      value: 0.2,
      priority: 4,
      active: true,
    },
  ],
};

const NODE_TYPE_LABELS = {
  Income: "수입",
  Expense: "지출",
  Bucket: "버킷",
  Invest: "투자",
  Debt: "부채",
  Transfer: "분배",
};

const LINK_TYPE_LABELS = {
  Fixed: "정액",
  Percent: "비율",
  RuleBased: "규칙",
  CapFill: "상한 채우기",
};

const state = {
  nodes: [],
  links: [],
  settings: { ...DEFAULT_SETTINGS },
  flows: [],
  ui: {
    editingNodeId: null,
    editingLinkId: null,
  },
};

const dom = {
  baseMonth: document.getElementById("baseMonth"),
  horizonYears: document.getElementById("horizonYears"),
  inflationRate: document.getElementById("inflationRate"),
  salaryGrowthRate: document.getElementById("salaryGrowthRate"),
  toggleButtons: Array.from(document.querySelectorAll(".toggle__btn")),
  sampleLoad: document.getElementById("sampleLoad"),
  resetView: document.getElementById("resetView"),
  resetAll: document.getElementById("resetAll"),
  addNode: document.getElementById("addNode"),
  addLink: document.getElementById("addLink"),
  summaryCards: document.getElementById("summaryCards"),
  flowCanvas: document.getElementById("flowCanvas"),
  nodeList: document.getElementById("nodeList"),
  linkList: document.getElementById("linkList"),
  nodeForm: document.getElementById("nodeForm"),
  nodeFormTitle: document.getElementById("nodeFormTitle"),
  nodeFormStatus: document.getElementById("nodeFormStatus"),
  nodeName: document.getElementById("nodeName"),
  nodeType: document.getElementById("nodeType"),
  nodeMonthly: document.getElementById("nodeMonthly"),
  nodeCurrency: document.getElementById("nodeCurrency"),
  nodeGrowthRate: document.getElementById("nodeGrowthRate"),
  nodeCap: document.getElementById("nodeCap"),
  nodeCurrent: document.getElementById("nodeCurrent"),
  nodeMemo: document.getElementById("nodeMemo"),
  nodeActive: document.getElementById("nodeActive"),
  nodeCancel: document.getElementById("nodeCancel"),
  linkForm: document.getElementById("linkForm"),
  linkFormTitle: document.getElementById("linkFormTitle"),
  linkFormStatus: document.getElementById("linkFormStatus"),
  linkFrom: document.getElementById("linkFrom"),
  linkTo: document.getElementById("linkTo"),
  linkType: document.getElementById("linkType"),
  linkValue: document.getElementById("linkValue"),
  linkValueLabel: document.getElementById("linkValueLabel"),
  linkValueHint: document.getElementById("linkValueHint"),
  linkPriority: document.getElementById("linkPriority"),
  linkMin: document.getElementById("linkMin"),
  linkMax: document.getElementById("linkMax"),
  linkActive: document.getElementById("linkActive"),
  linkCancel: document.getElementById("linkCancel"),
  linkWarnings: document.getElementById("linkWarnings"),
  simulationSummary: document.getElementById("simulationSummary"),
  baseMonthLabel: document.getElementById("baseMonthLabel"),
  nodeCountLabel: document.getElementById("nodeCountLabel"),
  linkCountLabel: document.getElementById("linkCountLabel"),
  viewModeLabel: document.getElementById("viewModeLabel"),
  viewModeBadge: document.getElementById("viewModeBadge"),
  flowMeta: document.getElementById("flowMeta"),
};

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  loadSample();
  renderAll();
});

function bindControls() {
  if (dom.baseMonth) {
    dom.baseMonth.value = state.settings.baseMonth;
    dom.baseMonth.addEventListener("change", (event) => {
      state.settings.baseMonth = event.target.value || getCurrentMonth();
      renderAll();
    });
  }

  if (dom.horizonYears) {
    dom.horizonYears.value = state.settings.horizonYears;
    dom.horizonYears.addEventListener("change", (event) => {
      const value = clampNumber(event.target.value, 1, 40, DEFAULT_SETTINGS.horizonYears);
      state.settings.horizonYears = value;
      dom.horizonYears.value = value;
      renderAll();
    });
  }

  if (dom.inflationRate) {
    dom.inflationRate.value = state.settings.inflationRate;
    dom.inflationRate.addEventListener("change", (event) => {
      const value = clampNumber(event.target.value, 0, 20, DEFAULT_SETTINGS.inflationRate, 1);
      state.settings.inflationRate = value;
      dom.inflationRate.value = value;
      renderAll();
    });
  }

  if (dom.salaryGrowthRate) {
    dom.salaryGrowthRate.addEventListener("change", (event) => {
      const primaryIncome = getPrimaryIncomeNode();
      if (!primaryIncome) {
        return;
      }
      const value = clampNumber(event.target.value, 0, 30, 0, 1);
      primaryIncome.annualGrowthRate = value / 100;
      dom.salaryGrowthRate.value = value;
      renderAll();
    });
  }

  dom.toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.viewMode = button.dataset.mode;
      renderAll();
    });
  });

  if (dom.sampleLoad) {
    dom.sampleLoad.addEventListener("click", () => {
      loadSample();
      renderAll();
    });
  }

  if (dom.resetView) {
    dom.resetView.addEventListener("click", () => {
      state.settings = {
        ...state.settings,
        baseMonth: getCurrentMonth(),
        horizonYears: DEFAULT_SETTINGS.horizonYears,
        inflationRate: DEFAULT_SETTINGS.inflationRate,
      };
      syncControlValues();
      renderAll();
    });
  }

  if (dom.resetAll) {
    dom.resetAll.addEventListener("click", () => {
      state.nodes = [];
      state.links = [];
      state.settings = { ...DEFAULT_SETTINGS, baseMonth: getCurrentMonth() };
      state.ui.editingNodeId = null;
      state.ui.editingLinkId = null;
      syncControlValues();
      renderAll();
    });
  }

  bindFormControls();
  bindListActions();
}

function bindFormControls() {
  if (dom.addNode) {
    dom.addNode.addEventListener("click", () => {
      startNodeCreate();
    });
  }

  if (dom.addLink) {
    dom.addLink.addEventListener("click", () => {
      startLinkCreate();
    });
  }

  if (dom.nodeForm) {
    dom.nodeForm.addEventListener("submit", handleNodeSubmit);
  }

  if (dom.nodeCancel) {
    dom.nodeCancel.addEventListener("click", () => {
      startNodeCreate();
    });
  }

  if (dom.nodeType) {
    dom.nodeType.addEventListener("change", () => {
      updateNodeTypeFields(dom.nodeType.value);
    });
  }

  if (dom.linkForm) {
    dom.linkForm.addEventListener("submit", handleLinkSubmit);
  }

  if (dom.linkCancel) {
    dom.linkCancel.addEventListener("click", () => {
      startLinkCreate();
    });
  }

  if (dom.linkType) {
    dom.linkType.addEventListener("change", () => {
      updateLinkTypeFields(dom.linkType.value);
    });
  }

  if (dom.linkFrom) {
    dom.linkFrom.addEventListener("change", () => {
      if (!state.ui.editingLinkId) {
        updateDefaultLinkPriority();
      }
    });
  }
}

function bindListActions() {
  if (dom.nodeList) {
    dom.nodeList.addEventListener("click", handleNodeListAction);
  }

  if (dom.linkList) {
    dom.linkList.addEventListener("click", handleLinkListAction);
  }
}

function loadSample() {
  state.nodes = deepCopy(SAMPLE_DATA.nodes);
  state.links = deepCopy(SAMPLE_DATA.links);
  state.ui.editingNodeId = null;
  state.ui.editingLinkId = null;
}

function renderAll() {
  const nodeMap = buildNodeMap(state.nodes);
  state.flows = computeFlows(state.nodes, state.links, nodeMap);
  const summary = computeSummary(state.nodes, state.flows, nodeMap);

  renderSummaryCards(summary);
  renderFlowCanvas(state.flows, nodeMap);
  renderNodeList(state.nodes, state.flows, nodeMap);
  renderLinkList(state.links, nodeMap);
  renderSimulation();
  renderMeta(nodeMap);
  syncToggleButtons();
  syncIncomeControls();
  syncForms();
  renderLinkWarnings(nodeMap);
}

function renderMeta(nodeMap) {
  const activeNodes = state.nodes.filter((node) => node.active).length;
  const activeLinks = state.links.filter((link) => link.active).length;

  if (dom.baseMonthLabel) {
    dom.baseMonthLabel.textContent = formatMonthLabel(state.settings.baseMonth);
  }
  if (dom.nodeCountLabel) {
    dom.nodeCountLabel.textContent = `${activeNodes} / ${state.nodes.length}`;
  }
  if (dom.linkCountLabel) {
    dom.linkCountLabel.textContent = `${activeLinks} / ${state.links.length}`;
  }
  if (dom.viewModeLabel) {
    dom.viewModeLabel.textContent = state.settings.viewMode === "real" ? "실질" : "명목";
  }
  if (dom.flowMeta) {
    dom.flowMeta.textContent = `노드 ${state.nodes.length} · 링크 ${state.links.length}`;
  }
  if (dom.viewModeBadge) {
    dom.viewModeBadge.textContent = state.settings.viewMode === "real" ? "실질" : "명목";
  }
}

function getPrimaryIncomeNode() {
  return (
    state.nodes.find((node) => node.id === "income-salary") ||
    state.nodes.find((node) => node.type === "Income")
  );
}

function syncIncomeControls() {
  if (!dom.salaryGrowthRate) {
    return;
  }
  const primaryIncome = getPrimaryIncomeNode();
  if (!primaryIncome) {
    dom.salaryGrowthRate.value = "";
    dom.salaryGrowthRate.placeholder = "수입 노드 없음";
    dom.salaryGrowthRate.disabled = true;
    return;
  }
  dom.salaryGrowthRate.disabled = false;
  dom.salaryGrowthRate.placeholder = "0.0";
  const rate = Number(primaryIncome.annualGrowthRate) || 0;
  dom.salaryGrowthRate.value = (rate * 100).toFixed(1);
}

function syncForms() {
  syncNodeForm();
  syncLinkForm();
}

function startNodeCreate() {
  state.ui.editingNodeId = null;
  syncNodeForm();
  setFormStatus(dom.nodeFormStatus, "");
}

function startLinkCreate() {
  state.ui.editingLinkId = null;
  syncLinkForm();
  setFormStatus(dom.linkFormStatus, "");
}

function syncNodeForm() {
  if (!dom.nodeForm) {
    return;
  }
  const node = state.nodes.find((item) => item.id === state.ui.editingNodeId);
  const data = node ? node : getDefaultNodeData();
  if (!node) {
    state.ui.editingNodeId = null;
  }
  if (dom.nodeFormTitle) {
    dom.nodeFormTitle.textContent = node ? "노드 수정" : "노드 추가";
  }
  fillNodeForm(data);
}

function syncLinkForm() {
  if (!dom.linkForm) {
    return;
  }
  const nodes = state.nodes;
  if (!nodes.length) {
    disableLinkForm("노드를 먼저 추가하세요.");
    return;
  }

  const link = state.links.find((item) => item.id === state.ui.editingLinkId);
  const data = link ? link : getDefaultLinkData(nodes);
  if (!link) {
    state.ui.editingLinkId = null;
  }
  if (dom.linkFormTitle) {
    dom.linkFormTitle.textContent = link ? "링크 수정" : "링크 추가";
  }
  enableLinkForm();
  fillLinkForm(data, nodes);
}

function disableLinkForm(message) {
  const fields = [
    dom.linkFrom,
    dom.linkTo,
    dom.linkType,
    dom.linkValue,
    dom.linkPriority,
    dom.linkMin,
    dom.linkMax,
    dom.linkActive,
  ];
  fields.forEach((field) => {
    if (field) {
      field.disabled = true;
    }
  });
  if (dom.linkFormStatus) {
    setFormStatus(dom.linkFormStatus, message, "error");
  }
}

function enableLinkForm() {
  const fields = [
    dom.linkFrom,
    dom.linkTo,
    dom.linkType,
    dom.linkValue,
    dom.linkPriority,
    dom.linkMin,
    dom.linkMax,
    dom.linkActive,
  ];
  fields.forEach((field) => {
    if (field) {
      field.disabled = false;
    }
  });
}

function getDefaultNodeData() {
  return {
    name: "",
    type: "Income",
    currency: "KRW",
    monthlyAmount: 0,
    annualGrowthRate: 0,
    active: true,
    memo: "",
    cap: null,
    currentAmount: null,
  };
}

function fillNodeForm(node) {
  if (!dom.nodeName) {
    return;
  }
  dom.nodeName.value = node.name || "";
  dom.nodeType.value = node.type || "Income";
  dom.nodeMonthly.value = Number(node.monthlyAmount) || 0;
  dom.nodeCurrency.value = node.currency || "KRW";
  dom.nodeGrowthRate.value = ((Number(node.annualGrowthRate) || 0) * 100).toFixed(1);
  dom.nodeCap.value = node.cap ?? "";
  dom.nodeCurrent.value = node.currentAmount ?? "";
  dom.nodeMemo.value = node.memo || "";
  dom.nodeActive.checked = node.active !== false;
  updateNodeTypeFields(dom.nodeType.value);
}

function updateNodeTypeFields(type) {
  toggleFormField("growth", type === "Income");
  toggleFormField("cap", type === "Bucket");
  toggleFormField("current", type === "Bucket");
}

function toggleFormField(field, isVisible) {
  const element = document.querySelector(`[data-node-field="${field}"], [data-link-field="${field}"]`);
  if (element) {
    element.hidden = !isVisible;
  }
}

function getDefaultLinkData(nodes) {
  const firstNode = nodes[0];
  const secondNode = nodes.find((node) => node.id !== firstNode?.id) || firstNode;
  return {
    from: firstNode?.id || "",
    to: secondNode?.id || "",
    type: "Fixed",
    value: 0,
    priority: getNextPriority(firstNode?.id),
    active: true,
    min: null,
    max: null,
  };
}

function fillLinkForm(link, nodes) {
  if (!dom.linkFrom || !dom.linkTo) {
    return;
  }
  populateNodeSelect(dom.linkFrom, nodes, link.from);
  populateNodeSelect(dom.linkTo, nodes, link.to);
  dom.linkType.value = link.type || "Fixed";
  dom.linkPriority.value = link.priority || getNextPriority(link.from);
  dom.linkMin.value = link.min ?? "";
  dom.linkMax.value = link.max ?? "";
  dom.linkActive.checked = link.active !== false;

  if (link.type === "Percent") {
    dom.linkValue.value = ((Number(link.value) || 0) * 100).toFixed(1);
  } else {
    dom.linkValue.value = Number(link.value) || 0;
  }

  updateLinkTypeFields(dom.linkType.value);
}

function updateLinkTypeFields(type) {
  if (!dom.linkValue || !dom.linkValueLabel || !dom.linkValueHint) {
    return;
  }
  if (type === "Fixed") {
    dom.linkValueLabel.textContent = "금액";
    dom.linkValueHint.textContent = "월 기준 금액을 입력합니다.";
    dom.linkValue.disabled = false;
    dom.linkValue.min = "0";
    dom.linkValue.max = "";
    dom.linkValue.step = "1000";
    toggleLinkValueField(true);
  } else if (type === "Percent") {
    dom.linkValueLabel.textContent = "비율(%)";
    dom.linkValueHint.textContent = "예: 20 입력 시 20% 배분";
    dom.linkValue.disabled = false;
    dom.linkValue.min = "0";
    dom.linkValue.max = "100";
    dom.linkValue.step = "0.1";
    toggleLinkValueField(true);
  } else if (type === "CapFill") {
    dom.linkValueLabel.textContent = "값";
    dom.linkValueHint.textContent = "버킷 상한까지 채웁니다.";
    dom.linkValue.value = "";
    dom.linkValue.disabled = true;
    toggleLinkValueField(true);
  } else {
    dom.linkValueLabel.textContent = "값";
    dom.linkValueHint.textContent = "규칙 기반 링크는 다음 단계에서 구현됩니다.";
    dom.linkValue.value = "";
    dom.linkValue.disabled = true;
    toggleLinkValueField(true);
  }
}

function toggleLinkValueField(isVisible) {
  const element = document.querySelector('[data-link-field="value"]');
  if (element) {
    element.hidden = !isVisible;
  }
}

function updateDefaultLinkPriority() {
  if (!dom.linkFrom || !dom.linkPriority) {
    return;
  }
  const next = getNextPriority(dom.linkFrom.value);
  dom.linkPriority.value = next;
}

function populateNodeSelect(select, nodes, selectedId) {
  select.innerHTML = "";
  nodes.forEach((node) => {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = `${node.name} (${NODE_TYPE_LABELS[node.type] || node.type})`;
    if (node.id === selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  if (select.options.length > 0 && !select.value) {
    select.value = select.options[0].value;
  }
}

function setFormStatus(element, message, variant) {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("is-error", "is-success");
  if (variant === "error") {
    element.classList.add("is-error");
  }
  if (variant === "success") {
    element.classList.add("is-success");
  }
}

function renderSummaryCards(summary) {
  if (!dom.summaryCards) {
    return;
  }

  const cards = [
    {
      id: "totalIncome",
      label: "월 총수입",
      value: formatCurrency(summary.totalIncome),
      sub: "수입 노드 합계",
      variant: "income",
    },
    {
      id: "totalExpense",
      label: "월 총지출",
      value: formatCurrency(summary.totalExpense),
      sub: "지출 노드 유입",
      variant: "expense",
    },
    {
      id: "netCashflow",
      label: "월 순현금흐름",
      value: formatCurrency(summary.netCashflow),
      sub: "수입 - 지출",
      variant: "net",
    },
    {
      id: "totalSavingsInvest",
      label: "월 저축/투자",
      value: formatCurrency(summary.totalSavingsInvest),
      sub: "버킷/투자 유입",
      variant: "saving",
    },
    {
      id: "savingRate",
      label: "저축률",
      value: formatPercent(summary.savingRate),
      sub: "저축/투자 ÷ 수입",
      variant: "saving",
    },
    {
      id: "remaining",
      label: "잔여금",
      value: formatCurrency(summary.remaining),
      sub: "배분 후 남는 금액",
      variant: "net",
    },
  ];

  dom.summaryCards.innerHTML = "";
  cards.forEach((card, index) => {
    const element = document.createElement("div");
    element.className = "card";
    element.dataset.variant = card.variant;
    element.style.setProperty("--delay", `${index * 0.04}s`);
    element.innerHTML = `
      <div class="card__label">${card.label}</div>
      <div class="card__value">${card.value}</div>
      <div class="card__sub">${card.sub}</div>
    `;
    dom.summaryCards.appendChild(element);
  });
}

function renderFlowCanvas(flows, nodeMap) {
  if (!dom.flowCanvas) {
    return;
  }

  dom.flowCanvas.innerHTML = "";

  if (!flows.length) {
    renderEmpty(dom.flowCanvas, "흐름이 없습니다. 샘플 로드를 눌러 시작하세요.");
    return;
  }

  flows.forEach((flow) => {
    const fromName = nodeMap.get(flow.fromId)?.name || "알 수 없음";
    const toName = flow.type === "Residual"
      ? "잔여금"
      : nodeMap.get(flow.toId)?.name || "알 수 없음";

    const item = document.createElement("div");
    item.className = `flow-item${flow.type === "Residual" ? " residual" : ""}`;
    item.innerHTML = `
      <span>${fromName}</span>
      <span class="flow-arrow">→</span>
      <span>${toName}</span>
      <span class="flow-amount">${formatCurrency(flow.amount)}</span>
    `;
    dom.flowCanvas.appendChild(item);
  });
}

function renderNodeList(nodes, flows, nodeMap) {
  if (!dom.nodeList) {
    return;
  }

  dom.nodeList.innerHTML = "";

  if (!nodes.length) {
    renderEmpty(dom.nodeList, "노드가 없습니다. 샘플 로드를 눌러보세요.");
    return;
  }

  const stats = buildFlowStats(flows);

  nodes.forEach((node) => {
    const flowStat = stats.get(node.id) || { incoming: 0, outgoing: 0 };
    const growthRate = Number(node.annualGrowthRate) || 0;
    const growthInfo = node.type === "Income"
      ? `<span>연봉상승률 ${formatPercent(growthRate)}</span>`
      : "";
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-title">
        <span>${node.name}</span>
        <span class="pill${node.active ? "" : " inactive"}">
          ${node.active ? "활성" : "비활성"}
        </span>
      </div>
      <div class="list-meta">
        <span>${NODE_TYPE_LABELS[node.type] || node.type}</span>
        <span>월 기준 ${formatCurrency(node.monthlyAmount || 0)}</span>
        ${growthInfo}
        <span>유입 ${formatCurrency(flowStat.incoming)}</span>
        <span>유출 ${formatCurrency(flowStat.outgoing)}</span>
      </div>
      <div class="list-actions">
        <button class="action-btn action-btn--primary" data-action="node-edit" data-id="${node.id}">
          편집
        </button>
        <button class="action-btn" data-action="node-duplicate" data-id="${node.id}">
          복제
        </button>
        <button class="action-btn" data-action="node-toggle" data-id="${node.id}">
          ${node.active ? "비활성" : "활성"}
        </button>
        <button class="action-btn action-btn--danger" data-action="node-delete" data-id="${node.id}">
          삭제
        </button>
      </div>
    `;
    dom.nodeList.appendChild(item);
  });
}

function renderLinkList(links, nodeMap) {
  if (!dom.linkList) {
    return;
  }

  dom.linkList.innerHTML = "";

  if (!links.length) {
    renderEmpty(dom.linkList, "링크가 없습니다. 샘플 로드를 눌러보세요.");
    return;
  }

  const grouped = new Map();
  links.forEach((link) => {
    if (!grouped.has(link.from)) {
      grouped.set(link.from, []);
    }
    grouped.get(link.from).push(link);
  });

  const orderedLinks = [];
  const positionMap = new Map();
  const fromIds = Array.from(grouped.keys()).sort((a, b) => {
    const nameA = nodeMap.get(a)?.name || "";
    const nameB = nodeMap.get(b)?.name || "";
    return nameA.localeCompare(nameB, "ko");
  });

  fromIds.forEach((fromId) => {
    const groupLinks = grouped.get(fromId) || [];
    groupLinks
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .forEach((link, index, array) => {
        positionMap.set(link.id, { index, count: array.length });
        orderedLinks.push(link);
      });
  });

  orderedLinks.forEach((link) => {
    const fromName = nodeMap.get(link.from)?.name || "알 수 없음";
    const toName = nodeMap.get(link.to)?.name || "알 수 없음";
    const position = positionMap.get(link.id) || { index: 0, count: 1 };
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-title">
        <span>${fromName} → ${toName}</span>
        <span class="pill${link.active ? "" : " inactive"}">
          ${link.active ? "활성" : "비활성"}
        </span>
      </div>
      <div class="list-meta">
        <span>${LINK_TYPE_LABELS[link.type] || link.type}</span>
        <span>${formatLinkValue(link, nodeMap)}</span>
        <span>우선순위 ${link.priority ?? "-"}</span>
      </div>
      <div class="list-actions">
        <button class="action-btn action-btn--primary" data-action="link-edit" data-id="${link.id}">
          편집
        </button>
        <button class="action-btn" data-action="link-up" data-id="${link.id}" ${position.index === 0 ? "disabled" : ""}>
          우선↑
        </button>
        <button class="action-btn" data-action="link-down" data-id="${link.id}" ${position.index === position.count - 1 ? "disabled" : ""}>
          우선↓
        </button>
        <button class="action-btn" data-action="link-toggle" data-id="${link.id}">
          ${link.active ? "비활성" : "활성"}
        </button>
        <button class="action-btn action-btn--danger" data-action="link-delete" data-id="${link.id}">
          삭제
        </button>
      </div>
    `;
    dom.linkList.appendChild(item);
  });
}

function renderSimulation() {
  if (!dom.simulationSummary) {
    return;
  }

  const projection = computeProjectionTotals(
    state.nodes,
    state.links,
    state.settings.horizonYears
  );
  const metrics = [
    {
      label: `${state.settings.horizonYears}년 누적 순현금흐름`,
      value: projection.netCashflow,
      note: "수입 - 지출 누적 (연봉상승률 반영)",
    },
    {
      label: `${state.settings.horizonYears}년 누적 저축/투자`,
      value: projection.totalSavingsInvest,
      note: "버킷/투자 유입 누적 (연봉상승률 반영)",
    },
    {
      label: `${state.settings.horizonYears}년 누적 잔여금`,
      value: projection.remaining,
      note: "배분 후 남는 금액 누적 (연봉상승률 반영)",
    },
    {
      label: `${state.settings.horizonYears}년 후 총 자산(추정)`,
      value: projection.totalAssets,
      note: "저축/투자 + 잔여금 합산",
    },
  ];

  dom.simulationSummary.innerHTML = "";
  metrics.forEach((metric, index) => {
    const element = document.createElement("div");
    element.className = "card";
    element.style.setProperty("--delay", `${index * 0.04}s`);
    element.innerHTML = `
      <div class="card__label">${metric.label}</div>
      <div class="card__value">${formatCurrency(applyInflation(metric.value))}</div>
      <div class="card__sub">${metric.note}</div>
    `;
    dom.simulationSummary.appendChild(element);
  });
}

function handleNodeSubmit(event) {
  event.preventDefault();
  if (!dom.nodeName || !dom.nodeType || !dom.nodeMonthly) {
    return;
  }

  const name = dom.nodeName.value.trim();
  const type = dom.nodeType.value;
  const currency = dom.nodeCurrency?.value || "KRW";
  const monthlyAmount = parseNumber(dom.nodeMonthly.value, 0);
  const growthPercent = parseNumber(dom.nodeGrowthRate?.value, 0);
  const cap = parseOptionalNumber(dom.nodeCap?.value);
  const currentAmount = parseOptionalNumber(dom.nodeCurrent?.value);
  const memo = dom.nodeMemo?.value?.trim() || "";
  const active = dom.nodeActive?.checked ?? true;

  const nodeData = {
    name,
    type,
    currency,
    monthlyAmount,
    annualGrowthRate: type === "Income" ? growthPercent / 100 : 0,
    active,
    memo,
    cap: type === "Bucket" ? cap : null,
    currentAmount: type === "Bucket" ? currentAmount : null,
  };

  const errors = validateNodeData(nodeData);
  if (errors.length) {
    setFormStatus(dom.nodeFormStatus, errors.join(" / "), "error");
    return;
  }

  const isEdit = Boolean(state.ui.editingNodeId);
  if (isEdit) {
    const node = state.nodes.find((item) => item.id === state.ui.editingNodeId);
    if (node) {
      Object.assign(node, nodeData);
    }
  } else {
    const newNode = { ...nodeData, id: createId("node") };
    state.nodes.push(newNode);
  }

  if (!isEdit) {
    state.ui.editingNodeId = null;
  }

  renderAll();
  setFormStatus(
    dom.nodeFormStatus,
    isEdit ? "노드가 저장되었습니다." : "노드가 추가되었습니다.",
    "success"
  );
}

function handleLinkSubmit(event) {
  event.preventDefault();
  if (!dom.linkFrom || dom.linkFrom.disabled) {
    return;
  }

  const from = dom.linkFrom.value;
  const to = dom.linkTo.value;
  const type = dom.linkType?.value || "Fixed";
  const priority = Math.max(1, parseNumber(dom.linkPriority?.value, getNextPriority(from)));
  const min = parseOptionalNumber(dom.linkMin?.value);
  const max = parseOptionalNumber(dom.linkMax?.value);
  const active = dom.linkActive?.checked ?? true;
  let value = 0;

  if (type === "Fixed") {
    value = parseNumber(dom.linkValue?.value, 0);
  } else if (type === "Percent") {
    const percent = parseNumber(dom.linkValue?.value, 0);
    value = percent / 100;
  }

  const linkData = {
    from,
    to,
    type,
    value,
    priority,
    active,
    min,
    max,
  };

  const errors = validateLinkData(linkData);
  if (errors.length) {
    setFormStatus(dom.linkFormStatus, errors.join(" / "), "error");
    return;
  }

  const isEdit = Boolean(state.ui.editingLinkId);
  let previousFrom = null;
  if (isEdit) {
    const link = state.links.find((item) => item.id === state.ui.editingLinkId);
    if (link) {
      previousFrom = link.from;
      Object.assign(link, linkData);
    }
  } else {
    const newLink = { ...linkData, id: createId("link") };
    state.links.push(newLink);
  }

  if (previousFrom && previousFrom !== from) {
    normalizeLinkPriorities(previousFrom);
  }
  normalizeLinkPriorities(from);

  if (!isEdit) {
    state.ui.editingLinkId = null;
  }

  renderAll();
  setFormStatus(
    dom.linkFormStatus,
    isEdit ? "링크가 저장되었습니다." : "링크가 추가되었습니다.",
    "success"
  );
}

function handleNodeListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const nodeId = button.dataset.id;
  if (!nodeId) {
    return;
  }

  if (action === "node-edit") {
    state.ui.editingNodeId = nodeId;
    syncNodeForm();
    setFormStatus(dom.nodeFormStatus, "");
    return;
  }

  if (action === "node-duplicate") {
    duplicateNode(nodeId);
    renderAll();
    return;
  }

  if (action === "node-toggle") {
    toggleNodeActive(nodeId);
    renderAll();
    return;
  }

  if (action === "node-delete") {
    deleteNode(nodeId);
    renderAll();
  }
}

function handleLinkListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  const linkId = button.dataset.id;
  if (!linkId) {
    return;
  }

  if (action === "link-edit") {
    state.ui.editingLinkId = linkId;
    syncLinkForm();
    setFormStatus(dom.linkFormStatus, "");
    return;
  }

  if (action === "link-up") {
    moveLinkPriority(linkId, -1);
    renderAll();
    return;
  }

  if (action === "link-down") {
    moveLinkPriority(linkId, 1);
    renderAll();
    return;
  }

  if (action === "link-toggle") {
    toggleLinkActive(linkId);
    renderAll();
    return;
  }

  if (action === "link-delete") {
    deleteLink(linkId);
    renderAll();
  }
}

function validateNodeData(node) {
  const errors = [];
  if (!node.name) {
    errors.push("노드 이름을 입력하세요.");
  }
  if (!node.type) {
    errors.push("노드 타입을 선택하세요.");
  }
  if (node.monthlyAmount < 0) {
    errors.push("월 기준 금액은 0 이상이어야 합니다.");
  }
  if (node.type === "Income" && (node.annualGrowthRate < 0 || node.annualGrowthRate > 0.3)) {
    errors.push("연봉상승률은 0~30% 범위입니다.");
  }
  if (node.type === "Bucket") {
    if (node.cap !== null && node.cap < 0) {
      errors.push("버킷 상한은 0 이상이어야 합니다.");
    }
    if (node.currentAmount !== null && node.currentAmount < 0) {
      errors.push("현재 잔액은 0 이상이어야 합니다.");
    }
    if (node.cap !== null && node.currentAmount !== null && node.currentAmount > node.cap) {
      errors.push("현재 잔액이 상한보다 큽니다.");
    }
  }
  return errors;
}

function validateLinkData(link) {
  const errors = [];
  if (!link.from || !link.to) {
    errors.push("From/To 노드를 선택하세요.");
  }
  const hasFrom = state.nodes.some((node) => node.id === link.from);
  const hasTo = state.nodes.some((node) => node.id === link.to);
  if (!hasFrom || !hasTo) {
    errors.push("선택한 노드를 찾을 수 없습니다.");
  }
  if (link.from === link.to) {
    errors.push("From과 To는 동일할 수 없습니다.");
  }
  if (link.type === "Fixed" && link.value <= 0) {
    errors.push("정액 값은 0보다 커야 합니다.");
  }
  if (link.type === "Percent" && (link.value <= 0 || link.value > 1)) {
    errors.push("비율은 0~100% 범위입니다.");
  }
  if (link.type === "CapFill") {
    const target = state.nodes.find((node) => node.id === link.to);
    if (target && target.type !== "Bucket") {
      errors.push("상한 채우기는 버킷 노드에만 적용됩니다.");
    }
  }
  if (link.min !== null && link.min < 0) {
    errors.push("최소값은 0 이상이어야 합니다.");
  }
  if (link.max !== null && link.max < 0) {
    errors.push("최대값은 0 이상이어야 합니다.");
  }
  if (link.min !== null && link.max !== null && link.min > link.max) {
    errors.push("최소값이 최대값보다 큽니다.");
  }
  return errors;
}

function duplicateNode(nodeId) {
  const node = state.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return;
  }
  const duplicated = {
    ...node,
    id: createId("node"),
    name: `${node.name} 복제`,
  };
  state.nodes.push(duplicated);
}

function toggleNodeActive(nodeId) {
  const node = state.nodes.find((item) => item.id === nodeId);
  if (node) {
    node.active = !node.active;
  }
}

function deleteNode(nodeId) {
  const linked = state.links.filter((link) => link.from === nodeId || link.to === nodeId);
  if (linked.length) {
    const confirmed = window.confirm(
      "연결된 링크가 있습니다. 노드와 함께 삭제할까요?"
    );
    if (!confirmed) {
      return;
    }
  }
  state.nodes = state.nodes.filter((node) => node.id !== nodeId);
  state.links = state.links.filter((link) => link.from !== nodeId && link.to !== nodeId);
  normalizeAllLinkPriorities();
  if (state.ui.editingNodeId === nodeId) {
    state.ui.editingNodeId = null;
  }
  if (state.ui.editingLinkId && !state.links.some((link) => link.id === state.ui.editingLinkId)) {
    state.ui.editingLinkId = null;
  }
}

function toggleLinkActive(linkId) {
  const link = state.links.find((item) => item.id === linkId);
  if (link) {
    link.active = !link.active;
  }
}

function deleteLink(linkId) {
  const link = state.links.find((item) => item.id === linkId);
  if (!link) {
    return;
  }
  const fromId = link.from;
  state.links = state.links.filter((item) => item.id !== linkId);
  normalizeLinkPriorities(fromId);
  if (state.ui.editingLinkId === linkId) {
    state.ui.editingLinkId = null;
  }
}

function moveLinkPriority(linkId, direction) {
  const link = state.links.find((item) => item.id === linkId);
  if (!link) {
    return;
  }
  const group = state.links
    .filter((item) => item.from === link.from)
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const index = group.findIndex((item) => item.id === linkId);
  const swapIndex = index + direction;
  if (swapIndex < 0 || swapIndex >= group.length) {
    return;
  }
  const swapTarget = group[swapIndex];
  const currentPriority = link.priority ?? index + 1;
  link.priority = swapTarget.priority ?? swapIndex + 1;
  swapTarget.priority = currentPriority;
  normalizeLinkPriorities(link.from);
}

function normalizeLinkPriorities(fromId) {
  if (!fromId) {
    return;
  }
  const group = state.links
    .filter((link) => link.from === fromId)
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  group.forEach((link, index) => {
    link.priority = index + 1;
  });
}

function normalizeAllLinkPriorities() {
  const fromIds = new Set(state.links.map((link) => link.from));
  fromIds.forEach((fromId) => {
    normalizeLinkPriorities(fromId);
  });
}

function getNextPriority(fromId) {
  if (!fromId) {
    return 1;
  }
  return state.links
    .filter((link) => link.from === fromId)
    .reduce((max, link) => Math.max(max, link.priority ?? 0), 0) + 1;
}

function renderLinkWarnings(nodeMap) {
  if (!dom.linkWarnings) {
    return;
  }
  const cycle = findCyclePath(state.nodes, state.links);
  if (!cycle) {
    dom.linkWarnings.hidden = true;
    dom.linkWarnings.textContent = "";
    return;
  }
  const names = cycle
    .map((id) => nodeMap.get(id)?.name || id)
    .join(" → ");
  dom.linkWarnings.hidden = false;
  dom.linkWarnings.textContent = `순환 참조 감지: ${names}`;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findCyclePath(nodes, links) {
  const adjacency = new Map();
  links
    .filter((link) => link.active)
    .forEach((link) => {
      if (!adjacency.has(link.from)) {
        adjacency.set(link.from, []);
      }
      adjacency.get(link.from).push(link.to);
    });

  const visited = new Set();
  const stack = new Set();
  const parent = new Map();
  let cycle = null;

  function buildCycle(fromId, toId) {
    const path = [toId];
    let current = fromId;
    while (current && current !== toId) {
      path.push(current);
      current = parent.get(current);
    }
    path.push(toId);
    return path.reverse();
  }

  function dfs(nodeId) {
    visited.add(nodeId);
    stack.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        parent.set(next, nodeId);
        if (dfs(next)) {
          return true;
        }
      } else if (stack.has(next)) {
        cycle = buildCycle(nodeId, next);
        return true;
      }
    }
    stack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        break;
      }
    }
  }

  return cycle;
}

function computeFlows(nodes, links, nodeMap) {
  const groups = new Map();

  links.forEach((link) => {
    if (!link.active) {
      return;
    }
    if (!groups.has(link.from)) {
      groups.set(link.from, []);
    }
    groups.get(link.from).push(link);
  });

  const flows = [];

  groups.forEach((groupLinks, fromId) => {
    const fromNode = nodeMap.get(fromId);
    if (!fromNode || !fromNode.active) {
      return;
    }

    const baseAmount = Math.max(0, Number(fromNode.monthlyAmount) || 0);
    let available = baseAmount;

    groupLinks
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .forEach((link) => {
        if (available <= 0) {
          return;
        }
        const amount = computeLinkAmount(link, fromNode, nodeMap, baseAmount, available);
        if (amount <= 0) {
          return;
        }
        const applied = Math.min(amount, available);
        available -= applied;
        flows.push({
          fromId: link.from,
          toId: link.to,
          amount: applied,
          type: link.type,
        });
      });

    if (available > 0) {
      flows.push({
        fromId,
        toId: null,
        amount: available,
        type: "Residual",
      });
    }
  });

  return flows;
}

function computeLinkAmount(link, fromNode, nodeMap, baseAmount, available) {
  let amount = 0;

  if (link.type === "Fixed") {
    amount = Number(link.value) || 0;
  } else if (link.type === "Percent") {
    amount = baseAmount * (Number(link.value) || 0);
  } else if (link.type === "CapFill") {
    const target = nodeMap.get(link.to);
    const cap = Number(target?.cap) || 0;
    const current = Number(target?.currentAmount) || 0;
    const gap = Math.max(0, cap - current);
    amount = Math.min(gap, available);
  }

  amount = clamp(amount, link.min, link.max);
  return Math.max(0, amount);
}

function computeSummary(nodes, flows, nodeMap) {
  const totalIncome = nodes.reduce((sum, node) => {
    if (node.active && node.type === "Income") {
      return sum + (Number(node.monthlyAmount) || 0);
    }
    return sum;
  }, 0);

  let totalExpense = 0;
  let totalSavingsInvest = 0;
  let totalDebt = 0;

  flows.forEach((flow) => {
    if (!flow.toId) {
      return;
    }
    const target = nodeMap.get(flow.toId);
    if (!target || !target.active) {
      return;
    }
    if (target.type === "Expense") {
      totalExpense += flow.amount;
    } else if (target.type === "Bucket" || target.type === "Invest") {
      totalSavingsInvest += flow.amount;
    } else if (target.type === "Debt") {
      totalDebt += flow.amount;
    }
  });

  const netCashflow = totalIncome - totalExpense;
  const remaining = totalIncome - (totalExpense + totalSavingsInvest + totalDebt);
  const savingRate = totalIncome > 0 ? totalSavingsInvest / totalIncome : 0;

  return {
    totalIncome,
    totalExpense,
    netCashflow,
    totalSavingsInvest,
    savingRate,
    remaining,
    totalDebt,
  };
}

function computeProjectionTotals(nodes, links, years) {
  const totals = {
    netCashflow: 0,
    totalSavingsInvest: 0,
    remaining: 0,
    totalAssets: 0,
  };
  const horizon = Math.max(1, years);

  for (let year = 0; year < horizon; year += 1) {
    const adjustedNodes = applyGrowthToNodes(nodes, year);
    const nodeMap = buildNodeMap(adjustedNodes);
    const flows = computeFlows(adjustedNodes, links, nodeMap);
    const summary = computeSummary(adjustedNodes, flows, nodeMap);

    totals.netCashflow += summary.netCashflow * 12;
    totals.totalSavingsInvest += summary.totalSavingsInvest * 12;
    totals.remaining += summary.remaining * 12;
  }

  totals.totalAssets = totals.totalSavingsInvest + totals.remaining;
  return totals;
}

function applyGrowthToNodes(nodes, yearIndex) {
  return nodes.map((node) => {
    const rate = Number(node.annualGrowthRate) || 0;
    const factor = Math.pow(1 + rate, yearIndex);
    return {
      ...node,
      monthlyAmount: (Number(node.monthlyAmount) || 0) * factor,
    };
  });
}

function buildFlowStats(flows) {
  const stats = new Map();

  flows.forEach((flow) => {
    if (!flow.fromId || !flow.toId) {
      return;
    }
    if (!stats.has(flow.fromId)) {
      stats.set(flow.fromId, { incoming: 0, outgoing: 0 });
    }
    if (!stats.has(flow.toId)) {
      stats.set(flow.toId, { incoming: 0, outgoing: 0 });
    }
    stats.get(flow.fromId).outgoing += flow.amount;
    stats.get(flow.toId).incoming += flow.amount;
  });

  return stats;
}

function formatLinkValue(link, nodeMap) {
  if (link.type === "Fixed") {
    return formatCurrency(link.value);
  }
  if (link.type === "Percent") {
    const percent = Number(link.value) || 0;
    const base = Number(nodeMap.get(link.from)?.monthlyAmount) || 0;
    return `${formatPercent(percent)} (${formatCurrency(base * percent)})`;
  }
  if (link.type === "CapFill") {
    return "상한 채우기";
  }
  return "조건식";
}

function formatCurrency(value) {
  const formatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(Number(value) || 0);
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatMonthLabel(value) {
  if (!value) {
    return "-";
  }
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

function applyInflation(value) {
  if (state.settings.viewMode !== "real") {
    return value;
  }
  const rate = Number(state.settings.inflationRate) / 100;
  if (rate <= 0) {
    return value;
  }
  return value / Math.pow(1 + rate, state.settings.horizonYears);
}

function buildNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function renderEmpty(container, message) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = message;
  container.appendChild(element);
}

function clampNumber(value, min, max, fallback, decimals = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = decimals > 0 ? Number(parsed.toFixed(decimals)) : Math.round(parsed);
  return clamp(rounded, min, max);
}

function clamp(value, min, max) {
  let result = value;
  if (Number.isFinite(min)) {
    result = Math.max(result, min);
  }
  if (Number.isFinite(max)) {
    result = Math.min(result, max);
  }
  return result;
}

function deepCopy(data) {
  return JSON.parse(JSON.stringify(data));
}

function createId(prefix) {
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}-${Date.now()}-${random}`;
}

function syncControlValues() {
  if (dom.baseMonth) {
    dom.baseMonth.value = state.settings.baseMonth;
  }
  if (dom.horizonYears) {
    dom.horizonYears.value = state.settings.horizonYears;
  }
  if (dom.inflationRate) {
    dom.inflationRate.value = state.settings.inflationRate;
  }
  syncIncomeControls();
}

function syncToggleButtons() {
  dom.toggleButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.settings.viewMode);
  });
}

function getCurrentMonth() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
}
