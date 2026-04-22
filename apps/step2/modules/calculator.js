/**
 * Step 2 Business Logic & Calculations
 */
import { state } from "./state.js";
import { DEFAULT_INFLATION_RATE, DEFAULT_TAX_RATE } from "./constants.js";

/**
 * Gets total allocation weight for an account
 */
export function getAllocationWeightTotal(account) {
  if (!account || !Array.isArray(account.allocations)) return 0;
  const utils = window.IsfUtils || { sanitizeWeight: n => parseFloat(n) || 0 };
  return account.allocations.reduce((sum, al) => sum + utils.sanitizeWeight(al.targetWeight), 0);
}

/**
 * Gets total target weight across all accounts
 */
export function getTotalAccountWeight() {
  if (!state.draft || !Array.isArray(state.draft.accounts)) return 0;
  const utils = window.IsfUtils || { sanitizeWeight: n => parseFloat(n) || 0 };
  return state.draft.accounts.reduce((sum, acc) => sum + utils.sanitizeWeight(acc.accountWeight), 0);
}

/**
 * Calculates the amount of cash not yet allocated to any account
 */
export function getAutoCashAmount() {
  const total = getTotalMonthlyInvestCapacity();
  const utils = window.IsfUtils || { sanitizeWeight: n => parseFloat(n) || 0 };
  const allocated = state.draft.accounts.reduce((sum, acc) => {
    return sum + Math.round(total * utils.sanitizeWeight(acc.accountWeight) / 100);
  }, 0);
  return Math.max(0, total - allocated);
}

/**
 * Gets the total monthly investment capacity in Won
 */
export function getTotalMonthlyInvestCapacity() {
  const utils = window.IsfUtils;
  return utils ? utils.sanitizeMoney(state.draft?.totalMonthlyInvestCapacity, 0) : (state.draft?.totalMonthlyInvestCapacity || 0);
}

/**
 * Formats a currency value
 */
export function formatCurrency(val) {
  const utils = window.IsfUtils || { formatMoney: v => v };
  return utils.formatMoney(val);
}

/**
 * Formats a date/time string from ISO or timestamp
 */
export function formatDateTime(iso) {
  if (!iso) return "-";
  const utils = window.IsfUtils || { formatTimestamp: t => t };
  return utils.formatTimestamp(new Date(iso).getTime());
}

/**
 * Gets an account from the state draft by ID
 */
export function getAccountById(id) {
  if (!state.draft) return null;
  return state.draft.accounts.find(a => String(a.id) === String(id));
}

/**
 * High-Fidelity Dividend Simulation Engine
 */
export function calculateDividendProjection() {
  if (!state.draft) return [];
  const sim = state.draft.dividendSim || {};
  const years = parseInt(sim.years) || 10;
  const initialYield = (parseFloat(sim.yield) || 3.5) / 100;
  const dgr = (parseFloat(sim.growth) || 5.0) / 100;
  const cgr = (parseFloat(sim.capitalGrowth) || 4.0) / 100;
  const monthlyContribution = getTotalMonthlyInvestCapacity();
  const yearlyContribution = monthlyContribution * 12;
  const taxRate = DEFAULT_TAX_RATE;
  const inflationRate = DEFAULT_INFLATION_RATE;

  let principal = 0;
  let assetPR = 0;
  let assetTR = 0;
  const results = [];

  for (let y = 1; y <= years; y++) {
    // 1. 원금 적립
    principal += yearlyContribution;

    // 2. PR 경로 (배당 미투자)
    assetPR += yearlyContribution;
    assetPR *= (1 + cgr);
    const prevDivPR = y > 1 ? results[y - 2].dividendNominalPR : 0;
    const divNominalPR = (prevDivPR * (1 + dgr)) + (yearlyContribution * (1 + cgr) * initialYield);
    const divAfterTaxPR = divNominalPR * (1 - taxRate);

    // 3. TR 경로 (배당 재투자)
    assetTR += yearlyContribution;
    assetTR *= (1 + cgr);
    const prevDivTR = y > 1 ? results[y - 2].dividendNominalTR : 0;
    const prevReinvested = y > 1 ? results[y - 2].dividendAfterTaxTR : 0;
    // (기존 배당 성장) + (신규 납입분 배당) + (전년 재투자분에서 발생하는 배당)
    const divNominalTR = (prevDivTR * (1 + dgr)) + (yearlyContribution * (1 + cgr) * initialYield) + (prevReinvested * (1 + cgr) * initialYield);
    const divAfterTaxTR = divNominalTR * (1 - taxRate);
    assetTR += divAfterTaxTR;

    // 4. 실질 가치 계산 (인플레이션 반영)
    const df = Math.pow(1 + inflationRate, y);

    results.push({
      year: y,
      principal,
      assetNominalPR: assetPR,
      assetRealPR: assetPR / df,
      assetNominalTR: assetTR,
      assetRealTR: assetTR / df,
      dividendNominalPR: divNominalPR,
      dividendAfterTaxPR: divAfterTaxPR,
      dividendAfterTaxRealPR: divAfterTaxPR / df,
      dividendNominalTR: divNominalTR,
      dividendAfterTaxTR: divAfterTaxTR,
      dividendAfterTaxRealTR: divAfterTaxTR / df
    });
  }

  return results;
}
