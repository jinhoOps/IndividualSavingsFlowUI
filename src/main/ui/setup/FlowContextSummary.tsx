import { useId, useState } from 'react';
import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';

export interface FlowContextSummaryProps {
  data: MainData;
}

export function FlowContextSummary({ data }: FlowContextSummaryProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();
  const cashflow = calculateCashflow(data);
  const plannedPercentage = percentageOfIncome(cashflow.plannedOutflowWon, cashflow.incomeWon);
  const visualPercentage = Math.min(100, Math.max(0, plannedPercentage ?? 0));
  const formattedPercentage = formatPercentage(plannedPercentage);

  return (
    <section className="flow-context-summary" aria-label="현재 자금 계획 요약">
      <p className="flow-context-summary__amount">월 수입 {formatContextWon(cashflow.incomeWon)}</p>
      <p className="flow-context-summary__amount">현재 계획 {formatContextWon(cashflow.plannedOutflowWon)}</p>
      <p className="flow-context-summary__amount">남는 돈 {formatContextWon(cashflow.remainingWon)}</p>
      <div className="flow-context-summary__meter-track">
        <div
          aria-describedby={tooltipOpen && plannedPercentage !== null ? tooltipId : undefined}
          aria-label="수입 대비 현재 계획"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={visualPercentage}
          aria-valuetext={plannedPercentage === null ? '비율을 계산할 수 없음' : formattedPercentage}
          className="flow-context-summary__meter"
          role="meter"
          style={{ width: `${visualPercentage}%` }}
          tabIndex={0}
          onBlur={() => setTooltipOpen(false)}
          onClick={() => setTooltipOpen((open) => !open)}
          onFocus={() => setTooltipOpen(true)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        />
      </div>
      {plannedPercentage === null ? <p className="flow-context-summary__notice">수입이 없어 비율을 계산할 수 없습니다</p> : null}
      {tooltipOpen && plannedPercentage !== null ? <span className="flow-tooltip" id={tooltipId} role="tooltip">{formattedPercentage}</span> : null}
    </section>
  );
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
