import { describe, expect, it } from 'vitest';
import { formatWon } from '../../../src/simulation/ui/format';

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
