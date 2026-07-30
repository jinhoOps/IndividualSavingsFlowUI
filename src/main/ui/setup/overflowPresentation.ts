export type OverflowIntensity = 'none' | 'calm' | 'active' | 'liquid' | 'maximum';

export interface OverflowPresentation {
  overflowPercent: number;
  displayLengthPercent: number;
  flowDurationMs: number;
  intensity: OverflowIntensity;
  showDroplets: boolean;
}

const EMPTY_OVERFLOW: OverflowPresentation = {
  overflowPercent: 0,
  displayLengthPercent: 0,
  flowDurationMs: 0,
  intensity: 'none',
  showDroplets: false,
};

export function createOverflowPresentation(
  deficitWon: number,
  incomeWon: number,
): OverflowPresentation {
  if (
    !Number.isFinite(deficitWon)
    || !Number.isFinite(incomeWon)
    || deficitWon <= 0
    || incomeWon <= 0
  ) {
    return EMPTY_OVERFLOW;
  }

  const overflowPercent = deficitWon / incomeWon * 100;
  const cappedPercent = Math.min(overflowPercent, 50);
  const intensity: OverflowIntensity = cappedPercent >= 50
    ? 'maximum'
    : cappedPercent >= 30
      ? 'liquid'
      : cappedPercent >= 10
        ? 'active'
        : 'calm';

  return {
    overflowPercent,
    displayLengthPercent: cappedPercent / 5,
    flowDurationMs: Math.round(1_400 - cappedPercent / 50 * 950),
    intensity,
    showDroplets: cappedPercent >= 30,
  };
}
