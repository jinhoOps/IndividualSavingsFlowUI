import { useEffect, useState } from 'react';
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
  const [baseRaw, setBaseRaw] = useState(String(draft.baseRatePercent));
  const [offsetRaw, setOffsetRaw] = useState(String(draft.inflationOffsetPercentPoints));
  const [baseError, setBaseError] = useState(false);
  const [offsetError, setOffsetError] = useState(false);
  useEffect(() => setBaseRaw(String(draft.baseRatePercent)), [draft.baseRatePercent]);
  useEffect(
    () => setOffsetRaw(String(draft.inflationOffsetPercentPoints)),
    [draft.inflationOffsetPercentPoints],
  );
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
          value={baseRaw}
          aria-invalid={baseError}
          onChange={(event) => {
            const raw = event.target.value;
            setBaseRaw(raw);
            const value = Number(raw);
            const valid = validRate(raw, value)
              && value + draft.inflationOffsetPercentPoints > -100;
            setBaseError(!valid);
            if (valid) setNumber({ baseRatePercent: value });
          }}
        />
      </label>
      {baseError ? <p role="alert">−100%보다 크고 소수점 둘째 자리까지 입력해주세요.</p> : null}
      <label>
        물가상승률 차이
        <input
          type="number"
          step="0.01"
          value={offsetRaw}
          aria-invalid={offsetError}
          onChange={(event) => {
            const raw = event.target.value;
            setOffsetRaw(raw);
            const value = Number(raw);
            const valid = validRate(raw, value) && draft.baseRatePercent + value > -100;
            setOffsetError(!valid);
            if (valid) setNumber({ inflationOffsetPercentPoints: value });
          }}
        />
      </label>
      {offsetError ? <p role="alert">−100%보다 크고 소수점 둘째 자리까지 입력해주세요.</p> : null}
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

function validRate(raw: string, value: number): boolean {
  return /^-?\d+(?:\.\d{0,2})?$/.test(raw) && Number.isFinite(value) && value > -100;
}
