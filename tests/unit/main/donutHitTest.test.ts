import { describe, expect, it } from 'vitest';
import { calculateCashflowInsight } from '../../../src/main/domain/cashflowInsight';
import type { MainData } from '../../../src/main/domain/model';
import { hitTestDonutAllocation } from '../../../src/main/ui/dashboard/donutHitTest';

const appliedData: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const bounds = { left: 0, top: 0, width: 100, height: 100 };

describe('hitTestDonutAllocation', () => {
  it('maps clockwise ring positions to their visible allocations', () => {
    const allocations = calculateCashflowInsight(appliedData).allocations;

    expect(hitTestDonutAllocation(allocations, { x: 50, y: 10 }, bounds)).toBe('consumption');
    expect(hitTestDonutAllocation(allocations, { x: 26.5, y: 82.4 }, bounds)).toBe('saving');
    expect(hitTestDonutAllocation(allocations, { x: 13.8, y: 67 }, bounds)).toBe('investment');
    expect(hitTestDonutAllocation(allocations, { x: 10, y: 50 }, bounds)).toBe('remaining');
  });

  it('ignores the center hole, the outside, and invalid bounds', () => {
    const allocations = calculateCashflowInsight(appliedData).allocations;

    expect(hitTestDonutAllocation(allocations, { x: 50, y: 50 }, bounds)).toBeUndefined();
    expect(hitTestDonutAllocation(allocations, { x: 99, y: 50 }, bounds)).toBeUndefined();
    expect(hitTestDonutAllocation(allocations, { x: 50, y: 10 }, { ...bounds, width: 0 })).toBeUndefined();
  });

  it('uses the clipped investment segment when the plan exceeds income', () => {
    const allocations = calculateCashflowInsight({
      ...appliedData,
      monthlyInvestmentWon: 1_500_000,
    }).allocations;

    expect(hitTestDonutAllocation(allocations, { x: 26.5, y: 17.6 }, bounds)).toBe('investment');
    expect(allocations.some(({ id }) => id === 'remaining')).toBe(false);
  });
});
