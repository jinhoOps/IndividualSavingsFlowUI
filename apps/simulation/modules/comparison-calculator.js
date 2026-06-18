import { DEFAULT_INFLATION_RATE } from "./constants.js";
import { utils } from "./utils.js";
import {
  DEFAULT_STRATEGY_SELECTION,
  STRATEGY_ASSUMPTION_LIMITS,
  getStrategyAssumptions,
} from "./assumptions.js";

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeRate(value, fallback = 0) {
  return clampNumber(value, fallback, 0, STRATEGY_ASSUMPTION_LIMITS.maxRate);
}

function sanitizeYears(value) {
  return Math.round(clampNumber(
    value,
    10,
    STRATEGY_ASSUMPTION_LIMITS.minYears,
    STRATEGY_ASSUMPTION_LIMITS.maxYears,
  ));
}

function calculateIncomeTax(amount) {
  if (typeof window !== "undefined" && window.IsfUtils?.calculateIncomeTax) {
    return window.IsfUtils.calculateIncomeTax(amount);
  }
  return Math.max(0, Number(amount || 0)) * 0.154;
}

function toWon(value) {
  return Math.round(utils.sanitizeMoney(value, 0));
}

function toSignedWon(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function toPercent(value, fallback = 0) {
  return Math.round(sanitizeRate(value, fallback) * 100) / 100;
}

function mergeEditableDefaults(strategy, editable = {}) {
  const defaults = strategy.defaults || {};
  const dividendGrowth = editable.dividendGrowth ?? editable.growth ?? defaults.dividendGrowth ?? defaults.distributionGrowth ?? 0;
  const cashFlowYield = editable.cashFlowYield ?? editable.yield ?? defaults.cashFlowYield ?? defaults.dividendYield ?? 0;

  return {
    key: strategy.key,
    label: strategy.label,
    fullName: strategy.fullName,
    evidenceKey: strategy.evidenceKey,
    sourcePath: strategy.sourcePath || "",
    displayRanges: strategy.displayRanges || {},
    dividendYieldPercent: toPercent(editable.dividendYield ?? editable.yield ?? defaults.dividendYield ?? cashFlowYield),
    cashFlowYieldPercent: toPercent(cashFlowYield),
    dividendGrowthPercent: toPercent(dividendGrowth),
    distributionGrowthPercent: toPercent(editable.distributionGrowth ?? dividendGrowth),
    capitalGrowthPercent: toPercent(editable.capitalGrowth ?? defaults.capitalGrowth),
    isDrip: typeof editable.isDrip === "boolean" ? editable.isDrip : defaults.isDrip !== false,
  };
}

function resolveSelection(draft = {}, overrides = {}) {
  const sim = draft.dividendSim || {};
  return {
    benchmarkKey: overrides.benchmarkKey || overrides.selectedBenchmark || sim.selectedBenchmark || DEFAULT_STRATEGY_SELECTION.benchmarkKey,
    dividendGrowthKey: overrides.dividendGrowthKey || DEFAULT_STRATEGY_SELECTION.dividendGrowthKey,
    coveredCallKey: overrides.coveredCallKey || overrides.coveredCallExample || sim.coveredCallExample || DEFAULT_STRATEGY_SELECTION.coveredCallKey,
  };
}

function resolveEditableOverrides(draft = {}, overrides = {}) {
  const sim = draft.dividendSim || {};
  const selectedStrategy = sim.strategyKey || "dividendGrowth";
  const editableFromUi = {
    dividendYield: sim.yield,
    cashFlowYield: sim.yield,
    dividendGrowth: sim.growth,
    distributionGrowth: sim.growth,
    capitalGrowth: sim.capitalGrowth,
    isDrip: sim.isDrip,
  };
  const editable = {
    dividendGrowth: overrides.dividendGrowthOverrides || {},
    coveredCall: overrides.coveredCallOverrides || {},
    benchmark: overrides.benchmarkOverrides || {},
  };

  if (!overrides.dividendGrowthOverrides && !overrides.coveredCallOverrides && !overrides.benchmarkOverrides) {
    if (selectedStrategy === "indexGrowth") {
      editable.benchmark = editableFromUi;
    } else if (selectedStrategy === "coveredCallMonthlyIncome") {
      editable.coveredCall = editableFromUi;
    } else {
      editable.dividendGrowth = editableFromUi;
    }
  }

  return {
    dividendGrowth: editable.dividendGrowth,
    coveredCall: editable.coveredCall,
    benchmark: editable.benchmark,
  };
}

function usesDividendGrowthIncomeModel(strategy) {
  return strategy.key === "schd" || strategy.key === "divo";
}

function projectStrategy(strategy, previousAsset, yearlyContribution, yearIndex, previousAnnualCashFlowGross = 0) {
  const capitalGrowth = strategy.capitalGrowthPercent / 100;
  const distributionGrowth = strategy.distributionGrowthPercent / 100;
  const baseCashFlowYield = strategy.cashFlowYieldPercent / 100;
  const grownAsset = previousAsset * (1 + capitalGrowth);
  const contributedAsset = yearlyContribution * (1 + capitalGrowth / 2);
  let finalAsset = grownAsset + contributedAsset;
  const effectiveCashFlowYield = baseCashFlowYield * Math.pow(1 + distributionGrowth, yearIndex - 1);
  const annualCashFlowGross = usesDividendGrowthIncomeModel(strategy)
    ? (
        yearIndex === 1
          ? previousAsset * (1 + capitalGrowth / 2) * baseCashFlowYield
          : previousAnnualCashFlowGross * (1 + distributionGrowth)
      ) + (contributedAsset * baseCashFlowYield / 2)
    : finalAsset * effectiveCashFlowYield;
  const annualCashFlowAfterTax = annualCashFlowGross - calculateIncomeTax(annualCashFlowGross);

  if (strategy.isDrip) {
    finalAsset += annualCashFlowAfterTax;
  }

  return {
    finalAsset: toWon(finalAsset),
    annualCashFlowGross: toWon(annualCashFlowGross),
    annualCashFlowAfterTax: toWon(annualCashFlowAfterTax),
    monthlyCashFlowAfterTax: toWon(annualCashFlowAfterTax / 12),
    effectiveCashFlowYieldPercent: toPercent(finalAsset > 0 ? (annualCashFlowGross / finalAsset) * 100 : effectiveCashFlowYield * 100),
  };
}

function buildStrategyRow(strategy, projection, benchmarkAsset) {
  return {
    key: strategy.key,
    label: strategy.label,
    fullName: strategy.fullName,
    evidenceKey: strategy.evidenceKey,
    sourcePath: strategy.sourcePath,
    finalAsset: projection.finalAsset,
    assetNominal: projection.finalAsset,
    annualCashFlowGross: projection.annualCashFlowGross,
    annualCashFlowAfterTax: projection.annualCashFlowAfterTax,
    monthlyCashFlowAfterTax: projection.monthlyCashFlowAfterTax,
    benchmarkDelta: toSignedWon(projection.finalAsset - benchmarkAsset),
    dividendYieldPercent: strategy.dividendYieldPercent,
    cashFlowYieldPercent: strategy.cashFlowYieldPercent,
    dividendGrowthPercent: strategy.dividendGrowthPercent,
    distributionGrowthPercent: strategy.distributionGrowthPercent,
    capitalGrowthPercent: strategy.capitalGrowthPercent,
    effectiveCashFlowYieldPercent: projection.effectiveCashFlowYieldPercent,
    isDrip: strategy.isDrip,
    displayRanges: strategy.displayRanges,
  };
}

export function calculateStrategyComparison(draft = {}, selectedAssumptions = {}) {
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const selection = resolveSelection(safeDraft, selectedAssumptions);
  const assumptions = getStrategyAssumptions(selection);
  const editable = resolveEditableOverrides(safeDraft, selectedAssumptions);

  const years = sanitizeYears(selectedAssumptions.years ?? safeDraft.dividendSim?.years);
  const initialAsset = toWon(safeDraft.totalInitialAsset);
  const monthlyContribution = toWon(safeDraft.totalMonthlyInvestCapacity);
  const yearlyContribution = monthlyContribution * 12;
  const inflationRate = clampNumber(selectedAssumptions.inflationRate, DEFAULT_INFLATION_RATE, 0, 0.2);

  const indexStrategy = mergeEditableDefaults(assumptions.benchmark, editable.benchmark);
  const schdStrategy = mergeEditableDefaults(assumptions.dividendGrowth, editable.dividendGrowth);
  const coveredCallStrategy = mergeEditableDefaults(assumptions.coveredCall, editable.coveredCall);

  let principal = initialAsset;
  const assets = {
    index: initialAsset,
    schd: initialAsset,
    coveredCall: initialAsset,
  };
  const annualCashFlows = {
    index: 0,
    schd: 0,
    coveredCall: 0,
  };
  const rows = [];

  for (let year = 1; year <= years; year += 1) {
    principal += yearlyContribution;
    const indexProjection = projectStrategy(indexStrategy, assets.index, yearlyContribution, year, annualCashFlows.index);
    assets.index = indexProjection.finalAsset;
    annualCashFlows.index = indexProjection.annualCashFlowGross;

    const schdProjection = projectStrategy(schdStrategy, assets.schd, yearlyContribution, year, annualCashFlows.schd);
    assets.schd = schdProjection.finalAsset;
    annualCashFlows.schd = schdProjection.annualCashFlowGross;

    const coveredProjection = projectStrategy(coveredCallStrategy, assets.coveredCall, yearlyContribution, year, annualCashFlows.coveredCall);
    assets.coveredCall = coveredProjection.finalAsset;
    annualCashFlows.coveredCall = coveredProjection.annualCashFlowGross;

    const benchmarkAsset = indexProjection.finalAsset;
    const inflationFactor = Math.pow(1 + inflationRate, year);
    const strategies = {
      index: buildStrategyRow(indexStrategy, indexProjection, benchmarkAsset),
      schd: buildStrategyRow(schdStrategy, schdProjection, benchmarkAsset),
      coveredCall: buildStrategyRow(coveredCallStrategy, coveredProjection, benchmarkAsset),
    };

    rows.push({
      year,
      principal: toWon(principal),
      principalReal: toWon(principal / inflationFactor),
      strategies,
      finalAssets: {
        index: strategies.index.finalAsset,
        schd: strategies.schd.finalAsset,
        coveredCall: strategies.coveredCall.finalAsset,
      },
      monthlyCashFlowAfterTax: {
        index: strategies.index.monthlyCashFlowAfterTax,
        schd: strategies.schd.monthlyCashFlowAfterTax,
        coveredCall: strategies.coveredCall.monthlyCashFlowAfterTax,
      },
      benchmarkDelta: {
        index: 0,
        schd: strategies.schd.benchmarkDelta,
        coveredCall: strategies.coveredCall.benchmarkDelta,
      },
    });
  }

  return {
    selectedBenchmark: assumptions.benchmark.key,
    selectedBenchmarkLabel: assumptions.benchmark.label,
    selectedCoveredCall: assumptions.coveredCall.key,
    selectedCoveredCallLabel: assumptions.coveredCall.label,
    assumptions,
    rows,
    final: rows[rows.length - 1] || null,
  };
}
