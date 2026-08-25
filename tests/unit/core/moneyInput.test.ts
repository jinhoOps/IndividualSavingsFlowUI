import { describe, expect, it } from 'vitest';
import {
  adjustWon,
  formatWonInput,
  normalizeMoneyEdit,
  parseWonInput,
} from '../../../src/core/domain/moneyInput';

describe('parseWonInput', () => {
  it('parses comma-separated Won input as a safe integer', () => {
    expect(parseWonInput('1,250,000')).toBe(1_250_000);
  });

  it('returns zero for empty, malformed, negative, and unsafe input', () => {
    expect(parseWonInput('')).toBe(0);
    expect(parseWonInput('1.5')).toBe(0);
    expect(parseWonInput('-1')).toBe(0);
    expect(parseWonInput('9,007,199,254,740,992')).toBe(0);
  });
});

describe('formatWonInput', () => {
  it('formats positive values and preserves the requested zero display', () => {
    expect(formatWonInput(3_500_000)).toBe('3,500,000');
    expect(formatWonInput(0)).toBe('');
    expect(formatWonInput(0, { zeroDisplay: 'zero' })).toBe('0');
  });
});

describe('normalizeMoneyEdit', () => {
  it('keeps a caret after the same number of digits when formatting', () => {
    expect(normalizeMoneyEdit('3,020,000', 4)).toEqual({
      valueWon: 3_020_000,
      displayValue: '3,020,000',
      caret: 4,
    });
  });

  it('keeps zero visible for surfaces that already display zero', () => {
    expect(normalizeMoneyEdit('0', 1, { zeroDisplay: 'zero' })).toEqual({
      valueWon: 0,
      displayValue: '0',
      caret: 1,
    });
  });

  it('normalizes empty and unsafe edits without emitting unsafe values', () => {
    expect(normalizeMoneyEdit('', 0)).toEqual({ valueWon: 0, displayValue: '', caret: 0 });
    expect(normalizeMoneyEdit('9,007,199,254,740,992', 21)).toEqual({
      valueWon: 0,
      displayValue: '',
      caret: 0,
    });
  });
});

describe('adjustWon', () => {
  it('clamps negative adjustments at zero', () => {
    expect(adjustWon(50_000, -100_000)).toBe(0);
    expect(adjustWon(3_000_000, 500_000)).toBe(3_500_000);
  });
});
