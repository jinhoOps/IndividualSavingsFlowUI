export const PRESET_SALARIES = [
  { label: "3,000만 원", value: 30000000, monthlyIncome: 2250000 },
  { label: "4,000만 원", value: 40000000, monthlyIncome: 2950000 },
  { label: "5,000만 원", value: 50000000, monthlyIncome: 3550000 },
  { label: "6,000만 원", value: 60000000, monthlyIncome: 4200000 },
  { label: "7,000만 원", value: 70000000, monthlyIncome: 4850000 },
  { label: "8,000만 원", value: 80000000, monthlyIncome: 5400000 },
  { label: "9,000만 원", value: 90000000, monthlyIncome: 6000000 },
  { label: "10,000만 원", value: 100000000, monthlyIncome: 6550000 },
];

export const PRESET_STYLES = {
  stable: {
    label: "안정",
    summary: "저축 비중을 높여 현금 안정성을 먼저 확보합니다.",
    percentages: { expense: 40, savings: 50, invest: 10 },
  },
  balanced: {
    label: "균형",
    summary: "생활비를 유지하면서 저축과 투자를 균형 있게 나눕니다.",
    percentages: { expense: 40, savings: 35, invest: 25 },
  },
  growth: {
    label: "성장",
    summary: "필수 저축을 남기고 장기 투자 비중을 높입니다.",
    percentages: { expense: 38, savings: 12, invest: 50 },
  },
  beast: {
    label: "야수",
    summary: "생활비를 강하게 통제하고 투자 비중을 최대로 둡니다.",
    percentages: { expense: 30, savings: 7, invest: 63 },
  },
  custom: {
    label: "사용자 지정",
    summary: "직전 선택값을 복사해 직접 조정합니다.",
    percentages: { expense: 40, savings: 35, invest: 25 },
  },
};

const LEGACY_STYLE_KEYS = {
  conservative: "stable",
  neutral: "balanced",
  aggressive: "growth",
};

const EXPENSE_DETAIL = [
  { id: "fixed", name: "고정비", weight: 0.42, group: "고정비", accountId: "acc-living" },
  { id: "variable", name: "변동비", weight: 0.32, group: "변동비", accountId: "acc-living" },
  { id: "joy", name: "행복비", weight: 0.18, group: "행복비", accountId: "acc-living" },
  { id: "events", name: "경조사비", weight: 0.08, group: "경조사비", accountId: "acc-living" },
];

const SAVINGS_DETAIL = [
  { id: "reserve", name: "비상금/목표저축", weight: 1, group: "저축", annualRate: 3.0, accountId: "acc-salary" },
];

const INVEST_DETAIL = [
  { id: "core-portfolio", name: "장기 투자", weight: 1, group: "투자", accountId: "acc-stock" },
];

const ROUNDING_UNIT_WON = 10000;

function resolvePresetKey(styleKey) {
  const key = String(styleKey || "balanced").trim();
  return PRESET_STYLES[key] ? key : (LEGACY_STYLE_KEYS[key] || "balanced");
}

function sanitizePercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function roundToUnit(value, unit = ROUNDING_UNIT_WON) {
  return Math.max(0, Math.round(Number(value || 0) / unit) * unit);
}

function getStartingCapitalMultipliers(styleKey) {
  const key = resolvePresetKey(styleKey);
  if (key === "growth" || key === "beast") {
    return { cash: 0.02, savings: 0.2, invest: 0.8, debt: 0.5 };
  }
  return { cash: 0.02, savings: 0.8, invest: 0.2, debt: 0.5 };
}

function createAllocations(monthlyIncomeWon, amounts) {
  const living = Math.max(0, Number(amounts.expense || 0));
  const invest = Math.max(0, Number(amounts.invest || 0));
  const salary = Math.max(0, monthlyIncomeWon - living - invest);
  const allocations = [];
  if (salary > 0) allocations.push({ accountId: "acc-salary", amount: salary });
  if (living > 0) allocations.push({ accountId: "acc-living", amount: living });
  if (invest > 0) allocations.push({ accountId: "acc-stock", amount: invest });
  return allocations.length > 0 ? allocations : [{ accountId: "acc-salary", amount: monthlyIncomeWon }];
}

function distributeCategoryAmount({
  totalAmount,
  totalOriginalPercent,
  totalNormalizedPercent,
  details,
  prefix,
  correctionMode,
}) {
  const safeTotal = Math.max(0, Number(totalAmount || 0));
  let remaining = safeTotal;

  return details.map((detail, index) => {
    const isLast = index === details.length - 1;
    const rawAmount = safeTotal * detail.weight;
    const amount = isLast
      ? remaining
      : correctionMode === "percentage"
        ? Math.round(rawAmount)
        : roundToUnit(rawAmount);
    remaining = Math.max(0, remaining - amount);
    const originalPercent = Math.round(totalOriginalPercent * detail.weight * 100) / 100;
    const normalizedPercent = Math.round(totalNormalizedPercent * detail.weight * 100) / 100;

    return {
      id: `preset-${prefix}-${detail.id}`,
      name: detail.name,
      group: detail.group,
      accountId: detail.accountId,
      amount,
      originalPercent,
      normalizedPercent,
      rawAmount: Math.round(rawAmount),
      correctionDelta: amount - Math.round(rawAmount),
      ...(detail.annualRate ? { annualRate: detail.annualRate } : {}),
    };
  });
}

