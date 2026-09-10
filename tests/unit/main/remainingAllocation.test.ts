import { describe, expect, it } from 'vitest';
import { allocateRemaining, availableRemainingWon } from '../../../src/main/domain/remainingAllocation';
import type { MainData } from '../../../src/main/domain/model';

const base: MainData = { schemaVersion: 2, updatedAt: 123, monthlyNetIncomeWon: 3_200_001,
  monthlyHousingWon: 800_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };

describe('remaining money allocation', () => {
  it('adds a partial allocation while retaining income, expenses and the unallocated remainder', () => {
    const result = allocateRemaining(base, 100_000, 200_000)!;
    expect(result).toEqual({ ...base, monthlySavingWon: 400_000, monthlyInvestmentWon: 400_000 });
    expect(availableRemainingWon(result)).toBe(600_001);
    expect(base.monthlySavingWon).toBe(300_000);
  });
  it('divides an odd won without losing or inventing money', () => {
    const amount = availableRemainingWon(base);
    const result = allocateRemaining(base, Math.ceil(amount / 2), Math.floor(amount / 2))!;
    expect(result.monthlySavingWon).toBe(750_001);
    expect(result.monthlyInvestmentWon).toBe(650_000);
    expect(availableRemainingWon(result)).toBe(0);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid additions: %s', value => {
    expect(allocateRemaining(base, value, 0)).toBeNull();
    expect(allocateRemaining(base, 0, value)).toBeNull();
  });
  it('blocks excess allocation and provides no spendable amount for zero or deficit plans', () => {
    expect(allocateRemaining(base, 900_002, 0)).toBeNull();
    for (const income of [2_300_000, 1]) {
      const data = { ...base, monthlyNetIncomeWon: income };
      expect(availableRemainingWon(data)).toBe(0);
      expect(allocateRemaining(data, 1, 0)).toBeNull();
    }
  });
  it('keeps exact boundaries even when intermediate outflow sums exceed the safe integer range', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(availableRemainingWon({ ...base, monthlyHousingWon: max, monthlyLivingWon: max })).toBe(0);
    const data = { ...base, monthlyNetIncomeWon: max, monthlyHousingWon: 0, monthlyLivingWon: 0,
      monthlySavingWon: max - 3, monthlyInvestmentWon: 0 };
    expect(allocateRemaining(data, 2, 1)?.monthlySavingWon).toBe(max - 1);
    expect(allocateRemaining(data, 3, 1)).toBeNull();
    expect(allocateRemaining(data, max, max)).toBeNull();
  });
});
