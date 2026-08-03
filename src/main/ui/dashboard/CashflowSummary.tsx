import { useId } from 'react';
import type { CashflowSummary as CashflowTotals } from '../../domain/cashflow';
import { Button } from '../common/Button';

export interface CashflowSummaryProps {
  summary: CashflowTotals;
  disabled?: boolean;
  onEdit(opener: HTMLElement): void;
}

export function CashflowSummary({ summary, disabled = false, onEdit }: CashflowSummaryProps) {
  return (
    <section className="grid gap-4" aria-label="월간 핵심 수치">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      <div className="grid gap-3 sm:grid-cols-2">
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
      className={importance === 'primary'
        ? 'group h-auto min-h-44 w-full flex-col items-stretch justify-start whitespace-normal rounded-3xl border-white/80 bg-white p-6 text-left shadow-float hover:-translate-y-0.5 hover:border-accent/25'
        : 'group h-auto w-full flex-col items-stretch justify-start whitespace-normal rounded-2xl border-slate-200/80 bg-white/70 p-5 text-left hover:border-slate-300 hover:bg-white'}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <span className={importance === 'primary'
        ? 'block text-sm font-black tracking-wide text-accent'
        : 'block text-sm font-bold text-slate-500'}>{label}</span>
      <strong id={descriptionId} className={importance === 'primary'
        ? 'mt-5 block text-4xl font-black tracking-tight text-slate-950'
        : 'mt-2 block text-2xl font-black tracking-tight text-slate-800'}>{formatDashboardWon(valueWon)}</strong>
      {children ? <small id={contextId} className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-500">{children}</small> : null}
    </Button>
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
