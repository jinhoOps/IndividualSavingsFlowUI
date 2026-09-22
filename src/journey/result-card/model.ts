import { calculateCashflow, percentageOfIncome } from '../../main/domain/cashflow';
import { materializeAllocation, orderedResultItems } from '../../portfolio/domain/allocation';
import { stableShareUnits } from '../../portfolio/domain/classification';
import { formatAllocationPercent, formatPortfolioWon } from '../../portfolio/ui/format';
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
    headline: string;
    rows: ResultCardRow[];
    points: Array<{ x: number; plan: number; baseline: number }>;
  };
  allocation: {
    headline: string;
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
  const maximum = Math.max(1, ...projection.points.map(point => Math.max(
    point.currentPlanNominalWon, point.allSavingsNominalWon,
    point.currentPlanRealWon, point.allSavingsRealWon,
  )));
  const points = projection.points.map(point => ({
    x: simulation.years === 0 ? 0 : point.year / simulation.years,
    plan: selectedProjectionValue(simulation.amountMode, point) / maximum,
    baseline: selectedBaselineValue(simulation.amountMode, point) / maximum,
  }));
  const stable = stableShareUnits({items: allocation.items, cashShareUnits: plan.cashShareUnits}) / 10_000;
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
    { label: '납입원금', value: formatPortfolioWon(projection.points.at(-1)!.contributedPrincipalWon) },
    { label: '전부 저축', value: formatPortfolioWon(projection.finalAllSavingsWon) },
  ] : [
    { label: '전부 저축 대비', value: multiplierLabel(projection.finalCurrentPlanWon, projection.finalAllSavingsWon) },
    { label: '기간', value: `${simulation.years}년` },
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
        headline: includeAmounts
          ? `${simulation.years}년 후 ${formatPortfolioWon(projection.finalCurrentPlanWon)}`
          : `${simulation.years}년 · 연 ${formatAllocationPercent(simulation.expectedAnnualReturnPercent)} 가정`,
        rows: growthRows,
        points,
      },
      allocation: {
        headline: `성장 ${formatAllocationPercent(100 - stable)} / 안정 ${formatAllocationPercent(stable)}`,
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

function selectedProjectionValue(mode: 'nominal' | 'real', point: {currentPlanNominalWon: number; currentPlanRealWon: number}): number {
  return mode === 'real' ? point.currentPlanRealWon : point.currentPlanNominalWon;
}
function selectedBaselineValue(mode: 'nominal' | 'real', point: {allSavingsNominalWon: number; allSavingsRealWon: number}): number {
  return mode === 'real' ? point.allSavingsRealWon : point.allSavingsNominalWon;
}
function ratio(value: number, total: number): number { return total > 0 && Number.isFinite(value) ? Math.max(0, value / total) : 0; }
function ratioLabel(value: number, total: number): string { return total > 0 ? formatAllocationPercent(value / total * 100) : '미설정'; }
function multiplierLabel(value: number, baseline: number): string { return baseline > 0 ? `${(value / baseline).toFixed(1)}배` : '미설정'; }
function isFiniteNonnegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }
