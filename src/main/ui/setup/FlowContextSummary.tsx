import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { PercentageTooltip } from '../common/PercentageTooltip';

export interface FlowContextSummaryProps {
  data: MainData;
}

export function FlowContextSummary({ data }: FlowContextSummaryProps) {
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  const [pointerPosition, setPointerPosition] = useState<number>();
  const [tapPosition, setTapPosition] = useState<number>();
  const flowBarWrapperRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const plannedPercentage = percentageOfIncome(cashflow.plannedOutflowWon, cashflow.incomeWon);
  const visualPercentage = clampPercentage(plannedPercentage ?? 0);
  const formattedPercentage = formatPercentage(plannedPercentage);
  const tooltipOpen = plannedPercentage !== null && (isPointerActive || isFocused || isTapped);
  const tooltipPosition = isTapped
    ? tapPosition ?? visualPercentage
    : isPointerActive
      ? pointerPosition ?? visualPercentage
      : visualPercentage;
  const unavailableCopy = '수입을 먼저 입력해주세요.';

  useEffect(() => {
    if (!isTapped) {
      return;
    }

    const closeTappedTooltip = (event: MouseEvent) => {
      if (!flowBarWrapperRef.current?.contains(event.target as Node)) {
        setIsTapped(false);
      }
    };

    document.addEventListener('click', closeTappedTooltip);
    return () => document.removeEventListener('click', closeTappedTooltip);
  }, [isTapped]);

  const updatePointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    setPointerPosition(pointerPercentage(event));
  };

  const toggleTappedTooltip = (event: PointerEvent<HTMLDivElement>) => {
    setTapPosition(pointerPercentage(event));
    setIsTapped((tapped) => !tapped);
  };

  return (
    <section className="flow-context-summary" aria-label="현재 자금 계획 요약">
      <div className="flow-bar-wrapper" ref={flowBarWrapperRef}>
        <div
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          aria-label="수입 대비 현재 계획"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={visualPercentage}
          aria-valuetext={plannedPercentage === null ? unavailableCopy : formattedPercentage}
          className="flow-bar"
          role="meter"
          tabIndex={0}
          onBlur={() => setIsFocused(false)}
          onClick={toggleTappedTooltip}
          onFocus={() => setIsFocused(true)}
          onPointerEnter={(event) => {
            updatePointerPosition(event);
            setIsPointerActive(true);
          }}
          onPointerLeave={() => setIsPointerActive(false)}
          onPointerMove={updatePointerPosition}
        >
          <div
            aria-hidden="true"
            className="flow-bar__fill"
            style={{ width: `${visualPercentage}%` }}
          />
        </div>
        <PercentageTooltip
          id={tooltipId}
          open={tooltipOpen}
          position={{ xPercent: tooltipPosition }}
          value={formattedPercentage}
        />
      </div>
    </section>
  );
}

function pointerPercentage(event: PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }

  return clampPercentage(((event.clientX - rect.left) / rect.width) * 100);
}

function clampPercentage(percentage: number): number {
  return Math.min(100, Math.max(0, percentage));
}

export function formatContextWon(amountWon: number): string {
  const absolute = Math.abs(amountWon);
  if (absolute >= 10_000) {
    const inManWon = amountWon / 10_000;
    const formatted = Number.isInteger(inManWon)
      ? new Intl.NumberFormat('ko-KR').format(inManWon)
      : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(inManWon);
    return `${formatted}만 원`;
  }

  return `${new Intl.NumberFormat('ko-KR').format(amountWon)}원`;
}

export function formatPercentage(percentage: number | null): string {
  return `${(percentage ?? 0).toFixed(1)}%`;
}
