import { useEffect, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
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

  const update = (patch: Partial<CompoundSimulationDraft>) => onChange({
    ...draft,
    ...patch,
  });

  return (
    <Surface as="section" className="simulation-calculation-settings" aria-label="금액과 계산 기준">
      <fieldset className="simulation-amount-mode">
        <legend>금액 기준</legend>
        {(['nominal', 'real'] as const).map((mode) => (
          <Button
            type="button"
            variant="secondary"
            key={mode}
            aria-pressed={draft.amountMode === mode}
            onClick={() => update({ amountMode: mode })}
          >
            {mode === 'nominal' ? '명목' : '실질'}
          </Button>
        ))}
      </fieldset>

      <details className="simulation-advanced">
        <summary>계산 기준</summary>
        <div className="simulation-advanced__content">
          <label>
            기준금리
            <input
              type="number"
              step="0.01"
              value={baseRaw}
              aria-invalid={baseError}
              onChange={(event) => {
                const raw = event.target.value;
                const value = Number(raw);
                const valid = validRate(raw, value)
                  && value + draft.inflationOffsetPercentPoints > -100;
                setBaseRaw(raw);
                setBaseError(!valid);
                if (valid) update({ baseRatePercent: value });
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
                const value = Number(raw);
                const valid = validRate(raw, value) && draft.baseRatePercent + value > -100;
                setOffsetRaw(raw);
                setOffsetError(!valid);
                if (valid) update({ inflationOffsetPercentPoints: value });
              }}
            />
          </label>
          {offsetError ? <p role="alert">−100%보다 크고 소수점 둘째 자리까지 입력해주세요.</p> : null}
          <p>물가상승률 {formatPercent(inflation)}%</p>
          <p>수익을 계속 재투자한다고 가정한 계산이며, 백테스트나 금융 자문이 아닙니다.</p>
        </div>
      </details>
    </Surface>
  );
}

function validRate(raw: string, value: number): boolean {
  return /^-?\d+(?:\.\d{0,2})?$/.test(raw) && Number.isFinite(value) && value > -100;
}
