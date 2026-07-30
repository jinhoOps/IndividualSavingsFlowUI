import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { PercentageTooltip } from '../common/PercentageTooltip';
import { formatContextWon, formatPercentage } from './FlowContextSummary';
import { createOverflowPresentation } from './overflowPresentation';

export interface AllocationBarProps {
  data: MainData;
  transitioning?: boolean;
}

interface Allocation {
  id: string;
  label: string;
  amountWon: number;
  percentage: number | null;
  visualPercentage: number;
}

export interface AllocationVisualSegment {
  id: 'consumption' | 'saving' | 'investment' | 'remaining';
  visualPercentage: number;
}

const MIN_INTERACTIVE_SIZE_PX = 44;

export function createAllocationVisualSegments(data: MainData): AllocationVisualSegment[] {
  const cashflow = calculateCashflow(data);
  const isDeficit = cashflow.deficitWon > 0;
  const denominator = isDeficit ? cashflow.plannedOutflowWon : cashflow.incomeWon;
  const segment = (
    id: AllocationVisualSegment['id'],
    amountWon: number,
  ): AllocationVisualSegment => ({
    id,
    visualPercentage: clampPercentage(percentageOfIncome(amountWon, denominator) ?? 0),
  });
  const segments = [
    segment('consumption', cashflow.consumptionWon),
    segment('saving', cashflow.savingWon),
    segment('investment', cashflow.investmentWon),
  ];
  if (!isDeficit) segments.push(segment('remaining', cashflow.remainingWon));
  return segments;
}

export function AllocationBar({ data, transitioning = false }: AllocationBarProps) {
  const [transitionVisible, setTransitionVisible] = useState(transitioning);
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [tappedId, setTappedId] = useState<string>();
  const [pointerPosition, setPointerPosition] = useState<number>();
  const [tapPosition, setTapPosition] = useState<number>();
  const [barWidth, setBarWidth] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isPointerFocusRef = useRef(false);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const isDeficit = cashflow.deficitWon > 0;
  const overflow = createOverflowPresentation(cashflow.deficitWon, cashflow.incomeWon);
  const overflowStyle = {
    '--overflow-length': `${overflow.displayLengthPercent}%`,
    '--overflow-duration': `${overflow.flowDurationMs}ms`,
  } as CSSProperties;
  const visualDenominator = isDeficit ? cashflow.plannedOutflowWon : cashflow.incomeWon;
  const visualSegments = createAllocationVisualSegments(data);
  const plannedPercentage = clampPercentage(
    percentageOfIncome(cashflow.plannedOutflowWon, cashflow.incomeWon) ?? 0,
  );
  const allocation = (id: string, label: string, amountWon: number): Allocation => ({
    id,
    label,
    amountWon,
    percentage: percentageOfIncome(amountWon, cashflow.incomeWon),
    visualPercentage: visualSegments.find((segment) => segment.id === id)?.visualPercentage
      ?? clampPercentage(percentageOfIncome(amountWon, visualDenominator) ?? 0),
  });
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

  useEffect(() => {
    if (!transitionVisible) return undefined;
    const timeout = window.setTimeout(() => setTransitionVisible(false), 1_350);
    return () => window.clearTimeout(timeout);
  }, [transitionVisible]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) {
      return;
    }

    const updateBarWidth = () => {
      const nextWidth = bar.getBoundingClientRect().width;
      setBarWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
    };
    updateBarWidth();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateBarWidth);
    resizeObserver?.observe(bar);
    window.addEventListener('resize', updateBarWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateBarWidth);
    };
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
      data-transitioning={transitioning ? 'true' : undefined}
    >
      <p className="allocation-bar__context">
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
        {transitionVisible ? (
          <div
            className="setup-review-transition"
            aria-hidden="true"
            onAnimationEnd={() => setTransitionVisible(false)}
          >
            <div className="setup-review-transition__track">
              {visualSegments.map((segment) => (
                <span
                  className={`allocation-bar__visual-segment allocation-bar__visual-segment--${segment.id}`}
                  key={segment.id}
                  style={{ width: `${segment.visualPercentage}%` }}
                />
              ))}
              <span
                className="setup-review-transition__accent"
                style={{ width: `${plannedPercentage}%` }}
              />
            </div>
          </div>
        ) : null}
        <div
          className="flow-bar allocation-bar__segments"
          data-overflow={isDeficit ? 'true' : 'false'}
          data-overflow-intensity={overflow.intensity}
          ref={barRef}
        >
          <div aria-hidden="true" className="allocation-bar__visual-track">
            {allocations.map((allocation) => {
              return (
                <span
                  className={`allocation-bar__visual-segment allocation-bar__visual-segment--${allocation.id}`}
                  key={allocation.id}
                  style={{ width: `${allocation.visualPercentage}%` }}
                />
              );
            })}
          </div>
          {allocations.map((allocation) => {
            const visualPercentage = allocation.visualPercentage;
            const requiresLegendTarget = !hasIndependentTarget(visualPercentage, barWidth);
            const offset = allocationOffset(allocation.id, allocations);

            return requiresLegendTarget ? null : (
              <button
                {...triggerProps(allocation, true)}
                className="allocation-bar__segment-target"
                key={allocation.id}
                style={{
                  left: `${offset}%`,
                  width: `${visualPercentage}%`,
                }}
              />
            );
          })}
          {overflow.intensity === 'none' ? null : (
            <>
              <span aria-hidden="true" className="flow-overflow-bridge">
                <span className="flow-overflow-sheen" />
              </span>
              <span aria-hidden="true" className="flow-overflow-extension" style={overflowStyle}>
                <span className="flow-overflow-sheen" />
                {overflow.showDroplets ? (
                  <span className="flow-overflow-droplets">
                    <span className="flow-overflow-droplet" />
                    <span className="flow-overflow-droplet" />
                  </span>
                ) : null}
              </span>
            </>
          )}
        </div>
        <table className="allocation-table" aria-label="월 자금 항목">
          <thead>
            <tr>
              <th scope="col">종류</th>
              <th scope="col">금액</th>
              <th scope="col">수입 대비</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => {
              const requiresTableTarget = !hasIndependentTarget(allocation.visualPercentage, barWidth);
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
      {isDeficit ? <p className="allocation-bar__deficit" role="status">수입보다 {formatContextWon(cashflow.deficitWon)} 초과</p> : null}
    </section>
  );
}

function allocationCenter(allocationId: string, allocations: Allocation[]): number {
  const allocation = allocations.find((candidate) => candidate.id === allocationId);
  return clampPercentage(
    allocationOffset(allocationId, allocations)
      + (allocation?.visualPercentage ?? 0) / 2,
  );
}

function allocationOffset(allocationId: string, allocations: Allocation[]): number {
  let offset = 0;

  for (const allocation of allocations) {
    const percentage = allocation.visualPercentage;
    if (allocation.id === allocationId) {
      return clampPercentage(offset);
    }
    offset += percentage;
  }

  return 0;
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
