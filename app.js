const MONEY_UNIT = 10000;
const STORAGE_KEY = "isf-rebuild-v1";
const MAX_INCOME_ITEMS = 12;

const DEFAULT_EXPENSE_ITEMS = [
  { id: "rent", name: "주거비(월세)", amount: 70 },
  { id: "maintenance", name: "관리비", amount: 12 },
  { id: "telecom", name: "통신비", amount: 8 },
  { id: "transport", name: "교통비", amount: 10 },
  { id: "food", name: "식비", amount: 35 },
  { id: "etc", name: "기타생활비", amount: 45 },
];

const DEFAULT_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 290 },
  ],
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  monthlyExpense: 180,
  monthlySavings: 80,
  monthlyInvest: 90,
  monthlyDebtPayment: 30,
  startCash: 500,
  startSavings: 300,
  startInvest: 1200,
  startDebt: 1500,
  annualIncomeGrowth: 3.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 2.0,
  annualInvestReturn: 6.5,
  annualDebtInterest: 4.2,
  horizonYears: 10,
};

const SAMPLE_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 460 },
    { id: "income-side", name: "부수입", amount: 60 },
  ],
  expenseItems: [
    { id: "rent", name: "주거비(월세)", amount: 80 },
    { id: "maintenance", name: "관리비", amount: 15 },
    { id: "telecom", name: "통신비", amount: 10 },
    { id: "transport", name: "교통비", amount: 15 },
    { id: "food", name: "식비", amount: 60 },
    { id: "etc", name: "기타생활비", amount: 30 },
  ],
  monthlyExpense: 210,
  monthlySavings: 110,
  monthlyInvest: 120,
  monthlyDebtPayment: 35,
  startCash: 600,
  startSavings: 450,
  startInvest: 1500,
  startDebt: 1200,
  annualIncomeGrowth: 3.5,
  annualExpenseGrowth: 2.8,
  annualSavingsYield: 2.2,
  annualInvestReturn: 7.0,
  annualDebtInterest: 4.0,
  horizonYears: 12,
};

const FORM_FIELD_KEYS = [
  "monthlySavings",
  "monthlyInvest",
  "monthlyDebtPayment",
  "startCash",
  "startSavings",
  "startInvest",
  "startDebt",
  "annualIncomeGrowth",
  "annualExpenseGrowth",
  "annualSavingsYield",
  "annualInvestReturn",
  "annualDebtInterest",
  "horizonYears",
];

const TONE_COLORS = {
  income: "#1e8b7c",
  expense: "#c9573c",
  savings: "#3175b6",
  invest: "#5d4fb3",
  debt: "#8c3d65",
  surplus: "#2f9e44",
  deficit: "#d6336c",
};

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const dom = {
  inputsForm: document.getElementById("inputsForm"),
  loadSample: document.getElementById("loadSample"),
  resetInputs: document.getElementById("resetInputs"),
  addIncomeItem: document.getElementById("addIncomeItem"),
  incomeList: document.getElementById("incomeList"),
  incomeTotalHint: document.getElementById("incomeTotalHint"),
  expenseList: document.getElementById("expenseList"),
  expenseTotalHint: document.getElementById("expenseTotalHint"),
  jumpToInputs: document.getElementById("jumpToInputs"),
  summaryCards: document.getElementById("summaryCards"),
  cardMeta: document.getElementById("cardMeta"),
  sankeySvg: document.getElementById("sankeySvg"),
  sankeyWrap: document.getElementById("sankeyWrap"),
  sankeyMeta: document.getElementById("sankeyMeta"),
  sankeyLegend: document.getElementById("sankeyLegend"),
  sankeyEmpty: document.getElementById("sankeyEmpty"),
  sankeyTooltip: document.getElementById("sankeyTooltip"),
  projectionTableBody: document.querySelector("#projectionTable tbody"),
  projectionMeta: document.getElementById("projectionMeta"),
};

const state = {
  inputs: sanitizeInputs({ ...DEFAULT_INPUTS, ...loadPersistedInputs() }),
  snapshot: null,
};

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  applyInputsToForm(state.inputs);
  renderIncomeList(state.inputs.incomes);
  renderExpenseList(state.inputs.expenseItems);
  renderAll();
});

function bindControls() {
  if (dom.inputsForm) {
    const handleInput = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) {
        return;
      }
      state.inputs = sanitizeInputs(readInputsFromForm());
      persistInputs(state.inputs);
      renderAll();
    };

    dom.inputsForm.addEventListener("input", handleInput);
    dom.inputsForm.addEventListener("change", handleInput);
  }

  if (dom.addIncomeItem) {
    dom.addIncomeItem.addEventListener("click", () => {
      if (state.inputs.incomes.length >= MAX_INCOME_ITEMS) {
        return;
      }
      state.inputs.incomes.push(createIncomeItem({ name: `수입 ${state.inputs.incomes.length + 1}` }));
      persistInputs(state.inputs);
      renderIncomeList(state.inputs.incomes);
      renderAll();
    });
  }

  if (dom.incomeList) {
    dom.incomeList.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const itemId = target.dataset.incomeId;
      const field = target.dataset.field;
      if (!itemId || !field) {
        return;
      }

      const income = state.inputs.incomes.find((item) => item.id === itemId);
      if (!income) {
        return;
      }

      if (field === "name") {
        income.name = target.value;
      }

      if (field === "amount") {
        income.amount = sanitizeMoney(target.value, 0);
      }

      persistInputs(state.inputs);
      renderAll();
    });

    dom.incomeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const removeId = target.dataset.removeIncome;
      if (!removeId) {
        return;
      }

      if (state.inputs.incomes.length <= 1) {
        return;
      }

      state.inputs.incomes = state.inputs.incomes.filter((item) => item.id !== removeId);
      state.inputs = sanitizeInputs(state.inputs);
      persistInputs(state.inputs);
      renderIncomeList(state.inputs.incomes);
      renderAll();
    });
  }

  if (dom.expenseList) {
    dom.expenseList.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const itemId = target.dataset.expenseId;
      if (!itemId) {
        return;
      }

      const expense = state.inputs.expenseItems.find((item) => item.id === itemId);
      if (!expense) {
        return;
      }

      expense.amount = sanitizeMoney(target.value, 0);
      state.inputs.monthlyExpense = getMonthlyExpenseTotalMan(state.inputs.expenseItems);
      syncMonthlyExpenseField(state.inputs.monthlyExpense);
      persistInputs(state.inputs);
      renderAll();
    });
  }

  if (dom.loadSample) {
    dom.loadSample.addEventListener("click", () => {
      state.inputs = sanitizeInputs({ ...SAMPLE_INPUTS });
      applyInputsToForm(state.inputs);
      renderIncomeList(state.inputs.incomes);
      renderExpenseList(state.inputs.expenseItems);
      persistInputs(state.inputs);
      renderAll();
    });
  }

  if (dom.resetInputs) {
    dom.resetInputs.addEventListener("click", () => {
      state.inputs = sanitizeInputs({ ...DEFAULT_INPUTS });
      applyInputsToForm(state.inputs);
      renderIncomeList(state.inputs.incomes);
      renderExpenseList(state.inputs.expenseItems);
      persistInputs(state.inputs);
      renderAll();
    });
  }

  if (dom.jumpToInputs) {
    dom.jumpToInputs.addEventListener("click", () => {
      const inputSectionTitle = document.getElementById("inputsTitle");
      if (inputSectionTitle) {
        inputSectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  window.addEventListener("resize", debounce(() => {
    if (state.snapshot) {
      renderSankey(state.snapshot);
    }
  }, 120));
}

function renderAll() {
  state.inputs.monthlyExpense = getMonthlyExpenseTotalMan(state.inputs.expenseItems);
  syncMonthlyExpenseField(state.inputs.monthlyExpense);

  const snapshot = buildMonthlySnapshot(state.inputs);
  const projection = simulateProjection(state.inputs);
  const cards = buildSummaryCards(snapshot, projection, state.inputs.horizonYears);

  state.snapshot = snapshot;

  renderCards(cards, state.inputs.horizonYears);
  renderSankey(snapshot);
  renderProjectionTable(projection, state.inputs.horizonYears);
  renderIncomeTotalHint(snapshot.income, state.inputs.incomes.length);
  renderExpenseTotalHint(toWon(state.inputs.monthlyExpense), state.inputs.expenseItems.length);
}

function buildMonthlySnapshot(inputs) {
  const income = toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const expense = toWon(inputs.monthlyExpense);
  const savings = toWon(inputs.monthlySavings);
  const invest = toWon(inputs.monthlyInvest);
  const debtPayment = toWon(inputs.monthlyDebtPayment);

  const requiredOutflow = expense + savings + invest + debtPayment;
  const netCashflow = income - requiredOutflow;
  const surplus = Math.max(0, netCashflow);
  const deficit = Math.max(0, -netCashflow);

  const targets = [
    { id: "expense", label: "생활비", tone: "expense", value: expense },
    { id: "savings", label: "저축", tone: "savings", value: savings },
    { id: "invest", label: "투자", tone: "invest", value: invest },
    { id: "debt", label: "부채상환", tone: "debt", value: debtPayment },
  ].filter((item) => item.value > 0);

  if (surplus > 0) {
    targets.push({ id: "surplus", label: "잉여현금", tone: "surplus", value: surplus });
  }

  return {
    income,
    expense,
    savings,
    invest,
    debtPayment,
    requiredOutflow,
    netCashflow,
    surplus,
    deficit,
    targets,
  };
}

function simulateProjection(inputs) {
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12;
  const monthlyIncomeBase = toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyExpenseBase = toWon(inputs.monthlyExpense);
  const monthlySavings = toWon(inputs.monthlySavings);
  const monthlyInvest = toWon(inputs.monthlyInvest);
  const monthlyDebtPayment = toWon(inputs.monthlyDebtPayment);

  const incomeFactor = toMonthlyFactor(inputs.annualIncomeGrowth);
  const expenseFactor = toMonthlyFactor(inputs.annualExpenseGrowth);
  const savingsFactor = toMonthlyFactor(inputs.annualSavingsYield);
  const investFactor = toMonthlyFactor(inputs.annualInvestReturn);
  const debtFactor = toMonthlyFactor(inputs.annualDebtInterest);

  let cash = toWon(inputs.startCash);
  let savings = toWon(inputs.startSavings);
  let invest = toWon(inputs.startInvest);
  let debt = toWon(inputs.startDebt);

  const records = [
    buildProjectionRecord({
      monthIndex: 0,
      monthlyIncome: monthlyIncomeBase,
      monthlyExpense: monthlyExpenseBase,
      debtInterest: 0,
      actualDebtPayment: 0,
      newBorrowing: 0,
      cash,
      savings,
      invest,
      debt,
    }),
  ];

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex += 1) {
    const monthlyIncome = monthlyIncomeBase * Math.pow(incomeFactor, monthIndex - 1);
    const monthlyExpense = monthlyExpenseBase * Math.pow(expenseFactor, monthIndex - 1);
    const debtInterest = debt * (debtFactor - 1);
    let debtBalance = debt + debtInterest;
    let nextCash = cash + monthlyIncome;
    nextCash -= monthlyExpense;
    nextCash -= monthlySavings;
    nextCash -= monthlyInvest;

    const payableCash = Math.max(0, nextCash);
    const actualDebtPayment = Math.min(debtBalance, monthlyDebtPayment, payableCash);
    nextCash -= actualDebtPayment;
    debtBalance -= actualDebtPayment;

    savings += monthlySavings;
    invest += monthlyInvest;

    let newBorrowing = 0;
    if (nextCash < 0) {
      newBorrowing = -nextCash;
      debtBalance += newBorrowing;
      nextCash = 0;
    }

    cash = nextCash;
    savings *= savingsFactor;
    invest *= investFactor;
    debt = debtBalance;

    records.push(
      buildProjectionRecord({
        monthIndex,
        monthlyIncome,
        monthlyExpense,
        debtInterest,
        actualDebtPayment,
        newBorrowing,
        cash,
        savings,
        invest,
        debt,
      }),
    );
  }

  return records;
}

function buildProjectionRecord({
  monthIndex,
  monthlyIncome,
  monthlyExpense,
  debtInterest = 0,
  actualDebtPayment = 0,
  newBorrowing = 0,
  cash,
  savings,
  invest,
  debt,
}) {
  return {
    monthIndex,
    monthlyIncome,
    monthlyExpense,
    debtInterest,
    actualDebtPayment,
    newBorrowing,
    cash,
    savings,
    invest,
    debt,
    netAsset: cash + savings + invest - debt,
  };
}

function buildSummaryCards(snapshot, projection, horizonYears) {
  const current = projection[0];
  const last = projection[projection.length - 1];
  const debtProbe = projection[1] || current;
  const deltaNet = last.netAsset - current.netAsset;
  const futureAllocation = snapshot.savings + snapshot.invest;
  const savingsRate = snapshot.income > 0 ? futureAllocation / snapshot.income : 0;
  const debtFreeMonth = projection.find((row) => row.monthIndex > 0 && row.debt <= 1);

  let debtFreeText = "부채 없음";
  let debtSub = "";

  if (current.debt > 0) {
    if (debtFreeMonth) {
      debtFreeText = formatMonthSpan(debtFreeMonth.monthIndex);
      debtSub = `시점: ${debtFreeMonth.monthIndex}개월`; 
    } else {
      debtFreeText = `${horizonYears}년 내 미소진`;
      debtSub = `말 잔여부채 ${formatCurrency(last.debt)}`;
    }
  }

  return [
    {
      label: "월 수입",
      value: formatCurrency(snapshot.income),
      sub: `연 ${formatCurrency(snapshot.income * 12)}`,
      variant: "positive",
    },
    {
      label: "월 총 배분",
      value: formatCurrency(snapshot.requiredOutflow),
      sub: `생활비+저축+투자+부채상환`,
      variant: "",
    },
    {
      label: "월 순현금흐름",
      value: formatSignedCurrency(snapshot.netCashflow),
      sub: snapshot.netCashflow >= 0 ? "흑자" : "적자(부족분은 부채 전환)",
      variant: snapshot.netCashflow >= 0 ? "positive" : "negative",
    },
    {
      label: "당월 부채이자",
      value: formatCurrency(debtProbe.debtInterest),
      sub: debtProbe.monthIndex > 0 ? `${debtProbe.monthIndex}개월차 기준` : "현재 기준",
      variant: debtProbe.debtInterest > 0 ? "negative" : "positive",
    },
    {
      label: "당월 실제상환",
      value: formatCurrency(debtProbe.actualDebtPayment),
      sub: `설정 상환 ${formatCurrency(snapshot.debtPayment)}`,
      variant: debtProbe.actualDebtPayment > 0 ? "positive" : "",
    },
    {
      label: "당월 신규차입",
      value: formatCurrency(debtProbe.newBorrowing),
      sub: debtProbe.newBorrowing > 0 ? "현금 부족분 전환" : "신규 차입 없음",
      variant: debtProbe.newBorrowing > 0 ? "negative" : "positive",
    },
    {
      label: "현재 순자산",
      value: formatCurrency(current.netAsset),
      sub: `현금 ${formatCurrency(current.cash)} · 부채 ${formatCurrency(current.debt)}`,
      variant: current.netAsset >= 0 ? "positive" : "negative",
    },
    {
      label: `${horizonYears}년 후 순자산`,
      value: formatCurrency(last.netAsset),
      sub: `변화 ${formatSignedCurrency(deltaNet)}`,
      variant: deltaNet >= 0 ? "positive" : "negative",
    },
    {
      label: "미래자산 투입률",
      value: formatPercent(savingsRate * 100),
      sub: `월 저축+투자 ${formatCurrency(futureAllocation)}`,
      variant: "positive",
    },
    {
      label: "부채 소진 예상",
      value: debtFreeText,
      sub: debtSub || "초기 부채가 없습니다.",
      variant: debtFreeMonth || current.debt === 0 ? "positive" : "negative",
    },
  ];
}

function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) {
    return;
  }

  dom.summaryCards.innerHTML = "";
  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = `card ${card.variant || ""}`.trim();

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = card.label;

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = card.value;

    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = card.sub;

    item.append(label, value, sub);
    dom.summaryCards.appendChild(item);
  });

  if (dom.cardMeta) {
    dom.cardMeta.textContent = `동일 엔진 계산 · ${horizonYears}년 예측 포함 · 부채 세부지표 노출`;
  }
}

