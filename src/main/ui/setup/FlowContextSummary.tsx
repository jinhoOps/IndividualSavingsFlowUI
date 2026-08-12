import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { PercentageTooltip } from '../common/PercentageTooltip';
import { createCashflowBarGeometry, type CashflowViewport } from './cashflowBarGeometry';

export interface FlowContextSummaryProps {
  data: MainData;
}

export function FlowContextSummary({ data }: FlowContextSummaryProps) {
  const [isPointerActive, setIsPointerActive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  const [pointerPosition, setPointerPosition] = useState<number>();
  const [tapPosition, setTapPosition] = useState<number>();
  const [viewport, setViewport] = useState<CashflowViewport>({
    barWidthPx: 0,
    availableRightPx: 0,
  });
  const flowBarRef = useRef<HTMLDivElement>(null);
  const flowBarWrapperRef = useRef<HTMLDivElement>(null);
  const isPointerFocusRef = useRef(false);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const isDeficit = cashflow.deficitWon > 0;
  const geometry = createCashflowBarGeometry(data, viewport);
  const plannedPercentage = percentageOfIncome(cashflow.plannedOutflowWon, cashflow.incomeWon);
  const visualPercentage = clampPercentage(plannedPercentage ?? 0);
  const formattedPercentage = formatPercentage(plannedPercentage);
  const tooltipValue = `현재 계획 ${formatContextWon(cashflow.plannedOutflowWon)} · 수입의 ${formattedPercentage}`;
  const tooltipOpen = plannedPercentage !== null && (isPointerActive || isFocused || isTapped);
  const tooltipPosition = isTapped
    ? tapPosition ?? visualPercentage
    : isPointerActive
      ? pointerPosition ?? visualPercentage
      : visualPercentage;
  const unavailableCopy = '수입을 먼저 입력해주세요.';

  useLayoutEffect(() => {
    const bar = flowBarRef.current;
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
    isPointerFocusRef.current = false;
    setTapPosition(pointerPercentage(event));
    setIsTapped((tapped) => !tapped);
  };

  return (
    <section
      className="flow-context-summary"
      data-overflow={isDeficit ? 'true' : 'false'}
      aria-label="현재 자금 계획 요약"
    >
      <div
        className="flow-bar-wrapper"
        data-overflow={isDeficit ? 'true' : 'false'}
        ref={flowBarWrapperRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsTapped(false);
          }
        }}
      >
        <div
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          aria-label="수입 대비 현재 계획"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={visualPercentage}
          aria-valuetext={plannedPercentage === null ? unavailableCopy : tooltipValue}
          className="flow-bar"
          data-desired-end-percent={geometry.desiredEndPercent}
          data-visible-end-percent={geometry.visibleEndPercent}
          data-overflow-clipped={geometry.clipped ? 'true' : 'false'}
          ref={flowBarRef}
          role="progressbar"
          tabIndex={0}
          onBlur={() => {
            isPointerFocusRef.current = false;
            setIsFocused(false);
          }}
          onClick={toggleTappedTooltip}
          onFocus={() => {
            if (!isPointerFocusRef.current) {
              setIsFocused(true);
            }
          }}
          onPointerDown={() => {
            isPointerFocusRef.current = true;
            setIsFocused(false);
          }}
          onPointerEnter={(event) => {
            updatePointerPosition(event);
            setIsPointerActive(true);
          }}
          onPointerLeave={() => setIsPointerActive(false)}
          onPointerMove={updatePointerPosition}
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
              className="cashflow-bar__strip flow-bar__fill"
              style={{
                height: '100%',
                position: 'relative',
                top: 'auto',
                transform: 'none',
                width: `${relativeFillWidth(
                  isDeficit ? geometry.desiredEndPercent : visualPercentage,
                  geometry.visibleEndPercent,
                )}%`,
              }}
            />
          </div>
        </div>
        {geometry.clipped ? (
          <span className="cashflow-bar__overflow-label">
            +{formatPercentage(geometry.overflowPercent)} 초과
          </span>
        ) : null}
        <PercentageTooltip
          id={tooltipId}
          open={tooltipOpen}
          position={{ xPercent: tooltipPosition }}
          value={tooltipValue}
        />
      </div>
      {isDeficit ? <p className="allocation-bar__deficit" role="status">수입보다 {formatContextWon(cashflow.deficitWon)} 초과</p> : null}
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

function relativeFillWidth(fillEndPercent: number, visibleEndPercent: number): number {
  return visibleEndPercent > 0 ? fillEndPercent / visibleEndPercent * 100 : 0;
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
