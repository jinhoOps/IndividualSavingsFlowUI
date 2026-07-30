import { describe, expect, it } from 'vitest';
import {
  createMainJourneySnapshot,
  createPortfolioJourneySnapshot,
  parseJourneySnapshot,
} from '../../../src/journey/domain/journeySnapshot';

const validMainSnapshot = {
  version: 1,
  sourceApp: 'main',
  sourceView: 'dashboard',
  destinationApp: 'simulation',
  monthlyInvestableAmountWon: 1_100_000,
  mainUpdatedAt: 10,
  createdAt: 20,
};

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

  it.each([
    ['unknown source app', { sourceApp: 'portfolio' }],
    ['Main with the Simulation source view', { sourceView: 'simulation-readiness' }],
    ['Main directed to Portfolio', { destinationApp: 'portfolio' }],
    ['Simulation with the Main source view', {
      sourceApp: 'simulation',
      sourceView: 'dashboard',
      destinationApp: 'portfolio',
    }],
    ['Simulation directed back to Simulation', {
      sourceApp: 'simulation',
      sourceView: 'simulation-readiness',
      destinationApp: 'simulation',
    }],
  ])('rejects the invalid route tuple: %s', (_label, mutation) => {
    expect(parseJourneySnapshot({ ...validMainSnapshot, ...mutation })).toBeNull();
  });

  it.each([
    ['fractional amount', { monthlyInvestableAmountWon: 1.5 }],
    ['positive unsafe amount', { monthlyInvestableAmountWon: Number.MAX_SAFE_INTEGER + 1 }],
    ['negative unsafe amount', { monthlyInvestableAmountWon: Number.MIN_SAFE_INTEGER - 1 }],
    ['negative Main timestamp', { mainUpdatedAt: -1 }],
    ['fractional Main timestamp', { mainUpdatedAt: 1.5 }],
    ['out-of-range Main timestamp', { mainUpdatedAt: 8_640_000_000_000_001 }],
    ['unsafe Main timestamp', { mainUpdatedAt: Number.MAX_SAFE_INTEGER + 1 }],
    ['negative creation timestamp', { createdAt: -1 }],
    ['fractional creation timestamp', { createdAt: 1.5 }],
    ['out-of-range creation timestamp', { createdAt: 8_640_000_000_000_001 }],
    ['unsafe creation timestamp', { createdAt: Number.MAX_SAFE_INTEGER + 1 }],
  ])('rejects the numeric boundary: %s', (_label, mutation) => {
    expect(parseJourneySnapshot({ ...validMainSnapshot, ...mutation })).toBeNull();
  });

  it.each([
    ['zero amount', { monthlyInvestableAmountWon: 0 }],
    ['negative amount', { monthlyInvestableAmountWon: -1 }],
    ['largest date-compatible timestamps', {
      mainUpdatedAt: 8_640_000_000_000_000,
      createdAt: 8_640_000_000_000_000,
    }],
  ])('accepts the valid boundary: %s', (_label, mutation) => {
    expect(parseJourneySnapshot({ ...validMainSnapshot, ...mutation })).toEqual({
      ...validMainSnapshot,
      ...mutation,
    });
  });
});
