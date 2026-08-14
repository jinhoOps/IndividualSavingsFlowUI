export interface PercentageTooltipProps {
  id: string;
  value: string;
  open: boolean;
  position: {
    alignment?: 'center' | 'end-contained';
    xPercent: number;
  };
}

export function PercentageTooltip({ id, value, open, position }: PercentageTooltipProps) {
  if (!open) {
    return null;
  }

  const endContained = position.alignment === 'end-contained';

  return (
    <span
      className={`flow-tooltip${endContained ? ' flow-tooltip--end-contained' : ''}`}
      id={id}
      role="tooltip"
      style={endContained
        ? { insetInlineEnd: 0 }
        : { left: `${position.xPercent}%` }}
    >
      {value}
    </span>
  );
}
