import {
  DEFAULT_INPUTS,
  DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS,
  DEFAULT_INVEST_ITEMS,
  PR_MODE_ASSUMED_ANNUAL_DIV_YIELD,
  MAGIC_MAPPING_DEFAULTS
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
      value: window.IsfUtils.sanitizeMoney(item?.amount, 0),
      accountId: item?.accountId,
      allocations: item?.allocations,
    }))
    .filter((item) => item.value > 0);
  const expenseBreakdown = (Array.isArray(inputs.expenseItems) ? inputs.expenseItems : [])
    .map((item, index) => ({
      id: `expense-${item?.id || index + 1}`,
      label: String(item?.name || `생활비 ${index + 1}`),
      tone: "expense",
      value: window.IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
      accountId: item?.accountId,
    }))
    .filter((item) => item.value > 0);
  const savingsBreakdown = (Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [])
    .map((item, index) => ({
      id: `savings-${item?.id || index + 1}`,
      label: String(item?.name || `저축 ${index + 1}`),
      tone: "savings",
      value: window.IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
      accountId: item?.accountId,
    }))
    .filter((item) => item.value > 0);
  const investBreakdown = (Array.isArray(inputs.investItems) ? inputs.investItems : [])
    .map((item, index) => ({
      id: `invest-${item?.id || index + 1}`,
      label: String(item?.name || `투자 ${index + 1}`),
      tone: "invest",
      value: window.IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
      accountId: item?.accountId,
    }))
    .filter((item) => item.value > 0);
  const expense = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);
  const savings = savingsBreakdown.reduce((sum, item) => sum + item.value, 0);
  const invest = investBreakdown.reduce((sum, item) => sum + item.value, 0);
  const debtPayment = window.IsfUtils.sanitizeMoney(inputs.monthlyDebtPayment, 0);

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
      accountId: MAGIC_MAPPING_DEFAULTS.expense || "acc-living",
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
    accounts: inputs.accounts || [],
    surplusTransferAccountId: inputs.surplusTransferAccountId || "",
    transfers: inputs.transfers || [],
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
  const monthlyTargets = savingsItems.map((item) => window.IsfUtils.sanitizeMoney(item?.amount, 0));
  const initialBalances = allocateByWeights(window.IsfUtils.sanitizeMoney(inputs.startSavings, 0), monthlyTargets);

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
  const monthlyTargets = investItems.map((item) => window.IsfUtils.sanitizeMoney(item?.amount, 0));
  const initialBalances = allocateByWeights(window.IsfUtils.sanitizeMoney(inputs.startInvest, 0), monthlyTargets);
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

export function simulateProjection(inputs, options = {}) {
  const mode = options.mode || "TR"; // "TR" or "PR"
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12;
  const monthlyIncomeBase = getMonthlyIncomeTotalWon(inputs.incomes);
  const monthlyExpenseBase = window.IsfUtils.sanitizeMoney(inputs.monthlyExpense, 0);
  const monthlySavings = window.IsfUtils.sanitizeMoney(inputs.monthlySavings, 0);
  const monthlyInvest = window.IsfUtils.sanitizeMoney(inputs.monthlyInvest, 0);
  const monthlyDebtPayment = window.IsfUtils.sanitizeMoney(inputs.monthlyDebtPayment, 0);

  const incomeFactor = toMonthlyFactor(inputs.annualIncomeGrowth);
  const expenseFactor = toMonthlyFactor(inputs.annualExpenseGrowth);
  const debtFactor = toMonthlyFactor(inputs.annualDebtInterest);
  const purchasingPowerFactor = toMonthlyFactor(inputs.annualExpenseGrowth);

  const savingsBuckets = buildSavingsBuckets(inputs);
  const investBuckets = buildInvestBuckets(inputs);

  // 현재 시점의 가중평균 연 수익률 계산 (경고용)
  const totalSavingsBalance = savingsBuckets.reduce((sum, b) => sum + b.balance, 0);
  const avgSavingsRate = totalSavingsBalance > 0 
    ? savingsBuckets.reduce((sum, b) => sum + (b.annualRate * b.balance), 0) / totalSavingsBalance
    : (savingsBuckets.length > 0 ? savingsBuckets.reduce((sum, b) => sum + b.annualRate, 0) / savingsBuckets.length : inputs.annualSavingsYield);
  const investRate = inputs.annualInvestReturn;

  let cash = window.IsfUtils.sanitizeMoney(inputs.startCash, 0, -1000000000000000);
  let savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let debt = window.IsfUtils.sanitizeMoney(inputs.startDebt, 0);
  let accumulatedPRDividend = 0; // PR 모드 시 재투자되지 않고 쌓인 배당/이자

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
      accumulatedPRDividend
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
      
      const totalGrowth = bucket.balance * (bucket.monthlyFactor - 1);
      if (mode === "TR") {
        bucket.balance += totalGrowth;
      } else {
        // 저축(Savings)은 이자 수익 전체를 배당(수취)으로 간주하여 현금으로 회수
        nextCash += totalGrowth;
        accumulatedPRDividend += totalGrowth;
      }

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

      const totalGrowth = bucket.balance * (bucket.monthlyFactor - 1);
      if (mode === "TR") {
        bucket.balance += totalGrowth;
      } else {
        // PR(Price Return) 모드: 자산 가치 상승(Capital Gain)은 잔고에 반영, 배당 수익은 현금으로 합산
        // 연 2% 수준의 배당 수익률을 가정하여 분리
        const monthlyDivFactor = Math.pow(1 + PR_MODE_ASSUMED_ANNUAL_DIV_YIELD, 1 / 12);
        const dividend = bucket.balance * (monthlyDivFactor - 1);
        const capitalGain = totalGrowth - dividend;
        
        bucket.balance += capitalGain;
        nextCash += dividend;
        accumulatedPRDividend += dividend;
      }

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
        avgSavingsRate,
        investRate,
        accumulatedPRDividend
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
  avgSavingsRate = 0,
  investRate = 0,
  accumulatedPRDividend = 0
}) {
  const netAsset = cash + savings + invest - debt;
  const realNetAsset = netAsset / Math.max(realDiscountFactor, 1e-9);
  
  // 연간 금융 수익 (이자 + 투자수익) 추정
  const annualFinancialIncome = (savings * (avgSavingsRate / 100)) + (invest * (investRate / 100));

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
    annualFinancialIncome,
    accumulatedPRDividend
  };
}


