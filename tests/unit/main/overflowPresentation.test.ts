import { describe, expect, it } from 'vitest';
import { createOverflowPresentation } from '../../../src/main/ui/setup/overflowPresentation';

describe('createOverflowPresentation', () => {
  it.each([
    [0, 1_000_000, 0, 0, 'none', false],
    [100_000, 1_000_000, 10, 2, 'active', false],
    [150_000, 1_000_000, 15, 3, 'active', false],
    [300_000, 1_000_000, 30, 6, 'liquid', true],
    [500_000, 1_000_000, 50, 10, 'maximum', true],
    [800_000, 1_000_000, 80, 10, 'maximum', true],
  ] as const)(
    'maps a %i won deficit against %i won income',
    (deficitWon, incomeWon, overflowPercent, displayLengthPercent, intensity, showDroplets) => {
      expect(createOverflowPresentation(deficitWon, incomeWon)).toMatchObject({
        overflowPercent,
        displayLengthPercent,
        intensity,
        showDroplets,
      });
    },
  );

  it.each([
    [100_000, 0],
    [Number.NaN, 1_000_000],
    [100_000, Number.POSITIVE_INFINITY],
    [-100_000, 1_000_000],
  ])('returns the static empty model for invalid input', (deficitWon, incomeWon) => {
    expect(createOverflowPresentation(deficitWon, incomeWon)).toEqual({
      overflowPercent: 0,
      displayLengthPercent: 0,
      flowDurationMs: 0,
      intensity: 'none',
      showDroplets: false,
    });
  });

  it('smoothly decreases duration until the 50% cap', () => {
    const at10 = createOverflowPresentation(100_000, 1_000_000);
    const at15 = createOverflowPresentation(150_000, 1_000_000);
    const at30 = createOverflowPresentation(300_000, 1_000_000);
    const at50 = createOverflowPresentation(500_000, 1_000_000);
    const at80 = createOverflowPresentation(800_000, 1_000_000);

    expect(at10.flowDurationMs).toBeGreaterThan(at15.flowDurationMs);
    expect(at15.flowDurationMs).toBeGreaterThan(at30.flowDurationMs);
    expect(at30.flowDurationMs).toBeGreaterThan(at50.flowDurationMs);
    expect(at80.flowDurationMs).toBe(at50.flowDurationMs);
  });
});