function buildSankeyData(snapshot) {
  const targets = snapshot.targets.filter((item) => item.value > 0);
  if (!targets.length) {
    return null;
  }

  const sources = [{ id: "income", label: "월 수입", tone: "income", value: snapshot.income }];
  const links = [];

  if (snapshot.deficit > 0) {
    sources.push({ id: "deficit", label: "부족자금", tone: "deficit", value: snapshot.deficit });

    const totalTarget = targets.reduce((sum, item) => sum + item.value, 0);
    const incomeCoverage = totalTarget > 0 ? Math.min(1, snapshot.income / totalTarget) : 0;

    targets.forEach((target) => {
      const incomeShare = target.value * incomeCoverage;
      const deficitShare = target.value - incomeShare;

      if (incomeShare > 0) {
        links.push({ source: "income", target: target.id, value: incomeShare, tone: target.tone });
      }
      if (deficitShare > 0) {
        links.push({ source: "deficit", target: target.id, value: deficitShare, tone: "deficit" });
      }
    });
  } else {
    targets.forEach((target) => {
      links.push({ source: "income", target: target.id, value: target.value, tone: target.tone });
    });
  }

  return { sources, targets, links };
}

function renderSankey(snapshot) {
  if (!dom.sankeySvg || !dom.sankeyWrap) {
    return;
  }

  hideSankeyTooltip();

  const data = buildSankeyData(snapshot);
  dom.sankeySvg.innerHTML = "";
  dom.sankeyLegend.innerHTML = "";

  if (!data || !data.links.length) {
    dom.sankeyEmpty.hidden = false;
    if (dom.sankeyMeta) {
      dom.sankeyMeta.textContent = "수입/배분 데이터가 없습니다.";
    }
    return;
  }

  dom.sankeyEmpty.hidden = true;

  if (dom.sankeyMeta) {
    dom.sankeyMeta.textContent = `수입 ${formatCurrency(snapshot.income)} · 배분 ${formatCurrency(snapshot.requiredOutflow)} · 순현금흐름 ${formatSignedCurrency(snapshot.netCashflow)}`;
  }

  const width = Math.max(680, dom.sankeyWrap.clientWidth - 20);
  const height = Math.max(300, data.targets.length * 56 + 60);
  const nodeWidth = 18;
  const sourceX = 120;
  const targetX = width - 180;
  const marginTop = 26;
  const marginBottom = 26;
  const targetGap = 14;

  dom.sankeySvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const totalFlow = data.targets.reduce((sum, target) => sum + target.value, 0);
  const availableHeight = height - marginTop - marginBottom - targetGap * Math.max(0, data.targets.length - 1);
  const scale = totalFlow > 0 ? availableHeight / totalFlow : 0;

  if (!Number.isFinite(scale) || scale <= 0) {
    dom.sankeyEmpty.hidden = false;
    return;
  }

  const positionedTargets = [];
  let currentTargetY = marginTop;
  data.targets.forEach((target) => {
    const h = target.value * scale;
    positionedTargets.push({ ...target, x: targetX, y: currentTargetY, h });
    currentTargetY += h + targetGap;
  });

  const sourceGap = 20;
  const sourceNodes = data.sources
    .filter((source) => source.value > 0)
    .map((source) => ({ ...source, x: sourceX, h: source.value * scale }));

  const sourceHeightTotal = sourceNodes.reduce((sum, source) => sum + source.h, 0)
    + sourceGap * Math.max(0, sourceNodes.length - 1);
  let currentSourceY = (height - sourceHeightTotal) / 2;

  sourceNodes.forEach((source) => {
    source.y = currentSourceY;
    currentSourceY += source.h + sourceGap;
  });

  const sourceMap = new Map(sourceNodes.map((node) => [node.id, node]));
  const targetMap = new Map(positionedTargets.map((node) => [node.id, node]));

  const sourceOrder = new Map(sourceNodes.map((node, index) => [node.id, index]));
  const targetOrder = new Map(positionedTargets.map((node, index) => [node.id, index]));

  const orderedLinks = [...data.links].sort((a, b) => {
    const byTarget = (targetOrder.get(a.target) || 0) - (targetOrder.get(b.target) || 0);
    if (byTarget !== 0) {
      return byTarget;
    }
    return (sourceOrder.get(a.source) || 0) - (sourceOrder.get(b.source) || 0);
  });

  const sourceOffsets = new Map(sourceNodes.map((node) => [node.id, 0]));
  const targetOffsets = new Map(positionedTargets.map((node) => [node.id, 0]));

  orderedLinks.forEach((link) => {
    const source = sourceMap.get(link.source);
    const target = targetMap.get(link.target);
    if (!source || !target) {
      return;
    }

    const thickness = link.value * scale;
    const sourceOffset = sourceOffsets.get(source.id) || 0;
    const targetOffset = targetOffsets.get(target.id) || 0;

    const y0 = source.y + sourceOffset;
    const y1 = y0 + thickness;
    const y2 = target.y + targetOffset;
    const y3 = y2 + thickness;

    sourceOffsets.set(source.id, sourceOffset + thickness);
    targetOffsets.set(target.id, targetOffset + thickness);

    const path = createSvgElement("path", {
      d: buildBandPath(source.x + nodeWidth, y0, y1, target.x, y2, y3),
      class: `sankey-path tone-${link.tone}`,
    });

    path.addEventListener("mousemove", (event) => {
      showSankeyTooltip(
        event,
        `${source.label} → ${target.label} · ${formatCurrency(link.value)}`,
      );
    });
    path.addEventListener("mouseleave", hideSankeyTooltip);

    dom.sankeySvg.appendChild(path);
  });

  sourceNodes.forEach((node) => drawNode(node, "source", nodeWidth));
  positionedTargets.forEach((node) => drawNode(node, "target", nodeWidth));

  renderSankeyLegend(data);
}

