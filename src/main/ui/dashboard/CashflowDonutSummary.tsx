import { useEffect, useId, useRef, useState } from 'react';
import { calculateCashflowInsight, type DonutAllocation } from '../../domain/cashflowInsight';
import type { MainData } from '../../domain/model';
import { formatDashboardWon } from './CashflowSummary';
import { hitTestDonutAllocation } from './donutHitTest';

export interface CashflowDonutSummaryProps {
  data: MainData;
}

export function CashflowDonutSummary({ data }: CashflowDonutSummaryProps) {
  const [hoveredId, setHoveredId] = useState<DonutAllocation['id']>();
  const [focusedId, setFocusedId] = useState<DonutAllocation['id']>();
  const [tappedId, setTappedId] = useState<DonutAllocation['id']>();
  const sectionRef = useRef<HTMLElement>(null);
  const tooltipId = useId();
  const insight = calculateCashflowInsight(data);
  const activeId = hoveredId ?? focusedId ?? tappedId;
  const activeAllocation = insight.allocations.find((allocation) => allocation.id === activeId);
  const hasIncome = data.monthlyNetIncomeWon > 0;
  let offset = 0;

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
            {insight.allocations.map((allocation) => {
              const visiblePercentage = Math.min(allocation.displayPercentage, Math.max(0, 100 - offset));
              const dashoffset = -offset;
              offset += visiblePercentage;
              return (
                <circle
                  aria-hidden="true"
                  className={`cashflow-donut__segment--${allocation.id}${activeAllocation?.id === allocation.id ? ' cashflow-donut__segment--active' : ''}`}
                  cx="50"
                  cy="50"
                  fill="none"
                  key={allocation.id}
                  pathLength="100"
                  r="40"
                  strokeDasharray={`${visiblePercentage} ${100 - visiblePercentage}`}
                  strokeDashoffset={dashoffset}
                  strokeWidth="14"
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </svg>
          <div className="cashflow-donut__center">
            <strong>{activeAllocation
              ? formatPercentage(activeAllocation.percentage)
              : insight.savingsInvestmentPercentage === null
                ? '—'
                : formatPercentage(insight.savingsInvestmentPercentage)}</strong>
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
              <span className="cashflow-donut__legend-amount">{formatDashboardWon(allocation.amountWon)}</span>
              <span>{formatPercentage(allocation.percentage)}</span>
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

function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}
