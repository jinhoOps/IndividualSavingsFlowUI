import { useId, useLayoutEffect, useRef } from 'react';
import { WandSparkles } from 'lucide-react';
import { animateVisualNumber } from '../../../components/motion/animateVisualNumber';
import type { CashflowSummary as CashflowTotals } from '../../domain/cashflow';

type AllocationId = 'consumption' | 'remaining' | 'saving' | 'investment';

export interface CashflowSummaryProps {
  summary: CashflowTotals;
  onExpense?(opener: HTMLElement): void;
  selection?: {
    activeId?: AllocationId;
    selectedId?: AllocationId;
    onHover(id?: AllocationId): void;
    onFocus(id?: AllocationId): void;
    onSelect(id: AllocationId): void;
  };
}

export function CashflowSummary({ summary, selection, onExpense }: CashflowSummaryProps) {
  const rows = [
    { id: 'consumption' as const, label: '월 지출', chartLabel: '지출', valueWon: summary.consumptionWon,
      context: `주거 ${formatDashboardWon(summary.housingWon)} · 생활 ${formatDashboardWon(summary.livingWon)}` },
    { id: 'remaining' as const, label: '남는 돈', chartLabel: '여윳돈', valueWon: summary.remainingWon,
      context: summary.deficitWon > 0 ? `수입보다 ${formatDashboardWon(summary.deficitWon)} 초과` : undefined },
    { id: 'saving' as const, label: '월 저축', chartLabel: '저축', valueWon: summary.savingWon },
    { id: 'investment' as const, label: '월 투자', chartLabel: '투자', valueWon: summary.investmentWon },
  ];

  return (
    <section className="cashflow-summary" aria-label="월간 핵심 수치">
      {rows.map((row) => (
        <MetricRow key={row.id} {...row} incomeWon={summary.incomeWon} selection={selection} onExpense={row.id === 'consumption' ? onExpense : undefined} />
      ))}
    </section>
  );
}

interface MetricRowProps {
  id: AllocationId;
  label: string;
  chartLabel: string;
  valueWon: number;
  incomeWon: number;
  context?: string;
  selection?: CashflowSummaryProps['selection'];
  onExpense?: CashflowSummaryProps['onExpense'];
}

function MetricRow({ id, label, chartLabel, valueWon, incomeWon, context, selection, onExpense }: MetricRowProps) {
  const contextId = useId();
  const percentage = incomeWon > 0 ? `${(valueWon / incomeWon * 100).toFixed(1)}%` : '—';
  const selectable = selection !== undefined && valueWon >= 0 && incomeWon > 0;
  const content = (
    <>
      <span className="cashflow-metric__label">{label}</span>
      <span className="cashflow-metric__percentage">{percentage}</span>
      {context && !onExpense ? <small id={contextId} className="cashflow-metric__context">{context}</small> : null}
      {!onExpense ? <strong className="cashflow-metric__value"><AnimatedMetricValue valueWon={valueWon} /></strong> : null}
    </>
  );

  return (
    <div className={`cashflow-metric cashflow-donut__segment--${id}${onExpense ? ' cashflow-metric--assistant' : ''}`} data-active={selection?.activeId === id || undefined} data-deficit={valueWon < 0 || undefined}>
      {selectable ? (
        <button
          type="button"
          className="cashflow-metric__inspect cashflow-donut__legend-button"
          aria-label={`${chartLabel} · ${formatDashboardWon(valueWon)} · ${percentage}`}
          aria-describedby={context ? contextId : undefined}
          aria-pressed={selection.selectedId === id}
          onBlur={() => selection.onFocus()}
          onClick={() => selection.onSelect(id)}
          onFocus={() => selection.onFocus(id)}
          onPointerEnter={() => selection.onHover(id)}
          onPointerLeave={() => selection.onHover()}
        >{content}</button>
      ) : <div className="cashflow-metric__inspect">{content}</div>}
      {onExpense ? <>
        <button type="button" className="cashflow-metric__assistant" aria-label={`지출 계산 도우미 · 현재 ${formatDashboardWon(valueWon)}`} onClick={event => onExpense(event.currentTarget)}>
          <strong className="cashflow-metric__value"><AnimatedMetricValue valueWon={valueWon} /></strong><WandSparkles size={18} aria-hidden="true" />
          <span className="cashflow-metric__assistant-hint">항목별로 계산</span>
        </button>
        {context ? <small id={contextId} className="cashflow-metric__context">{context}</small> : null}
      </> : null}
    </div>
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
