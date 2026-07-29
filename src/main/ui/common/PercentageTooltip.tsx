export interface PercentageTooltipProps {
  id: string;
  value: string;
  open: boolean;
  position: { xPercent: number };
}

export function PercentageTooltip({ id, value, open, position }: PercentageTooltipProps) {
  if (!open) {
    return null;
  }

  return (
    <span
      className="flow-tooltip"
      id={id}
      role="tooltip"
      style={{ left: `${position.xPercent}%` }}
    >
      {value}
    </span>
  );
}
