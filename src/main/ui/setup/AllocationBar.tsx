import { useId, useState } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { formatContextWon, formatPercentage } from './FlowContextSummary';

export interface AllocationBarProps {
  data: MainData;
  contextLabel?: string;
}

interface Allocation {
  id: string;
  label: string;
  amountWon: number;
  percentage: number | null;
}

export function AllocationBar({ data, contextLabel }: AllocationBarProps) {
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [tappedId, setTappedId] = useState<string>();
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

  return (
    <section className="allocation-bar" aria-label="수입 배분">
      <p className="allocation-bar__context">
        {contextLabel ?? (isDeficit ? '계획 유출을 기준으로 배분했습니다' : '월 수입을 기준으로 배분했습니다')}
      </p>
      <div className="allocation-bar__segments">
        {allocations.map((allocation) => {
          const formattedPercentage = formatPercentage(allocation.percentage);
          const isActive = activeId === allocation.id;
          return (
            <button
              aria-describedby={isActive ? tooltipId : undefined}
              aria-label={`${allocation.label} ${formattedPercentage}`}
              className={`allocation-bar__segment allocation-bar__segment--${allocation.id}`}
              key={allocation.id}
              style={{ width: `${Math.min(100, Math.max(0, allocation.percentage ?? 0))}%` }}
              type="button"
              onBlur={() => {
                setFocusedId(undefined);
                setTappedId(undefined);
              }}
              onClick={() => setTappedId((active) => active === allocation.id ? undefined : allocation.id)}
              onFocus={() => setFocusedId(allocation.id)}
              onMouseEnter={() => setHoveredId(allocation.id)}
              onMouseLeave={() => setHoveredId(undefined)}
            >
              <span className="sr-only">{allocation.label} {formatContextWon(allocation.amountWon)}</span>
            </button>
          );
        })}
      </div>
      <ul className="allocation-bar__legend" aria-label="배분 항목">
        {allocations.map((allocation) => <li key={allocation.id}>{allocation.label} {formatContextWon(allocation.amountWon)}</li>)}
      </ul>
      {isDeficit ? <p className="allocation-bar__deficit" role="status">수입보다 {formatContextWon(cashflow.deficitWon)} 초과</p> : null}
      {activeId ? (
        <span className="flow-tooltip" id={tooltipId} role="tooltip">
          {formatPercentage(allocations.find((allocation) => allocation.id === activeId)?.percentage ?? null)}
        </span>
      ) : null}
    </section>
  );
}
