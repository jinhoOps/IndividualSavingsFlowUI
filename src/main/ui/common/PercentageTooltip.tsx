import { useLayoutEffect, useRef, useState } from 'react';

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
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [horizontalCorrection, setHorizontalCorrection] = useState(0);

  const endContained = position.alignment === 'end-contained';

  useLayoutEffect(() => {
    if (endContained) {
      setHorizontalCorrection(0);
      return;
    }

    const tooltip = tooltipRef.current;
    const stage = tooltip?.parentElement;
    if (tooltip === null || stage == null) return;

    const tooltipBounds = tooltip.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const nextCorrection = tooltipBounds.left < stageBounds.left
      ? stageBounds.left - tooltipBounds.left
      : tooltipBounds.right > stageBounds.right
        ? stageBounds.right - tooltipBounds.right
        : 0;
    setHorizontalCorrection((current) => (
      Math.abs(current - nextCorrection) < 0.5 ? current : nextCorrection
    ));
  }, [endContained, position.xPercent, value]);

  if (!open) {
    return null;
  }

  return (
    <span
      className={`flow-tooltip${endContained ? ' flow-tooltip--end-contained' : ''}`}
      id={id}
      ref={tooltipRef}
      role="tooltip"
      style={endContained
        ? { insetInlineEnd: 0 }
        : {
          left: `${position.xPercent}%`,
          transform: `translateX(calc(-50% + ${horizontalCorrection}px))`,
        }}
    >
      {value}
    </span>
  );
}
