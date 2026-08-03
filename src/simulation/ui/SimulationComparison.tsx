import type { ProjectionResult } from '../domain/model';
import { formatWon } from './format';

export function SimulationComparison({ result }: { result: ProjectionResult }) {
  return (
    <dl className="simulation-comparison" aria-label="핵심 비교">
      <div>
        <dt>전부 저축보다</dt>
        <dd>{formatWon(result.advantageOverAllSavingsWon)}</dd>
      </div>
      <div>
        <dt>납입원금 대비</dt>
        <dd>{result.principalRatioPercent === null
          ? '—'
          : `${Math.round(result.principalRatioPercent)}%`}
        </dd>
      </div>
    </dl>
  );
}
