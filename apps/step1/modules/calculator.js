import {
  DEFAULT_INPUTS,
  DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS,
  DEFAULT_INVEST_ITEMS
} from "./constants.js";
import {
  getMonthlyIncomeTotalWon,
  getMonthlyAllocationTotalWon,
  normalizeAllocationGroupName,
  sanitizeSavingsAnnualRate,
  toMonthlyFactor,
  getMaturityMonthIndex,
  normalizeMaturityMonth,
  createAllocationItemId
} from "./input-sanitizer.js";
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatMonthSpan
} from "./formatters.js";

export function buildMonthlySnapshot(inputs) {
  const income = getMonthlyIncomeTotalWon(inputs.incomes);
  const incomeBreakdown = (Array.isArray(inputs.incomes) ? inputs.incomes : [])
    .map((item, index) => ({
      id: `income-${item?.id || index + 1}`,
      label: String(item?.name || `수입 ${index + 1}`),
      tone: "income",
      value: IsfUtils.sanitizeMoney(item?.amount, 0),
    }))
    .filter((item) => item.value > 0);
  const expenseBreakdown = (Array.isArray(inputs.expenseItems) ? inputs.expenseItems : [])
    .map((item, index) => ({
      id: `expense-${item?.id || index + 1}`,
      label: String(item?.name || `생활비 ${index + 1}`),
      tone: "expense",
      value: IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const savingsBreakdown = (Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [])
    .map((item, index) => ({
      id: `savings-${item?.id || index + 1}`,
      label: String(item?.name || `저축 ${index + 1}`),
      tone: "savings",
      value: IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const investBreakdown = (Array.isArray(inputs.investItems) ? inputs.investItems : [])
    .map((item, index) => ({
      id: `invest-${item?.id || index + 1}`,
      label: String(item?.name || `투자 ${index + 1}`),
      tone: "invest",
      value: IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const expense = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);
  const savings = savingsBreakdown.reduce((sum, item) => sum + item.value, 0);
  const invest = investBreakdown.reduce((sum, item) => sum + item.value, 0);
  const debtPayment = IsfUtils.sanitizeMoney(inputs.monthlyDebtPayment, 0);

  const requiredOutflow = expense + savings + invest + debtPayment;
  const netCashflow = income - requiredOutflow;
  const surplus = Math.max(0, netCashflow);
  const deficit = Math.max(0, -netCashflow);

  if (deficit > 0) {
    incomeBreakdown.push({
      id: "income-deficit",
      label: "결손(부채/자산인출)",
      tone: "deficit",
      value: deficit,
    });
  }

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
    incomeBreakdown,
    expense,
    expenseBreakdown,
    savingsBreakdown,
    investBreakdown,
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

export function allocateByWeights(totalAmount, weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return [];
  }

  const safeTotal = Math.max(0, Number(totalAmount) || 0);
  if (safeTotal <= 0) {
    return weights.map(() => 0);
  }

  const safeWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) {
    const equal = safeTotal / safeWeights.length;
    return safeWeights.map(() => equal);
  }

  return safeWeights.map((weight) => safeTotal * (weight / weightTotal));
}

export function buildSavingsBuckets(inputs) {
  const fallbackRate = sanitizeSavingsAnnualRate(inputs.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield);
  const savingsItems = Array.isArray(inputs.savingsItems) && inputs.savingsItems.length > 0
    ? inputs.savingsItems
    : DEFAULT_SAVINGS_ITEMS;
  const monthlyTargets = savingsItems.map((item) => IsfUtils.sanitizeMoney(item?.amount, 0));
  const initialBalances = allocateByWeights(IsfUtils.sanitizeMoney(inputs.startSavings, 0), monthlyTargets);

  return savingsItems.map((item, index) => ({
    id: typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : createAllocationItemId("savings", index),
    monthlyTarget: monthlyTargets[index] || 0,
    annualRate: sanitizeSavingsAnnualRate(item?.annualRate, fallbackRate),
    monthlyFactor: toMonthlyFactor(sanitizeSavingsAnnualRate(item?.annualRate, fallbackRate)),
    balance: initialBalances[index] || 0,
    maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    maturityMonthIndex: getMaturityMonthIndex(item?.maturityMonth),
    closed: false,
  }));
}

export function buildInvestBuckets(inputs) {
  const investItems = Array.isArray(inputs.investItems) && inputs.investItems.length > 0
    ? inputs.investItems
    : DEFAULT_INVEST_ITEMS;
  const monthlyTargets = investItems.map((item) => IsfUtils.sanitizeMoney(item?.amount, 0));
  const initialBalances = allocateByWeights(IsfUtils.sanitizeMoney(inputs.startInvest, 0), monthlyTargets);
  const monthlyFactor = toMonthlyFactor(inputs.annualInvestReturn);

  return investItems.map((item, index) => ({
    id: typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : createAllocationItemId("invest", index),
    monthlyTarget: monthlyTargets[index] || 0,
    monthlyFactor,
    balance: initialBalances[index] || 0,
    maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    maturityMonthIndex: getMaturityMonthIndex(item?.maturityMonth),
    closed: false,
  }));
}

export function simulateProjection(inputs) {
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12;
  const monthlyIncomeBase = getMonthlyIncomeTotalWon(inputs.incomes);
  const monthlyExpenseBase = IsfUtils.sanitizeMoney(inputs.monthlyExpense, 0);
  const monthlySavings = IsfUtils.sanitizeMoney(inputs.monthlySavings, 0);
  const monthlyInvest = IsfUtils.sanitizeMoney(inputs.monthlyInvest, 0);
  const monthlyDebtPayment = IsfUtils.sanitizeMoney(inputs.monthlyDebtPayment, 0);

  const incomeFactor = toMonthlyFactor(inputs.annualIncomeGrowth);
  const expenseFactor = toMonthlyFactor(inputs.annualExpenseGrowth);
  const debtFactor = toMonthlyFactor(inputs.annualDebtInterest);
  const purchasingPowerFactor = toMonthlyFactor(inputs.annualExpenseGrowth);

  const savingsBuckets = buildSavingsBuckets(inputs);
  const investBuckets = buildInvestBuckets(inputs);

  let cash = IsfUtils.sanitizeMoney(inputs.startCash, 0);
  let savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let debt = IsfUtils.sanitizeMoney(inputs.startDebt, 0);

  savingsBuckets.forEach((bucket) => {
    if (bucket.maturityMonthIndex !== null && bucket.maturityMonthIndex <= 0 && !bucket.closed) {
      cash += bucket.balance;
      bucket.balance = 0;
      bucket.closed = true;
    }
  });
  investBuckets.forEach((bucket) => {
    if (bucket.maturityMonthIndex !== null && bucket.maturityMonthIndex <= 0 && !bucket.closed) {
      cash += bucket.balance;
      bucket.balance = 0;
      bucket.closed = true;
    }
  });
  savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

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
      realDiscountFactor: 1,
    }),
  ];

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex += 1) {
    const monthlyIncome = monthlyIncomeBase * Math.pow(incomeFactor, monthIndex - 1);
    const monthlyExpense = monthlyExpenseBase * Math.pow(expenseFactor, monthIndex - 1);
    const debtInterest = debt * (debtFactor - 1);
    let debtBalance = debt + debtInterest;
    let nextCash = cash + monthlyIncome;
    nextCash -= monthlyExpense;

    const payableCash = Math.max(0, nextCash);
    const actualDebtPayment = Math.min(debtBalance, monthlyDebtPayment, payableCash);
    nextCash -= actualDebtPayment;
    debtBalance -= actualDebtPayment;

    const activeSavingsTargets = savingsBuckets.map((bucket) => (bucket.closed ? 0 : bucket.monthlyTarget));
    const maxSavingsAdd = activeSavingsTargets.reduce((sum, target) => sum + target, 0);
    const savingsAdd = Math.min(Math.max(0, nextCash), monthlySavings, maxSavingsAdd);
    nextCash -= savingsAdd;

    const savingsAddsByItem = allocateByWeights(savingsAdd, activeSavingsTargets);
    savingsBuckets.forEach((bucket, index) => {
      if (bucket.closed) {
        return;
      }
      const addAmount = savingsAddsByItem[index] || 0;
      bucket.balance += addAmount;
      bucket.balance *= bucket.monthlyFactor;
      if (bucket.maturityMonthIndex !== null && monthIndex >= bucket.maturityMonthIndex) {
        nextCash += bucket.balance;
        bucket.balance = 0;
        bucket.closed = true;
      }
    });
    savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

    const activeInvestTargets = investBuckets.map((bucket) => (bucket.closed ? 0 : bucket.monthlyTarget));
    const maxInvestAdd = activeInvestTargets.reduce((sum, target) => sum + target, 0);
    const investAdd = Math.min(Math.max(0, nextCash), monthlyInvest, maxInvestAdd);
    nextCash -= investAdd;

    const investAddsByItem = allocateByWeights(investAdd, activeInvestTargets);
    investBuckets.forEach((bucket, index) => {
      if (bucket.closed) {
        return;
      }
      const addAmount = investAddsByItem[index] || 0;
      bucket.balance += addAmount;
      bucket.balance *= bucket.monthlyFactor;
      if (bucket.maturityMonthIndex !== null && monthIndex >= bucket.maturityMonthIndex) {
        nextCash += bucket.balance;
        bucket.balance = 0;
        bucket.closed = true;
      }
    });
    invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

    let newBorrowing = 0;
    if (nextCash < 0) {
      newBorrowing = -nextCash;
      debtBalance += newBorrowing;
      nextCash = 0;
    }

    cash = nextCash;
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
        realDiscountFactor: Math.pow(purchasingPowerFactor, monthIndex),
      }),
    );
  }

  return records;
}

