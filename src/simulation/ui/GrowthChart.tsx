import { animate } from 'animejs';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Surface } from '../../components/common/Surface';
import { MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import type {
  CompoundSimulationDraft,
  ProjectionPoint,
  ProjectionResult,
} from '../domain/model';
import {
  buildChartGeometry,
  tooltipPlacement,
  type ChartGeometry,
} from './chartGeometry';
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
  const touchPointerRef = useRef<number | null>(null);
  const visualGeometryRef = useRef<VisualChartGeometry | null>(null);
  const firstRevealCompleteRef = useRef(false);
  const revealClipId = `growth-chart-reveal-${useId().replace(/:/g, '')}`;
  const compactTooltip = useCompactTooltip();
  const geometry = useMemo(
    () => buildChartGeometry(result.points, amountMode),
    [amountMode, result.points],
  );
  const chartRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const motionPaths = findMotionPaths(root);
    const revealClip = root.querySelector<SVGRectElement>('.growth-chart__reveal-clip');

    if (motionPaths === null || revealClip === null) return;

    const revealWidth = geometry.plot.right - geometry.plot.left;
    const targetGeometry = visualGeometry(geometry);
    const previousGeometry = visualGeometryRef.current;
    revealClip.setAttribute('width', String(revealWidth));

    if (reducedMotion) {
      setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
      firstRevealCompleteRef.current = true;
      return;
    }

    if (
      previousGeometry === null
      || (
        !firstRevealCompleteRef.current
        && pathsForVisualGeometry(previousGeometry).current === geometry.currentPlanPath
        && pathsForVisualGeometry(previousGeometry).savings === geometry.allSavingsPath
      )
    ) {
      setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
      revealClip.setAttribute('width', '0');
      try {
        animate(revealClip, {
          width: revealWidth,
          duration: MOTION_DURATION.emphasis,
          ease: MOTION_EASE.enter,
          onComplete: () => {
            revealClip.setAttribute('width', String(revealWidth));
            firstRevealCompleteRef.current = true;
          },
        });
      } catch {
        revealClip.setAttribute('width', String(revealWidth));
        firstRevealCompleteRef.current = true;
      }
      return;
    }

    firstRevealCompleteRef.current = true;
    const transition = createPathTransition(previousGeometry, targetGeometry);
    const state = { progress: 0 };
    setVisualFrame(motionPaths, transition(0), visualGeometryRef);
    try {
      animate(state, {
        progress: 1,
        duration: MOTION_DURATION.emphasis,
        ease: MOTION_EASE.update,
        onUpdate: () => setVisualFrame(
          motionPaths,
          transition(state.progress),
          visualGeometryRef,
        ),
        onComplete: () => setVisualFrame(motionPaths, targetGeometry, visualGeometryRef),
      });
    } catch {
      setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
    }
  }, [
    geometry.currentPlanAreaPath,
    geometry.currentPlanPath,
    geometry.allSavingsPath,
  ]);

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
          if (event.key === 'Home') {
            event.preventDefault();
            setActiveIndex(0);
          }
          if (event.key === 'End') {
            event.preventDefault();
            setActiveIndex(result.points.length - 1);
          }
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
          <defs>
            <clipPath id={revealClipId}>
              <rect
                className="growth-chart__reveal-clip"
                x={geometry.plot.left}
                y={geometry.plot.top}
                width={geometry.plot.right - geometry.plot.left}
                height={geometry.plot.bottom - geometry.plot.top}
              />
            </clipPath>
          </defs>
          {geometry.yTicks.map((tick) => (
            <g className="growth-chart__y-tick" key={tick.y}>
              <line x1={geometry.plot.left} x2={geometry.plot.right} y1={tick.y} y2={tick.y} />
              <text x={geometry.plot.left} y={tick.y}>{tick.label}</text>
            </g>
          ))}
          <path
            className="growth-chart__area growth-chart__semantic-path"
            d={geometry.currentPlanAreaPath}
          />
          <path
            className="growth-chart__current growth-chart__semantic-path"
            d={geometry.currentPlanPath}
          />
          <path
            className="growth-chart__savings growth-chart__semantic-path"
            d={geometry.allSavingsPath}
          />
          <g
            aria-hidden="true"
            className="growth-chart__motion-layer"
            clipPath={`url(#${revealClipId})`}
          >
            <path
              aria-hidden="true"
              className="growth-chart__area growth-chart__motion-path"
              data-motion-series="area"
              d={geometry.currentPlanAreaPath}
            />
            <path
              aria-hidden="true"
              className="growth-chart__current growth-chart__motion-path"
              data-motion-series="current"
              d={geometry.currentPlanPath}
            />
            <path
              aria-hidden="true"
              className="growth-chart__savings growth-chart__motion-path"
              data-motion-series="savings"
              d={geometry.allSavingsPath}
            />
          </g>
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

