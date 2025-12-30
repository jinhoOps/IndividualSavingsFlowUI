const DEFAULT_SETTINGS = {
  baseMonth: getCurrentMonth(),
  horizonYears: 10,
  inflationRate: 2.5,
  seedMoney: 0,
  seedMoneyGrowthRate: 4.5,
  seedMoneyReturnRate: 11,
  viewMode: "nominal",
  currency: "KRW",
  flowTypeFilter: "all",
  flowCurrencyFilter: "all",
  flowActiveOnly: true,
};

const MONEY_UNIT = 10000;

const SAMPLE_DATA = {
  nodes: [
    {
      id: "income-salary",
      name: "월급",
      type: "Income",
      currency: "KRW",
      monthlyAmount: 2900000,
      annualGrowthRate: 0.04,
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
      investReturnRate: 0,
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
      value: 200000,
      priority: 2,
      active: true,
    },
    {
      id: "link-fixed-3",
      from: "income-salary",
      to: "bucket-emergency",
      type: "Fixed",
      value: 720000,
      priority: 3,
      active: true,
    },
  ],
};

const NODE_TYPE_LABELS = {
  Income: "수입",
  Expense: "지출",
  Bucket: "저축통",
  Invest: "투자",
  Debt: "부채",
  Transfer: "분배",
};

const LINK_TYPE_LABELS = {
  Fixed: "금액",
  Percent: "비율",
  RuleBased: "규칙",
  CapFill: "목표 채우기",
};

const state = {
  nodes: [],
  links: [],
  settings: { ...DEFAULT_SETTINGS },
  flows: [],
  ui: {
    editingNodeId: null,
    editingLinkId: null,
    nodePanelCollapsed: false,
    linkPanelCollapsed: false,
    drag: {
      linkId: null,
      fromId: null,
    },
  },
};

const dom = {
  baseMonth: document.getElementById("baseMonth"),
  horizonYears: document.getElementById("horizonYears"),
  inflationRate: document.getElementById("inflationRate"),
  seedMoney: document.getElementById("seedMoney"),
  seedMoneyGrowthRate: document.getElementById("seedMoneyGrowthRate"),
  seedMoneyReturnRate: document.getElementById("seedMoneyReturnRate"),
  salaryGrowthRate: document.getElementById("salaryGrowthRate"),
  toggleButtons: Array.from(document.querySelectorAll(".toggle__btn")),
  sampleLoad: document.getElementById("sampleLoad"),
  resetView: document.getElementById("resetView"),
  resetAll: document.getElementById("resetAll"),
  nodePanel: document.getElementById("nodePanel"),
  nodePanelBody: document.getElementById("nodePanelBody"),
  nodePanelToggle: document.getElementById("toggleNodePanel"),
  linkPanel: document.getElementById("linkPanel"),
  linkPanelBody: document.getElementById("linkPanelBody"),
  linkPanelToggle: document.getElementById("toggleLinkPanel"),
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
  nodeInvestReturnRate: document.getElementById("nodeInvestReturnRate"),
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
  linkValueLabelText: document.getElementById("linkValueLabelText"),
  linkValueHint: document.getElementById("linkValueHint"),
  linkPriority: document.getElementById("linkPriority"),
  linkMin: document.getElementById("linkMin"),
  linkMax: document.getElementById("linkMax"),
  linkActive: document.getElementById("linkActive"),
  linkCancel: document.getElementById("linkCancel"),
  linkWarnings: document.getElementById("linkWarnings"),
  simulationSummary: document.getElementById("simulationSummary"),
  simulationChart: document.getElementById("simulationChart"),
  simulationChartMeta: document.getElementById("simulationChartMeta"),
  simulationChartTooltip: document.getElementById("simulationChartTooltip"),
  baseMonthLabel: document.getElementById("baseMonthLabel"),
  nodeCountLabel: document.getElementById("nodeCountLabel"),
  linkCountLabel: document.getElementById("linkCountLabel"),
  viewModeLabel: document.getElementById("viewModeLabel"),
  viewModeBadge: document.getElementById("viewModeBadge"),
  flowMeta: document.getElementById("flowMeta"),
  flowTypeFilter: document.getElementById("flowTypeFilter"),
  flowCurrencyFilter: document.getElementById("flowCurrencyFilter"),
  flowActiveOnly: document.getElementById("flowActiveOnly"),
  flowTooltip: document.getElementById("flowTooltip"),
  flowSummary: document.getElementById("flowSummary"),
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

  if (dom.seedMoney) {
    dom.seedMoney.value = formatManAmount(state.settings.seedMoney);
    dom.seedMoney.addEventListener("change", (event) => {
      const value = Math.max(0, parseManAmount(event.target.value, 0));
      state.settings.seedMoney = value;
      dom.seedMoney.value = formatManAmount(value);
      renderAll();
    });
  }

  if (dom.seedMoneyGrowthRate) {
    dom.seedMoneyGrowthRate.value = state.settings.seedMoneyGrowthRate;
    const updateSeedGrowth = (event) => {
      const value = clampNumber(event.target.value, 0, 20, 0, 1);
      state.settings.seedMoneyGrowthRate = value;
      dom.seedMoneyGrowthRate.value = value;
      renderAll();
    };
    dom.seedMoneyGrowthRate.addEventListener("change", updateSeedGrowth);
    dom.seedMoneyGrowthRate.addEventListener("input", updateSeedGrowth);
  }

  if (dom.seedMoneyReturnRate) {
    dom.seedMoneyReturnRate.value = state.settings.seedMoneyReturnRate;
    const updateSeedReturn = (event) => {
      const value = clampNumber(event.target.value, 0, 20, 0, 1);
      state.settings.seedMoneyReturnRate = value;
      dom.seedMoneyReturnRate.value = value;
      renderAll();
    };
    dom.seedMoneyReturnRate.addEventListener("change", updateSeedReturn);
    dom.seedMoneyReturnRate.addEventListener("input", updateSeedReturn);
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

  bindFlowFilters();
  bindFormControls();
  bindListActions();
  bindPanelToggles();
}

function bindFlowFilters() {
  if (dom.flowTypeFilter) {
    dom.flowTypeFilter.value = state.settings.flowTypeFilter;
    dom.flowTypeFilter.addEventListener("change", (event) => {
      state.settings.flowTypeFilter = event.target.value;
      renderAll();
    });
  }
  if (dom.flowCurrencyFilter) {
    dom.flowCurrencyFilter.value = state.settings.flowCurrencyFilter;
    dom.flowCurrencyFilter.addEventListener("change", (event) => {
      state.settings.flowCurrencyFilter = event.target.value;
      renderAll();
    });
  }
  if (dom.flowActiveOnly) {
    dom.flowActiveOnly.checked = state.settings.flowActiveOnly;
    dom.flowActiveOnly.addEventListener("change", (event) => {
      state.settings.flowActiveOnly = event.target.checked;
      renderAll();
    });
  }
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
    dom.nodeForm.addEventListener("focusout", handleNodeFieldBlur);
    dom.nodeForm.addEventListener("keydown", handleNodeShortcutSave);
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

  if (dom.nodeForm) {
    dom.nodeForm.addEventListener("input", handleFormFieldInput);
    dom.nodeForm.addEventListener("change", handleFormFieldInput);
  }

  if (dom.linkForm) {
    dom.linkForm.addEventListener("input", handleFormFieldInput);
    dom.linkForm.addEventListener("change", handleFormFieldInput);
  }
}

function bindListActions() {
  if (dom.nodeList) {
    dom.nodeList.addEventListener("click", handleNodeListAction);
  }

  if (dom.linkList) {
    dom.linkList.addEventListener("click", handleLinkListAction);
    dom.linkList.addEventListener("dragstart", handleLinkDragStart);
    dom.linkList.addEventListener("dragover", handleLinkDragOver);
    dom.linkList.addEventListener("dragleave", handleLinkDragLeave);
    dom.linkList.addEventListener("drop", handleLinkDrop);
    dom.linkList.addEventListener("dragend", handleLinkDragEnd);
  }
}

function bindPanelToggles() {
  ["node", "link"].forEach((key) => {
    const { toggle, body } = getPanelConfig(key);
    if (!toggle || !body) {
      return;
    }
    toggle.addEventListener("click", () => {
      setPanelCollapsed(key, !state.ui[`${key}PanelCollapsed`]);
    });
    updatePanelState(key);
  });
}

function getPanelConfig(key) {
  if (key === "node") {
    return {
      toggle: dom.nodePanelToggle,
      body: dom.nodePanelBody,
      panel: dom.nodePanel,
    };
  }
  if (key === "link") {
    return {
      toggle: dom.linkPanelToggle,
      body: dom.linkPanelBody,
      panel: dom.linkPanel,
    };
  }
  return {};
}

function updatePanelState(key) {
  const { toggle, body, panel } = getPanelConfig(key);
  const collapsed = state.ui[`${key}PanelCollapsed`];
  if (body) {
    body.hidden = collapsed;
  }
  if (toggle) {
    toggle.textContent = collapsed ? "펼치기" : "접기";
    toggle.setAttribute("aria-expanded", (!collapsed).toString());
  }
  if (panel) {
    panel.classList.toggle("is-collapsed", collapsed);
  }
}

function setPanelCollapsed(key, collapsed) {
  state.ui[`${key}PanelCollapsed`] = collapsed;
  updatePanelState(key);
}

function expandPanel(key) {
  if (state.ui[`${key}PanelCollapsed`]) {
    setPanelCollapsed(key, false);
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
  renderFlowSummary(summary);
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
  expandPanel("node");
  syncNodeForm();
  setFormStatus(dom.nodeFormStatus, "");
}

function startLinkCreate() {
  state.ui.editingLinkId = null;
  expandPanel("link");
  syncLinkForm();
  setFormStatus(dom.linkFormStatus, "");
}

function syncNodeForm() {
  if (!dom.nodeForm) {
    return;
  }
  clearFieldErrors(dom.nodeForm);
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
  clearFieldErrors(dom.linkForm);
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
    investReturnRate: 0,
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
  dom.nodeMonthly.value = formatManAmount(node.monthlyAmount);
  dom.nodeCurrency.value = node.currency || "KRW";
  dom.nodeGrowthRate.value = ((Number(node.annualGrowthRate) || 0) * 100).toFixed(1);
  if (dom.nodeInvestReturnRate) {
    dom.nodeInvestReturnRate.value = ((Number(node.investReturnRate) || 0) * 100).toFixed(1);
  }
  dom.nodeCap.value = node.cap === null || node.cap === undefined ? "" : formatManAmount(node.cap);
  dom.nodeCurrent.value = node.currentAmount === null || node.currentAmount === undefined
    ? ""
    : formatManAmount(node.currentAmount);
  dom.nodeMemo.value = node.memo || "";
  dom.nodeActive.checked = node.active !== false;
  updateNodeTypeFields(dom.nodeType.value);
}

function updateNodeTypeFields(type) {
  toggleFormField("growth", type === "Income");
  toggleFormField("investReturn", type === "Invest");
  toggleFormField("cap", type === "Bucket");
  toggleFormField("current", type === "Bucket");
  if (type !== "Income" && dom.nodeGrowthRate) {
    clearFieldError(dom.nodeGrowthRate);
  }
  if (type !== "Invest" && dom.nodeInvestReturnRate) {
    clearFieldError(dom.nodeInvestReturnRate);
  }
  if (type !== "Bucket") {
    if (dom.nodeCap) {
      clearFieldError(dom.nodeCap);
    }
    if (dom.nodeCurrent) {
      clearFieldError(dom.nodeCurrent);
    }
  }
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
  dom.linkMin.value = link.min === null || link.min === undefined ? "" : formatManAmount(link.min);
  dom.linkMax.value = link.max === null || link.max === undefined ? "" : formatManAmount(link.max);
  dom.linkActive.checked = link.active !== false;

  if (link.type === "Percent") {
    dom.linkValue.value = ((Number(link.value) || 0) * 100).toFixed(1);
  } else {
    dom.linkValue.value = formatManAmount(link.value);
  }

  updateLinkTypeFields(dom.linkType.value);
}

function updateLinkTypeFields(type) {
  if (!dom.linkValue || !dom.linkValueLabelText || !dom.linkValueHint) {
    return;
  }
  if (type === "Fixed") {
    dom.linkValueLabelText.textContent = "금액";
    dom.linkValueHint.textContent = "월 기준 금액(만원 단위)을 입력합니다.";
    dom.linkValue.disabled = false;
    dom.linkValue.min = "0";
    dom.linkValue.max = "";
    dom.linkValue.step = "1";
    toggleLinkValueField(true);
  } else if (type === "Percent") {
    dom.linkValueLabelText.textContent = "비율(%)";
    dom.linkValueHint.textContent = "예: 20 입력 시 20% 배분";
    dom.linkValue.disabled = false;
    dom.linkValue.min = "0";
    dom.linkValue.max = "100";
    dom.linkValue.step = "0.1";
    toggleLinkValueField(true);
  } else if (type === "CapFill") {
    dom.linkValueLabelText.textContent = "값";
    dom.linkValueHint.textContent = "저축통 목표 상한까지 채웁니다.";
    dom.linkValue.value = "";
    dom.linkValue.disabled = true;
    toggleLinkValueField(true);
  } else {
    dom.linkValueLabelText.textContent = "값";
    dom.linkValueHint.textContent = "규칙 기반 링크는 다음 단계에서 구현됩니다.";
    dom.linkValue.value = "";
    dom.linkValue.disabled = true;
    toggleLinkValueField(true);
  }
  clearFieldError(dom.linkValue);
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

function clearFieldErrors(form) {
  if (!form) {
    return;
  }
  form.querySelectorAll(".form-group").forEach((group) => {
    group.classList.remove("is-error");
    group.querySelectorAll("input, select, textarea").forEach((field) => {
      field.classList.remove("is-invalid");
      field.removeAttribute("aria-invalid");
    });
    const error = group.querySelector(".field-error");
    if (error) {
      error.textContent = "";
    }
  });
}

function applyFieldErrors(fieldErrors) {
  Object.entries(fieldErrors).forEach(([fieldId, message]) => {
    setFieldError(fieldId, message);
  });
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) {
    return;
  }
  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
  const group = field.closest(".form-group");
  if (!group) {
    return;
  }
  group.classList.add("is-error");
  const error = group.querySelector(".field-error");
  if (error) {
    error.textContent = message;
  }
}

function handleFormFieldInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
    return;
  }
  clearFieldError(field);
}

function clearFieldError(field) {
  if (!field) {
    return;
  }
  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
  const group = field.closest(".form-group");
  if (!group) {
    return;
  }
  group.classList.remove("is-error");
  const error = group.querySelector(".field-error");
  if (error) {
    error.textContent = "";
  }
}

function renderSummaryCards(summary) {
  if (!dom.summaryCards) {
    return;
  }

  const cards = [
    {
      id: "totalExpense",
      label: "월 총지출",
      value: formatCurrency(summary.totalExpense),
      sub: "생활지출 + 저축/투자 + 부채",
      variant: "expense",
    },
    {
      id: "savingRate",
      label: "저축률",
      value: formatPercent(summary.savingRate),
      sub: "저축 ÷ 수입",
      variant: "saving",
    },
    {
      id: "investRate",
      label: "투자율",
      value: formatPercent(summary.investRate),
      sub: "투자 ÷ 수입",
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

  const filtered = filterFlows(flows, nodeMap);
  if (!filtered.length) {
    renderEmpty(dom.flowCanvas, "조건에 맞는 흐름이 없습니다.");
    hideFlowTooltip();
    return;
  }

  const graph = buildFlowGraph(filtered, nodeMap);
  if (!graph.nodes.length || !graph.links.length) {
    renderEmpty(dom.flowCanvas, "그래프를 표시할 데이터가 없습니다.");
    hideFlowTooltip();
    return;
  }

  const svg = buildFlowSvg(graph);
  dom.flowCanvas.appendChild(svg);
}

function renderFlowSummary(summary) {
  if (!dom.flowSummary) {
    return;
  }
  dom.flowSummary.innerHTML = "";
  dom.flowSummary.classList.remove("flow-summary-grid--single");

  if (summary.totalIncome <= 0) {
    const empty = document.createElement("div");
    empty.className = "sankey-empty";
    empty.textContent = "수입이 없어 흐름 요약을 표시할 수 없습니다.";
    dom.flowSummary.appendChild(empty);
    return;
  }

  const items = [
    {
      label: "생활지출",
      value: summary.totalLivingExpense,
      className: "is-expense",
    },
    {
      label: "저축",
      value: summary.totalSavings,
      className: "is-savings",
    },
    {
      label: "투자",
      value: summary.totalInvest,
      className: "is-savings",
    },
    {
      label: "부채 상환",
      value: summary.totalDebt,
      className: "is-debt",
    },
    {
      label: summary.remaining >= 0 ? "잔여금" : "적자",
      value: Math.abs(summary.remaining),
      className: summary.remaining >= 0 ? "is-remaining" : "is-expense",
    },
  ];

  const visibleItems = items.filter((item) => item.value > 0);
  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "sankey-empty";
    empty.textContent = "표시할 항목이 없습니다.";
    dom.flowSummary.appendChild(empty);
    return;
  }

  const donut = buildFlowDonut(summary);
  dom.flowSummary.classList.toggle("flow-summary-grid--single", !donut);
  if (donut) {
    dom.flowSummary.appendChild(donut);
  }

  const totalOutflow = visibleItems.reduce((sum, item) => sum + item.value, 0);
  const itemCount = visibleItems.length;
  const minBaseHeight = 320;
  const maxBaseHeight = 640;
  const bandGap = itemCount > 3 ? 16 : 18;
  const edgePadding = 18;
  const targetHeight = 240;
  const maxBase = Math.max(summary.totalIncome, totalOutflow, 1);
  const scale = targetHeight / maxBase;
  const minHeight = 32;
  let heights = visibleItems.map((item) => Math.max(minHeight, item.value * scale));
  let sumHeights = heights.reduce((sum, height) => sum + height, 0);
  const requiredHeight = sumHeights +
    bandGap * Math.max(0, itemCount - 1) +
    edgePadding * 2;
  let baseHeight = clamp(Math.max(minBaseHeight, requiredHeight), minBaseHeight, maxBaseHeight);
  let availableHeight = baseHeight -
    bandGap * Math.max(0, itemCount - 1) -
    edgePadding * 2;

  const sankey = document.createElement("div");
  sankey.className = "sankey";
  sankey.style.setProperty("--sankey-height", `${baseHeight}px`);
  sankey.style.height = `${baseHeight}px`;
  sankey.style.minHeight = `${baseHeight}px`;

  const leftColumn = document.createElement("div");
  leftColumn.className = "sankey__column sankey__column--left";
  const bands = document.createElement("div");
  bands.className = "sankey__bands";
  const rightColumn = document.createElement("div");
  rightColumn.className = "sankey__column sankey__column--right";

  if (requiredHeight > maxBaseHeight) {
    const compress = availableHeight / sumHeights;
    heights = heights.map((height) => height * compress);
    sumHeights = heights.reduce((sum, height) => sum + height, 0);
  }

  const usedHeight = sumHeights + bandGap * Math.max(0, heights.length - 1);
  const offsetY = edgePadding + Math.max(0, (availableHeight - sumHeights) / 2);
  const leftHeight = usedHeight;
  const incomeNode = document.createElement("div");
  incomeNode.className = "sankey__node is-income";
  incomeNode.style.height = `${leftHeight}px`;
  incomeNode.style.top = `${offsetY}px`;
  incomeNode.innerHTML = `
    <span class="sankey__node-title">월 총수입</span>
    <span class="sankey__node-value">${formatCurrency(summary.totalIncome)}</span>
  `;
  leftColumn.appendChild(incomeNode);

  let currentTop = offsetY;
  visibleItems.forEach((item, index) => {
    const height = heights[index];
    const band = document.createElement("div");
    band.className = `sankey__band ${item.className}`;
    band.style.top = `${currentTop}px`;
    band.style.height = `${height}px`;
    bands.appendChild(band);

    const node = document.createElement("div");
    node.className = `sankey__node ${item.className}`;
    node.style.top = `${currentTop}px`;
    node.style.height = `${height}px`;
    node.innerHTML = `
      <span class="sankey__node-title">${item.label}</span>
      <span class="sankey__node-value">${formatCurrency(item.value)}</span>
    `;
    rightColumn.appendChild(node);
    currentTop += height + bandGap;
  });

  sankey.appendChild(leftColumn);
  sankey.appendChild(bands);
  sankey.appendChild(rightColumn);
  dom.flowSummary.appendChild(sankey);
}

function buildFlowDonut(summary) {
  const income = summary.totalIncome;
  if (!Number.isFinite(income) || income <= 0) {
    return null;
  }

  const items = [
    {
      label: "생활지출",
      value: summary.totalLivingExpense,
      className: "is-expense",
    },
    {
      label: "저축",
      value: summary.totalSavings,
      className: "is-savings",
    },
    {
      label: "투자",
      value: summary.totalInvest,
      className: "is-savings",
    },
    {
      label: "부채 상환",
      value: summary.totalDebt,
      className: "is-debt",
    },
  ].filter((item) => item.value > 0);

  const expenseTotal = items.reduce((sum, item) => sum + item.value, 0);
  if (!items.length || expenseTotal <= 0) {
    return null;
  }

  const baseTotal = Math.max(expenseTotal, 1);

  const container = document.createElement("div");
  container.className = "flow-donut";

  const chartWrap = document.createElement("div");
  chartWrap.className = "flow-donut__chart-wrap";

  const svg = createSvgElement("svg", {
    viewBox: "0 0 160 160",
    class: "flow-donut__chart",
    role: "img",
    "aria-label": "지출 분포 도넛 차트",
  });

  const centerX = 80;
  const centerY = 80;
  const radius = 56;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  const track = createSvgElement("circle", {
    cx: centerX,
    cy: centerY,
    r: radius,
    class: "flow-donut__track",
    "stroke-width": strokeWidth,
    fill: "none",
  });
  svg.appendChild(track);

  let offset = 0;
  items.forEach((item) => {
    const fraction = Math.max(0, item.value / baseTotal);
    const dash = circumference * Math.min(1, fraction);
    const circle = createSvgElement("circle", {
      cx: centerX,
      cy: centerY,
      r: radius,
      class: `flow-donut__arc ${item.className}`,
      "stroke-width": strokeWidth,
      fill: "none",
    });
    circle.style.strokeDasharray = `${dash} ${circumference - dash}`;
    circle.style.strokeDashoffset = `${-offset}`;
    svg.appendChild(circle);
    offset += dash;
  });

  const center = document.createElement("div");
  center.className = "flow-donut__center";
  center.innerHTML = `
    <div class="flow-donut__label">월 총수입</div>
    <div class="flow-donut__value">${formatCurrency(income)}</div>
  `;

  chartWrap.appendChild(svg);
  chartWrap.appendChild(center);
  container.appendChild(chartWrap);

  const legend = document.createElement("div");
  legend.className = "flow-donut__legend";
  items.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "flow-donut__legend-item";
    entry.innerHTML = `
      <span class="flow-donut__legend-label">
        <span class="flow-donut__dot ${item.className}"></span>
        ${item.label}
      </span>
      <span>${formatCurrency(item.value)}</span>
    `;
    legend.appendChild(entry);
  });
  container.appendChild(legend);

  return container;
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
      const investRate = Number(node.investReturnRate) || 0;
      const investInfo = node.type === "Invest"
        ? `<span>투자수익률 ${formatPercent(investRate)}</span>`
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
          ${investInfo}
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
    item.dataset.linkId = link.id;
    item.dataset.fromId = link.from;
    item.innerHTML = `
      <div class="list-title">
        <span class="title-left">
          <span class="drag-handle" draggable="true" data-drag-handle="link" data-id="${link.id}" title="드래그로 우선순위 조정" aria-label="우선순위 드래그">↕</span>
          <span>${fromName} → ${toName}</span>
        </span>
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
  const simulation = simulateMonthly(state.nodes, state.links, state.settings);
  renderSimulationChart(simulation);

  if (!dom.simulationSummary) {
    return;
  }

  const totals = simulation.totals;
  const isReal = state.settings.viewMode === "real";
  const metrics = [
    {
      label: "보유자산(시드머니)",
      value: totals.seedMoneyStart,
      note: "기준월 보유 자산",
    },
    {
      label: `${state.settings.horizonYears}년 후 보유자산`,
      value: isReal ? totals.seedMoneyEndReal : totals.seedMoneyEnd,
      note: "성장률/투자수익률 반영",
    },
    {
      label: `${state.settings.horizonYears}년 누적 순현금흐름`,
      value: isReal ? totals.netCashflowReal : totals.netCashflow,
      note: "수입 - 생활지출 누적",
    },
    {
      label: `${state.settings.horizonYears}년 누적 저축/투자`,
      value: isReal ? totals.totalSavingsInvestReal : totals.totalSavingsInvest,
      note: "저축통/투자 유입 누적",
    },
    {
      label: `${state.settings.horizonYears}년 누적 잔여금`,
      value: isReal ? totals.remainingReal : totals.remaining,
      note: "배분 후 남는 금액 누적",
    },
    {
      label: `${state.settings.horizonYears}년 후 총 자산(추정)`,
      value: isReal ? totals.totalAssetsReal : totals.totalAssets,
      note: "저축통/투자/잔여금 + 보유자산",
    },
  ];

  dom.simulationSummary.innerHTML = "";
  metrics.forEach((metric, index) => {
    const element = document.createElement("div");
    element.className = "card";
    element.style.setProperty("--delay", `${index * 0.04}s`);
    element.innerHTML = `
        <div class="card__label">${metric.label}</div>
        <div class="card__value">${formatCurrency(metric.value)}</div>
        <div class="card__sub">${metric.note}</div>
      `;
    dom.simulationSummary.appendChild(element);
  });
}

function renderSimulationChart(simulation) {
  if (!dom.simulationChart) {
    return;
  }
  const svg = dom.simulationChart;
  const width = 720;
  const height = 220;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const series = simulation.timeline || [];
  const growthRate = Number(state.settings.seedMoneyGrowthRate) || 0;
  const returnRate = Number(state.settings.seedMoneyReturnRate) || 0;
  const inflationRate = Number(state.settings.inflationRate) || 0;
  const steadyScenario = buildSteadyScenario(state.nodes, state.settings);
  const steadySimulation = simulateMonthly(
    steadyScenario.steadyNodes,
    state.links,
    steadyScenario.steadySettings
  );
  const steadySeries = steadySimulation.timeline || [];
  if (dom.simulationChartMeta) {
    dom.simulationChartMeta.textContent = `보유자산 성장률 연 ${growthRate.toFixed(1)}% · 보유자산 투자수익률 연 ${returnRate.toFixed(1)}% · 인플레이션 연 ${inflationRate.toFixed(1)}% · 성실 총자산: 저축/투자 성장률 0%, 보유자산 성장률=인플레이션, 실질 기준`;
  }
  if (!series.length) {
    const empty = createSvgElement("text", {
      x: width / 2,
      y: height / 2,
      class: "sim-empty",
      "text-anchor": "middle",
    });
    empty.textContent = "데이터 없음";
    svg.appendChild(empty);
    return;
  }

  const padding = {
    top: 18,
    right: 220,
    bottom: 28,
    left: 96,
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxIndex = series[series.length - 1].monthIndex || 0;

  const points = series.map((point) => {
    const factor = getInflationFactor(state.settings.inflationRate, point.monthIndex);
    const steadyPoint = steadySeries[point.monthIndex];
    const steadyTotal = steadyPoint ? steadyPoint.totalAssets / factor : 0;
    return {
      x: maxIndex === 0 ? padding.left : padding.left + (plotWidth * point.monthIndex) / maxIndex,
      nominal: point.totalAssets,
      real: point.totalAssets / factor,
      steady: steadyTotal,
    };
  });

  const maxValue = points.reduce((max, point) => {
    return Math.max(max, point.nominal, point.real, point.steady);
  }, 0);

  if (maxValue <= 0) {
    const empty = createSvgElement("text", {
      x: width / 2,
      y: height / 2,
      class: "sim-empty",
      "text-anchor": "middle",
    });
    empty.textContent = "데이터 없음";
    svg.appendChild(empty);
    return;
  }

  const yScale = (value) => padding.top + (1 - value / maxValue) * plotHeight;
  const axisTicks = [0, 0.5, 1];

  axisTicks.forEach((tick) => {
    const value = maxValue * tick;
    const y = yScale(value);
    const line = createSvgElement("line", {
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
      class: "sim-grid",
    });
    svg.appendChild(line);
    const label = createSvgElement("text", {
      x: padding.left - 8,
      y: y + 4,
      class: "sim-axis-label",
      "text-anchor": "end",
    });
    label.textContent = formatKoreanCompact(value);
    svg.appendChild(label);
  });

  const buildPath = (key) =>
    points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${point.x} ${yScale(point[key])}`;
      })
      .join(" ");

  const nominalPath = createSvgElement("path", {
    d: buildPath("nominal"),
    class: "sim-line sim-line--nominal",
  });
  const realPath = createSvgElement("path", {
    d: buildPath("real"),
    class: "sim-line sim-line--real",
  });
  const steadyPath = createSvgElement("path", {
    d: buildPath("steady"),
    class: "sim-line sim-line--steady",
  });

  svg.appendChild(nominalPath);
  svg.appendChild(realPath);
  svg.appendChild(steadyPath);

  const startLabel = formatMonthLabel(state.settings.baseMonth);
  const endLabel = formatMonthLabel(addMonths(state.settings.baseMonth, simulation.months));
  const axisY = height - 8;

  const startText = createSvgElement("text", {
    x: padding.left,
    y: axisY,
    class: "sim-axis-label",
    "text-anchor": "start",
  });
  startText.textContent = startLabel;
  svg.appendChild(startText);

  const endText = createSvgElement("text", {
    x: width - padding.right,
    y: axisY,
    class: "sim-axis-label",
    "text-anchor": "end",
  });
  endText.textContent = endLabel;
  svg.appendChild(endText);

  const legend = createSvgElement("g", {
    class: "sim-legend",
    transform: `translate(${width - padding.right + 12}, ${padding.top})`,
  });
  const legendItems = [
    { label: "명목 총자산", className: "sim-line--nominal" },
    { label: "실질 총자산", className: "sim-line--real" },
    { label: "성실 총자산(실질)", className: "sim-line--steady" },
  ];
  legendItems.forEach((item, index) => {
    const y = index * 14;
    const line = createSvgElement("line", {
      x1: 0,
      x2: 14,
      y1: y,
      y2: y,
      class: `sim-legend-line ${item.className}`,
    });
    const text = createSvgElement("text", {
      x: 20,
      y: y + 4,
      class: "sim-legend-label",
    });
    text.textContent = item.label;
    legend.appendChild(line);
    legend.appendChild(text);
  });
  svg.appendChild(legend);

  const tooltip = dom.simulationChartTooltip;
  if (tooltip) {
    const plotLeft = padding.left;
    const plotRight = width - padding.right;
    const plotTop = padding.top;
    const plotBottom = padding.top + plotHeight;

    const showTooltip = (event) => {
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      if (x < plotLeft || x > plotRight || y < plotTop || y > plotBottom) {
        tooltip.hidden = true;
        return;
      }
      const ratio = clamp((x - plotLeft) / plotWidth, 0, 1);
      const monthFloat = ratio * maxIndex;
      const yearIndex = Math.round(monthFloat / 12);
      const monthIndex = clamp(yearIndex * 12, 0, maxIndex);
      const point = series[monthIndex];
      if (!point) {
        tooltip.hidden = true;
        return;
      }
      const factor = getInflationFactor(state.settings.inflationRate, point.monthIndex);
      const nominal = point.totalAssets;
      const real = point.totalAssets / factor;
      const steadyPoint = steadySeries[point.monthIndex];
      const steadyTotal = steadyPoint ? steadyPoint.totalAssets / factor : 0;
      const labelMonth = addMonths(state.settings.baseMonth, monthIndex);
      const yearLabel = yearIndex === 0
        ? `기준월 (${formatMonthLabel(labelMonth)})`
        : `${yearIndex}년차 (${formatMonthLabel(labelMonth)})`;
      tooltip.innerHTML = `
        <div class="sim-tooltip__title">${yearLabel}</div>
        <div class="sim-tooltip__row"><span>명목 총자산</span><span>${formatKoreanCompact(nominal)}</span></div>
        <div class="sim-tooltip__row"><span>실질 총자산</span><span>${formatKoreanCompact(real)}</span></div>
        <div class="sim-tooltip__row"><span>성실 총자산(실질)</span><span>${formatKoreanCompact(steadyTotal)}</span></div>
      `;
      tooltip.hidden = false;
      const panelRect = tooltip.offsetParent?.getBoundingClientRect() || rect;
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = event.clientX - panelRect.left + 12;
      let top = event.clientY - panelRect.top - tooltipRect.height - 12;
      if (left + tooltipRect.width > panelRect.width) {
        left = panelRect.width - tooltipRect.width - 12;
      }
      if (top < 8) {
        top = event.clientY - panelRect.top + 12;
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    svg.onmousemove = showTooltip;
    svg.onmouseleave = () => {
      tooltip.hidden = true;
    };
  }
}

function handleNodeSubmit(event) {
  event.preventDefault();
  if (!dom.nodeName || !dom.nodeType || !dom.nodeMonthly) {
    return;
  }

  clearFieldErrors(dom.nodeForm);
  const nodeData = buildNodeFormData();

  const validation = validateNodeData(nodeData);
  if (validation.errors.length) {
    applyFieldErrors(validation.fieldErrors);
    setFormStatus(dom.nodeFormStatus, validation.errors.join(" / "), "error");
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

function handleNodeFieldBlur(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
    return;
  }
  if (!dom.nodeForm || !dom.nodeForm.contains(field)) {
    return;
  }
  if (field.closest("[hidden]")) {
    return;
  }
  const nodeData = buildNodeFormData();
  const validation = validateNodeData(nodeData);
  const message = validation.fieldErrors[field.id];
  if (message) {
    setFieldError(field.id, message);
  } else {
    clearFieldError(field);
  }
}

function handleNodeShortcutSave(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (dom.nodeForm && typeof dom.nodeForm.requestSubmit === "function") {
      dom.nodeForm.requestSubmit();
    }
  }
}

function buildNodeFormData() {
  const name = dom.nodeName?.value?.trim() || "";
  const type = dom.nodeType?.value || "Income";
  const currency = dom.nodeCurrency?.value || "KRW";
  const monthlyAmount = parseManAmount(dom.nodeMonthly?.value, 0);
  const growthPercent = parseNumber(dom.nodeGrowthRate?.value, 0);
  const investReturnPercent = parseNumber(dom.nodeInvestReturnRate?.value, 0);
  const cap = parseOptionalManAmount(dom.nodeCap?.value);
  const currentAmount = parseOptionalManAmount(dom.nodeCurrent?.value);
  const memo = dom.nodeMemo?.value?.trim() || "";
  const active = dom.nodeActive?.checked ?? true;

  return {
    name,
    type,
    currency,
    monthlyAmount,
    annualGrowthRate: type === "Income" ? growthPercent / 100 : 0,
    investReturnRate: type === "Invest" ? investReturnPercent / 100 : 0,
    active,
    memo,
    cap: type === "Bucket" ? cap : null,
    currentAmount: type === "Bucket" ? currentAmount : null,
  };
}

function handleLinkSubmit(event) {
  event.preventDefault();
  if (!dom.linkFrom || dom.linkFrom.disabled) {
    return;
  }

  clearFieldErrors(dom.linkForm);
  const from = dom.linkFrom.value;
  const to = dom.linkTo.value;
  const type = dom.linkType?.value || "Fixed";
  const priority = Math.max(1, parseNumber(dom.linkPriority?.value, getNextPriority(from)));
  const min = parseOptionalManAmount(dom.linkMin?.value);
  const max = parseOptionalManAmount(dom.linkMax?.value);
  const active = dom.linkActive?.checked ?? true;
  let value = 0;

  if (type === "Fixed") {
    value = parseManAmount(dom.linkValue?.value, 0);
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

  const validation = validateLinkData(linkData);
  if (validation.errors.length) {
    applyFieldErrors(validation.fieldErrors);
    setFormStatus(dom.linkFormStatus, validation.errors.join(" / "), "error");
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
    expandPanel("node");
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
    expandPanel("link");
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

function handleLinkDragStart(event) {
  const handle = event.target.closest("[data-drag-handle=\"link\"]");
  if (!handle) {
    return;
  }
  const linkId = handle.dataset.id;
  const item = handle.closest(".list-item[data-link-id]");
  if (!linkId || !item) {
    return;
  }
  state.ui.drag.linkId = linkId;
  state.ui.drag.fromId = item.dataset.fromId || null;
  item.classList.add("is-dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", linkId);
  }
}

function handleLinkDragOver(event) {
  const target = event.target.closest(".list-item[data-link-id]");
  if (!target || !state.ui.drag.linkId) {
    return;
  }
  if (target.dataset.fromId !== state.ui.drag.fromId) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  clearDragIndicators();
  applyAutoScroll(dom.linkList, event.clientY);
  const rect = target.getBoundingClientRect();
  const isAfter = event.clientY > rect.top + rect.height / 2;
  target.classList.add(isAfter ? "drop-after" : "drop-before");
}

function handleLinkDragLeave(event) {
  const target = event.target.closest(".list-item[data-link-id]");
  if (!target) {
    return;
  }
  target.classList.remove("drop-before", "drop-after");
}

function handleLinkDrop(event) {
  const target = event.target.closest(".list-item[data-link-id]");
  if (!target || !state.ui.drag.linkId) {
    return;
  }
  if (target.dataset.fromId !== state.ui.drag.fromId) {
    clearDragIndicators();
    return;
  }
  event.preventDefault();
  const rect = target.getBoundingClientRect();
  const insertAfter = event.clientY > rect.top + rect.height / 2;
  reorderLinkWithinGroup(state.ui.drag.linkId, target.dataset.linkId, insertAfter);
  clearDragIndicators();
  renderAll();
}

function handleLinkDragEnd() {
  state.ui.drag.linkId = null;
  state.ui.drag.fromId = null;
  clearDragIndicators();
  document.querySelectorAll(".list-item.is-dragging").forEach((item) => {
    item.classList.remove("is-dragging");
  });
}

function clearDragIndicators() {
  document.querySelectorAll(".list-item.drop-before, .list-item.drop-after").forEach((item) => {
    item.classList.remove("drop-before", "drop-after");
  });
}

function applyAutoScroll(container, pointerY) {
  if (!container) {
    return;
  }
  const rect = container.getBoundingClientRect();
  const threshold = 40;
  const speed = 12;
  if (pointerY < rect.top + threshold) {
    container.scrollTop -= speed;
  } else if (pointerY > rect.bottom - threshold) {
    container.scrollTop += speed;
  }
}

function filterFlows(flows, nodeMap) {
  return flows.filter((flow) => {
    const fromNode = nodeMap.get(flow.fromId);
    const toNode = flow.toId ? nodeMap.get(flow.toId) : null;

    if (!fromNode) {
      return false;
    }

    if (state.settings.flowActiveOnly) {
      if (!fromNode.active) {
        return false;
      }
      if (toNode && !toNode.active) {
        return false;
      }
    }

    if (state.settings.flowTypeFilter !== "all") {
      const matchesFrom = fromNode.type === state.settings.flowTypeFilter;
      const matchesTo = toNode?.type === state.settings.flowTypeFilter;
      if (!matchesFrom && !matchesTo) {
        return false;
      }
    }

    if (state.settings.flowCurrencyFilter !== "all") {
      if (fromNode.currency !== state.settings.flowCurrencyFilter) {
        return false;
      }
    }

    return true;
  });
}

function buildFlowGraph(flows, nodeMap) {
  const nodes = new Map();
  const links = [];
  const stats = new Map();

  function ensureStats(id) {
    if (!stats.has(id)) {
      stats.set(id, { incoming: 0, outgoing: 0 });
    }
    return stats.get(id);
  }

  flows.forEach((flow) => {
    const fromNode = nodeMap.get(flow.fromId);
    if (!fromNode) {
      return;
    }
    const toNode = flow.toId ? nodeMap.get(flow.toId) : null;
    nodes.set(fromNode.id, fromNode);
    if (toNode) {
      nodes.set(toNode.id, toNode);
    } else {
      nodes.set("residual", {
        id: "residual",
        name: "잔여금",
        type: "Residual",
        currency: fromNode.currency,
        active: true,
        monthlyAmount: 0,
      });
    }
    links.push(flow);

    const fromStat = ensureStats(fromNode.id);
    fromStat.outgoing += flow.amount;
    const toId = flow.toId || "residual";
    const toStat = ensureStats(toId);
    toStat.incoming += flow.amount;
  });

  const nodeList = Array.from(nodes.values());
  const typeOrder = [
    "Income",
    "Transfer",
    "Expense",
    "Bucket",
    "Invest",
    "Debt",
    "Residual",
  ];
  const availableTypes = typeOrder.filter((type) =>
    nodeList.some((node) => node.type === type)
  );
  const columnTypes = availableTypes.length ? availableTypes : typeOrder;
  const columnIndex = new Map(columnTypes.map((type, index) => [type, index]));

  const columnGroups = new Map();
  nodeList.forEach((node) => {
    const column = columnIndex.get(node.type) ?? 1;
    if (!columnGroups.has(column)) {
      columnGroups.set(column, []);
    }
    columnGroups.get(column).push(node);
  });

  const nodePositions = new Map();
  const containerWidth = dom.flowCanvas?.clientWidth || 760;
  const columnCount = Math.max(1, columnTypes.length);
  const marginX = 40;
  const marginY = 30;
  const minColumnWidth = 180;
  const width = Math.max(
    760,
    Math.floor(containerWidth),
    columnCount * minColumnWidth + marginX * 2
  );
  const nodeWidth = clampNumber(
    ((width - marginX * 2) / columnCount) * 0.7,
    120,
    190,
    160
  );
  let gapY = 18;
  const spacingX =
    columnCount > 1 ? (width - marginX * 2 - nodeWidth) / (columnCount - 1) : 0;

  const volumes = nodeList.map((node) => {
    const stat = stats.get(node.id) || { incoming: 0, outgoing: 0 };
    return stat.incoming + stat.outgoing;
  });
  const maxVolume = Math.max(...volumes, 1);
  let baseHeight = 34;
  let extraHeight = 20;
  const columnHeights = new Map();
  const orderedColumns = Array.from(columnGroups.keys()).sort((a, b) => a - b);

  orderedColumns.forEach((col) => {
    const list = columnGroups.get(col) || [];
    const sorted = list.slice().sort((a, b) => {
      const statA = stats.get(a.id) || { incoming: 0, outgoing: 0 };
      const statB = stats.get(b.id) || { incoming: 0, outgoing: 0 };
      const volumeA = statA.incoming + statA.outgoing;
      const volumeB = statB.incoming + statB.outgoing;
      if (volumeB !== volumeA) {
        return volumeB - volumeA;
      }
      return (a.name || "").localeCompare(b.name || "", "ko");
    });
    const heights = sorted.map((node) => {
      const stat = stats.get(node.id) || { incoming: 0, outgoing: 0 };
      const volume = stat.incoming + stat.outgoing;
      return baseHeight + (volume / maxVolume) * extraHeight;
    });
    const columnHeight = heights.reduce((sum, height) => sum + height, 0) +
      gapY * Math.max(0, heights.length - 1);
    columnHeights.set(col, { nodes: sorted, heights, columnHeight });
  });

  let maxColumnHeight = Math.max(
    ...Array.from(columnHeights.values()).map((entry) => entry.columnHeight),
    0
  );
  const maxCanvasHeight = 560;
  const minCanvasHeight = 320;
  let height = Math.max(minCanvasHeight, maxColumnHeight + marginY * 2);
  if (height > maxCanvasHeight) {
    const scale = (maxCanvasHeight - marginY * 2) / Math.max(maxColumnHeight, 1);
    baseHeight = Math.max(22, baseHeight * scale);
    extraHeight = Math.max(8, extraHeight * scale);
    gapY = Math.max(8, gapY * scale);
    columnHeights.clear();
    orderedColumns.forEach((col) => {
      const list = columnGroups.get(col) || [];
      const sorted = list.slice().sort((a, b) => {
        const statA = stats.get(a.id) || { incoming: 0, outgoing: 0 };
        const statB = stats.get(b.id) || { incoming: 0, outgoing: 0 };
        const volumeA = statA.incoming + statA.outgoing;
        const volumeB = statB.incoming + statB.outgoing;
        if (volumeB !== volumeA) {
          return volumeB - volumeA;
        }
        return (a.name || "").localeCompare(b.name || "", "ko");
      });
      const heights = sorted.map((node) => {
        const stat = stats.get(node.id) || { incoming: 0, outgoing: 0 };
        const volume = stat.incoming + stat.outgoing;
        return baseHeight + (volume / maxVolume) * extraHeight;
      });
      const columnHeight = heights.reduce((sum, h) => sum + h, 0) +
        gapY * Math.max(0, heights.length - 1);
      columnHeights.set(col, { nodes: sorted, heights, columnHeight });
    });
    maxColumnHeight = Math.max(
      ...Array.from(columnHeights.values()).map((entry) => entry.columnHeight),
      0
    );
    height = Math.max(minCanvasHeight, Math.min(maxCanvasHeight, maxColumnHeight + marginY * 2));
  }

  orderedColumns.forEach((col) => {
    const entry = columnHeights.get(col);
    if (!entry) {
      return;
    }
    const startY = marginY + (height - marginY * 2 - entry.columnHeight) / 2;
    let currentY = startY;
    entry.nodes.forEach((node, index) => {
      const nodeHeight = entry.heights[index];
      nodePositions.set(node.id, {
        x: marginX + col * spacingX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
      });
      currentY += nodeHeight + gapY;
    });
  });

  return {
    nodes: nodeList,
    links,
    positions: nodePositions,
    width,
    height,
    stats,
  };
}

function buildFlowSvg(graph) {
  const svg = createSvgElement("svg", {
    class: "flow-svg",
    viewBox: `0 0 ${graph.width} ${graph.height}`,
    role: "img",
    "aria-label": "자산 흐름 그래프",
  });

  const maxAmount = Math.max(...graph.links.map((link) => link.amount), 1);
  const graphNodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  graph.links.forEach((link) => {
    const fromPos = graph.positions.get(link.fromId);
    const toId = link.toId || "residual";
    const toPos = graph.positions.get(toId);
    if (!fromPos || !toPos) {
      return;
    }
    const fromNode = graphNodeMap.get(link.fromId);
    const toNode = graphNodeMap.get(toId) || { name: "잔여금", type: "Residual" };
    const startX = fromPos.x + fromPos.width;
    const startY = fromPos.y + fromPos.height / 2;
    const endX = toPos.x;
    const endY = toPos.y + toPos.height / 2;
    const controlOffset = Math.max(60, Math.abs(endX - startX) / 2);
    const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    const strokeWidth = 1.5 + (link.amount / maxAmount) * 6;
    const typeClass = String(toNode.type || "Residual").toLowerCase();
    const pathEl = createSvgElement("path", {
      d: path,
      class: `flow-link flow-link--${typeClass}${link.type === "Residual" ? " is-residual" : ""}`,
      strokeWidth: strokeWidth.toFixed(2),
    });

    pathEl.addEventListener("mousemove", (event) => {
      showFlowTooltip(event, buildLinkTooltip(link, fromNode, toNode));
    });
    pathEl.addEventListener("mouseleave", hideFlowTooltip);

    svg.appendChild(pathEl);
  });

  graph.nodes.forEach((node) => {
    const pos = graph.positions.get(node.id);
    if (!pos) {
      return;
    }
    const group = createSvgElement("g", {});
    const typeClass = String(node.type || "unknown").toLowerCase();
    const rect = createSvgElement("rect", {
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      rx: 12,
      ry: 12,
      class: `flow-node flow-node--${typeClass}`,
    });
    const label = createSvgElement("text", {
      x: pos.x + 12,
      y: pos.y + pos.height / 2 + 4,
      class: "flow-node-label",
    });
    label.textContent = node.name || "노드";

    group.appendChild(rect);
    group.appendChild(label);
    group.addEventListener("mousemove", (event) => {
      showFlowTooltip(event, buildNodeTooltip(node, graph.stats.get(node.id)));
    });
    group.addEventListener("mouseleave", hideFlowTooltip);

    svg.appendChild(group);
  });

  return svg;
}

function buildNodeTooltip(node, stats) {
  const typeLabel = NODE_TYPE_LABELS[node.type] || node.type;
  const incoming = formatCurrency(stats?.incoming || 0);
  const outgoing = formatCurrency(stats?.outgoing || 0);
  return `${node.name}\n${typeLabel}\n유입 ${incoming} · 유출 ${outgoing}`;
}

function buildLinkTooltip(link, fromNode, toNode) {
  const typeLabel = LINK_TYPE_LABELS[link.type] || link.type;
  const amount = formatCurrency(link.amount || 0);
  const fromName = fromNode?.name || "알 수 없음";
  const toName = toNode?.name || "잔여금";
  return `${fromName} → ${toName}\n${typeLabel} · ${amount}`;
}

function showFlowTooltip(event, text) {
  if (!dom.flowTooltip) {
    return;
  }
  dom.flowTooltip.hidden = false;
  dom.flowTooltip.textContent = text;
  const rect = dom.flowCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  dom.flowTooltip.style.left = `${x}px`;
  dom.flowTooltip.style.top = `${y}px`;
}

function hideFlowTooltip() {
  if (!dom.flowTooltip) {
    return;
  }
  dom.flowTooltip.hidden = true;
}

function createSvgElement(tag, attrs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function validateNodeData(node) {
  const errors = [];
  const fieldErrors = {};

  if (!node.name) {
    fieldErrors.nodeName = "노드 이름을 입력하세요.";
    errors.push(fieldErrors.nodeName);
  }
  if (!node.type) {
    fieldErrors.nodeType = "노드 타입을 선택하세요.";
    errors.push(fieldErrors.nodeType);
  }
  if (node.monthlyAmount < 0) {
    fieldErrors.nodeMonthly = "월 기준 금액은 0 이상이어야 합니다.";
    errors.push(fieldErrors.nodeMonthly);
  }
  if (node.type === "Income" && (node.annualGrowthRate < 0 || node.annualGrowthRate > 0.3)) {
    fieldErrors.nodeGrowthRate = "연봉상승률은 0~30% 범위입니다.";
    errors.push(fieldErrors.nodeGrowthRate);
  }
  if (node.type === "Invest" && (node.investReturnRate < 0 || node.investReturnRate > 0.3)) {
    fieldErrors.nodeInvestReturnRate = "투자수익률은 0~30% 범위입니다.";
    errors.push(fieldErrors.nodeInvestReturnRate);
  }
  if (node.type === "Bucket") {
    if (node.cap !== null && node.cap < 0) {
      fieldErrors.nodeCap = "저축통 목표 상한은 0 이상이어야 합니다.";
      errors.push(fieldErrors.nodeCap);
    }
    if (node.currentAmount !== null && node.currentAmount < 0) {
      fieldErrors.nodeCurrent = "현재 잔액은 0 이상이어야 합니다.";
      errors.push(fieldErrors.nodeCurrent);
    }
    if (node.cap !== null && node.currentAmount !== null && node.currentAmount > node.cap) {
      fieldErrors.nodeCurrent = "현재 잔액이 목표 상한보다 큽니다.";
      errors.push(fieldErrors.nodeCurrent);
    }
  }

  return { errors, fieldErrors };
}

function validateLinkData(link) {
  const errors = [];
  const fieldErrors = {};

  if (!link.from) {
    fieldErrors.linkFrom = "From 노드를 선택하세요.";
    errors.push(fieldErrors.linkFrom);
  }
  if (!link.to) {
    fieldErrors.linkTo = "To 노드를 선택하세요.";
    errors.push(fieldErrors.linkTo);
  }

  const hasFrom = state.nodes.some((node) => node.id === link.from);
  const hasTo = state.nodes.some((node) => node.id === link.to);
  if ((link.from && !hasFrom) || (link.to && !hasTo)) {
    fieldErrors.linkFrom = "선택한 노드를 찾을 수 없습니다.";
    fieldErrors.linkTo = "선택한 노드를 찾을 수 없습니다.";
    errors.push("선택한 노드를 찾을 수 없습니다.");
  }

  if (link.from && link.to && link.from === link.to) {
    fieldErrors.linkTo = "From과 To는 동일할 수 없습니다.";
    errors.push(fieldErrors.linkTo);
  }
  if (link.type === "Fixed" && link.value <= 0) {
    fieldErrors.linkValue = "금액 값은 0보다 커야 합니다.";
    errors.push(fieldErrors.linkValue);
  }
  if (link.type === "Percent" && (link.value <= 0 || link.value > 1)) {
    fieldErrors.linkValue = "비율은 0~100% 범위입니다.";
    errors.push(fieldErrors.linkValue);
  }
  if (link.priority < 1) {
    fieldErrors.linkPriority = "우선순위는 1 이상이어야 합니다.";
    errors.push(fieldErrors.linkPriority);
  }
  if (link.type === "CapFill") {
    const target = state.nodes.find((node) => node.id === link.to);
    if (target && target.type !== "Bucket") {
      fieldErrors.linkTo = "목표 채우기는 저축통 노드에만 적용됩니다.";
      errors.push(fieldErrors.linkTo);
    }
  }
  if (link.min !== null && link.min < 0) {
    fieldErrors.linkMin = "최소값은 0 이상이어야 합니다.";
    errors.push(fieldErrors.linkMin);
  }
  if (link.max !== null && link.max < 0) {
    fieldErrors.linkMax = "최대값은 0 이상이어야 합니다.";
    errors.push(fieldErrors.linkMax);
  }
  if (link.min !== null && link.max !== null && link.min > link.max) {
    fieldErrors.linkMin = "최소값이 최대값보다 큽니다.";
    fieldErrors.linkMax = "최대값이 최소값보다 작습니다.";
    errors.push("최소/최대 값을 확인하세요.");
  }

  return { errors, fieldErrors };
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

function reorderLinkWithinGroup(dragId, targetId, insertAfter) {
  if (!dragId || !targetId || dragId === targetId) {
    return;
  }
  const dragged = state.links.find((item) => item.id === dragId);
  if (!dragged) {
    return;
  }
  const group = state.links
    .filter((item) => item.from === dragged.from)
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const dragIndex = group.findIndex((item) => item.id === dragId);
  const targetIndex = group.findIndex((item) => item.id === targetId);
  if (dragIndex < 0 || targetIndex < 0) {
    return;
  }
  const [moved] = group.splice(dragIndex, 1);
  const adjustedTargetIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = insertAfter ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  group.splice(insertIndex, 0, moved);
  group.forEach((item, index) => {
    item.priority = index + 1;
  });
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

function parseManAmount(value, fallbackMan = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackMan * MONEY_UNIT;
  }
  return Math.round(parsed) * MONEY_UNIT;
}

function parseOptionalManAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) * MONEY_UNIT : null;
}

function formatManAmount(value) {
  const numeric = Number(value) || 0;
  return Math.round(numeric / MONEY_UNIT);
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
          linkId: link.id,
          priority: link.priority,
        });
      });

    if (available > 0) {
      flows.push({
        fromId,
        toId: null,
        amount: available,
        type: "Residual",
        linkId: null,
        priority: null,
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

  let totalLivingExpense = 0;
  let totalSavings = 0;
  let totalInvest = 0;
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
      totalLivingExpense += flow.amount;
    } else if (target.type === "Bucket") {
      totalSavings += flow.amount;
    } else if (target.type === "Invest") {
      totalInvest += flow.amount;
    } else if (target.type === "Debt") {
      totalDebt += flow.amount;
    }
  });

  const totalExpense = totalLivingExpense + totalSavings + totalInvest + totalDebt;
  const netCashflow = totalIncome - totalLivingExpense;
  const remaining = totalIncome - totalExpense;
  const savingRate = totalIncome > 0 ? totalSavings / totalIncome : 0;
  const investRate = totalIncome > 0 ? totalInvest / totalIncome : 0;
  const totalSavingsInvest = totalSavings + totalInvest;

  return {
    totalIncome,
    totalExpense,
    totalLivingExpense,
    totalSavings,
    totalInvest,
    netCashflow,
    totalSavingsInvest,
    savingRate,
    investRate,
    remaining,
    totalDebt,
  };
}

