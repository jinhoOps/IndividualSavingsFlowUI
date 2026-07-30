import type { CompoundSimulationDraft, ProjectionResult } from '../domain/model';
import { formatPercent, formatWon } from './format';

export function SimulationSummary({
  draft,
  result,
}: {
  draft: CompoundSimulationDraft;
  result: ProjectionResult;
}) {
  return (
    <section className="simulation-summary" aria-labelledby="simulation-result-title">
      <p>{draft.amountMode === 'nominal' ? '명목금액' : '현재 가치'}</p>
      <h1 id="simulation-result-title">{draft.years}년 뒤 예상금액</h1>
      <strong className="simulation-summary__amount">{formatWon(result.finalCurrentPlanWon)}</strong>
      <dl>
        <div>
          <dt>전부 저축보다</dt>
          <dd>{formatWon(result.advantageOverAllSavingsWon)}</dd>
        </div>
        <div>
          <dt>납입원금 대비</dt>
          <dd>{result.principalRatioPercent === null
            ? '—'
            : `총 ${formatPercent(result.principalRatioPercent)}%`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
