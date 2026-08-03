import type { CompoundSimulationDraft, ProjectionResult } from '../domain/model';
import { formatPercent, formatWon } from './format';

export function SimulationHero({
  draft,
  result,
}: {
  draft: CompoundSimulationDraft;
  result: ProjectionResult;
}) {
  const resultCopy = draft.years === 0
    ? `현재 시작 자산은 ${formatWon(result.finalCurrentPlanWon)}입니다!`
    : `이대로 ${draft.years}년 유지하면 ${formatWon(result.finalCurrentPlanWon)}이 됩니다!`;

  return (
    <header className="simulation-hero">
      <h1 id="simulation-result-title">{resultCopy}</h1>
      <p className="simulation-hero__conditions">
        {`월 저축 ${formatWon(draft.source.monthlySavingsWon)} · 투자 ${formatWon(draft.source.monthlyInvestmentWon)} · 연 ${formatPercent(draft.expectedAnnualReturnPercent)}%`}
      </p>
    </header>
  );
}