function drawNode(node, side, nodeWidth) {
  const rect = createSvgElement("rect", {
    x: node.x,
    y: node.y,
    width: nodeWidth,
    height: Math.max(1, node.h),
    class: `sankey-node tone-${node.tone}`,
  });
  dom.sankeySvg.appendChild(rect);

  const labelX = side === "source" ? node.x - 10 : node.x + nodeWidth + 10;
  const anchor = side === "source" ? "end" : "start";
  const centerY = node.y + node.h / 2;

  const label = createSvgElement("text", {
    x: labelX,
    y: centerY - 6,
    class: "sankey-label",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  label.textContent = node.label;

  const value = createSvgElement("text", {
    x: labelX,
    y: centerY + 10,
    class: "sankey-value",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  value.textContent = formatCurrency(node.value);

  dom.sankeySvg.appendChild(label);
  dom.sankeySvg.appendChild(value);
}

function renderSankeyLegend(data) {
  const items = [...data.targets];

  if (data.sources.some((source) => source.id === "deficit" && source.value > 0)) {
    items.push({
      id: "deficit",
      label: "부족자금",
      tone: "deficit",
      value: data.sources.find((source) => source.id === "deficit")?.value || 0,
    });
  }

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = TONE_COLORS[item.tone] || "#999";

    const label = document.createElement("span");
    label.textContent = `${item.label} ${formatCurrency(item.value)}`;

    chip.append(dot, label);
    dom.sankeyLegend.appendChild(chip);
  });
}

function renderProjectionTable(records, horizonYears) {
  if (!dom.projectionTableBody) {
    return;
  }

  const yearlyRows = records.filter((row) => row.monthIndex % 12 === 0);
  dom.projectionTableBody.innerHTML = "";

  yearlyRows.forEach((row) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.monthIndex === 0 ? "현재" : `${row.monthIndex / 12}년`}</td>
      <td>${formatCurrency(row.monthlyIncome)}</td>
      <td>${formatCurrency(row.monthlyExpense)}</td>
      <td>${formatCurrency(row.debtInterest)}</td>
      <td>${formatCurrency(row.actualDebtPayment)}</td>
      <td>${formatCurrency(row.newBorrowing)}</td>
      <td>${formatCurrency(row.cash)}</td>
      <td>${formatCurrency(row.savings)}</td>
      <td>${formatCurrency(row.invest)}</td>
      <td>${formatCurrency(row.debt)}</td>
      <td>${formatCurrency(row.netAsset)}</td>
    `;

    dom.projectionTableBody.appendChild(tr);
  });

  if (dom.projectionMeta) {
    dom.projectionMeta.textContent = `월 단위 ${records.length - 1}회 계산 결과를 연 단위 스냅샷으로 요약했습니다 (${horizonYears}년).`;
  }
}

function renderIncomeList(incomes) {
  if (!dom.incomeList) {
    return;
  }

  dom.incomeList.innerHTML = "";

  incomes.forEach((income, index) => {
    const row = document.createElement("div");
    row.className = "income-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "수입명";
    nameInput.value = income.name;
    nameInput.setAttribute("aria-label", `수입 항목 ${index + 1} 이름`);
    nameInput.dataset.incomeId = income.id;
    nameInput.dataset.field = "name";

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(income.amount);
    amountInput.setAttribute("aria-label", `수입 항목 ${index + 1} 금액`);
    amountInput.dataset.incomeId = income.id;
    amountInput.dataset.field = "amount";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost btn-sm income-remove";
    removeButton.textContent = "삭제";
    removeButton.dataset.removeIncome = income.id;
    removeButton.disabled = incomes.length <= 1;

    row.append(nameInput, amountInput, removeButton);
    dom.incomeList.appendChild(row);
  });

  if (dom.addIncomeItem) {
    dom.addIncomeItem.disabled = incomes.length >= MAX_INCOME_ITEMS;
  }
}

function renderIncomeTotalHint(monthlyIncomeWon, count) {
  if (!dom.incomeTotalHint) {
    return;
  }
  dom.incomeTotalHint.textContent = `현재 수입 항목 ${count}개 · 월 수입 합계 ${formatCurrency(monthlyIncomeWon)}`;
}

function renderExpenseList(expenseItems) {
  if (!dom.expenseList) {
    return;
  }

  dom.expenseList.innerHTML = "";

  expenseItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "expense-row";

    const name = document.createElement("span");
    name.className = "expense-name";
    name.textContent = item.name;

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    amountInput.dataset.expenseId = item.id;
    amountInput.dataset.index = String(index);

    row.append(name, amountInput);
    dom.expenseList.appendChild(row);
  });
}

function renderExpenseTotalHint(monthlyExpenseWon, count) {
  if (!dom.expenseTotalHint) {
    return;
  }
  dom.expenseTotalHint.textContent = `생활비 항목 ${count}개 · 월 생활비 합계 ${formatCurrency(monthlyExpenseWon)}`;
}

function syncMonthlyExpenseField(monthlyExpenseMan) {
  const field = dom.inputsForm?.elements?.monthlyExpense;
  if (field) {
    field.value = String(sanitizeMoney(monthlyExpenseMan, 0));
  }
}

function readInputsFromForm() {
  const raw = {
    incomes: state.inputs.incomes,
    expenseItems: state.inputs.expenseItems,
    monthlyExpense: state.inputs.monthlyExpense,
  };

  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    raw[key] = Number(field?.value);
  });

  return raw;
}

function applyInputsToForm(inputs) {
  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    if (field) {
      field.value = String(inputs[key]);
    }
  });
}

function sanitizeInputs(raw) {
  const monthlyIncomeFallback = sanitizeMoney(raw.monthlyIncome, getMonthlyIncomeTotalMan(DEFAULT_INPUTS.incomes));
  const monthlyExpenseFallback = sanitizeMoney(raw.monthlyExpense, getMonthlyExpenseTotalMan(DEFAULT_EXPENSE_ITEMS));
  const expenseItems = sanitizeExpenseItems(raw.expenseItems, monthlyExpenseFallback);

  return {
    incomes: sanitizeIncomeItems(raw.incomes, monthlyIncomeFallback),
    expenseItems,
    monthlyExpense: getMonthlyExpenseTotalMan(expenseItems),
    monthlySavings: sanitizeMoney(raw.monthlySavings, DEFAULT_INPUTS.monthlySavings),
    monthlyInvest: sanitizeMoney(raw.monthlyInvest, DEFAULT_INPUTS.monthlyInvest),
    monthlyDebtPayment: sanitizeMoney(raw.monthlyDebtPayment, DEFAULT_INPUTS.monthlyDebtPayment),
    startCash: sanitizeMoney(raw.startCash, DEFAULT_INPUTS.startCash),
    startSavings: sanitizeMoney(raw.startSavings, DEFAULT_INPUTS.startSavings),
    startInvest: sanitizeMoney(raw.startInvest, DEFAULT_INPUTS.startInvest),
    startDebt: sanitizeMoney(raw.startDebt, DEFAULT_INPUTS.startDebt),
    annualIncomeGrowth: sanitizeRate(raw.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: sanitizeRate(raw.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield: sanitizeRate(raw.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20),
    annualInvestReturn: sanitizeRate(raw.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: sanitizeRate(raw.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: sanitizeInteger(raw.horizonYears, DEFAULT_INPUTS.horizonYears, 1, 40),
  };
}

function sanitizeIncomeItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
  }

  const sanitized = items
    .map((item, index) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const safeName = normalizeIncomeName(safeItem.name, index);
      const safeAmount = sanitizeMoney(safeItem.amount, 0);
      const safeId = typeof safeItem.id === "string" && safeItem.id.trim()
        ? safeItem.id.trim()
        : createIncomeId();
      return {
        id: safeId,
        name: safeName,
        amount: safeAmount,
      };
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_INCOME_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
}

function normalizeIncomeName(name, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `수입 ${index + 1}`;
  }
  return text.slice(0, 24);
}

function createIncomeId() {
  return `income-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createIncomeItem({ id, name, amount } = {}) {
  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createIncomeId(),
    name: normalizeIncomeName(name, 0),
    amount: sanitizeMoney(amount, 0),
  };
}

function getMonthlyIncomeTotalMan(incomes) {
  if (!Array.isArray(incomes)) {
    return 0;
  }
  return incomes.reduce((sum, income) => sum + sanitizeMoney(income?.amount, 0), 0);
}

function sanitizeExpenseItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return scaleDefaultExpenseItemsToTotal(fallbackAmount);
  }

  const sourceById = new Map(
    items
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.id || "").trim(), item]),
  );

  const merged = DEFAULT_EXPENSE_ITEMS.map((template) => {
    const source = sourceById.get(template.id);
    return {
      id: template.id,
      name: template.name,
      amount: sanitizeMoney(source?.amount, template.amount),
    };
  });

  return merged;
}

