import { describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { createCashflowBarGeometry } from '../../../src/main/ui/setup/cashflowBarGeometry';
import { buildCashflowBarModel } from '../../../src/main/ui/setup/cashflowBarModel';

const normalFixture: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const exactFixture: MainData = {
  ...normalFixture,
  monthlyInvestmentWon: 1_100_000,
};

const deficitFixture: MainData = {
  ...normalFixture,
  monthlyInvestmentWon: 2_300_000,
};

const twoHundredPercentDeficitFixture: MainData = {
  ...normalFixture,
  monthlyNetIncomeWon: 1_000_000,
  monthlyHousingWon: 1_000_000,
  monthlyLivingWon: 0,
  monthlySavingWon: 1_000_000,
  monthlyInvestmentWon: 1_000_000,
};

const zeroIncomeFixture: MainData = {
  ...normalFixture,
  monthlyNetIncomeWon: 0,
};

const singleConsumptionOverflowFixture: MainData = {
  ...normalFixture,
  monthlyNetIncomeWon: 1_000_000,
  monthlyHousingWon: 1_250_000,
  monthlyLivingWon: 0,
  monthlySavingWon: 0,
  monthlyInvestmentWon: 0,
};

describe('createCashflowBarGeometry', () => {
  it('fills the rest of a normal 71.875% plan with remaining income', () => {
    expect(createCashflowBarGeometry(buildCashflowBarModel(normalFixture), {
      barWidthPx: 400,
      availableRightPx: 0,
    })).toEqual({
      segments: [
        { id: 'consumption', startPercent: 0, widthPercent: 56.25 },
        { id: 'saving', startPercent: 56.25, widthPercent: 9.375 },
        { id: 'investment', startPercent: 65.625, widthPercent: 6.25 },
        { id: 'remaining', startPercent: 71.875, widthPercent: 28.125 },
      ],
      overflowPercent: 0,
      desiredEndPercent: 100,
      visibleEndPercent: 100,
      clipped: false,
    });
  });

  it('keeps the fixed segment order at exactly 100%', () => {
    expect(createCashflowBarGeometry(buildCashflowBarModel(exactFixture), {
      barWidthPx: 400,
      availableRightPx: 0,
    }).segments).toEqual([
      { id: 'consumption', startPercent: 0, widthPercent: 56.25 },
      { id: 'saving', startPercent: 56.25, widthPercent: 9.375 },
      { id: 'investment', startPercent: 65.625, widthPercent: 34.375 },
      { id: 'remaining', startPercent: 100, widthPercent: 0 },
    ]);
  });

  it('preserves actual income percentages for a 37.5% deficit when it fits', () => {
    expect(createCashflowBarGeometry(buildCashflowBarModel(deficitFixture), {
      barWidthPx: 400,
      availableRightPx: 200,
    })).toEqual({
      segments: [
        { id: 'consumption', startPercent: 0, widthPercent: 56.25 },
        { id: 'saving', startPercent: 56.25, widthPercent: 9.375 },
        { id: 'investment', startPercent: 65.625, widthPercent: 71.875 },
      ],
      overflowPercent: 37.5,
      desiredEndPercent: 137.5,
      visibleEndPercent: 137.5,
      clipped: false,
    });
  });

  it('clips a 200% deficit to viewport capacity without changing segment widths', () => {
    expect(createCashflowBarGeometry(buildCashflowBarModel(twoHundredPercentDeficitFixture), {
      barWidthPx: 100,
      availableRightPx: 20,
    })).toEqual({
      segments: [
        { id: 'consumption', startPercent: 0, widthPercent: 100 },
        { id: 'saving', startPercent: 100, widthPercent: 100 },
        { id: 'investment', startPercent: 200, widthPercent: 100 },
      ],
      overflowPercent: 200,
      desiredEndPercent: 300,
      visibleEndPercent: 120,
      clipped: true,
    });
  });

  it('returns the static empty geometry when income is zero or dimensions are non-finite', () => {
    const emptyGeometry = {
      segments: [],
      overflowPercent: 0,
      desiredEndPercent: 0,
      visibleEndPercent: 0,
      clipped: false,
    };

    expect(createCashflowBarGeometry(buildCashflowBarModel(zeroIncomeFixture), {
      barWidthPx: 400,
      availableRightPx: 200,
    })).toEqual(emptyGeometry);
    expect(createCashflowBarGeometry(buildCashflowBarModel(normalFixture), {
      barWidthPx: Number.NaN,
      availableRightPx: 200,
    })).toEqual(emptyGeometry);
    expect(createCashflowBarGeometry(buildCashflowBarModel(normalFixture), {
      barWidthPx: 400,
      availableRightPx: Number.POSITIVE_INFINITY,
    })).toEqual(emptyGeometry);
  });

  it('renders a single consumption item over 100% without an overflow segment', () => {
    expect(createCashflowBarGeometry(buildCashflowBarModel(singleConsumptionOverflowFixture), {
      barWidthPx: 100,
      availableRightPx: 30,
    })).toEqual({
      segments: [
        { id: 'consumption', startPercent: 0, widthPercent: 125 },
        { id: 'saving', startPercent: 125, widthPercent: 0 },
        { id: 'investment', startPercent: 125, widthPercent: 0 },
      ],
      overflowPercent: 25,
      desiredEndPercent: 125,
      visibleEndPercent: 125,
      clipped: false,
    });
  });
});
