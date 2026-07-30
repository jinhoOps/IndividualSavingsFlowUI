import { useEffect, useState } from 'react';
import type { CompoundSimulationDraft } from '../domain/model';
import { formatPercent, formatWon } from './format';

export function SimulationControls({
  draft,
  onChange,
}: {
  draft: CompoundSimulationDraft;
  onChange(next: CompoundSimulationDraft): void;
}) {
  const isPreset = [5, 9, 13].includes(draft.expectedAnnualReturnPercent);
  const [yearsRaw, setYearsRaw] = useState(String(draft.years));
  const [returnRaw, setReturnRaw] = useState(String(draft.expectedAnnualReturnPercent));
  const [yearsError, setYearsError] = useState(false);
  const [returnError, setReturnError] = useState(false);

  useEffect(() => setYearsRaw(String(draft.years)), [draft.years]);
  useEffect(
    () => setReturnRaw(String(draft.expectedAnnualReturnPercent)),
    [draft.expectedAnnualReturnPercent],
  );

  function update(patch: Partial<CompoundSimulationDraft>): void {
    onChange({ ...draft, ...patch });
  }

  function updateYears(years: number): void {
    const next = Math.max(1, Math.min(50, Math.round(years)));
    setYearsRaw(String(next));
    setYearsError(false);
    update({ years: next });
  }

  function updateReturn(value: number): void {
    const next = Math.max(0, Math.min(30, Math.round(value * 100) / 100));
    setReturnRaw(String(next));
    setReturnError(false);
    update({ expectedAnnualReturnPercent: next });
  }

  return (
    <section className="simulation-controls" aria-label="시뮬레이션 조건">
      <dl className="simulation-source">
        <div><dt>월 저축</dt><dd>{formatWon(draft.source.monthlySavingsWon)}</dd></div>
        <div><dt>월 투자</dt><dd>{formatWon(draft.source.monthlyInvestmentWon)}</dd></div>
        <div><dt>시작 원금</dt><dd>{formatWon(draft.initialInvestmentWon)}</dd></div>
      </dl>

      <fieldset>
        <legend>투자 기간</legend>
        <div className="simulation-stepper">
          <button type="button" aria-label="기간 1년 줄이기" onClick={() => updateYears(draft.years - 1)}>−</button>
          <input
            aria-label="투자 기간 숫자"
            type="number"
            min="1"
            max="50"
            value={yearsRaw}
            aria-invalid={yearsError}
            aria-describedby={yearsError ? 'simulation-years-error' : undefined}
            onChange={(event) => {
              const raw = event.target.value;
              setYearsRaw(raw);
              const value = Number(raw);
              const valid = /^\d+$/.test(raw) && value >= 1 && value <= 50;
              setYearsError(!valid);
              if (valid) update({ years: value });
            }}
          />
          <button type="button" aria-label="기간 1년 늘리기" onClick={() => updateYears(draft.years + 1)}>+</button>
        </div>
        {yearsError ? <p id="simulation-years-error" role="alert">1~50년 사이의 정수를 입력해주세요.</p> : null}
        <input
          aria-label="투자 기간"
          type="range"
          min="1"
          max="50"
          value={draft.years}
          onChange={(event) => updateYears(Number(event.target.value))}
        />
        <div className="simulation-preset-row">
          {[10, 20, 30].map((years) => (
            <button type="button" key={years} onClick={() => updateYears(years)}>{years}년</button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>연 기대수익률</legend>
        <div className="simulation-preset-row">
          {[5, 9, 13].map((rate) => (
            <button
              type="button"
              key={rate}
              aria-label={`연 기대수익률 ${rate}%`}
              aria-pressed={draft.expectedAnnualReturnPercent === rate}
              onClick={() => updateReturn(rate)}
            >
              {rate}%
            </button>
          ))}
          <button type="button" aria-pressed={!isPreset}>직접 입력</button>
        </div>
        <div className="simulation-stepper">
          <button type="button" aria-label="기대수익률 0.25%p 내리기" onClick={() => updateReturn(draft.expectedAnnualReturnPercent - 0.25)}>−</button>
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
              setReturnRaw(raw);
              const value = Number(raw);
              const valid = /^(?:\d+)(?:\.\d{0,2})?$/.test(raw)
                && Number.isFinite(value) && value >= 0 && value <= 30;
              setReturnError(!valid);
              if (valid) update({ expectedAnnualReturnPercent: value });
            }}
          />
          <span>%</span>
          <button type="button" aria-label="기대수익률 0.25%p 올리기" onClick={() => updateReturn(draft.expectedAnnualReturnPercent + 0.25)}>+</button>
        </div>
        {returnError ? <p id="simulation-return-error" role="alert">0~30 사이, 소수점 둘째 자리까지 입력해주세요.</p> : null}
        <output>{formatPercent(draft.expectedAnnualReturnPercent)}%</output>
      </fieldset>
    </section>
  );
}
