import { animate } from 'animejs';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Surface } from '../../components/common/Surface';
import { MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import type {
  CompoundSimulationDraft,
  ProjectionResult,
} from '../domain/model';
import {
  buildChartGeometry,
  formatProjectionPeriod,
} from './chartGeometry';
import {
  indexAtClientX,
  indexForKey,
  tooltipPlacement,
  type ChartKeyIntent,
} from './chartInteraction';
import { buildChartSeries } from './chartSeries';
import { buildChartTooltipModel } from './chartTooltipModel';
import {
  findMotionPaths,
  setRevealWidth,
  setVisualFrame,
} from './chartMotion';
import {
  createPathTransition,
  pathsForVisualGeometry,
  visualGeometry,
  type VisualChartGeometry,
} from './chartMotionGeometry';
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
  const revealWidthRef = useRef(0);
  const firstRevealCompleteRef = useRef(false);
  const motionGenerationRef = useRef(0);
  const revealClipId = `growth-chart-reveal-${useId().replace(/:/g, '')}`;
  const compactTooltip = useCompactTooltip();
  const series = useMemo(
    () => buildChartSeries(result.points, amountMode),
    [amountMode, result.points],
  );
  const geometry = useMemo(
    () => buildChartGeometry(series),
    [series],
  );
  const chartRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const generation = ++motionGenerationRef.current;
    const isCurrentGeneration = () => motionGenerationRef.current === generation;
    const invalidateGeneration = () => {
      motionGenerationRef.current += 1;
    };
    const motionPaths = findMotionPaths(root);
    const revealClip = root.querySelector<SVGRectElement>('.growth-chart__reveal-clip');

    if (motionPaths === null || revealClip === null) return invalidateGeneration;

    const revealWidth = geometry.plot.right - geometry.plot.left;
    const targetGeometry = visualGeometry(geometry);
    const previousGeometry = visualGeometryRef.current;

    if (reducedMotion) {
      setRevealWidth(revealClip, revealWidth, revealWidthRef);
      setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
      firstRevealCompleteRef.current = true;
      return invalidateGeneration;
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
      continueReveal(
        revealClip,
        revealWidth,
        revealWidthRef,
        firstRevealCompleteRef,
        isCurrentGeneration,
      );
      return invalidateGeneration;
    }

    if (firstRevealCompleteRef.current) {
      setRevealWidth(revealClip, revealWidth, revealWidthRef);
    } else {
      continueReveal(
        revealClip,
        revealWidth,
        revealWidthRef,
        firstRevealCompleteRef,
        isCurrentGeneration,
      );
    }
    const transition = createPathTransition(previousGeometry, targetGeometry);
    const state = { progress: 0 };
    setVisualFrame(motionPaths, transition(0), visualGeometryRef);
    try {
      animate(state, {
        progress: 1,
        duration: MOTION_DURATION.emphasis,
        ease: MOTION_EASE.update,
        onUpdate: () => {
          if (isCurrentGeneration()) {
            setVisualFrame(motionPaths, transition(state.progress), visualGeometryRef);
          }
        },
        onComplete: () => {
          if (isCurrentGeneration()) {
            setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
          }
        },
      });
    } catch {
      if (isCurrentGeneration()) {
        setVisualFrame(motionPaths, targetGeometry, visualGeometryRef);
        setRevealWidth(revealClip, revealWidth, revealWidthRef);
        firstRevealCompleteRef.current = true;
        invalidateGeneration();
      }
    }
    return invalidateGeneration;
  }, [
    geometry.currentPlanAreaPath,
    geometry.currentPlanPath,
    geometry.allSavingsPath,
  ]);

  useEffect(() => {
    setActiveIndex((current) => (
      current !== null && current >= series.length ? null : current
    ));
  }, [series.length]);

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
  const last = geometry.points.at(-1);
  const finalCurrent = last?.currentPlanWon ?? 0;
  const finalSavings = last?.allSavingsWon ?? 0;
  const activeGeometry = activeIndex === null ? null : geometry.points[activeIndex] ?? null;
  const active = activeGeometry;
  const tooltip = active === null ? null : buildChartTooltipModel(active, compactTooltip);
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
        {`${amountMode === 'nominal' ? '명목' : '실질'} 기준 ${formatProjectionPeriod(last?.month ?? 0)}, 현재 계획 ${formatWon(finalCurrent)}, 전부 저축 ${formatWon(finalSavings)}, 차이 ${formatWon(finalCurrent - finalSavings)}`}
      </p>
      <div
        className="growth-chart__canvas"
        role="application"
        aria-label="그래프 기간 탐색"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setActiveIndex(null);
          const intent = keyIntentFor(event.key);
          if (intent !== null) {
            event.preventDefault();
            setActiveIndex((current) => indexForKey(current, intent, series.length));
          }
        }}
      >
        <svg
          viewBox="0 0 680 285"
          role="img"
          aria-label="기간별 복리 성장 그래프"
          onPointerDown={(event) => {
            const index = indexAtClientX({
              clientX: event.clientX,
              bounds: event.currentTarget.getBoundingClientRect(),
              viewBoxWidth: 680,
              plot: geometry.plot,
              pointCount: series.length,
            });
            setActiveIndex(index);
            if (event.pointerType === 'touch') {
              touchPointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== 'touch' || touchPointerRef.current === event.pointerId) {
              setActiveIndex(indexAtClientX({
                clientX: event.clientX,
                bounds: event.currentTarget.getBoundingClientRect(),
                viewBoxWidth: 680,
                plot: geometry.plot,
                pointCount: series.length,
              }));
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
        {active === null || activeGeometry === null || tooltip === null || placement === null ? null : (
          <>
            <p className="sr-only" role="status">
              {tooltip.status}
            </p>
            <GrowthChartTooltip
              variant={compactTooltip ? 'compact' : 'detailed'}
              placement={placement}
              anchorPercent={activeGeometry.x / 680 * 100}
              anchorYPercent={Math.min(activeGeometry.currentY, activeGeometry.allSavingsY) / 285 * 100}
              values={tooltip.values}
            />
          </>
        )}
      </div>
    </Surface>
  );
}

function continueReveal(
  clip: SVGRectElement,
  finalWidth: number,
  widthRef: { current: number },
  completeRef: { current: boolean },
  isCurrentGeneration: () => boolean,
): void {
  const currentWidth = Math.max(0, Math.min(finalWidth, widthRef.current));
  setRevealWidth(clip, currentWidth, widthRef);
  try {
    animate(clip, {
      width: finalWidth,
      duration: MOTION_DURATION.emphasis,
      ease: MOTION_EASE.enter,
      onUpdate: () => {
        if (!isCurrentGeneration()) return;
        const renderedWidth = Number(clip.getAttribute('width'));
        if (Number.isFinite(renderedWidth)) widthRef.current = renderedWidth;
      },
      onComplete: () => {
        if (!isCurrentGeneration()) return;
        setRevealWidth(clip, finalWidth, widthRef);
        completeRef.current = true;
      },
    });
  } catch {
    if (isCurrentGeneration()) {
      setRevealWidth(clip, finalWidth, widthRef);
      completeRef.current = true;
    }
  }
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

function keyIntentFor(key: string): ChartKeyIntent | null {
  if (key === 'Home') return 'home';
  if (key === 'End') return 'end';
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'next';
  return null;
}
