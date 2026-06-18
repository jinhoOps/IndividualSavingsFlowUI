export const STRATEGY_GROUPS = [
  {
    key: "indexGrowth",
    label: "지수/성장",
    description: "장기 총자산 성장을 먼저 비교하는 기준 전략",
    examples: ["Nasdaq", "S&P 500"],
  },
  {
    key: "dividendGrowth",
    label: "배당성장",
    description: "현금흐름과 배당 성장의 균형을 보는 전략",
    examples: ["SCHD"],
  },
  {
    key: "coveredCallMonthlyIncome",
    label: "커버드콜/월 현금흐름",
    description: "월 현금흐름을 우선하되 상승 참여 제한을 함께 보는 전략",
    examples: ["JEPI", "QQQI", "DIVO"],
  },
];

export const INDEX_BENCHMARKS = {
  nasdaq: {
    key: "nasdaq",
    label: "Nasdaq",
    fullName: "Nasdaq 100 (QQQ)",
    evidenceKey: "qqq",
    sourcePath: "public/data/indices/qqq.json",
    defaults: {
      dividendYield: 0.7,
      dividendGrowth: 5.0,
      capitalGrowth: 13.5,
      cashFlowYield: 0.7,
      isDrip: true,
    },
    displayRanges: {
      dividendYield: "0.3-1%",
      dividendGrowth: "3-7%",
      capitalGrowth: "12-15%",
    },
  },
  sp500: {
    key: "sp500",
    label: "S&P 500",
    fullName: "S&P 500 (SPY Proxy)",
    evidenceKey: "spy",
    sourcePath: "public/data/indices/spy.json",
    defaults: {
      dividendYield: 1.4,
      dividendGrowth: 4.0,
      capitalGrowth: 9.0,
      cashFlowYield: 1.4,
      isDrip: true,
    },
    displayRanges: {
      dividendYield: "1-2%",
      dividendGrowth: "3-6%",
      capitalGrowth: "8-10%",
    },
  },
};

export const DIVIDEND_GROWTH_EXAMPLES = {
  schd: {
    key: "schd",
    label: "SCHD",
    fullName: "Schwab US Dividend Equity (SCHD)",
    groupKey: "dividendGrowth",
    evidenceKey: "schd",
    sourcePath: "public/data/indices/schd.json",
    defaults: {
      dividendYield: 3.5,
      dividendGrowth: 11.0,
      capitalGrowth: 7.0,
      cashFlowYield: 3.5,
      isDrip: true,
    },
    displayRanges: {
      dividendYield: "3.3-3.6%",
      dividendGrowth: "10-12%",
      capitalGrowth: "6-8%",
    },
  },
};

export const COVERED_CALL_EXAMPLES = {
  jepi: {
    key: "jepi",
    label: "JEPI",
    fullName: "JPMorgan Equity Premium Income ETF (JEPI)",
    groupKey: "coveredCallMonthlyIncome",
    evidenceKey: "covered-call-jepi-example",
    defaults: {
      cashFlowYield: 8.0,
      dividendYield: 8.0,
      distributionGrowth: 0.0,
      dividendGrowth: 0.0,
      capitalGrowth: 3.0,
      isDrip: false,
    },
    displayRanges: {
      cashFlowYield: "7-9%",
      distributionGrowth: "측정 불가/변동",
      capitalGrowth: "2-4%",
    },
  },
  qqqi: {
    key: "qqqi",
    label: "QQQI",
    fullName: "NEOS Nasdaq-100 High Income ETF (QQQI)",
    groupKey: "coveredCallMonthlyIncome",
    evidenceKey: "covered-call-qqqi-example",
    defaults: {
      cashFlowYield: 11.5,
      dividendYield: 11.5,
      distributionGrowth: 0.0,
      dividendGrowth: 0.0,
      capitalGrowth: 6.5,
      isDrip: false,
    },
    displayRanges: {
      cashFlowYield: "11-12%",
      distributionGrowth: "측정 불가/변동",
      capitalGrowth: "5-8%",
    },
  },
  divo: {
    key: "divo",
    label: "DIVO",
    fullName: "Amplify CWP Enhanced Dividend Income ETF (DIVO)",
    groupKey: "coveredCallMonthlyIncome",
    evidenceKey: "covered-call-divo-example",
    defaults: {
      cashFlowYield: 4.75,
      dividendYield: 4.75,
      distributionGrowth: 5.0,
      dividendGrowth: 5.0,
      capitalGrowth: 6.0,
      isDrip: false,
    },
    displayRanges: {
      cashFlowYield: "4.5-5%",
      distributionGrowth: "4-6%",
      capitalGrowth: "5-7%",
    },
  },
};

export const STRATEGY_ASSUMPTION_LIMITS = {
  minYears: 1,
  maxYears: 50,
  maxRate: 30,
};

export const DEFAULT_STRATEGY_SELECTION = {
  benchmarkKey: "nasdaq",
  dividendGrowthKey: "schd",
  coveredCallKey: "jepi",
};

export const ASSUMPTION_COPY = {
  source: "conservative-example",
  disclaimer: "보수 예시 가정이며 실시간 수익률이나 보장 수익이 아닙니다.",
};

export function getBenchmarkOptions() {
  return Object.values(INDEX_BENCHMARKS);
}

export function getDividendGrowthExamples() {
  return Object.values(DIVIDEND_GROWTH_EXAMPLES);
}

export function getCoveredCallExamples() {
  return Object.values(COVERED_CALL_EXAMPLES);
}

export function getStrategyAssumptions(selection = {}) {
  const benchmarkKey = selection.benchmarkKey || selection.selectedBenchmark || DEFAULT_STRATEGY_SELECTION.benchmarkKey;
  const coveredCallKey = selection.coveredCallKey || selection.coveredCallExample || DEFAULT_STRATEGY_SELECTION.coveredCallKey;
  const dividendGrowthKey = selection.dividendGrowthKey || DEFAULT_STRATEGY_SELECTION.dividendGrowthKey;

  return {
    copy: ASSUMPTION_COPY,
    groups: STRATEGY_GROUPS,
    benchmark: INDEX_BENCHMARKS[benchmarkKey] || INDEX_BENCHMARKS[DEFAULT_STRATEGY_SELECTION.benchmarkKey],
    dividendGrowth: DIVIDEND_GROWTH_EXAMPLES[dividendGrowthKey] || DIVIDEND_GROWTH_EXAMPLES[DEFAULT_STRATEGY_SELECTION.dividendGrowthKey],
    coveredCall: COVERED_CALL_EXAMPLES[coveredCallKey] || COVERED_CALL_EXAMPLES[DEFAULT_STRATEGY_SELECTION.coveredCallKey],
    benchmarkOptions: getBenchmarkOptions(),
    dividendGrowthExamples: getDividendGrowthExamples(),
    coveredCallExamples: getCoveredCallExamples(),
    limits: STRATEGY_ASSUMPTION_LIMITS,
  };
}
