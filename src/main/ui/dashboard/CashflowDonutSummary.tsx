import { useId, useState } from 'react';
import { calculateCashflowInsight, type DonutAllocation } from '../../domain/cashflowInsight';
import type { MainData } from '../../domain/model';
import { formatDashboardWon } from './CashflowSummary';

export interface CashflowDonutSummaryProps {
  data: MainData;
}

export function CashflowDonutSummary({ data }: CashflowDonutSummaryProps) {
  const [hoveredId, setHoveredId] = useState<DonutAllocation['id']>();
  const [focusedId, setFocusedId] = useState<DonutAllocation['id']>();
  const [tappedId, setTappedId] = useState<DonutAllocation['id']>();
  const tooltipId = useId();
  const insight = calculateCashflowInsight(data);
  const activeId = hoveredId ?? focusedId ?? tappedId;
  const activeAllocation = insight.allocations.find((allocation) => allocation.id === activeId);
  const hasIncome = data.monthlyNetIncomeWon > 0;
  let offset = 0;

  return (
    <section className="cashflow-donut" aria-label="월 수입 배분">
      {hasIncome ? (
        <div className="cashflow-donut__chart">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={insight.allocations.map((allocation) => `${allocation.label} ${formatPercentage(allocation.percentage)}`).join(', ')}
          >
            {insight.allocations.map((allocation) => {
              const dashoffset = -offset;
              offset += allocation.displayPercentage;
              return (
                <circle
                  aria-hidden="true"
                  className={`cashflow-donut__segment--${allocation.id}`}
                  cx="50"
                  cy="50"
                  fill="none"
                  key={allocation.id}
                  pathLength="100"
                  r="40"
                  strokeDasharray={`${allocation.displayPercentage} ${100 - allocation.displayPercentage}`}
                  strokeDashoffset={dashoffset}
                  strokeWidth="14"
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </svg>
          <div className="cashflow-donut__center">
            <strong>{insight.savingsInvestmentPercentage === null ? '—' : formatPercentage(insight.savingsInvestmentPercentage)}</strong>
            <span>저축·투자</span>
            {insight.isOverIncome ? <small>소득 초과</small> : null}
          </div>
        </div>
      ) : <p className="cashflow-donut__guidance">월소득을 입력해주세요.</p>}
      <div className="cashflow-donut__legend">
        {insight.allocations.map((allocation) => {
          const active = activeAllocation?.id === allocation.id;
          return (
            <button
              aria-describedby={active ? tooltipId : undefined}
              aria-label={`${allocation.label} 상세 정보`}
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
              <span>{formatDashboardWon(allocation.amountWon)}</span>
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
