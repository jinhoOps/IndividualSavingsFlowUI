import { useId, useLayoutEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { animateVisualNumber } from '../../../components/motion/animateVisualNumber';
import type { CashflowSummary as CashflowTotals } from '../../domain/cashflow';
import { Button } from '../common/Button';

export interface CashflowSummaryProps {
  summary: CashflowTotals;
  disabled?: boolean;
  onEdit(opener: HTMLElement): void;
}

export function CashflowSummary({ summary, disabled = false, onEdit }: CashflowSummaryProps) {
  return (
    <section className="cashflow-summary" aria-label="월간 핵심 수치">
      <div className="cashflow-summary__row">
        <MetricButton
          label="월 소비"
          valueWon={summary.consumptionWon}
          importance="primary"
          disabled={disabled}
          onClick={onEdit}
        >
          <span>주거 {formatDashboardWon(summary.housingWon)}</span>
          <span>생활 {formatDashboardWon(summary.livingWon)}</span>
        </MetricButton>
        <MetricButton
          label="남는 돈"
          valueWon={summary.remainingWon}
          importance="primary"
          disabled={disabled}
          onClick={onEdit}
        >
          {summary.deficitWon > 0 ? <span>수입보다 {formatDashboardWon(summary.deficitWon)} 초과</span> : null}
        </MetricButton>
      </div>
      <div className="cashflow-summary__row">
        <MetricButton
          label="월 저축"
          valueWon={summary.savingWon}
          importance="secondary"
          disabled={disabled}
          onClick={onEdit}
        />
        <MetricButton
          label="월 투자"
          valueWon={summary.investmentWon}
          importance="secondary"
          disabled={disabled}
          onClick={onEdit}
        />
      </div>
    </section>
  );
}

interface MetricButtonProps {
  label: string;
  valueWon: number;
  importance: 'primary' | 'secondary';
  children?: React.ReactNode;
  disabled: boolean;
  onClick(opener: HTMLButtonElement): void;
}

function MetricButton({ label, valueWon, importance, children, disabled, onClick }: MetricButtonProps) {
  const descriptionId = useId();
  const contextId = useId();
  return (
    <Button
      type="button"
      variant="quiet"
      disabled={disabled}
      aria-label={`${label} 편집`}
      aria-describedby={children ? `${descriptionId} ${contextId}` : descriptionId}
      data-importance={importance}
      className="cashflow-metric"
      onClick={(event) => onClick(event.currentTarget)}
    >
      <span className="cashflow-metric__label">
        {label}
        <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <strong id={descriptionId} className="cashflow-metric__value">
        <AnimatedMetricValue valueWon={valueWon} />
      </strong>
      {children ? <small id={contextId} className="cashflow-metric__context">{children}</small> : null}
    </Button>
  );
}

function AnimatedMetricValue({ valueWon }: { valueWon: number }) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(valueWon);
  const formattedValue = formatDashboardWon(valueWon);

  useLayoutEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = valueWon;
    if (previousValue === valueWon || visualRef.current === null) return;
    return animateVisualNumber(
      visualRef.current,
      previousValue,
      valueWon,
      formatDashboardWon,
    );
  }, [valueWon]);

  return (
    <>
      <span className="sr-only">{formattedValue}</span>
      <span aria-hidden="true" ref={visualRef}>{formattedValue}</span>
    </>
  );
}

export function formatDashboardWon(valueWon: number): string {
  const absolute = Math.abs(valueWon);
  if (absolute >= 10_000) {
    const inManWon = valueWon / 10_000;
    const rendered = Number.isInteger(inManWon)
      ? new Intl.NumberFormat('ko-KR').format(inManWon)
      : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(inManWon);
    return `${rendered}만 원`;
  }

  return `${new Intl.NumberFormat('ko-KR').format(valueWon)}원`;
}
