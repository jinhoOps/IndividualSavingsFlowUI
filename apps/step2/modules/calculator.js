/**
 * Step 2 Business Logic & Calculations
 */
import { state } from "./state.js";

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
  const utils = window.IsfUtils || { sanitizeMoney: (v, def) => v || def };
  return utils.sanitizeMoney(state.draft?.totalMonthlyInvestCapacity, 0);
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
  const isDrip = sim.isDrip !== false;
  const monthlyContribution = getTotalMonthlyInvestCapacity();
  const yearlyContribution = monthlyContribution * 12;
  const taxRate = 0.154;
  const inflationRate = 0.02; // 실질 가치 계산을 위한 고정 인플레이션

  let principal = 0;
  let assetNominal = 0;
  const results = [];

  for (let y = 1; y <= years; y++) {
    // 1. 원금 적립
    principal += yearlyContribution;
    assetNominal += yearlyContribution;

    // 2. 자산 성장 (시세 차익)
    assetNominal *= (1 + cgr);

    // 3. 배당금 계산
    // 배당 성장률(DGR)은 기존 배당금의 증가분으로 계산하고, 신규 투자분은 초기 수익률(initialYield)을 따르도록 모델링
    const prevDiv = y > 1 ? results[y - 2].dividendNominal : 0;
    const dividendNominal = (prevDiv * (1 + dgr)) + (yearlyContribution * (1 + cgr) * initialYield);
    const dividendAfterTax = dividendNominal * (1 - taxRate);

    // 4. 배당 재투자
    if (isDrip) {
      assetNominal += dividendAfterTax;
      // principal += dividendAfterTax; // 재투자된 배당금은 원금 합산에서 제외 (수익률 측정 정확도 향상)
    }

    // 5. 실질 가치 계산 (인플레이션 반영)
    const discountFactor = Math.pow(1 + inflationRate, y);
    const assetReal = assetNominal / discountFactor;
    const divReal = dividendNominal / discountFactor;
    const divAfterTaxReal = dividendAfterTax / discountFactor;

    results.push({
      year: y,
      principal,
      assetNominal,
      assetReal,
      dividendNominal,
      dividendAfterTax,
      dividendAfterTaxReal,
      monthlyDivNominal: dividendAfterTax / 12,
      monthlyDivReal: divAfterTaxReal / 12
    });
  }

  return results;
}