function scaleDefaultExpenseItemsToTotal(totalAmount) {
  const safeTotal = sanitizeMoney(totalAmount, getMonthlyExpenseTotalMan(DEFAULT_EXPENSE_ITEMS));
  const baseTotal = getMonthlyExpenseTotalMan(DEFAULT_EXPENSE_ITEMS);

  if (baseTotal <= 0) {
    return DEFAULT_EXPENSE_ITEMS.map((item) => ({ ...item, amount: 0 }));
  }

  const factor = safeTotal / baseTotal;
  const scaled = DEFAULT_EXPENSE_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    amount: sanitizeMoney(item.amount * factor, 0),
  }));

  const currentTotal = getMonthlyExpenseTotalMan(scaled);
  const diff = safeTotal - currentTotal;
  const etcIndex = scaled.findIndex((item) => item.id === "etc");
  const targetIndex = etcIndex >= 0 ? etcIndex : scaled.length - 1;
  scaled[targetIndex].amount = Math.max(0, scaled[targetIndex].amount + diff);

  return scaled;
}

function getMonthlyExpenseTotalMan(expenseItems) {
  if (!Array.isArray(expenseItems)) {
    return 0;
  }
  return expenseItems.reduce((sum, item) => sum + sanitizeMoney(item?.amount, 0), 0);
}

