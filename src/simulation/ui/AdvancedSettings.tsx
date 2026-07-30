import type { CompoundSimulationDraft } from '../domain/model';
import { formatPercent } from './format';

export function AdvancedSettings({
  draft,
  onChange,
}: {
  draft: CompoundSimulationDraft;
  onChange(next: CompoundSimulationDraft): void;
}) {
  const inflation = draft.baseRatePercent + draft.inflationOffsetPercentPoints;
  const setNumber = (patch: Partial<CompoundSimulationDraft>) => onChange({
    ...draft,
    ...patch,
  });

  return (
    <details className="simulation-advanced">
      <summary>고급 설정</summary>
      <label>
        기준금리
        <input
          type="number"
          step="0.01"
          value={draft.baseRatePercent}
          onChange={(event) => setNumber({ baseRatePercent: Number(event.target.value) })}
        />
      </label>
      <label>
        물가상승률 차이
        <input
          type="number"
          step="0.01"
          value={draft.inflationOffsetPercentPoints}
          onChange={(event) => setNumber({
            inflationOffsetPercentPoints: Number(event.target.value),
          })}
        />
      </label>
      <p>물가상승률 {formatPercent(inflation)}%</p>
      <fieldset>
        <legend>금액 기준</legend>
        {(['nominal', 'real'] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            aria-pressed={draft.amountMode === mode}
            onClick={() => setNumber({ amountMode: mode })}
          >
            {mode === 'nominal' ? '명목' : '실질'}
          </button>
        ))}
      </fieldset>
    </details>
  );
}