interface MotionPaths {
  area: SVGPathElement;
  current: SVGPathElement;
  savings: SVGPathElement;
}

interface ChartPaths {
  area: string;
  current: string;
  savings: string;
}

interface VisualPathPoint {
  x: number;
  y: number;
}

interface VisualChartGeometry {
  current: VisualPathPoint[];
  savings: VisualPathPoint[];
  bottom: number;
}

function findMotionPaths(root: HTMLElement): MotionPaths | null {
  const area = root.querySelector<SVGPathElement>('[data-motion-series="area"]');
  const current = root.querySelector<SVGPathElement>('[data-motion-series="current"]');
  const savings = root.querySelector<SVGPathElement>('[data-motion-series="savings"]');
  return area === null || current === null || savings === null
    ? null
    : { area, current, savings };
}

function setMotionPaths(paths: MotionPaths, values: ChartPaths): void {
  paths.area.setAttribute('d', values.area);
  paths.current.setAttribute('d', values.current);
  paths.savings.setAttribute('d', values.savings);
}

function setVisualFrame(
  paths: MotionPaths,
  geometry: VisualChartGeometry,
  geometryRef: { current: VisualChartGeometry | null },
): void {
  geometryRef.current = geometry;
  setMotionPaths(paths, pathsForVisualGeometry(geometry));
}

function visualGeometry(geometry: ChartGeometry): VisualChartGeometry {
  return {
    current: geometry.points.map((point) => ({ x: point.x, y: point.currentY })),
    savings: geometry.points.map((point) => ({ x: point.x, y: point.allSavingsY })),
    bottom: geometry.plot.bottom,
  };
}

function pathsForVisualGeometry(geometry: VisualChartGeometry): ChartPaths {
  const current = pathForVisualPoints(geometry.current);
  const savings = pathForVisualPoints(geometry.savings);
  const first = geometry.current[0];
  const last = geometry.current.at(-1);
  const area = first === undefined || last === undefined || current === ''
    ? ''
    : `${current} L ${last.x} ${geometry.bottom} L ${first.x} ${geometry.bottom} Z`;
  return { area, current, savings };
}

function createPathTransition(
  previous: VisualChartGeometry,
  next: VisualChartGeometry,
): (progress: number) => VisualChartGeometry {
  const pointCount = Math.max(previous.current.length, next.current.length);
  const sourceCurrent = resample(previous.current, pointCount);
  const sourceSavings = resample(previous.savings, pointCount);
  const targetCurrent = resample(next.current, pointCount);
  const targetSavings = resample(next.savings, pointCount);

  return (progress) => ({
    current: interpolatePoints(sourceCurrent, targetCurrent, progress),
    savings: interpolatePoints(sourceSavings, targetSavings, progress),
    bottom: previous.bottom + (next.bottom - previous.bottom) * progress,
  });
}

function resample(
  points: VisualPathPoint[],
  count: number,
): VisualPathPoint[] {
  if (count <= 0 || points.length === 0) return [];
  if (count === 1) return [points[0]];
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1) * (points.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(points.length - 1, Math.ceil(position));
    const lower = points[lowerIndex];
    const upper = points[upperIndex];
    const progress = position - lowerIndex;
    return {
      x: lower.x + (upper.x - lower.x) * progress,
      y: lower.y + (upper.y - lower.y) * progress,
    };
  });
}

function interpolatePoints(
  previous: VisualPathPoint[],
  next: VisualPathPoint[],
  progress: number,
): VisualPathPoint[] {
  return next.map((point, index) => ({
    x: previous[index].x + (point.x - previous[index].x) * progress,
    y: previous[index].y + (point.y - previous[index].y) * progress,
  }));
}

function pathForVisualPoints(points: VisualPathPoint[]): string {
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  )).join(' ');
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
