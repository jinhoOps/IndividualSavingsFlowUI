import { animate, type JSAnimation } from 'animejs';
import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { PercentageTooltip } from '../common/PercentageTooltip';
import { createCashflowBarGeometry, type CashflowViewport } from './cashflowBarGeometry';
import { formatContextWon, formatPercentage } from './FlowContextSummary';

export interface AllocationBarProps {
  data: MainData;
}

interface Allocation {
  id: string;
  label: string;
  amountWon: number;
  percentage: number | null;
  startPercent: number;
  visualPercentage: number;
}

type AllocationId = 'consumption' | 'saving' | 'investment' | 'remaining';

interface AllocationBarMotionState {
  consumption: number;
  saving: number;
  investment: number;
  remaining: number;
  desiredEndPercent: number;
  visibleEndPercent: number;
  animation?: JSAnimation;
}

const MIN_INTERACTIVE_SIZE_PX = 44;
const ALLOCATION_IDS: AllocationId[] = ['consumption', 'saving', 'investment', 'remaining'];

export function AllocationBar({ data }: AllocationBarProps) {
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [tappedId, setTappedId] = useState<string>();
  const [pointerPosition, setPointerPosition] = useState<number>();
  const [tapPosition, setTapPosition] = useState<number>();
  const [viewport, setViewport] = useState<CashflowViewport>({
    barWidthPx: 0,
    availableRightPx: 0,
  });
  const barRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previousDataRef = useRef(data);
  const motionStateRef = useRef<AllocationBarMotionState | undefined>(undefined);
  const isPointerFocusRef = useRef(false);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const isDeficit = cashflow.deficitWon > 0;
  const geometry = createCashflowBarGeometry(data, viewport);
  const targetVisualSegmentIds = geometry.segments.map((segment) => segment.id);
  const [visualSegmentIds, setVisualSegmentIds] = useState<AllocationId[]>(
    () => targetVisualSegmentIds,
  );
  const renderedVisualSegmentIds = mergeAllocationIds(
    visualSegmentIds,
    targetVisualSegmentIds,
  );
  const motionGenerationRef = useRef(0);
  const visualSegments = geometry.segments.map((segment) => ({
    id: segment.id,
    visualPercentage: segment.widthPercent,
  }));
  const allocation = (id: string, label: string, amountWon: number): Allocation => {
    const geometrySegment = geometry.segments.find((segment) => segment.id === id);
    return {
      id,
      label,
      amountWon,
      percentage: percentageOfIncome(amountWon, cashflow.incomeWon),
      startPercent: geometrySegment?.startPercent ?? 0,
      visualPercentage: visualSegments.find((segment) => segment.id === id)?.visualPercentage
        ?? percentageOfIncome(amountWon, cashflow.incomeWon)
        ?? 0,
    };
  };
  const allocations: Allocation[] = [
    allocation('consumption', '소비', cashflow.consumptionWon),
    allocation('saving', '저축', cashflow.savingWon),
    allocation('investment', '투자', cashflow.investmentWon),
  ];

  if (!isDeficit) {
    allocations.push(allocation('remaining', '남는 돈', cashflow.remainingWon));
  }

  const activeId = hoveredId ?? focusedId ?? tappedId;
  const activeAllocation = allocations.find((allocation) => allocation.id === activeId);
  const activePosition = activeAllocation ? allocationCenter(activeAllocation.id, allocations) : 0;
  const tooltipPosition = activeId === hoveredId
    ? pointerPosition ?? activePosition
    : activeId === tappedId
      ? tapPosition ?? activePosition
      : activePosition;

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) {
      return;
    }

    const updateViewport = () => {
      const rect = bar.getBoundingClientRect();
      const nextViewport = {
        barWidthPx: rect.width,
        availableRightPx: document.documentElement.clientWidth - 16 - rect.right,
      };
      setViewport((current) => (
        current.barWidthPx === nextViewport.barWidthPx
        && current.availableRightPx === nextViewport.availableRightPx
          ? current
          : nextViewport
      ));
    };
    updateViewport();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateViewport);
    resizeObserver?.observe(bar);
    window.addEventListener('resize', updateViewport);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) return undefined;

    const targetState = createBarMotionState(geometry);
    const targetIds = geometry.segments.map((segment) => segment.id);
    const previousData = previousDataRef.current;
    const dataChanged = hasCashflowValueChange(previousData, data);
    previousDataRef.current = data;

    if (motionStateRef.current === undefined) {
      motionStateRef.current = targetState;
      setVisualSegmentIds(targetIds);
      return undefined;
    }

    const generation = ++motionGenerationRef.current;
    const state = motionStateRef.current;
    state.animation?.cancel();
    if (!dataChanged || prefersReducedMotion()) {
      assignBarMotionState(state, targetState);
      applyBarMotionState(bar, state);
      setVisualSegmentIds(targetIds);
      return undefined;
    }

    setVisualSegmentIds((current) => mergeAllocationIds(current, targetIds));
    applyBarMotionState(bar, state);
    state.animation = animate(state, {
      consumption: targetState.consumption,
      saving: targetState.saving,
      investment: targetState.investment,
      remaining: targetState.remaining,
      desiredEndPercent: targetState.desiredEndPercent,
      visibleEndPercent: targetState.visibleEndPercent,
      duration: MOTION_DURATION.emphasis,
      ease: MOTION_EASE.update,
      onComplete: () => {
        if (motionGenerationRef.current !== generation) return;
        assignBarMotionState(state, targetState);
        applyBarMotionState(bar, state);
        state.animation = undefined;
        setVisualSegmentIds(targetIds);
      },
      onUpdate: () => applyBarMotionState(bar, state),
    });

    return undefined;
  }, [
    data.monthlyNetIncomeWon,
    data.monthlyHousingWon,
    data.monthlyLivingWon,
    data.monthlySavingWon,
    data.monthlyInvestmentWon,
    geometry.desiredEndPercent,
    geometry.visibleEndPercent,
  ]);

  useEffect(() => () => {
    motionGenerationRef.current += 1;
    motionStateRef.current?.animation?.cancel();
  }, []);

  useEffect(() => {
    if (!tappedId) {
      return;
    }

    const closeTappedTooltip = (event: globalThis.MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setTappedId(undefined);
      }
    };

    document.addEventListener('click', closeTappedTooltip);
    return () => document.removeEventListener('click', closeTappedTooltip);
  }, [tappedId]);

  const setPointerPositionFromEvent = (event: PointerEvent<HTMLButtonElement>) => {
    setPointerPosition(pointerPercentage(event.clientX, barRef.current));
  };

  const activatePointer = (allocationId: string, event?: PointerEvent<HTMLButtonElement>) => {
    if (event) {
      setPointerPositionFromEvent(event);
    } else {
      setPointerPosition(undefined);
    }
    setHoveredId(allocationId);
  };

  const toggleTappedTooltip = (allocationId: string, event: MouseEvent<HTMLButtonElement>, isVisualTarget: boolean) => {
    isPointerFocusRef.current = false;
    setTapPosition(isVisualTarget && event.detail > 0 ? pointerPercentage(event.clientX, barRef.current) : undefined);
    setTappedId((tapped) => tapped === allocationId ? undefined : allocationId);
  };

  const triggerProps = (allocation: Allocation, isVisualTarget: boolean, accessibleName = allocationText(allocation)) => {
    const isActive = activeId === allocation.id;
    return {
      'aria-describedby': isActive ? tooltipId : undefined,
      'aria-label': accessibleName,
      onBlur: () => {
        isPointerFocusRef.current = false;
        setFocusedId(undefined);
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => toggleTappedTooltip(allocation.id, event, isVisualTarget),
      onFocus: () => {
        if (!isPointerFocusRef.current) {
          setFocusedId(allocation.id);
        }
      },
      onPointerDown: () => {
        isPointerFocusRef.current = true;
        setFocusedId(undefined);
      },
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => activatePointer(allocation.id, isVisualTarget ? event : undefined),
      onPointerLeave: () => setHoveredId(undefined),
      onPointerMove: isVisualTarget ? setPointerPositionFromEvent : undefined,
      type: 'button' as const,
    };
  };

  return (
    <section
      className="allocation-bar"
      aria-label="월 수입 나누기"
    >
      <p className="allocation-bar__context" data-assembly-content>
        월 수입을 이렇게 나눠 쓰고 있어요
      </p>
      <div
        className="flow-bar-wrapper"
        ref={wrapperRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setTappedId(undefined);
          }
        }}
      >
        <div
          className="flow-bar allocation-bar__segments"
          data-desired-end-percent={geometry.desiredEndPercent}
          data-visible-end-percent={geometry.visibleEndPercent}
          data-overflow-clipped={geometry.clipped ? 'true' : 'false'}
          ref={barRef}
        >
          <div
            aria-hidden="true"
            className="cashflow-bar__clip"
            style={{
              borderRadius: '9999px',
              height: '0.375rem',
              left: 0,
              overflow: 'hidden',
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              width: `${geometry.visibleEndPercent}%`,
            }}
          >
            <div
              className="cashflow-bar__strip allocation-bar__visual-track"
              style={{
                height: '100%',
                left: 'auto',
                position: 'relative',
                right: 'auto',
                top: 'auto',
                transform: 'none',
                width: `${relativeStripWidth(geometry.desiredEndPercent, geometry.visibleEndPercent)}%`,
              }}
            >
              {renderedVisualSegmentIds.map((id) => {
                const segment = geometry.segments.find((candidate) => candidate.id === id);
                const widthPercent = segment?.widthPercent ?? 0;
                return (
                  <span
                    className={`allocation-bar__visual-segment allocation-bar__visual-segment--${id}`}
                    data-segment-id={id}
                    data-start-percent={segment?.startPercent ?? geometry.desiredEndPercent}
                    data-width-percent={widthPercent}
                    key={id}
                    style={{ width: `${relativeSegmentWidth(widthPercent, geometry.desiredEndPercent)}%` }}
                  />
                );
              })}
            </div>
          </div>
          <div
            className="cashflow-bar__targets-clip"
            style={{
              height: '100%',
              left: 0,
              overflow: 'hidden',
              position: 'absolute',
              top: 0,
              width: `${geometry.visibleEndPercent}%`,
            }}
          >
            <div
              className="cashflow-bar__targets"
              style={{
                height: '100%',
                position: 'relative',
                width: `${relativeStripWidth(geometry.desiredEndPercent, geometry.visibleEndPercent)}%`,
              }}
            >
              {allocations.map((allocation) => {
                const visiblePercentage = visibleSegmentPercentage(
                  allocation,
                  geometry.visibleEndPercent,
                );
                const requiresLegendTarget = !hasIndependentTarget(
                  visiblePercentage,
                  viewport.barWidthPx,
                );

                return requiresLegendTarget ? null : (
                  <button
                    {...triggerProps(allocation, true)}
                    className="allocation-bar__segment-target"
                    key={allocation.id}
                    style={{
                      left: `${relativeSegmentPosition(allocation.startPercent, geometry.desiredEndPercent)}%`,
                      width: `${relativeSegmentWidth(allocation.visualPercentage, geometry.desiredEndPercent)}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {geometry.clipped ? (
          <span className="cashflow-bar__overflow-label" data-assembly-content>
            +{formatPercentage(geometry.overflowPercent)} 초과
          </span>
        ) : null}
        <table className="allocation-table" aria-label="월 자금 항목" data-assembly-content>
          <thead>
            <tr>
              <th scope="col">종류</th>
              <th scope="col">금액</th>
              <th scope="col">수입 대비</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => {
              const visiblePercentage = visibleSegmentPercentage(
                allocation,
                geometry.visibleEndPercent,
              );
              const requiresTableTarget = !hasIndependentTarget(
                visiblePercentage,
                viewport.barWidthPx,
              ) || isSegmentClipped(allocation, geometry.visibleEndPercent);
              return (
                <tr key={allocation.id}>
                  <th scope="row">
                    {requiresTableTarget ? (
                      <button
                        {...triggerProps(allocation, false, `${allocation.label} 상세 정보`)}
                        className="allocation-table__label-target"
                      >
                        {allocation.label}
                      </button>
                    ) : allocation.label}
                  </th>
                  <td>{formatContextWon(allocation.amountWon)}</td>
                  <td>{formatPercentage(allocation.percentage)}</td>
                </tr>
              );
            })}
            {isDeficit ? (
              <tr className="allocation-table__overflow-row">
                <th scope="row">초과</th>
                <td>{formatContextWon(cashflow.deficitWon)}</td>
                <td>{formatPercentage(percentageOfIncome(cashflow.deficitWon, cashflow.incomeWon))}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PercentageTooltip
          id={tooltipId}
          open={activeAllocation !== undefined}
          position={{ xPercent: tooltipPosition }}
          value={activeAllocation ? allocationText(activeAllocation) : ''}
        />
      </div>
      {isDeficit ? <p className="allocation-bar__deficit" data-assembly-content role="status">수입보다 {formatContextWon(cashflow.deficitWon)} 초과</p> : null}
    </section>
  );
}

function allocationCenter(allocationId: string, allocations: Allocation[]): number {
  const allocation = allocations.find((candidate) => candidate.id === allocationId);
  return clampPercentage(
    (allocation?.startPercent ?? 0)
      + (allocation?.visualPercentage ?? 0) / 2,
  );
}

function allocationText(allocation: Allocation): string {
  return `${allocation.label} · ${formatContextWon(allocation.amountWon)} · ${formatPercentage(allocation.percentage)}`;
}

function hasIndependentTarget(percentage: number, barWidth: number): boolean {
  return barWidth > 0 && barWidth * percentage / 100 >= MIN_INTERACTIVE_SIZE_PX;
}

function pointerPercentage(clientX: number, element: HTMLDivElement | null): number {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width <= 0) {
    return 0;
  }

  return clampPercentage(((clientX - rect.left) / rect.width) * 100);
}

function clampPercentage(percentage: number): number {
  return Math.min(100, Math.max(0, percentage));
}

function relativeStripWidth(desiredEndPercent: number, visibleEndPercent: number): number {
  return visibleEndPercent > 0 ? desiredEndPercent / visibleEndPercent * 100 : 0;
}

function relativeSegmentWidth(widthPercent: number, desiredEndPercent: number): number {
  return desiredEndPercent > 0 ? widthPercent / desiredEndPercent * 100 : 0;
}

function relativeSegmentPosition(startPercent: number, desiredEndPercent: number): number {
  return desiredEndPercent > 0 ? startPercent / desiredEndPercent * 100 : 0;
}

function visibleSegmentPercentage(
  allocation: Allocation,
  visibleEndPercent: number,
): number {
  const visibleEnd = Math.min(
    allocation.startPercent + allocation.visualPercentage,
    visibleEndPercent,
  );
  return Math.max(0, visibleEnd - allocation.startPercent);
}

function isSegmentClipped(allocation: Allocation, visibleEndPercent: number): boolean {
  return allocation.visualPercentage > 0
    && allocation.startPercent + allocation.visualPercentage > visibleEndPercent;
}

function createBarMotionState(
  geometry: ReturnType<typeof createCashflowBarGeometry>,
): AllocationBarMotionState {
  const widths = new Map(geometry.segments.map((segment) => [segment.id, segment.widthPercent]));
  return {
    consumption: widths.get('consumption') ?? 0,
    saving: widths.get('saving') ?? 0,
    investment: widths.get('investment') ?? 0,
    remaining: widths.get('remaining') ?? 0,
    desiredEndPercent: geometry.desiredEndPercent,
    visibleEndPercent: geometry.visibleEndPercent,
  };
}

function applyBarMotionState(bar: HTMLDivElement, state: AllocationBarMotionState): void {
  const clip = bar.querySelector<HTMLElement>('.cashflow-bar__clip');
  const strip = bar.querySelector<HTMLElement>('.allocation-bar__visual-track');
  if (clip === null || strip === null) return;

  clip.style.width = `${state.visibleEndPercent}%`;
  strip.style.width = `${relativeStripWidth(state.desiredEndPercent, state.visibleEndPercent)}%`;
  for (const segment of strip.querySelectorAll<HTMLElement>('[data-segment-id]')) {
    const id = segment.dataset.segmentId as AllocationId;
    segment.style.width = `${relativeSegmentWidth(state[id], state.desiredEndPercent)}%`;
  }
}

function assignBarMotionState(
  state: AllocationBarMotionState,
  target: AllocationBarMotionState,
): void {
  state.consumption = target.consumption;
  state.saving = target.saving;
  state.investment = target.investment;
  state.remaining = target.remaining;
  state.desiredEndPercent = target.desiredEndPercent;
  state.visibleEndPercent = target.visibleEndPercent;
}

function hasCashflowValueChange(previous: MainData, current: MainData): boolean {
  return previous.monthlyNetIncomeWon !== current.monthlyNetIncomeWon
    || previous.monthlyHousingWon !== current.monthlyHousingWon
    || previous.monthlyLivingWon !== current.monthlyLivingWon
    || previous.monthlySavingWon !== current.monthlySavingWon
    || previous.monthlyInvestmentWon !== current.monthlyInvestmentWon;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mergeAllocationIds(
  previousIds: AllocationId[],
  currentIds: AllocationId[],
): AllocationId[] {
  return ALLOCATION_IDS.filter((id) => previousIds.includes(id) || currentIds.includes(id));
}
