import { describe, expect, it } from 'vitest';
import type { CompoundSimulationDraft } from '../../../src/simulation/domain/model';
import {
  annualPercentToMonthlyRate,
  findTargetReachMonth,
  projectCompoundGrowth,
} from '../../../src/simulation/domain/projection';

const draft: CompoundSimulationDraft = {
  schemaVersion: 3,
  source: {
    monthlySavingsWon: 300_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 1_753_758_900_000,
  },
  initialInvestmentWon: 10_000_000,
  targetAmountWon: 100_000_000,
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

  it('samples every month through three years but keeps four years annual', () => {
    const threeYear = projectCompoundGrowth({ ...draft, years: 3 });
    const fourYear = projectCompoundGrowth({ ...draft, years: 4 });

    expect(threeYear.points).toHaveLength(37);
    expect(threeYear.points.map((point) => point.month)).toEqual(
      Array.from({ length: 37 }, (_, month) => month),
    );
    expect(fourYear.points.map((point) => point.month)).toEqual([0, 12, 24, 36, 48]);
    expect(threeYear.points.at(-1)?.month).toBe(36);
    expect(fourYear.points.at(-1)?.month).toBe(48);
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

describe('findTargetReachMonth', () => {
  const monthlyTargetDraft: CompoundSimulationDraft = {
    ...draft,
    source: {
      ...draft.source,
      monthlySavingsWon: 50_000,
      monthlyInvestmentWon: 0,
    },
    initialInvestmentWon: 10_000_000,
    expectedAnnualReturnPercent: 0,
    baseRatePercent: 0,
    inflationOffsetPercentPoints: 0,
  };

  it('returns the first monthly target reach rather than a later annual graph point', () => {
    expect(findTargetReachMonth({ ...monthlyTargetDraft, targetAmountWon: 10_600_000 })).toBe(12);
    expect(findTargetReachMonth({ ...monthlyTargetDraft, targetAmountWon: 10_050_000 })).toBe(1);
  });

  it('uses the selected amount mode when finding the target reach month', () => {
    expect(findTargetReachMonth({ ...draft, amountMode: 'real' }))
      .not.toBe(findTargetReachMonth({ ...draft, amountMode: 'nominal' }));
  });

  it('returns null for targets that are unreachable within 30 years', () => {
    expect(findTargetReachMonth({ ...draft, targetAmountWon: Number.MAX_SAFE_INTEGER }))
      .toBeNull();
  });

  it('keeps a zero-return and zero-contribution target unreachable without changing graph points', () => {
    const stalledDraft = {
      ...monthlyTargetDraft,
      source: {
        ...monthlyTargetDraft.source,
        monthlySavingsWon: 0,
      },
      targetAmountWon: 10_000_001,
    };

    expect(findTargetReachMonth(stalledDraft)).toBeNull();

    const projection = projectCompoundGrowth({ ...stalledDraft, years: 10 });
    expect(projection.points).toHaveLength(11);
    expect(projection.points.at(-1)!.month).toBe(120);
  });
});
