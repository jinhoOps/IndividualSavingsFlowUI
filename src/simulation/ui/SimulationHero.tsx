import type { CompoundSimulationDraft, ProjectionResult } from '../domain/model';
import { findTargetReachMonth } from '../domain/projection';
import { formatPercent, formatTargetReachDuration, formatWon } from './format';

export function SimulationHero({
  draft,
  result,
}: {
  draft: CompoundSimulationDraft;
  result: ProjectionResult;
}) {
  void result;
  const targetAmountWon = draft.targetAmountWon;
  const reachMonth = findTargetReachMonth(draft);
  const resultCopy = targetAmountWon === null
    ? ''
    : reachMonth === null
      ? `현재 조건으로는 30년 안에 ${formatWon(targetAmountWon)}에 도달하기 어려워요`
      : `${formatWon(targetAmountWon)}을 모으려면 ${formatTargetReachDuration(reachMonth)}이 걸려요`;

  return (
    <header className="simulation-hero">
      <h1 id="simulation-result-title">{resultCopy}</h1>
      <p className="simulation-hero__conditions">
        {`월 저축 ${formatWon(draft.source.monthlySavingsWon)} · 투자 ${formatWon(draft.source.monthlyInvestmentWon)} · 연 ${formatPercent(draft.expectedAnnualReturnPercent)}%`}
      </p>
    </header>
  );
}
