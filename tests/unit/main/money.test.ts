import { describe, expect, it } from 'vitest';
import { formatWon, parseWonInput } from '../../../src/main/domain/money';

describe('parseWonInput', () => {
  it('parses comma- and whitespace-separated won integers', () => {
    expect(parseWonInput('1,250,000')).toBe(1_250_000);
    expect(parseWonInput('1 250 000')).toBe(1_250_000);
  });

  it('normalizes empty, negative, and malformed values to zero', () => {
    expect(parseWonInput('')).toBe(0);
    expect(parseWonInput('-1')).toBe(0);
    expect(parseWonInput('1.5')).toBe(0);
  });
});

describe('formatWon', () => {
  it('keeps hundred-million-won amounts readable in won', () => {
    expect(formatWon(100_000_000)).toBe('100,000,000원');
  });
});
