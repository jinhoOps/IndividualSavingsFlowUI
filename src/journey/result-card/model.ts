import { calculateCashflow, percentageOfIncome } from '../../main/domain/cashflow';
import { materializeAllocation, orderedResultItems } from '../../portfolio/domain/allocation';
import { assetClassAllocation } from '../../portfolio/domain/classification';
import { formatAllocationPercent, formatPortfolioWon } from '../../portfolio/ui/format';
import { formatWon } from '../../simulation/ui/format';
import { projectCompoundGrowth } from '../../simulation/domain/projection';
import type { WorkspaceDocument } from '../../workspace/domain/model';

export interface ResultCardOptions {
  includeAmounts: boolean;
  displayNames?: Readonly<Record<string, string>>;
}

export interface ResultCardRow {
  label: string;
  value: string;
}

export interface ResultCardModel {
  revision: number;
  basisDate: string;
  mode: 'amounts' | 'ratios';
  monthly: {
    headline: string;
    rows: ResultCardRow[];
    segments: Array<{ id: string; ratio: number; color: string }>;
  };
  growth: {
    label: string;
    headline: string;
    context: string;
    rows: ResultCardRow[];
  };
  allocation: {
    groups: Array<{ label: string; percentage: string }>;
    rows: Array<{ id: string; name: string; percentage: string; amount?: string; color: string }>;
  };
  notes: string[];
}

export type ResultCardBuild =
  | { kind: 'ready'; model: ResultCardModel }
  | { kind: 'blocked'; reason: 'main-required' | 'simulation-required' | 'portfolio-required' | 'source-mismatch' | 'invalid-values' };

const colors = ['#247f79', '#459aa0', '#cc9027', '#587bb6', '#7463a8', '#7f6856'];

