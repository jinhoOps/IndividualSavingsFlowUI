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
      setHorizontalCorrection((current) => {
        const uncorrectedLeft = tooltipBounds.left - current;
        const uncorrectedRight = tooltipBounds.right - current;
        const nextCorrection = uncorrectedLeft < stageBounds.left
          ? stageBounds.left - uncorrectedLeft
          : uncorrectedRight > stageBounds.right
            ? stageBounds.right - uncorrectedRight
            : 0;
        return Math.abs(current - nextCorrection) < 0.5 ? current : nextCorrection;
      });
    };

    correctHorizontalPosition();
    let frameId: number | null = null;
    let fallbackTimer: number | null = null;
    const cancelScheduledCorrection = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      frameId = null;
      fallbackTimer = null;
    };
    const scheduleCorrection = () => {
      cancelScheduledCorrection();

      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(() => {
          frameId = window.requestAnimationFrame(() => {
            frameId = null;
            correctHorizontalPosition();
          });
        });
        return;
      }

      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        correctHorizontalPosition();
      }, 0);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleCorrection);
    resizeObserver?.observe(stage);
    window.addEventListener('resize', scheduleCorrection);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleCorrection);
      cancelScheduledCorrection();
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
