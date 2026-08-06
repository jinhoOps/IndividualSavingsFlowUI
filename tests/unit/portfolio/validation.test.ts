import { describe, expect, it } from 'vitest';
import { normalizePortfolioName } from '../../../src/portfolio/domain/allocation';
import { parsePortfolioPlan } from '../../../src/portfolio/domain/validation';

const validPlanV2 = {
  schemaVersion: 2,
  items: [{ id: 'a', name: '미국 인덱스', shareUnits: 800_000, order: 0 }],
  cashShareUnits: 200_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 100_000,
  appliedAt: 1,
  updatedAt: 1,
};

const validPlanV1 = {
  ...validPlanV2,
  schemaVersion: 1,
};

describe('Portfolio validation', () => {
  it('normalizes names for duplicate comparison', () => {
    expect(normalizePortfolioName('  US   INDEX ')).toBe('us index');
  });

  it('accepts aggregate and non-empty location scopes in schema v2', () => {
    expect(parsePortfolioPlan({ ...validPlanV2, scope: { type: 'aggregate' } })).not.toBeNull();
    expect(parsePortfolioPlan({
      ...validPlanV2,
      scope: { type: 'location', locationId: 'loc-isa' },
    })).not.toBeNull();
  });

  it('rejects schema v1 and empty location scope IDs', () => {
    expect(parsePortfolioPlan(validPlanV1)).toBeNull();
    expect(parsePortfolioPlan({
      ...validPlanV2,
      scope: { type: 'location', locationId: '' },
    })).toBeNull();
  });

  it('rejects duplicate normalized names', () => {
    expect(parsePortfolioPlan({
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [
        { id: 'a', name: '미국  인덱스', shareUnits: 400_000, order: 0 },
        { id: 'b', name: '미국 인덱스', shareUnits: 400_000, order: 1 },
      ],
      cashShareUnits: 200_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 100_000,
      appliedAt: 1,
      updatedAt: 1,
    })).toBeNull();
  });
});
