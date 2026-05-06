
import { state } from "./state.js";
import { DEFAULT_INFLATION_RATE, DEFAULT_TAX_RATE } from "./constants.js";

import { utils } from "./utils.js";


export function getTotalMonthlyInvestCapacity() {
  return utils.sanitizeMoney(state.draft?.totalMonthlyInvestCapacity, 0);
}


export function formatCurrency(val) {
  return utils.formatMoney(val);
}


export function formatDateTime(iso) {
  if (!iso) return "-";
  return utils.formatTimestamp(new Date(iso).getTime());
}


export function calculateDividendProjection() {
  if (!state.draft) return [];
  const sim = state.draft.dividendSim || {};
  const years = parseInt(sim.years) || 10;
  const initialYield = (parseFloat(sim.yield) || 3.5) / 100;
  const dgr = (parseFloat(sim.growth) || 5.0) / 100;
  const cgr = (parseFloat(sim.capitalGrowth) || 4.0) / 100;
  
  const initialAsset = utils.sanitizeMoney(state.draft.totalInitialAsset, 0);
  const monthlyContribution = getTotalMonthlyInvestCapacity();
  const yearlyContribution = monthlyContribution * 12;
  const taxRate = DEFAULT_TAX_RATE;
  const inflationRate = DEFAULT_INFLATION_RATE;

  let principal = initialAsset;
  let assetPR = initialAsset;
  let assetTR = initialAsset;
  const results = [];

  for (let y = 1; y <= years; y++) {
    const lastResult = results.length > 0 ? results[results.length - 1] : null;


    principal += yearlyContribution;



    const existingAssetPR = assetPR;
    const growthOnExistingPR = existingAssetPR * cgr;
    const growthOnNewPR = yearlyContribution * (cgr / 2);
    assetPR = existingAssetPR + yearlyContribution + growthOnExistingPR + growthOnNewPR;

    const prevDivPR = lastResult ? lastResult.dividendNominalPR : 0;
    const divNominalPR = (prevDivPR * (1 + dgr)) + (yearlyContribution * (1 + cgr / 2) * (initialYield / 2));
    
    const divAfterTaxPR = divNominalPR - window.IsfUtils.calculateIncomeTax(divNominalPR);

    const existingAssetTR = assetTR;
    const growthOnExistingTR = existingAssetTR * cgr;
    const growthOnNewTR = yearlyContribution * (cgr / 2);
    assetTR = existingAssetTR + yearlyContribution + growthOnExistingTR + growthOnNewTR;

    const prevDivTR = lastResult ? lastResult.dividendNominalTR : 0;
    const prevReinvested = lastResult ? lastResult.dividendAfterTaxTR : 0;

    const divNominalTR = (prevDivTR * (1 + dgr)) + (yearlyContribution * (1 + cgr / 2) * (initialYield / 2)) + (prevReinvested * (1 + cgr) * initialYield);
    
    const divAfterTaxTR = divNominalTR - window.IsfUtils.calculateIncomeTax(divNominalTR);
    
    assetTR += divAfterTaxTR;


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



