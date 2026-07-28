import type { CashflowSummary as CashflowTotals } from '../../domain/cashflow';

export type DashboardSection = 'income' | 'expense' | 'saving' | 'investment';

export interface CashflowSummaryProps {
  summary: CashflowTotals;
  onEdit(section: DashboardSection, opener: HTMLElement): void;
}

export function CashflowSummary({ summary, onEdit }: CashflowSummaryProps) {
  return (
    <section aria-label="월간 핵심 수치">
      <div>
        <MetricButton
          label="수입"
          valueWon={summary.incomeWon}
          importance="primary"
          onClick={(opener) => onEdit('income', opener)}
        />
        <MetricButton
          label="계획 유출"
          valueWon={summary.plannedOutflowWon}
          importance="primary"
          onClick={(opener) => onEdit('expense', opener)}
        >
          <span>생활비 {formatDashboardWon(summary.expenseWon)}</span>
        </MetricButton>
        <MetricButton
          label="남는 금액"
          valueWon={summary.availableWon}
          importance="primary"
          onClick={(opener) => onEdit('investment', opener)}
        >
          <span>투자 가능액</span>
          {summary.deficitWon > 0 ? <span>부족 {formatDashboardWon(summary.deficitWon)}</span> : null}
        </MetricButton>
      </div>
      <div>
        <MetricButton
          label="저축"
          valueWon={summary.savingWon}
          importance="secondary"
          onClick={(opener) => onEdit('saving', opener)}
        />
        <MetricButton
          label="투자"
          valueWon={summary.investmentWon}
          importance="secondary"
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
  onClick(opener: HTMLButtonElement): void;
}

function MetricButton({ label, valueWon, importance, children, onClick }: MetricButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${label === '계획 유출' ? '생활비' : label} 편집`}
      data-importance={importance}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <span>{label}</span>
      <strong>{formatDashboardWon(valueWon)}</strong>
      {children ? <small>{children}</small> : null}
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