export function buildProjectionRecord({
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
  realDiscountFactor = 1,
}) {
  const netAsset = cash + savings + invest - debt;
  const realNetAsset = netAsset / Math.max(realDiscountFactor, 1e-9);

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
    netAsset,
    realNetAsset,
  };
}

export function buildSummaryCards(snapshot, projection, horizonYears) {
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

  const cards = [
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
      sub: snapshot.netCashflow >= 0 ? "흑자" : "적자(현금 부족분은 부채 증가)",
      variant: snapshot.netCashflow >= 0 ? "positive" : "negative",
    },
    {
      label: "당월 부채이자",
      value: formatCurrency(debtProbe.debtInterest),
      sub: debtProbe.monthIndex > 0 ? `${debtProbe.monthIndex}개월차 기준` : "현재 기준",
      variant: debtProbe.debtInterest > 0 ? "negative" : "positive",
      metric: debtProbe.debtInterest,
      hideIfZero: true,
    },
    {
      label: "당월 실제상환",
      value: formatCurrency(debtProbe.actualDebtPayment),
      sub: `설정 상환 ${formatCurrency(snapshot.debtPayment)}`,
      variant: debtProbe.actualDebtPayment > 0 ? "positive" : "",
      metric: debtProbe.actualDebtPayment,
      hideIfZero: true,
    },
    {
      label: "당월 부채증가분",
      value: formatCurrency(debtProbe.newBorrowing),
      sub: debtProbe.newBorrowing > 0 ? "현금 부족분이 부채로 전환됨" : "부채 증가분 없음",
      variant: debtProbe.newBorrowing > 0 ? "negative" : "positive",
      metric: debtProbe.newBorrowing,
      hideIfZero: true,
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
      metric: current.debt,
      hideIfZero: true,
    },
  ];

  return cards.filter((card) => {
    if (!card.hideIfZero) {
      return true;
    }
    return Math.abs(Number(card.metric) || 0) > 0;
  });
}
