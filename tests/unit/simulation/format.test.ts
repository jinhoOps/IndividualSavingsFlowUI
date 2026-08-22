import { describe, expect, it } from 'vitest';
import { formatTargetReachDuration, formatWon } from '../../../src/simulation/ui/format';

describe('Simulation money formatting', () => {
  it.each([
    [82_405_500, '8,240만 6천 원'],
    [1_234_567, '123만 5천 원'],
    [999_500, '100만 원'],
    [482_405_500, '4억 8,241만 원'],
    [400_000_000, '4억 원'],
    [1_250_040_000_000, '1조 2,500억 4,000만 원'],
    [-1_234_567, '-123만 5천 원'],
    [0, '0원'],
  ])('formats %i with Korean integer units', (amount, expected) => {
    expect(formatWon(amount)).toBe(expected);
    expect(formatWon(amount)).not.toContain('.');
  });
});

describe('Simulation target reach duration formatting', () => {
  it.each([
    [12, '1년'],
    [19, '1년 7개월'],
    [9, '9개월'],
  ])('formats %i months without a zero-month suffix', (month, expected) => {
    expect(formatTargetReachDuration(month)).toBe(expected);
  });

  it('rejects month zero instead of formatting it as zero months', () => {
    expect(() => formatTargetReachDuration(0)).toThrow(RangeError);
  });
});