function getAnnualRateFactor(rate, monthsElapsed) {
  const normalized = Number(rate) || 0;
  if (!Number.isFinite(normalized) || normalized === 0) {
    return 1;
  }
  return Math.pow(1 + normalized, monthsElapsed / 12);
}

function getMonthlyRateFactor(rate) {
  return getAnnualRateFactor(rate, 1);
}

function getInflationFactor(ratePercent, monthsElapsed) {
  const rate = Math.max(0, Number(ratePercent) || 0) / 100;
  if (rate === 0) {
    return 1;
  }
  return Math.pow(1 + rate, monthsElapsed / 12);
}

function sumMapValues(values) {
  let total = 0;
  values.forEach((value) => {
    total += Number(value) || 0;
  });
  return total;
}

function simulateMonthly(nodes, links, settings, options = {}) {
  const months = Math.max(1, Number(settings.horizonYears) || 1) * 12;
  const baseNodes = nodes.map((node) => ({
    ...node,
    monthlyAmount: Number(node.monthlyAmount) || 0,
    annualGrowthRate: Number(node.annualGrowthRate) || 0,
    investReturnRate: Number(node.investReturnRate) || 0,
  }));
  const bucketBalances = new Map();
  const investBalances = new Map();
  baseNodes.forEach((node) => {
    if (node.type === "Bucket") {
      bucketBalances.set(node.id, Number(node.currentAmount) || 0);
    }
    if (node.type === "Invest") {
      investBalances.set(node.id, Number(node.currentAmount) || 0);
    }
  });

  const seedMoneyStart = Math.max(0, Number(settings.seedMoney) || 0);
  const growthRate = Math.max(0, Number(settings.seedMoneyGrowthRate) || 0) / 100;
  const returnRate = Math.max(0, Number(settings.seedMoneyReturnRate) || 0) / 100;
  const combinedSeedRate = (1 + growthRate) * (1 + returnRate) - 1;
  const seedMonthlyFactor = getMonthlyRateFactor(combinedSeedRate);
  const assetGrowthRate = Number(options.assetGrowthRate);
  const assetMonthlyFactor = Number.isFinite(assetGrowthRate) && assetGrowthRate !== 0
    ? getMonthlyRateFactor(assetGrowthRate / 100)
    : 1;

  let seedMoneyBalance = seedMoneyStart;
  let cashBalance = 0;

  const totals = {
    netCashflow: 0,
    totalSavingsInvest: 0,
    remaining: 0,
  };
  const totalsReal = {
    netCashflow: 0,
    totalSavingsInvest: 0,
    remaining: 0,
  };

  const timeline = [];
  const initialBucket = sumMapValues(bucketBalances);
  const initialInvest = sumMapValues(investBalances);
  const initialAssets = seedMoneyBalance + cashBalance + initialBucket + initialInvest;
  timeline.push({
    monthIndex: 0,
    bucketTotal: initialBucket,
    investTotal: initialInvest,
    totalAssets: initialAssets,
    seedMoney: seedMoneyBalance,
  });

  for (let month = 1; month <= months; month += 1) {
    const growthIndex = month - 1;
    const monthNodes = baseNodes.map((node) => {
      const factor = getAnnualRateFactor(node.annualGrowthRate, growthIndex);
      const monthlyAmount = (Number(node.monthlyAmount) || 0) * factor;
      let currentAmount = node.currentAmount ?? null;
      if (node.type === "Bucket") {
        currentAmount = bucketBalances.get(node.id) || 0;
      } else if (node.type === "Invest") {
        currentAmount = investBalances.get(node.id) || 0;
      }
      return {
        ...node,
        monthlyAmount,
        currentAmount,
      };
    });

    const nodeMap = buildNodeMap(monthNodes);
    const flows = computeFlows(monthNodes, links, nodeMap);
    const summary = computeSummary(monthNodes, flows, nodeMap);
    const monthBucketAdds = new Map();
    const monthInvestAdds = new Map();

    flows.forEach((flow) => {
      if (!flow.toId) {
        return;
      }
      const target = nodeMap.get(flow.toId);
      if (!target || !target.active) {
        return;
      }
      if (target.type === "Bucket") {
        monthBucketAdds.set(flow.toId, (monthBucketAdds.get(flow.toId) || 0) + flow.amount);
      }
      if (target.type === "Invest") {
        monthInvestAdds.set(flow.toId, (monthInvestAdds.get(flow.toId) || 0) + flow.amount);
      }
    });

    monthBucketAdds.forEach((value, id) => {
      bucketBalances.set(id, (bucketBalances.get(id) || 0) + value);
    });

    monthNodes.forEach((node) => {
      if (node.type !== "Invest") {
        return;
      }
      const added = monthInvestAdds.get(node.id) || 0;
      const baseBalance = (investBalances.get(node.id) || 0) + added;
      const monthlyFactor = getMonthlyRateFactor(Math.max(0, Number(node.investReturnRate) || 0));
      investBalances.set(node.id, baseBalance * monthlyFactor);
    });

    seedMoneyBalance *= seedMonthlyFactor;
    cashBalance += summary.remaining;

    if (assetMonthlyFactor !== 1) {
      bucketBalances.forEach((value, id) => {
        bucketBalances.set(id, value * assetMonthlyFactor);
      });
      investBalances.forEach((value, id) => {
        investBalances.set(id, value * assetMonthlyFactor);
      });
      seedMoneyBalance *= assetMonthlyFactor;
      cashBalance *= assetMonthlyFactor;
    }

    totals.netCashflow += summary.netCashflow;
    totals.totalSavingsInvest += summary.totalSavingsInvest;
    totals.remaining += summary.remaining;

    const inflationFactor = getInflationFactor(settings.inflationRate, month);
    totalsReal.netCashflow += summary.netCashflow / inflationFactor;
    totalsReal.totalSavingsInvest += summary.totalSavingsInvest / inflationFactor;
    totalsReal.remaining += summary.remaining / inflationFactor;

    const bucketTotal = sumMapValues(bucketBalances);
    const investTotal = sumMapValues(investBalances);
    const totalAssets = bucketTotal + investTotal + cashBalance + seedMoneyBalance;
    timeline.push({
      monthIndex: month,
      bucketTotal,
      investTotal,
      totalAssets,
      seedMoney: seedMoneyBalance,
    });
  }

  const finalAssets = timeline[timeline.length - 1]?.totalAssets || initialAssets;
  const inflationFactorEnd = getInflationFactor(settings.inflationRate, months);

  return {
    months,
    timeline,
    totals: {
      seedMoneyStart,
      seedMoneyEnd: seedMoneyBalance,
      seedMoneyEndReal: seedMoneyBalance / inflationFactorEnd,
      netCashflow: totals.netCashflow,
      netCashflowReal: totalsReal.netCashflow,
      totalSavingsInvest: totals.totalSavingsInvest,
      totalSavingsInvestReal: totalsReal.totalSavingsInvest,
      remaining: totals.remaining,
      remainingReal: totalsReal.remaining,
      totalAssets: finalAssets,
      totalAssetsReal: finalAssets / inflationFactorEnd,
      bucketTotal: sumMapValues(bucketBalances),
      investTotal: sumMapValues(investBalances),
      cashBalance,
    },
  };
}

