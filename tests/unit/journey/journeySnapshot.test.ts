import { describe, expect, it } from 'vitest';
import {
  createMainJourneySnapshot,
  createPortfolioJourneySnapshot,
  parseJourneySnapshot,
} from '../../../src/journey/domain/journeySnapshot';

describe('JourneySnapshot', () => {
  it('creates the Main to Simulation summary without detailed Main fields', () => {
    const snapshot = createMainJourneySnapshot({
      schemaVersion: 2,
      updatedAt: 10,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    }, 20);

    expect(snapshot).toEqual({
      version: 1,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: 1_100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    });
    expect(snapshot).not.toHaveProperty('monthlyNetIncomeWon');
  });

  it('preserves the amount and Main timestamp for Portfolio', () => {
    const source = parseJourneySnapshot({
      version: 1,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: -100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    });
    expect(createPortfolioJourneySnapshot(source!, 30)).toEqual({
      version: 1,
      sourceApp: 'simulation',
      sourceView: 'simulation-readiness',
      destinationApp: 'portfolio',
      monthlyInvestableAmountWon: -100_000,
      mainUpdatedAt: 10,
      createdAt: 30,
    });
  });

  it.each([
    null,
    {},
    { version: 2 },
    { version: 1, monthlyInvestableAmountWon: Number.NaN },
    { version: 1, monthlyInvestableAmountWon: 1.5 },
  ])('rejects invalid input %#', (value) => {
    expect(parseJourneySnapshot(value)).toBeNull();
  });
});
