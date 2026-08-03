import { describe, expect, it } from 'vitest';
import type { CompoundSimulationDraft } from '../../../src/simulation/domain/model';
import {
  annualPercentToMonthlyRate,
  projectCompoundGrowth,
} from '../../../src/simulation/domain/projection';

const draft: CompoundSimulationDraft = {
  schemaVersion: 2,
  source: {
    monthlySavingsWon: 300_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 1_753_758_900_000,
  },
  initialInvestmentWon: 10_000_000,
  years: 10,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal',
  updatedAt: 1_753_758_900_100,
};

describe('projectCompoundGrowth', () => {
  it('converts an effective annual return into its equivalent monthly rate', () => {
    expect(annualPercentToMonthlyRate(9)).toBeCloseTo(0.0072073233, 10);
  });

  it('keeps yearly balances and contributed principal internally consistent', () => {
    const result = projectCompoundGrowth(draft);
    const final = result.points.at(-1)!;

    expect(result.points).toHaveLength(11);
    expect(final.month).toBe(120);
    expect(final.currentPlanNominalWon).toBe(
      final.savingsNominalWon + final.investmentNominalWon,
    );
    expect(final.contributedPrincipalWon).toBe(70_000_000);
    expect(final.currentPlanNominalWon).toBeGreaterThan(final.allSavingsNominalWon);
    expect(result.principalRatioPercent).toBeCloseTo(
      final.currentPlanNominalWon / 70_000_000 * 100,
      6,
    );
  });

  it('uses the same starting principal in both comparison paths', () => {
    const result = projectCompoundGrowth({ ...draft, years: 1 });

    expect(result.points[0].allSavingsNominalWon).toBe(10_000_000);
    expect(result.points[0].investmentNominalWon).toBe(10_000_000);
  });

  it('returns only the starting principal at year zero', () => {
    const result = projectCompoundGrowth({ ...draft, years: 0 });

    expect(result.points).toHaveLength(1);
    expect(result.finalCurrentPlanWon).toBe(10_000_000);
    expect(result.finalAllSavingsWon).toBe(10_000_000);
    expect(result.advantageOverAllSavingsWon).toBe(0);
  });

  it('discounts displayed totals in real mode without changing nominal paths', () => {
    const nominal = projectCompoundGrowth(draft);
    const real = projectCompoundGrowth({ ...draft, amountMode: 'real' });

    expect(real.finalCurrentPlanWon).toBeLessThan(nominal.finalCurrentPlanWon);
    expect(real.points.at(-1)!.currentPlanNominalWon).toBe(
      nominal.points.at(-1)!.currentPlanNominalWon,
    );
    const final = real.points.at(-1)!;
    expect(final.currentPlanRealWon).toBe(final.savingsRealWon + final.investmentRealWon);
    expect(real.principalRatioPercent).toBeCloseTo(
      final.currentPlanRealWon / final.contributedPrincipalRealWon * 100,
      6,
    );
  });
});