function buildSteadyScenario(nodes, settings) {
  const inflationRate = Number(settings.inflationRate) || 0;
  const steadySettings = {
    ...settings,
    seedMoneyGrowthRate: inflationRate,
    seedMoneyReturnRate: 0,
  };
  const steadyNodes = nodes.map((node) => {
    if (node.type === "Invest") {
      return { ...node, investReturnRate: 0 };
    }
    return node;
  });
  return {
    steadySettings,
    steadyNodes,
  };
}

function computeProjectionTotals(
  nodes,
  links,
  years,
  seedMoney = 0,
  seedMoneyGrowthRate = 0,
  seedMoneyReturnRate = 0
) {
  const totals = {
    netCashflow: 0,
    totalSavingsInvest: 0,
    remaining: 0,
    totalAssets: 0,
    seedMoney,
    seedMoneyFuture: seedMoney,
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

  const growthRate = Math.max(0, seedMoneyGrowthRate) / 100;
  const returnRate = Math.max(0, seedMoneyReturnRate) / 100;
  const seedFactor = Math.pow((1 + growthRate) * (1 + returnRate), horizon);
  totals.seedMoneyFuture = seedMoney * seedFactor;
  totals.totalAssets = totals.totalSavingsInvest + totals.remaining + totals.seedMoneyFuture;
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
    return "목표 채우기";
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

function formatKoreanCompact(value) {
  const numeric = Number(value) || 0;
  const sign = numeric < 0 ? "-" : "";
  const totalMan = Math.round(Math.abs(numeric) / 10000);
  const eok = Math.floor(totalMan / 10000);
  const man = totalMan % 10000;
  if (eok > 0) {
    if (man === 0) {
      return `${sign}${eok}억`;
    }
    return `${sign}${eok}억 ${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}${man.toLocaleString("ko-KR")}만`;
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

function addMonths(baseMonth, offset) {
  if (!baseMonth) {
    return baseMonth;
  }
  const [yearText, monthText] = baseMonth.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return baseMonth;
  }
  const date = new Date(year, monthIndex + offset, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
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
  if (dom.seedMoney) {
    dom.seedMoney.value = formatManAmount(state.settings.seedMoney);
  }
  if (dom.seedMoneyGrowthRate) {
    dom.seedMoneyGrowthRate.value = state.settings.seedMoneyGrowthRate;
  }
  if (dom.seedMoneyReturnRate) {
    dom.seedMoneyReturnRate.value = state.settings.seedMoneyReturnRate;
  }
  if (dom.flowTypeFilter) {
    dom.flowTypeFilter.value = state.settings.flowTypeFilter;
  }
  if (dom.flowCurrencyFilter) {
    dom.flowCurrencyFilter.value = state.settings.flowCurrencyFilter;
  }
  if (dom.flowActiveOnly) {
    dom.flowActiveOnly.checked = state.settings.flowActiveOnly;
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
