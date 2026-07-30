import type {
  CompoundSimulationDraft,
  ProjectionPoint,
  ProjectionResult,
} from './model';

export function annualPercentToMonthlyRate(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

export function projectCompoundGrowth(draft: CompoundSimulationDraft): ProjectionResult {
  const savingsMonthlyRate = annualPercentToMonthlyRate(draft.baseRatePercent);
  const investmentMonthlyRate = annualPercentToMonthlyRate(
    draft.expectedAnnualReturnPercent,
  );
  const inflationAnnualRate = (
    draft.baseRatePercent + draft.inflationOffsetPercentPoints
  ) / 100;
  const totalMonths = draft.years * 12;
  let savingsBalance = 0;
  let investmentBalance = draft.initialInvestmentWon;
  let allSavingsBalance = draft.initialInvestmentWon;
  const points: ProjectionPoint[] = [];

  appendPoint(0);

  for (let month = 1; month <= totalMonths; month += 1) {
    savingsBalance = (
      savingsBalance * (1 + savingsMonthlyRate)
      + draft.source.monthlySavingsWon
    );
    investmentBalance = (
      investmentBalance * (1 + investmentMonthlyRate)
      + draft.source.monthlyInvestmentWon
    );
    allSavingsBalance = (
      allSavingsBalance * (1 + savingsMonthlyRate)
      + draft.source.monthlySavingsWon
      + draft.source.monthlyInvestmentWon
    );

    if (month % 12 === 0) appendPoint(month);
  }

  const final = points.at(-1)!;
  const finalCurrentPlanWon = selectAmount(
    draft.amountMode,
    final.currentPlanNominalWon,
    final.currentPlanRealWon,
  );
  const finalAllSavingsWon = selectAmount(
    draft.amountMode,
    final.allSavingsNominalWon,
    final.allSavingsRealWon,
  );

  return {
    points,
    finalCurrentPlanWon,
    finalAllSavingsWon,
    advantageOverAllSavingsWon: finalCurrentPlanWon - finalAllSavingsWon,
    principalRatioPercent: final.contributedPrincipalWon > 0
      ? finalCurrentPlanWon / final.contributedPrincipalWon * 100
      : null,
  };

  function appendPoint(month: number): void {
    const contributedPrincipalWon = (
      draft.initialInvestmentWon
      + (draft.source.monthlySavingsWon + draft.source.monthlyInvestmentWon) * month
    );
    const savingsNominalWon = Math.round(savingsBalance);
    const investmentNominalWon = Math.round(investmentBalance);
    const currentPlanNominalWon = savingsNominalWon + investmentNominalWon;
    const allSavingsNominalWon = Math.round(allSavingsBalance);
    const realFactor = Math.pow(1 + inflationAnnualRate, month / 12);

    points.push({
      year: month / 12,
      month,
      contributedPrincipalWon,
      savingsNominalWon,
      investmentNominalWon,
      currentPlanNominalWon,
      allSavingsNominalWon,
      currentPlanRealWon: Math.round(currentPlanNominalWon / realFactor),
      allSavingsRealWon: Math.round(allSavingsNominalWon / realFactor),
    });
  }
}

function selectAmount(
  mode: CompoundSimulationDraft['amountMode'],
  nominalWon: number,
  realWon: number,
): number {
  return mode === 'real' ? realWon : nominalWon;
}
