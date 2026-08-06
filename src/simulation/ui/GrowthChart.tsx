import { useEffect, useRef, useState } from 'react';
import { Surface } from '../../components/common/Surface';
import type {
  CompoundSimulationDraft,
  ProjectionPoint,
  ProjectionResult,
} from '../domain/model';
import { buildChartGeometry, tooltipPlacement } from './chartGeometry';
import { formatWon } from './format';
import { GrowthChartTooltip } from './GrowthChartTooltip';

export function GrowthChart({
  result,
  amountMode,
}: {
  result: ProjectionResult;
  amountMode: CompoundSimulationDraft['amountMode'];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLElement>(null);
  const touchPointerRef = useRef<number | null>(null);
  const compactTooltip = useCompactTooltip();
  useEffect(() => {
    if (activeIndex === null) return undefined;
    const dismiss = () => setActiveIndex(null);
    const dismissOutside = (event: PointerEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) dismiss();
    };
    document.addEventListener('pointerdown', dismissOutside);
    window.addEventListener('scroll', dismiss, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      window.removeEventListener('scroll', dismiss);
    };
  }, [activeIndex]);
  const geometry = buildChartGeometry(result.points, amountMode);
  const last = result.points.at(-1)!;
  const finalCurrent = displayed(last, 'current', amountMode);
  const finalSavings = displayed(last, 'allSavings', amountMode);
  const activeGeometry = activeIndex === null ? null : geometry.points[activeIndex] ?? null;
  const active = activeGeometry?.point ?? null;
  const tooltipSize = compactTooltip
    ? { width: 192, height: 112 }
    : { width: 240, height: 230 };
  const placement = activeGeometry === null ? null : tooltipPlacement({
    anchorX: activeGeometry.x,
    anchorY: Math.min(activeGeometry.currentY, activeGeometry.allSavingsY),
    chartWidth: 680,
    tooltipWidth: tooltipSize.width,
    tooltipHeight: tooltipSize.height,
  });

  return (
    <Surface
      as="section"
      ref={chartRef}
      className="growth-chart"
      aria-labelledby="growth-chart-title"
      aria-label="복리 성장 그래프"
    >
      <div className="growth-chart__header">
        <h2 id="growth-chart-title">시간이 만든 차이</h2>
        <div className="growth-chart__legend" aria-label="그래프 범례">
          <span><i className="growth-chart__legend-current" />현재 계획</span>
          <span><i className="growth-chart__legend-savings" />전부 저축</span>
        </div>
      </div>
      <p className="sr-only">
        {`${amountMode === 'nominal' ? '명목' : '실질'} 기준 ${last.year}년, 현재 계획 ${formatWon(finalCurrent)}, 전부 저축 ${formatWon(finalSavings)}, 차이 ${formatWon(finalCurrent - finalSavings)}`}
      </p>
      <div
        className="growth-chart__canvas"
        role="application"
        aria-label="그래프 연도 탐색"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setActiveIndex(null);
          if (event.key === 'Home') setActiveIndex(0);
          if (event.key === 'End') setActiveIndex(result.points.length - 1);
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(0, (current ?? 1) - 1));
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            setActiveIndex((current) => Math.min(result.points.length - 1, (current ?? -1) + 1));
          }
        }}
      >
        <svg
          viewBox="0 0 680 285"
          role="img"
          aria-label="연도별 복리 성장 그래프"
          onPointerDown={(event) => {
            const index = indexAt(
              event.currentTarget,
              event.clientX,
              result.points,
              geometry.plot,
            );
            setActiveIndex(index);
            if (event.pointerType === 'touch') {
              touchPointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== 'touch' || touchPointerRef.current === event.pointerId) {
              setActiveIndex(indexAt(
                event.currentTarget,
                event.clientX,
                result.points,
                geometry.plot,
              ));
            }
          }}
          onPointerUp={(event) => {
            if (touchPointerRef.current !== event.pointerId) return;
            touchPointerRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (touchPointerRef.current === event.pointerId) touchPointerRef.current = null;
          }}
        >
          {geometry.yTicks.map((tick) => (
            <g className="growth-chart__y-tick" key={tick.y}>
              <line x1={geometry.plot.left} x2={geometry.plot.right} y1={tick.y} y2={tick.y} />
              <text x={geometry.plot.left} y={tick.y}>{tick.label}</text>
            </g>
          ))}
          <path className="growth-chart__area" d={geometry.currentPlanAreaPath} />
          <path className="growth-chart__current" d={geometry.currentPlanPath} />
          <path className="growth-chart__savings" d={geometry.allSavingsPath} />
          {activeGeometry === null ? null : (
            <>
              <line
                className="growth-chart__guide"
                x1={activeGeometry.x}
                x2={activeGeometry.x}
                y1={geometry.plot.top}
                y2={geometry.plot.bottom}
              />
              <circle className="growth-chart__marker" cx={activeGeometry.x} cy={activeGeometry.currentY} r="5" />
              <circle className="growth-chart__marker" cx={activeGeometry.x} cy={activeGeometry.allSavingsY} r="4" />
            </>
          )}
          {geometry.xTicks.map((tick) => (
            <text className="growth-chart__x-tick" key={tick.x} x={tick.x} y="277">{tick.label}</text>
          ))}
        </svg>
        {active === null || activeGeometry === null || placement === null ? null : (
          <>
            <p className="sr-only" role="status">
              {`${active.year}년, 현재 계획 총액 ${formatWon(displayed(active, 'current', amountMode))}, 전부 저축 총액 ${formatWon(displayed(active, 'allSavings', amountMode))}`}
            </p>
            <GrowthChartTooltip
              variant={compactTooltip ? 'compact' : 'detailed'}
              placement={placement}
              anchorPercent={activeGeometry.x / 680 * 100}
              anchorYPercent={Math.min(activeGeometry.currentY, activeGeometry.allSavingsY) / 285 * 100}
              values={{
                year: active.year,
                currentPlanWon: displayed(active, 'current', amountMode),
                allSavingsWon: displayed(active, 'allSavings', amountMode),
                principalWon: amountMode === 'real'
                  ? active.contributedPrincipalRealWon
                  : active.contributedPrincipalWon,
                savingsWon: amountMode === 'real' ? active.savingsRealWon : active.savingsNominalWon,
                investmentWon: amountMode === 'real'
                  ? active.investmentRealWon
                  : active.investmentNominalWon,
              }}
            />
          </>
        )}
      </div>
    </Surface>
  );
}

function useCompactTooltip(): boolean {
  const query = '(max-width: 767px)';
  const [compact, setCompact] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  ));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}

function indexAt(
  element: SVGSVGElement,
  clientX: number,
  points: ProjectionPoint[],
  plot: { left: number; right: number },
): number | null {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0) return null;
  const viewBoxX = (clientX - bounds.left) / bounds.width * 680;
  const ratio = Math.max(0, Math.min(1, (viewBoxX - plot.left) / (plot.right - plot.left)));
  const index = Math.round(ratio * (points.length - 1));
  return points[index] === undefined ? null : index;
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
