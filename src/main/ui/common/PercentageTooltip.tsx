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
    if (!open || endContained) {
      setHorizontalCorrection(0);
      return;
    }

    const tooltip = tooltipRef.current;
    const stage = tooltip?.parentElement;
    if (tooltip === null || stage == null) return;

    const correctHorizontalPosition = () => {
      const tooltipBounds = tooltip.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const correctionDelta = tooltipBounds.left < stageBounds.left
        ? stageBounds.left - tooltipBounds.left
        : tooltipBounds.right > stageBounds.right
          ? stageBounds.right - tooltipBounds.right
          : 0;
      setHorizontalCorrection((current) => (
        Math.abs(correctionDelta) < 0.5 ? current : current + correctionDelta
      ));
    };

    correctHorizontalPosition();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(correctHorizontalPosition);
    resizeObserver?.observe(stage);
    window.addEventListener('resize', correctHorizontalPosition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', correctHorizontalPosition);
    };
  }, [endContained, open, position.xPercent, value]);

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
