import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { PercentageTooltip } from '../common/PercentageTooltip';
import { formatContextWon, formatPercentage } from './FlowContextSummary';

export interface AllocationBarProps {
  data: MainData;
}

interface Allocation {
  id: string;
  label: string;
  amountWon: number;
  percentage: number | null;
}

const MIN_INTERACTIVE_PERCENTAGE = 2;

export function AllocationBar({ data }: AllocationBarProps) {
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [tappedId, setTappedId] = useState<string>();
  const [pointerPosition, setPointerPosition] = useState<number>();
  const [tapPosition, setTapPosition] = useState<number>();
  const barRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isPointerFocusRef = useRef(false);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const isDeficit = cashflow.deficitWon > 0;
  const denominator = isDeficit ? cashflow.plannedOutflowWon : cashflow.incomeWon;
  const allocations: Allocation[] = [
    { id: 'consumption', label: '소비', amountWon: cashflow.consumptionWon, percentage: percentageOfIncome(cashflow.consumptionWon, denominator) },
    { id: 'saving', label: '저축', amountWon: cashflow.savingWon, percentage: percentageOfIncome(cashflow.savingWon, denominator) },
    { id: 'investment', label: '투자', amountWon: cashflow.investmentWon, percentage: percentageOfIncome(cashflow.investmentWon, denominator) },
  ];

  if (!isDeficit) {
    allocations.push({ id: 'remaining', label: '남는 돈', amountWon: cashflow.remainingWon, percentage: percentageOfIncome(cashflow.remainingWon, denominator) });
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

  const triggerProps = (allocation: Allocation, isVisualTarget: boolean) => {
    const isActive = activeId === allocation.id;
    return {
      'aria-describedby': isActive ? tooltipId : undefined,
      'aria-label': `${allocation.label} ${formatPercentage(allocation.percentage)}`,
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
    <section className="allocation-bar" aria-label="월 수입 나누기">
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
        <div className="flow-bar allocation-bar__segments" ref={barRef}>
          <div aria-hidden="true" className="allocation-bar__visual-track">
            {allocations.map((allocation) => {
              const visualPercentage = clampPercentage(allocation.percentage ?? 0);
              return (
                <span
                  className={`allocation-bar__visual-segment allocation-bar__visual-segment--${allocation.id}`}
                  key={allocation.id}
                  style={{ width: `${visualPercentage}%` }}
                />
              );
            })}
          </div>
          {allocations.map((allocation) => {
            const visualPercentage = clampPercentage(allocation.percentage ?? 0);
            const requiresLegendTarget = visualPercentage < MIN_INTERACTIVE_PERCENTAGE;
            const center = allocationCenter(allocation.id, allocations);

            return requiresLegendTarget ? null : (
              <button
                {...triggerProps(allocation, true)}
                className="allocation-bar__segment-target"
                key={allocation.id}
                style={{
                  left: `clamp(22px, ${center}%, calc(100% - 22px))`,
                  width: `max(${visualPercentage}%, var(--ui-control-min-height))`,
                }}
              />
            );
          })}
        </div>
        <ul className="allocation-bar__legend" aria-label="월 자금 항목">
          {allocations.map((allocation) => {
            const requiresLegendTarget = clampPercentage(allocation.percentage ?? 0) < MIN_INTERACTIVE_PERCENTAGE;
            const text = `${allocation.label} ${formatContextWon(allocation.amountWon)}`;

            return (
              <li key={allocation.id}>
                {requiresLegendTarget ? (
                  <button {...triggerProps(allocation, false)} className="allocation-bar__legend-target">
                    {text}
                  </button>
                ) : text}
              </li>
            );
          })}
        </ul>
        <PercentageTooltip
          id={tooltipId}
          open={activeAllocation !== undefined}
          position={{ xPercent: tooltipPosition }}
          value={formatPercentage(activeAllocation?.percentage ?? null)}
        />
      </div>
      {isDeficit ? <p className="allocation-bar__deficit" role="status">수입보다 {formatContextWon(cashflow.deficitWon)} 초과</p> : null}
    </section>
  );
}

function allocationCenter(allocationId: string, allocations: Allocation[]): number {
  let offset = 0;

  for (const allocation of allocations) {
    const percentage = clampPercentage(allocation.percentage ?? 0);
    if (allocation.id === allocationId) {
      return clampPercentage(offset + percentage / 2);
    }
    offset += percentage;
  }

  return 0;
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