export function normalizePresetPercentages(percentages = PRESET_STYLES.balanced.percentages) {
  const original = {
    expense: sanitizePercent(percentages.expense),
    savings: sanitizePercent(percentages.savings),
    invest: sanitizePercent(percentages.invest),
  };
  const total = original.expense + original.savings + original.invest;
  if (total <= 0) {
    return {
      original,
      normalized: { ...PRESET_STYLES.balanced.percentages },
      originalTotal: 0,
      normalizedTotal: 100,
    };
  }

  const normalized = {
    expense: Math.round((original.expense / total) * 10000) / 100,
    savings: Math.round((original.savings / total) * 10000) / 100,
    invest: 0,
  };
  normalized.invest = Math.round((100 - normalized.expense - normalized.savings) * 100) / 100;

  return {
    original,
    normalized,
    originalTotal: Math.round(total * 100) / 100,
    normalizedTotal: Math.round((normalized.expense + normalized.savings + normalized.invest) * 100) / 100,
  };
}

export function buildPresetPreview({
  monthlyIncomeWon,
  presetKey = "balanced",
  percentages,
  correctionMode = "amount",
} = {}) {
  const key = resolvePresetKey(presetKey);
  const preset = PRESET_STYLES[key];
  const safeIncome = Math.max(0, Math.round(Number(monthlyIncomeWon || 0)));
  const normalized = normalizePresetPercentages(percentages || preset.percentages);
  const mode = correctionMode === "percentage" ? "percentage" : "amount";
  const amountFor = (percent) => {
    const raw = safeIncome * (percent / 100);
    return mode === "percentage" ? Math.round(raw) : roundToUnit(raw);
  };
  const expenseAmount = amountFor(normalized.normalized.expense);
  const savingsAmount = amountFor(normalized.normalized.savings);
  const investAmount = Math.max(0, safeIncome - expenseAmount - savingsAmount);

  const expenseItems = distributeCategoryAmount({
    totalAmount: expenseAmount,
    totalOriginalPercent: normalized.original.expense,
    totalNormalizedPercent: normalized.normalized.expense,
    details: EXPENSE_DETAIL,
    prefix: "expense",
    correctionMode: mode,
  });
  const savingsItems = distributeCategoryAmount({
    totalAmount: savingsAmount,
    totalOriginalPercent: normalized.original.savings,
    totalNormalizedPercent: normalized.normalized.savings,
    details: SAVINGS_DETAIL,
    prefix: "savings",
    correctionMode: mode,
  });
  const investItems = distributeCategoryAmount({
    totalAmount: investAmount,
    totalOriginalPercent: normalized.original.invest,
    totalNormalizedPercent: normalized.normalized.invest,
    details: INVEST_DETAIL,
    prefix: "invest",
    correctionMode: mode,
  });

  return {
    presetKey: key,
    presetLabel: preset.label,
    correctionMode: mode,
    percentages: normalized,
    totals: {
      monthlyIncomeWon: safeIncome,
      originalPercentTotal: normalized.originalTotal,
      normalizedPercentTotal: normalized.normalizedTotal,
      expenseAmount,
      savingsAmount,
      investAmount,
      correctionDelta: expenseAmount + savingsAmount + investAmount - safeIncome,
    },
    expenseItems,
    savingsItems,
    investItems,
  };
}

export function applyPresetPreview(preview) {
  const safePreview = preview && typeof preview === "object" ? preview : buildPresetPreview();
  const income = Math.max(0, Number(safePreview.totals?.monthlyIncomeWon || 0));
  const expenseAmount = Math.max(0, Number(safePreview.totals?.expenseAmount || 0));
  const savingsAmount = Math.max(0, Number(safePreview.totals?.savingsAmount || 0));
  const investAmount = Math.max(0, Number(safePreview.totals?.investAmount || 0));

  return {
    modelVersion: 10,
    incomes: [{
      id: "income-preset",
      name: "급여",
      amount: income,
      accountId: "acc-salary",
      allocations: createAllocations(income, {
        expense: expenseAmount,
        savings: savingsAmount,
        invest: investAmount,
      }),
    }],
    accounts: [
      { id: "acc-salary", name: "급여계좌" },
      { id: "acc-living", name: "생활비계좌" },
      { id: "acc-stock", name: "투자계좌" },
      { id: "acc-cma", name: "CMA비상금계좌(RP)" },
    ],
    splitIncomeAccounts: true,
    transfers: [],
    monthlyExpense: expenseAmount,
    monthlySavings: savingsAmount,
    monthlyInvest: investAmount,
    expenseItems: (safePreview.expenseItems || []).map(({ rawAmount, originalPercent, normalizedPercent, correctionDelta, ...item }) => item),
    savingsItems: (safePreview.savingsItems || []).map(({ rawAmount, originalPercent, normalizedPercent, correctionDelta, ...item }) => item),
    investItems: (safePreview.investItems || []).map(({ rawAmount, originalPercent, normalizedPercent, correctionDelta, ...item }) => item),
    monthlyDebtPayment: 0,
    startCash: 0,
    startSavings: 0,
    startInvest: 0,
    startDebt: 0,
    annualIncomeGrowth: 4.0,
    annualExpenseGrowth: 2.5,
    annualSavingsYield: 3.0,
    annualInvestReturn: 9.5,
    annualDebtInterest: 5.2,
    horizonYears: 5,
    presetPreviewMeta: {
      presetKey: safePreview.presetKey,
      presetLabel: safePreview.presetLabel,
      correctionMode: safePreview.correctionMode,
      percentages: safePreview.percentages,
      totals: safePreview.totals,
    },
  };
}

export function applyPreset(salaryValue, styleKey) {
  const salary = PRESET_SALARIES.find((candidate) => candidate.value === salaryValue);
  if (!salary) return null;
  const presetInputs = applyPresetByMonthlyIncome(salary.monthlyIncome, styleKey);
  const startingCapital = getStartingCapitalMultipliers(styleKey);
  return {
    ...presetInputs,
    startCash: Math.round(salary.value * startingCapital.cash),
    startDebt: Math.round(salary.value * startingCapital.debt),
    startSavings: Math.round(salary.value * startingCapital.savings),
    startInvest: Math.round(salary.value * startingCapital.invest),
  };
}

export function calculateMonthlyIncomeFromAnnualSalary(salaryWon) {
  const salaryMan = Number(salaryWon || 0) / 10000;
  const table = [
    { salary: 0, monthly: 0 },
    { salary: 3000, monthly: 2250000 },
    { salary: 4000, monthly: 2950000 },
    { salary: 5000, monthly: 3550000 },
    { salary: 6000, monthly: 4200000 },
    { salary: 7000, monthly: 4850000 },
    { salary: 8000, monthly: 5400000 },
    { salary: 9000, monthly: 6000000 },
    { salary: 10000, monthly: 6550000 },
  ];

  if (salaryMan <= 0) return 0;
  if (salaryMan >= 10000) {
    return Math.round(6550000 * (salaryMan / 10000));
  }

  for (let i = 0; i < table.length - 1; i += 1) {
    const p1 = table[i];
    const p2 = table[i + 1];
    if (salaryMan >= p1.salary && salaryMan <= p2.salary) {
      const ratio = (salaryMan - p1.salary) / (p2.salary - p1.salary);
      return Math.round(p1.monthly + ratio * (p2.monthly - p1.monthly));
    }
  }
  return 0;
}

export function calculateAnnualSalaryFromMonthlyIncome(monthlyWon) {
  const table = [
    { salary: 0, monthly: 0 },
    { salary: 3000, monthly: 2250000 },
    { salary: 4000, monthly: 2950000 },
    { salary: 5000, monthly: 3550000 },
    { salary: 6000, monthly: 4200000 },
    { salary: 7000, monthly: 4850000 },
    { salary: 8000, monthly: 5400000 },
    { salary: 9000, monthly: 6000000 },
    { salary: 10000, monthly: 6550000 },
  ];

  if (monthlyWon <= 0) return 0;
  if (monthlyWon >= 6550000) {
    return Math.round(100000000 * (monthlyWon / 6550000));
  }

  for (let i = 0; i < table.length - 1; i += 1) {
    const p1 = table[i];
    const p2 = table[i + 1];
    if (monthlyWon >= p1.monthly && monthlyWon <= p2.monthly) {
      const ratio = (monthlyWon - p1.monthly) / (p2.monthly - p1.monthly);
      const salaryMan = p1.salary + ratio * (p2.salary - p1.salary);
      return Math.round(salaryMan * 10000);
    }
  }
  return 0;
}

export function applyPresetByMonthlyIncome(monthlyIncomeWon, styleKey) {
  const key = resolvePresetKey(styleKey);
  const preview = buildPresetPreview({
    monthlyIncomeWon,
    presetKey: key,
    percentages: PRESET_STYLES[key].percentages,
  });
  return applyPresetPreview(preview);
}

export function applyPresetBySalary(salaryWon, styleKey) {
  const validSalaryWon = Math.max(0, Math.min(99000000, Number(salaryWon) || 0));
  const monthlyIncome = calculateMonthlyIncomeFromAnnualSalary(validSalaryWon);
  const presetInputs = applyPresetByMonthlyIncome(monthlyIncome, styleKey);
  const startingCapital = getStartingCapitalMultipliers(styleKey);
  return {
    ...presetInputs,
    startCash: Math.round(validSalaryWon * startingCapital.cash),
    startDebt: Math.round(validSalaryWon * startingCapital.debt),
    startSavings: Math.round(validSalaryWon * startingCapital.savings),
    startInvest: Math.round(validSalaryWon * startingCapital.invest),
  };
}
