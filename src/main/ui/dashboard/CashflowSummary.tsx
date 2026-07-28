import type { CashflowSummary as CashflowTotals } from '../../domain/cashflow';

export type DashboardSection = 'income' | 'expense' | 'saving' | 'investment';

export interface CashflowSummaryProps {
  summary: CashflowTotals;
  disabled?: boolean;
  onEdit(section: DashboardSection, opener: HTMLElement): void;
}

export function CashflowSummary({ summary, disabled = false, onEdit }: CashflowSummaryProps) {
  return (
    <section className="grid gap-4" aria-label="월간 핵심 수치">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricButton
          label="수입"
          valueWon={summary.incomeWon}
          importance="primary"
          disabled={disabled}
          onClick={(opener) => onEdit('income', opener)}
        />
        <MetricButton
          label="계획 유출"
          valueWon={summary.plannedOutflowWon}
          importance="primary"
          disabled={disabled}
          onClick={(opener) => onEdit('expense', opener)}
        >
          <span>생활비 {formatDashboardWon(summary.expenseWon)}</span>
        </MetricButton>
        <MetricButton
          label="남는 금액"
          valueWon={summary.availableWon}
          importance="primary"
          disabled={disabled}
          onClick={(opener) => onEdit('investment', opener)}
        >
          <span>투자 가능액</span>
          {summary.deficitWon > 0 ? <span>부족 {formatDashboardWon(summary.deficitWon)}</span> : null}
        </MetricButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricButton
          label="저축"
          valueWon={summary.savingWon}
          importance="secondary"
          disabled={disabled}
          onClick={(opener) => onEdit('saving', opener)}
        />
        <MetricButton
          label="투자"
          valueWon={summary.investmentWon}
          importance="secondary"
          disabled={disabled}
          onClick={(opener) => onEdit('investment', opener)}
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
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label === '계획 유출' ? '생활비' : label} 편집`}
      data-importance={importance}
      className={importance === 'primary'
        ? 'group min-h-44 rounded-3xl border border-white/80 bg-white p-6 text-left shadow-float transition hover:-translate-y-0.5 hover:border-accent/25'
        : 'group rounded-2xl border border-slate-200/80 bg-white/70 p-5 text-left transition hover:border-slate-300 hover:bg-white'}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <span className={importance === 'primary'
        ? 'block text-sm font-black tracking-wide text-accent'
        : 'block text-sm font-bold text-slate-500'}>{label}</span>
      <strong className={importance === 'primary'
        ? 'mt-5 block text-4xl font-black tracking-tight text-slate-950'
        : 'mt-2 block text-2xl font-black tracking-tight text-slate-800'}>{formatDashboardWon(valueWon)}</strong>
      {children ? <small className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-500">{children}</small> : null}
    </button>
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
