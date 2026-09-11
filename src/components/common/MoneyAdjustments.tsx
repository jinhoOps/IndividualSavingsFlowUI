import { Button } from './Button';

export interface MoneyAdjustment {
  label: string;
  deltaWon: number;
}

export const DEFAULT_MONEY_ADJUSTMENTS: readonly MoneyAdjustment[] = [
  { label: '-50만', deltaWon: -500_000 },
  { label: '-10만', deltaWon: -100_000 },
  { label: '+10만', deltaWon: 100_000 },
  { label: '+50만', deltaWon: 500_000 },
];

/** Shared presentation only; each input retains its own amount and persistence rules. */
export function MoneyAdjustments({
  adjustments = DEFAULT_MONEY_ADJUSTMENTS,
  label = '금액 빠른 조정',
  className = '',
  disabled = false,
  isAdjustmentDisabled,
  onAdjust,
}: {
  adjustments?: readonly MoneyAdjustment[];
  label?: string;
  className?: string;
  disabled?: boolean;
  isAdjustmentDisabled?(deltaWon: number): boolean;
  onAdjust(deltaWon: number): void;
}) {
  if (adjustments.length === 0) return null;
  return <div className={`ui-money-adjustments ${className}`.trim()} role="group" aria-label={label}>
    {adjustments.map(({ label: text, deltaWon }) => <Button
      key={`${text}-${deltaWon}`}
      type="button"
      variant="quiet"
      data-direction={deltaWon < 0 ? 'decrease' : 'increase'}
      disabled={disabled || isAdjustmentDisabled?.(deltaWon)}
      onClick={() => onAdjust(deltaWon)}
    >{text}</Button>)}
  </div>;
}
