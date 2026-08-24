import type {
  CompoundSimulationDraft,
  ProjectionPoint,
  ProjectionResult,
} from './model';

export function annualPercentToMonthlyRate(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

export function findTargetReachMonth(draft: CompoundSimulationDraft): number | null {
  if (draft.targetAmountWon === null) return null;

  const rates = createProjectionRates(draft);
  let savingsBalance = 0;
  let investmentBalance = draft.initialInvestmentWon;

  for (let month = 1; month <= 360; month += 1) {
    ({ savingsBalance, investmentBalance } = advanceCurrentPlanBalances(
      savingsBalance,
      investmentBalance,
      draft,
      rates,
    ));

    const amount = draft.amountMode === 'nominal'
      ? Math.round(savingsBalance) + Math.round(investmentBalance)
      : Math.round(
        (savingsBalance + investmentBalance)
          / Math.pow(1 + rates.inflationAnnualRate, month / 12),
      );

    if (amount >= draft.targetAmountWon) return month;
  }

  return null;
}

export function projectCompoundGrowth(draft: CompoundSimulationDraft): ProjectionResult {
  const rates = createProjectionRates(draft);
  const totalMonths = draft.years * 12;
  const includeEveryMonth = totalMonths <= 36;
  let savingsBalance = 0;
  let investmentBalance = draft.initialInvestmentWon;
  let allSavingsBalance = draft.initialInvestmentWon;
  const points: ProjectionPoint[] = [];

  appendPoint(0);

  for (let month = 1; month <= totalMonths; month += 1) {
    ({ savingsBalance, investmentBalance } = advanceCurrentPlanBalances(
      savingsBalance,
      investmentBalance,
      draft,
      rates,
    ));
    allSavingsBalance = advanceAllSavingsBalance(allSavingsBalance, draft, rates);

    if (includeEveryMonth || month % 12 === 0) appendPoint(month);
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
      ? finalCurrentPlanWon / selectAmount(
        draft.amountMode,
        final.contributedPrincipalWon,
        final.contributedPrincipalRealWon,
      ) * 100
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
    const realFactor = Math.pow(1 + rates.inflationAnnualRate, month / 12);
    const savingsRealWon = Math.round(savingsNominalWon / realFactor);
    const investmentRealWon = Math.round(investmentNominalWon / realFactor);

    points.push({
      year: month / 12,
      month,
      contributedPrincipalWon,
      contributedPrincipalRealWon: Math.round(contributedPrincipalWon / realFactor),
      savingsNominalWon,
      savingsRealWon,
      investmentNominalWon,
      investmentRealWon,
      currentPlanNominalWon,
      allSavingsNominalWon,
      currentPlanRealWon: savingsRealWon + investmentRealWon,
      allSavingsRealWon: Math.round(allSavingsNominalWon / realFactor),
    });
  }
}

function createProjectionRates(draft: CompoundSimulationDraft): {
  savingsMonthlyRate: number;
  investmentMonthlyRate: number;
  inflationAnnualRate: number;
} {
  return {
    savingsMonthlyRate: annualPercentToMonthlyRate(draft.baseRatePercent),
    investmentMonthlyRate: annualPercentToMonthlyRate(draft.expectedAnnualReturnPercent),
    inflationAnnualRate: (
      draft.baseRatePercent + draft.inflationOffsetPercentPoints
    ) / 100,
  };
}

function advanceCurrentPlanBalances(
  savingsBalance: number,
  investmentBalance: number,
  draft: CompoundSimulationDraft,
  rates: ReturnType<typeof createProjectionRates>,
): { savingsBalance: number; investmentBalance: number } {
  return {
    savingsBalance: (
      savingsBalance * (1 + rates.savingsMonthlyRate)
      + draft.source.monthlySavingsWon
    ),
    investmentBalance: (
      investmentBalance * (1 + rates.investmentMonthlyRate)
      + draft.source.monthlyInvestmentWon
    ),
  };
}

function advanceAllSavingsBalance(
  allSavingsBalance: number,
  draft: CompoundSimulationDraft,
  rates: ReturnType<typeof createProjectionRates>,
): number {
  return (
    allSavingsBalance * (1 + rates.savingsMonthlyRate)
    + draft.source.monthlySavingsWon
    + draft.source.monthlyInvestmentWon
  );
}

function selectAmount(
  mode: CompoundSimulationDraft['amountMode'],
  nominalWon: number,
  realWon: number,
): number {
  return mode === 'real' ? realWon : nominalWon;
}
