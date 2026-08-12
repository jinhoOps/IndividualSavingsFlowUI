import { animate, type JSAnimation } from 'animejs';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { animateVisualNumber } from '../../../components/motion/animateVisualNumber';
import { attemptMotion } from '../../../components/motion/attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { calculateCashflowInsight, type DonutAllocation } from '../../domain/cashflowInsight';
import type { MainData } from '../../domain/model';
import { formatDashboardWon } from './CashflowSummary';
import { hitTestDonutAllocation } from './donutHitTest';

export interface CashflowDonutSummaryProps {
  data: MainData;
}

interface DonutSegmentGeometry {
  id: DonutAllocation['id'];
  visiblePercentage: number;
  dashoffset: number;
}

interface DonutSegmentMotionState {
  visiblePercentage: number;
  dashoffset: number;
  animation?: JSAnimation;
}

const DONUT_ALLOCATION_IDS: DonutAllocation['id'][] = [
  'consumption',
  'saving',
  'investment',
  'remaining',
];

export function CashflowDonutSummary({ data }: CashflowDonutSummaryProps) {
  const [hoveredId, setHoveredId] = useState<DonutAllocation['id']>();
  const [focusedId, setFocusedId] = useState<DonutAllocation['id']>();
  const [tappedId, setTappedId] = useState<DonutAllocation['id']>();
  const sectionRef = useRef<HTMLElement>(null);
  const circleRefs = useRef(new Map<DonutAllocation['id'], SVGCircleElement>());
  const geometryStatesRef = useRef(new Map<DonutAllocation['id'], DonutSegmentMotionState>());
  const geometryMountedRef = useRef(false);
  const tooltipId = useId();
  const insight = calculateCashflowInsight(data);
  const activeId = hoveredId ?? focusedId ?? tappedId;
  const activeAllocation = insight.allocations.find((allocation) => allocation.id === activeId);
  const hasIncome = data.monthlyNetIncomeWon > 0;
  const segmentGeometry = createDonutSegmentGeometry(insight.allocations);
  const targetSegmentIds = segmentGeometry.map((segment) => segment.id);
  const [visualSegmentIds, setVisualSegmentIds] = useState<DonutAllocation['id'][]>(
    () => targetSegmentIds,
  );
  const renderedVisualSegmentIds = mergeDonutAllocationIds(
    visualSegmentIds,
    targetSegmentIds,
  );
  const motionGenerationRef = useRef(0);

  useLayoutEffect(() => {
    if (!geometryMountedRef.current) {
      geometryMountedRef.current = true;
      geometryStatesRef.current = new Map(segmentGeometry.map((segment) => [
        segment.id,
        {
          visiblePercentage: segment.visiblePercentage,
          dashoffset: segment.dashoffset,
        },
      ]));
      setVisualSegmentIds(targetSegmentIds);
      return undefined;
    }

    const generation = ++motionGenerationRef.current;
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetById = new Map(segmentGeometry.map((segment) => [segment.id, segment]));
    let cancellationSucceeded = true;
    for (const state of geometryStatesRef.current.values()) {
      if (!attemptMotion(() => state.animation?.cancel())) cancellationSucceeded = false;
      state.animation = undefined;
    }
    setVisualSegmentIds((current) => mergeDonutAllocationIds(current, targetSegmentIds));

    if (!cancellationSucceeded) {
      commitFinalDonutGeometry(
        renderedVisualSegmentIds,
        targetSegmentIds,
        targetById,
        circleRefs.current,
        geometryStatesRef.current,
      );
      setVisualSegmentIds(targetSegmentIds);
      return undefined;
    }

    for (const id of renderedVisualSegmentIds) {
      const circle = circleRefs.current.get(id);
      if (circle === undefined) continue;
      const segment = targetById.get(id) ?? exitingDonutSegment(id);
      const exiting = !targetById.has(id);
      const state = geometryStatesRef.current.get(id) ?? {
        visiblePercentage: 0,
        dashoffset: segment.dashoffset,
      };
      geometryStatesRef.current.set(id, state);

      if (reducedMotion) {
        state.visiblePercentage = segment.visiblePercentage;
        state.dashoffset = segment.dashoffset;
        setCircleGeometry(circle, state);
        state.animation = undefined;
        if (exiting) geometryStatesRef.current.delete(id);
        continue;
      }

      if (
        state.visiblePercentage === segment.visiblePercentage
        && state.dashoffset === segment.dashoffset
      ) {
        setCircleGeometry(circle, state);
        if (exiting) {
          geometryStatesRef.current.delete(id);
          setVisualSegmentIds((current) => current.filter((candidate) => candidate !== id));
        }
        continue;
      }

      setCircleGeometry(circle, state);
      const animationStarted = attemptMotion(() => {
        state.animation = animate(state, {
          visiblePercentage: segment.visiblePercentage,
          dashoffset: segment.dashoffset,
          duration: MOTION_DURATION.emphasis,
          ease: MOTION_EASE.update,
          onComplete: () => {
            if (motionGenerationRef.current !== generation) return;
            commitFinalDonutSegment(id, circle, state, segment, exiting, geometryStatesRef.current);
            if (exiting) {
              setVisualSegmentIds((current) => current.filter((candidate) => candidate !== id));
            }
          },
          onUpdate: () => {
            if (motionGenerationRef.current === generation) setCircleGeometry(circle, state);
          },
        });
      });
      if (!animationStarted) {
        motionGenerationRef.current += 1;
        for (const activeState of geometryStatesRef.current.values()) {
          attemptMotion(() => activeState.animation?.cancel());
          activeState.animation = undefined;
        }
        commitFinalDonutGeometry(
          renderedVisualSegmentIds,
          targetSegmentIds,
          targetById,
          circleRefs.current,
          geometryStatesRef.current,
        );
        setVisualSegmentIds(targetSegmentIds);
        return undefined;
      }
    }

    if (reducedMotion) setVisualSegmentIds(targetSegmentIds);

    return undefined;
  }, [
    data.monthlyNetIncomeWon,
    data.monthlyHousingWon,
    data.monthlyLivingWon,
    data.monthlySavingWon,
    data.monthlyInvestmentWon,
  ]);

  useEffect(() => () => {
    motionGenerationRef.current += 1;
    for (const state of geometryStatesRef.current.values()) {
      attemptMotion(() => state.animation?.cancel());
    }
  }, []);

  useEffect(() => {
    if (tappedId === undefined) return undefined;

    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !sectionRef.current?.contains(event.target)) {
        setTappedId(undefined);
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [tappedId]);

  const allocationAtPointer = (svg: SVGSVGElement, clientX: number, clientY: number) => (
    hitTestDonutAllocation(
      insight.allocations,
      { x: clientX, y: clientY },
      svg.getBoundingClientRect(),
    )
  );

  return (
    <section className="cashflow-donut" aria-label="월 수입 배분" ref={sectionRef}>
      {hasIncome ? (
        <div className="cashflow-donut__chart">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={insight.allocations.map((allocation) => `${allocation.label} ${formatPercentage(allocation.percentage)}`).join(', ')}
            aria-describedby={activeAllocation ? tooltipId : undefined}
            onPointerDown={(event) => {
              const allocationId = allocationAtPointer(
                event.currentTarget,
                event.clientX,
                event.clientY,
              );
              if (allocationId !== undefined) {
                setTappedId((id) => id === allocationId ? undefined : allocationId);
              }
            }}
            onPointerMove={(event) => {
              if (event.pointerType !== 'touch') {
                setHoveredId(allocationAtPointer(
                  event.currentTarget,
                  event.clientX,
                  event.clientY,
                ));
              }
            }}
            onPointerLeave={() => setHoveredId(undefined)}
          >
            {renderedVisualSegmentIds.map((id) => {
              const geometry = segmentGeometry.find((segment) => segment.id === id)
                ?? exitingDonutSegment(id);
              return (
                <circle
                  aria-hidden="true"
                  className={`cashflow-donut__segment--${id}${activeAllocation?.id === id ? ' cashflow-donut__segment--active' : ''}`}
                  cx="50"
                  cy="50"
                  fill="none"
                  key={id}
                  pathLength="100"
                  ref={(element) => {
                    if (element === null) circleRefs.current.delete(id);
                    else circleRefs.current.set(id, element);
                  }}
                  r="40"
                  strokeDasharray={`${geometry.visiblePercentage} ${100 - geometry.visiblePercentage}`}
                  strokeDashoffset={geometry.dashoffset}
                  strokeWidth="14"
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </svg>
          <div className="cashflow-donut__center">
            <strong>
              {activeAllocation ? formatPercentage(activeAllocation.percentage) : (
                <>
                  <span className="sr-only">{insight.savingsInvestmentPercentage === null
                    ? '—'
                    : formatPercentage(insight.savingsInvestmentPercentage)}</span>
                  <AnimatedVisualNumber
                    value={insight.savingsInvestmentPercentage}
                    format={formatPercentage}
                  />
                </>
              )}
            </strong>
            <span>{activeAllocation?.label ?? '저축·투자'}</span>
            {!activeAllocation && insight.isOverIncome ? <small>소득 초과</small> : null}
          </div>
        </div>
      ) : <p className="cashflow-donut__guidance">월소득을 입력해주세요.</p>}
      <div className="cashflow-donut__legend">
        {insight.allocations.map((allocation) => {
          const active = activeAllocation?.id === allocation.id;
          return (
            <button
              aria-describedby={active ? tooltipId : undefined}
              aria-label={`${allocation.label} · ${formatDashboardWon(allocation.amountWon)} · ${formatPercentage(allocation.percentage)}`}
              aria-pressed={tappedId === allocation.id}
              className={`cashflow-donut__legend-button cashflow-donut__segment--${allocation.id}`}
              key={allocation.id}
              onBlur={() => setFocusedId(undefined)}
              onClick={() => setTappedId((id) => id === allocation.id ? undefined : allocation.id)}
              onFocus={() => setFocusedId(allocation.id)}
              onPointerEnter={() => setHoveredId(allocation.id)}
              onPointerLeave={() => setHoveredId(undefined)}
              type="button"
            >
              <span>{allocation.label}</span>
              <AnimatedVisualNumber
                className="cashflow-donut__legend-amount"
                value={allocation.amountWon}
                format={formatDashboardWon}
              />
              <AnimatedVisualNumber value={allocation.percentage} format={formatPercentage} />
            </button>
          );
        })}
      </div>
      {activeAllocation ? (
        <p className="cashflow-donut__tooltip" id={tooltipId} role="tooltip">
          {activeAllocation.label} · {formatDashboardWon(activeAllocation.amountWon)} · {formatPercentage(activeAllocation.percentage)}
        </p>
      ) : null}
    </section>
  );
}

function AnimatedVisualNumber({
  value,
  format,
  className,
}: {
  value: number | null;
  format(value: number): string;
  className?: string;
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
      MOTION_DURATION.normal,
    );
  }, [format, value]);

  return <span aria-hidden="true" className={className} ref={visualRef}>{rendered}</span>;
}

function createDonutSegmentGeometry(allocations: DonutAllocation[]): DonutSegmentGeometry[] {
  let offset = 0;
  return allocations.map((allocation) => {
    const visiblePercentage = Math.min(allocation.displayPercentage, Math.max(0, 100 - offset));
    const segment = {
      id: allocation.id,
      visiblePercentage,
      dashoffset: -offset,
    };
    offset += visiblePercentage;
    return segment;
  });
}

function exitingDonutSegment(id: DonutAllocation['id']): DonutSegmentGeometry {
  return { id, visiblePercentage: 0, dashoffset: -100 };
}

function mergeDonutAllocationIds(
  previousIds: DonutAllocation['id'][],
  currentIds: DonutAllocation['id'][],
): DonutAllocation['id'][] {
  return DONUT_ALLOCATION_IDS.filter((id) => (
    previousIds.includes(id) || currentIds.includes(id)
  ));
}

function setCircleGeometry(
  circle: SVGCircleElement,
  geometry: Pick<DonutSegmentMotionState, 'visiblePercentage' | 'dashoffset'>,
): void {
  circle.setAttribute(
    'stroke-dasharray',
    `${geometry.visiblePercentage} ${100 - geometry.visiblePercentage}`,
  );
  circle.setAttribute('stroke-dashoffset', String(geometry.dashoffset));
}

function commitFinalDonutGeometry(
  renderedIds: DonutAllocation['id'][],
  targetIds: DonutAllocation['id'][],
  targetById: Map<DonutAllocation['id'], DonutSegmentGeometry>,
  circles: Map<DonutAllocation['id'], SVGCircleElement>,
  states: Map<DonutAllocation['id'], DonutSegmentMotionState>,
): void {
  for (const id of mergeDonutAllocationIds(renderedIds, targetIds)) {
    const circle = circles.get(id);
    if (circle === undefined) continue;
    const segment = targetById.get(id) ?? exitingDonutSegment(id);
    const state = states.get(id) ?? {
      visiblePercentage: segment.visiblePercentage,
      dashoffset: segment.dashoffset,
    };
    states.set(id, state);
    commitFinalDonutSegment(id, circle, state, segment, !targetById.has(id), states);
  }
}

function commitFinalDonutSegment(
  id: DonutAllocation['id'],
  circle: SVGCircleElement,
  state: DonutSegmentMotionState,
  segment: DonutSegmentGeometry,
  exiting: boolean,
  states: Map<DonutAllocation['id'], DonutSegmentMotionState>,
): void {
  state.visiblePercentage = segment.visiblePercentage;
  state.dashoffset = segment.dashoffset;
  state.animation = undefined;
  setCircleGeometry(circle, state);
  if (exiting) states.delete(id);
}

function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}