/** Builds a redacted-at-the-source model from one committed workspace snapshot. */
export function buildResultCardModel(workspace: WorkspaceDocument, options: ResultCardOptions): ResultCardBuild {
  const main = workspace.main.applied;
  if (main === null) return { kind: 'blocked', reason: 'main-required' };
  const simulation = workspace.simulation.draft;
  if (simulation === null) return { kind: 'blocked', reason: 'simulation-required' };
  const plan = workspace.portfolio.plans.find(candidate => candidate.scope.type === 'aggregate') ?? null;
  if (plan === null) return { kind: 'blocked', reason: 'portfolio-required' };
  if (
    simulation.source.mainUpdatedAt !== main.updatedAt
    || simulation.source.monthlySavingsWon !== main.monthlySavingWon
    || simulation.source.monthlyInvestmentWon !== main.monthlyInvestmentWon
    || plan.syncedInvestmentWon !== main.monthlyInvestmentWon
  ) return { kind: 'blocked', reason: 'source-mismatch' };
  if (!isFiniteNonnegative(main.monthlyNetIncomeWon) || !isFiniteNonnegative(plan.syncedInvestmentWon)) {
    return { kind: 'blocked', reason: 'invalid-values' };
  }

  let projection;
  let allocation;
  try {
    projection = projectCompoundGrowth(simulation);
    allocation = materializeAllocation(plan, plan.syncedInvestmentWon);
  } catch {
    return { kind: 'blocked', reason: 'invalid-values' };
  }
  if (!Number.isFinite(projection.finalCurrentPlanWon) || projection.points.length === 0) {
    return { kind: 'blocked', reason: 'invalid-values' };
  }

  const cashflow = calculateCashflow(main);
  const includeAmounts = options.includeAmounts;
  const incomeRatio = percentageOfIncome(main.monthlySavingWon + main.monthlyInvestmentWon, main.monthlyNetIncomeWon);
  const ordered = orderedResultItems(plan.items, plan.cashShareUnits, 'input').map((item, index) => {
    const materialized = item.isCash
      ? { amountWon: allocation.cashAmountWon, percentage: allocation.cashPercentage }
      : allocation.items.find(candidate => candidate.id === item.id) ?? { amountWon: 0, percentage: 0 };
    return {
      id: item.id,
      name: options.displayNames?.[item.id]?.trim() || item.name,
      percentage: formatAllocationPercent(materialized.percentage),
      ...(includeAmounts ? { amount: formatPortfolioWon(materialized.amountWon) } : {}),
      color: item.isCash ? '#8dbab4' : colors[index % colors.length],
    };
  });
  const final = projection.points.at(-1)!;
  const principal = simulation.amountMode === 'real' ? final.contributedPrincipalRealWon : final.contributedPrincipalWon;
  const gain = projection.finalCurrentPlanWon - principal;
  const monthlyRows = includeAmounts ? [
    { label: '월 수입', value: formatPortfolioWon(cashflow.incomeWon) },
    { label: '주거 고정비', value: formatPortfolioWon(cashflow.housingWon) },
    { label: '생활비', value: formatPortfolioWon(cashflow.livingWon) },
    { label: '저축', value: formatPortfolioWon(cashflow.savingWon) },
    { label: '투자', value: formatPortfolioWon(cashflow.investmentWon) },
    { label: cashflow.remainingWon < 0 ? '적자' : '남는 돈', value: formatPortfolioWon(Math.abs(cashflow.remainingWon)) },
  ] : [
    { label: '저축·투자 비중', value: incomeRatio === null ? '미설정' : formatAllocationPercent(incomeRatio) },
    { label: '저축 비중', value: ratioLabel(main.monthlySavingWon, main.monthlyNetIncomeWon) },
    { label: '투자 비중', value: ratioLabel(main.monthlyInvestmentWon, main.monthlyNetIncomeWon) },
  ];
  const growthRows = includeAmounts ? [
    { label: '납입원금', value: formatWon(principal) },
    { label: '예상 수익', value: signedWon(gain) },
    { label: '전부 저축 시', value: formatWon(projection.finalAllSavingsWon) },
    { label: '전부 저축 대비', value: signedWon(projection.advantageOverAllSavingsWon) },
  ] : [
    { label: '누적 수익률', value: principal > 0 ? formatAllocationPercent(gain / principal * 100) : '미설정' },
    { label: '전부 저축 대비', value: multiplierLabel(projection.finalCurrentPlanWon, projection.finalAllSavingsWon) },
    { label: '연 기대수익률', value: formatAllocationPercent(simulation.expectedAnnualReturnPercent) },
    { label: '저축 기준금리', value: formatAllocationPercent(simulation.baseRatePercent) },
  ];

  return {
    kind: 'ready',
    model: {
      revision: workspace.revision,
      basisDate: new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(Math.max(main.updatedAt, simulation.updatedAt, plan.updatedAt))),
      mode: includeAmounts ? 'amounts' : 'ratios',
      monthly: {
        headline: includeAmounts ? `월 수입 ${formatPortfolioWon(cashflow.incomeWon)}` : '비율로 보는 이번 달',
        rows: monthlyRows,
        segments: [
          { id: 'consumption', ratio: ratio(cashflow.consumptionWon, cashflow.incomeWon), color: '#d48658' },
          { id: 'saving', ratio: ratio(cashflow.savingWon, cashflow.incomeWon), color: '#6f9d8c' },
          { id: 'investment', ratio: ratio(cashflow.investmentWon, cashflow.incomeWon), color: '#5874a8' },
          { id: 'remaining', ratio: Math.max(0, ratio(cashflow.remainingWon, cashflow.incomeWon)), color: '#a4b0b6' },
        ],
      },
      growth: {
        label: `${simulation.years}년 후 · ${includeAmounts ? '예상 자산' : '원금 대비'}`,
        headline: includeAmounts ? formatWon(projection.finalCurrentPlanWon) : multiplierLabel(projection.finalCurrentPlanWon, principal),
        context: `연 ${formatAllocationPercent(simulation.expectedAnnualReturnPercent)} 가정 · ${simulation.amountMode === 'real' ? '실질' : '명목'}`,
        rows: growthRows,
      },
      allocation: {
        groups: assetClassAllocation(plan).map(group => ({ label: group.label, percentage: formatAllocationPercent(group.percentage) })),
        rows: ordered,
      },
      notes: [
        `${simulation.years}년 · 연 ${formatAllocationPercent(simulation.expectedAnnualReturnPercent)} 가정`,
        simulation.amountMode === 'real' ? '물가 반영 예상값' : '명목 예상값',
        '적용된 계획 기준',
      ],
    },
  };
}

function signedWon(value: number): string { return `${value > 0 ? '+' : ''}${formatWon(value)}`; }
function ratio(value: number, total: number): number { return total > 0 && Number.isFinite(value) ? Math.max(0, value / total) : 0; }
function ratioLabel(value: number, total: number): string { return total > 0 ? formatAllocationPercent(value / total * 100) : '미설정'; }
function multiplierLabel(value: number, baseline: number): string { return baseline > 0 ? `${(value / baseline).toFixed(1)}배` : '미설정'; }
function isFiniteNonnegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }
