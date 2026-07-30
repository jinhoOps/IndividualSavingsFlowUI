import { useState } from 'react';
import type {
  CompoundSimulationDraft,
  ProjectionPoint,
  ProjectionResult,
} from '../domain/model';
import { buildChartGeometry } from './chartGeometry';
import { formatWon } from './format';

export function GrowthChart({
  result,
  amountMode,
}: {
  result: ProjectionResult;
  amountMode: CompoundSimulationDraft['amountMode'];
}) {
  const [active, setActive] = useState<ProjectionPoint | null>(null);
  const geometry = buildChartGeometry(result.points, amountMode);
  const last = result.points.at(-1)!;
  const finalCurrent = displayed(last, 'current', amountMode);
  const finalSavings = displayed(last, 'allSavings', amountMode);

  return (
    <section className="growth-chart" aria-labelledby="growth-chart-title">
      <div className="growth-chart__header">
        <h2 id="growth-chart-title">시간이 만든 차이</h2>
        <div className="growth-chart__legend" aria-label="그래프 범례">
          <span><i className="growth-chart__legend-current" />현재 계획</span>
          <span><i className="growth-chart__legend-savings" />전부 저축</span>
        </div>
      </div>
      <p className="sr-only">
        {`현재 계획 ${formatWon(finalCurrent)}, 전부 저축 ${formatWon(finalSavings)}, 차이 ${formatWon(finalCurrent - finalSavings)}`}
      </p>
      <div className="growth-chart__canvas">
        <svg
          viewBox="0 0 680 285"
          role="img"
          aria-label="연도별 복리 성장 그래프"
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (bounds.width <= 0) return;
            const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
            const index = Math.round(ratio * (result.points.length - 1));
            setActive(result.points[index] ?? null);
          }}
        >
          <path className="growth-chart__area" d={geometry.currentPlanAreaPath} />
          <path className="growth-chart__current" d={geometry.currentPlanPath} />
          <path className="growth-chart__savings" d={geometry.allSavingsPath} />
        </svg>
        <input
          className="growth-chart__scrubber"
          aria-label="그래프 연도 상세"
          type="range"
          min="0"
          max={result.points.length - 1}
          step="1"
          value={active?.year ?? result.points.length - 1}
          onChange={(event) => {
            setActive(result.points[Number(event.target.value)] ?? null);
          }}
        />
        {active === null ? null : (
          <aside className="growth-chart__tooltip" aria-live="polite">
            <strong>{active.year}년</strong>
            <Detail label="현재 계획 총액" value={displayed(active, 'current', amountMode)} />
            <Detail label="전부 저축 총액" value={displayed(active, 'allSavings', amountMode)} />
            <Detail label="누적 납입원금" value={active.contributedPrincipalWon} />
            <Detail label="저축 잔액" value={active.savingsNominalWon} />
            <Detail label="투자 잔액" value={active.investmentNominalWon} />
            <button type="button" onClick={() => setActive(null)}>닫기</button>
          </aside>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return <p><span>{label}</span><b>{formatWon(value)}</b></p>;
}

function displayed(
  point: ProjectionPoint,
  series: 'current' | 'allSavings',
  mode: CompoundSimulationDraft['amountMode'],
): number {
  if (mode === 'real') {
    return series === 'current' ? point.currentPlanRealWon : point.allSavingsRealWon;
  }
  return series === 'current' ? point.currentPlanNominalWon : point.allSavingsNominalWon;
}