export function buildSummaryCards(snapshot, projection, horizonYears) {
  const current = projection[0];
  const last = projection[projection.length - 1];
  const deltaNet = last.netAsset - current.netAsset;
  const futureAllocation = snapshot.savings + snapshot.invest;
  const savingsRate = snapshot.income > 0 ? futureAllocation / snapshot.income : 0;

  return [
    {
      label: "월 순현금흐름",
      value: formatSignedCurrency(snapshot.netCashflow),
      sub: snapshot.netCashflow >= 0 ? "흑자" : "적자(현금 부족분은 부채 증가)",
      variant: snapshot.netCashflow >= 0 ? "positive" : "negative",
    },
    {
      label: "현재 순자산",
      value: formatCurrency(current.netAsset),
      sub: `현금 ${formatCurrency(current.cash)} · 저축 ${formatCurrency(current.savings)} · 투자 ${formatCurrency(current.invest)}${current.debt > 0 ? ` · 부채 ${formatCurrency(current.debt)}` : ""}`,
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
  ];
}

export function calculateAccountFinancialIncomes(inputs) {
  const savingsItems = Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [];
  const investItems = Array.isArray(inputs.investItems) ? inputs.investItems : [];
  const accounts = Array.isArray(inputs.accounts) ? inputs.accounts : [];
  const accountIds = new Set(accounts.map((a) => a.id));

  function resolveAccountId(itemAccountId, magicDefault) {
    if (itemAccountId && accountIds.has(itemAccountId)) return itemAccountId;
    if (magicDefault && accountIds.has(magicDefault)) return magicDefault;
    return accounts[0]?.id || null;
  }

  const savingsBuckets = buildSavingsBuckets(inputs);
  const investBuckets = buildInvestBuckets(inputs);

  const accountIncomeMap = {};
  accounts.forEach((acc) => {
    accountIncomeMap[acc.id] = 0;
  });

  savingsBuckets.forEach((bucket, index) => {
    const originalItem = savingsItems[index];
    const accId = resolveAccountId(originalItem?.accountId, MAGIC_MAPPING_DEFAULTS.savings);
    if (!accId) return;

    const annualRate = bucket.annualRate || 0;
    const balance = bucket.balance || 0;
    const annualIncome = balance * (annualRate / 100);

    if (accountIncomeMap[accId] === undefined) {
      accountIncomeMap[accId] = 0;
    }
    accountIncomeMap[accId] += annualIncome;
  });

  investBuckets.forEach((bucket, index) => {
    const originalItem = investItems[index];
    const accId = resolveAccountId(originalItem?.accountId, MAGIC_MAPPING_DEFAULTS.invest);
    if (!accId) return;

    const balance = bucket.balance || 0;
    const annualIncome = balance * 0.02;

    if (accountIncomeMap[accId] === undefined) {
      accountIncomeMap[accId] = 0;
    }
    accountIncomeMap[accId] += annualIncome;
  });

  let totalFinancialIncome = 0;
  Object.values(accountIncomeMap).forEach((val) => {
    totalFinancialIncome += val;
  });

  const warnings = {};
  const status = window.IsfUtils.getFinancialIncomeStatus(totalFinancialIncome);

  if (status !== "normal") {
    const message = status === "crit"
      ? "금융소득 종합과세 대상 (한도 초과)"
      : "금융소득 종합과세 주의";

    Object.keys(accountIncomeMap).forEach((accId) => {
      if (accountIncomeMap[accId] > 0) {
        warnings[accId] = { status, message };
      }
    });
  }

  return {
    accountIncomeMap,
    totalFinancialIncome,
    warnings
  };
}

