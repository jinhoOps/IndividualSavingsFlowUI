import { useLayoutEffect, useRef } from 'react';
import { animateVisualNumber } from '../../components/motion/animateVisualNumber';
import { MOTION_DURATION } from '../../components/motion/tokens';
import type { ProjectionResult } from '../domain/model';
import { formatWon } from './format';

export function SimulationComparison({ result }: { result: ProjectionResult }) {
  return (
    <dl className="simulation-comparison ui-surface" aria-label="핵심 비교">
      <div>
        <dt>전부 저축보다</dt>
        <dd>
          <AnimatedComparisonValue
            value={result.advantageOverAllSavingsWon}
            format={formatWon}
          />
        </dd>
      </div>
      <div>
        <dt>납입원금 대비</dt>
        <dd>
          <AnimatedComparisonValue
            value={result.principalRatioPercent}
            format={formatRoundedPercent}
          />
        </dd>
      </div>
    </dl>
  );
}

function AnimatedComparisonValue({
  value,
  format,
}: {
  value: number | null;
  format(value: number): string;
}) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(value);
  const rendered = value === null ? '—' : format(value);

  useLayoutEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;
    if (
      previousValue === null
      || value === null
      || previousValue === value
      || visualRef.current === null
    ) return;
    return animateVisualNumber(
      visualRef.current,
      previousValue,
      value,
      format,
      MOTION_DURATION.emphasis,
    );
  }, [format, value]);

  return (
    <>
      <span className="sr-only simulation-comparison__semantic-value">{rendered}</span>
      <span
        aria-hidden="true"
        className="simulation-comparison__visual-value"
        ref={visualRef}
      >
        {rendered}
      </span>
    </>
  );
}

function formatRoundedPercent(value: number): string {
  return `${Math.round(value)}%`;
}
