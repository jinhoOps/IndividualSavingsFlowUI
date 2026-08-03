import { describe, expect, it } from 'vitest';
import { formatAllocationPercent, formatPortfolioWon } from '../../../src/portfolio/ui/format';

describe('Portfolio formatting', () => {
  it.each([
    [10_499, '10,000원'],
    [10_500, '11,000원'],
    [1_234_567, '1,235,000원'],
  ])('rounds %i to thousand won', (value, expected) => {
    expect(formatPortfolioWon(value as number)).toBe(expected);
  });

  it.each([[25, '25%'], [33.3, '33.3%']])('formats compact percent', (value, expected) => {
    expect(formatAllocationPercent(value as number)).toBe(expected);
  });
});
