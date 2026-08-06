import { useEffect, useState } from 'react';
import type { CompoundSimulationDraft } from '../domain/model';

const RETURN_PRESETS = [5, 9, 13] as const;

export function SimulationControls({
  draft,
  onChange,
}: {
  draft: CompoundSimulationDraft;
  onChange(next: CompoundSimulationDraft): void;
}) {
  const [yearsRaw, setYearsRaw] = useState(String(draft.years));
  const [returnRaw, setReturnRaw] = useState(String(draft.expectedAnnualReturnPercent));
  const [yearsError, setYearsError] = useState(false);
  const [returnError, setReturnError] = useState(false);
  const [customReturn, setCustomReturn] = useState(
    !RETURN_PRESETS.includes(draft.expectedAnnualReturnPercent as 5 | 9 | 13),
  );

  useEffect(() => setYearsRaw(String(draft.years)), [draft.years]);
  useEffect(() => {
    setReturnRaw(String(draft.expectedAnnualReturnPercent));
    if (!RETURN_PRESETS.includes(draft.expectedAnnualReturnPercent as 5 | 9 | 13)) {
      setCustomReturn(true);
    }
  }, [draft.expectedAnnualReturnPercent]);

  function update(patch: Partial<CompoundSimulationDraft>): void {
    onChange({ ...draft, ...patch });
  }

  function updateYears(years: number): void {
    setYearsRaw(String(years));
    setYearsError(false);
    update({ years });
  }

  function updateReturn(value: number): void {
    const next = Math.max(0, Math.min(30, Math.round(value * 100) / 100));
    setReturnRaw(String(next));
    setReturnError(false);
    update({ expectedAnnualReturnPercent: next });
  }

  return (
    <section className="simulation-controls ui-surface" aria-label="시뮬레이션 조건">
      <fieldset className="simulation-control-group">
        <legend>기간</legend>
        <div className="simulation-duration-control">
          <input
            aria-label="기간"
            type="range"
            min="0"
            max="30"
            value={draft.years}
            onChange={(event) => updateYears(Number(event.target.value))}
          />
          <label className="simulation-number-field">
            <span className="sr-only">기간 숫자</span>
            <input
              aria-label="기간 숫자"
              type="number"
              min="0"
              max="30"
              value={yearsRaw}
              aria-invalid={yearsError}
              aria-describedby={yearsError ? 'simulation-years-error' : undefined}
              onChange={(event) => {
                const raw = event.target.value;
                const value = Number(raw);
                const valid = /^\d+$/.test(raw) && value >= 0 && value <= 30;
                setYearsRaw(raw);
                setYearsError(!valid);
                if (valid) update({ years: value });
              }}
            />
            <span aria-hidden="true">년</span>
          </label>
        </div>
        {yearsError ? (
          <p id="simulation-years-error" role="alert">0~30년 사이의 정수를 입력해주세요.</p>
        ) : null}
      </fieldset>

      <fieldset className="simulation-control-group">
        <legend>연 기대수익률</legend>
        <div className="simulation-preset-row">
          {RETURN_PRESETS.map((rate) => (
            <button
              type="button"
              className="ui-button ui-button--secondary"
              key={rate}
              aria-label={`연 기대수익률 ${rate}%`}
              aria-pressed={!customReturn && draft.expectedAnnualReturnPercent === rate}
              onClick={() => {
                setCustomReturn(false);
                updateReturn(rate);
              }}
            >
              {rate}%
            </button>
          ))}
          <button
            type="button"
            className="ui-button ui-button--secondary"
            aria-pressed={customReturn}
            onClick={() => {
              setCustomReturn(true);
              setReturnError(false);
            }}
          >
            직접 입력
          </button>
        </div>

        {customReturn ? (
          <div className="simulation-custom-return">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              aria-label="기대수익률 0.25%p 내리기"
              disabled={draft.expectedAnnualReturnPercent <= 0}
              onClick={() => updateReturn(draft.expectedAnnualReturnPercent - 0.25)}
            >
              −
            </button>
            <label className="simulation-number-field">
              <span className="sr-only">연 기대수익률 직접 입력</span>
              <input
                aria-label="연 기대수익률 직접 입력"
                type="number"
                min="0"
                max="30"
                step="0.01"
                value={returnRaw}
                aria-invalid={returnError}
                aria-describedby={returnError ? 'simulation-return-error' : undefined}
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = Number(raw);
                  const valid = /^(?:\d+)(?:\.\d{0,2})?$/.test(raw)
                    && Number.isFinite(value) && value >= 0 && value <= 30;
                  setReturnRaw(raw);
                  setReturnError(!valid);
                  if (valid) update({ expectedAnnualReturnPercent: value });
                }}
              />
              <span aria-hidden="true">%</span>
            </label>
            <button
              type="button"
              className="ui-button ui-button--secondary"
              aria-label="기대수익률 0.25%p 올리기"
              disabled={draft.expectedAnnualReturnPercent >= 30}
              onClick={() => updateReturn(draft.expectedAnnualReturnPercent + 0.25)}
            >
              +
            </button>
          </div>
        ) : null}
        {returnError ? (
          <p id="simulation-return-error" role="alert">
            0~30 사이, 소수점 둘째 자리까지 입력해주세요.
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}
