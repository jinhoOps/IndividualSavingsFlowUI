import { describe, expect, it } from 'vitest';
import { adjustWon, formatWon, formatWonInput, normalizeMoneyEdit, parseWonInput } from '../../../src/main/domain/money';

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

describe('caret-safe money editing', () => {
  it('keeps a caret after the same number of digits when formatting is unchanged', () => {
    expect(normalizeMoneyEdit('3,020,000', 4)).toEqual({
      valueWon: 3_020_000,
      displayValue: '3,020,000',
      caret: 4,
    });
  });

  it('maps an insertion before a comma by its digit position', () => {
    expect(normalizeMoneyEdit('3,200,000', 3)).toMatchObject({
      valueWon: 3_200_000,
      displayValue: '3,200,000',
      caret: 3,
    });
  });

  it('maps backward deletion and selected replacement by their remaining digits', () => {
    expect(normalizeMoneyEdit('1,234,000', 4)).toMatchObject({
      valueWon: 1_234_000,
      caret: 4,
    });
    expect(normalizeMoneyEdit('9,000', 1)).toMatchObject({
      valueWon: 9_000,
      displayValue: '9,000',
      caret: 1,
    });
  });

  it('sanitizes pasted Korean and whitespace text into a formatted integer', () => {
    expect(normalizeMoneyEdit('₩ 3백 20 만 원', 11)).toEqual({
      valueWon: 320,
      displayValue: '320',
      caret: 3,
    });
  });

  it('keeps a leading caret before the first sanitized digit', () => {
    expect(normalizeMoneyEdit('₩3,000', 1)).toMatchObject({
      valueWon: 3_000,
      displayValue: '3,000',
      caret: 0,
    });
  });

  it('normalizes empty and unsafe edits to an empty input', () => {
    expect(normalizeMoneyEdit('', 0)).toEqual({ valueWon: 0, displayValue: '', caret: 0 });
    expect(normalizeMoneyEdit('9,007,199,254,740,992', 21)).toEqual({ valueWon: 0, displayValue: '', caret: 0 });
  });

  it('formats input values and clamps adjustments at zero', () => {
    expect(formatWonInput(3_500_000)).toBe('3,500,000');
    expect(formatWonInput(0)).toBe('');
    expect(adjustWon(50_000, -100_000)).toBe(0);
    expect(adjustWon(3_000_000, 500_000)).toBe(3_500_000);
  });
});