function sanitizeMoney(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.round(number));
}

function sanitizeRate(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return roundTo(Math.min(Math.max(number, 0), max), 1);
}

function sanitizeInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function toWon(manValue) {
  return Number(manValue) * MONEY_UNIT;
}

function toMonthlyFactor(annualPercent) {
  const annualRate = Number(annualPercent) / 100;
  return Math.pow(1 + annualRate, 1 / 12);
}

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(Math.round(safeValue));
}

function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) {
    return formatCurrency(0);
  }
  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }
  return `+${formatCurrency(value)}`;
}

function formatPercent(percent) {
  const safe = Number.isFinite(percent) ? percent : 0;
  return `${roundTo(safe, 1).toLocaleString("ko-KR")} %`;
}

function formatMonthSpan(months) {
  const year = Math.floor(months / 12);
  const month = months % 12;

  if (year <= 0) {
    return `${month}개월`;
  }
  if (month === 0) {
    return `${year}년`;
  }
  return `${year}년 ${month}개월`;
}

function buildBandPath(x0, y0, y1, x1, y2, y3) {
  const curve = Math.max(40, (x1 - x0) * 0.42);
  return [
    `M ${x0} ${y0}`,
    `C ${x0 + curve} ${y0}, ${x1 - curve} ${y2}, ${x1} ${y2}`,
    `L ${x1} ${y3}`,
    `C ${x1 - curve} ${y3}, ${x0 + curve} ${y1}, ${x0} ${y1}`,
    "Z",
  ].join(" ");
}

function createSvgElement(tagName, attrs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });
  return element;
}

function showSankeyTooltip(event, text) {
  if (!dom.sankeyTooltip || !dom.sankeyWrap) {
    return;
  }

  const wrapRect = dom.sankeyWrap.getBoundingClientRect();
  const tooltip = dom.sankeyTooltip;

  tooltip.hidden = false;
  tooltip.textContent = text;

  const maxX = Math.max(20, wrapRect.width - 250);
  const maxY = Math.max(20, wrapRect.height - 70);
  const x = Math.min(maxX, event.clientX - wrapRect.left + 12);
  const y = Math.min(maxY, event.clientY - wrapRect.top + 12);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideSankeyTooltip() {
  if (dom.sankeyTooltip) {
    dom.sankeyTooltip.hidden = true;
  }
}

function persistInputs(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (_error) {
    // Ignore storage errors to keep UI functional.
  }
}

function loadPersistedInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function roundTo(value, digit) {
  const factor = 10 ** digit;
  return Math.round(value * factor) / factor;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
