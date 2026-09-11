import { useLayoutEffect, useRef } from 'react';
import { animateVisualNumber } from '../../components/motion/animateVisualNumber';
import { MOTION_DURATION } from '../../components/motion/tokens';
import type { ProjectionResult } from '../domain/model';
import { formatWon } from './format';

export function SimulationComparison({ result }: { result: ProjectionResult }) {
  return (
    <dl className="simulation-comparison" aria-label="핵심 비교">
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
        <dt>넣은 돈 대비</dt>
        <dd>
          <AnimatedComparisonValue
            value={result.principalRatioPercent}
            format={formatPrincipalMultiple}
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

function formatPrincipalMultiple(value: number): string {
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value / 100)}배`;
}
