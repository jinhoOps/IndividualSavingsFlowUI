import { describe, expect, it } from 'vitest';
import { normalizePortfolioName } from '../../../src/portfolio/domain/allocation';
import { parsePortfolioPlan } from '../../../src/portfolio/domain/validation';

describe('Portfolio validation', () => {
  it('normalizes names for duplicate comparison', () => {
    expect(normalizePortfolioName('  US   INDEX ')).toBe('us index');
  });

  it('rejects duplicate normalized names', () => {
    expect(parsePortfolioPlan({
      schemaVersion: 1,
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
