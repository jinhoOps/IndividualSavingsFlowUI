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

  function update(patch: Partial<CompoundSimulationDraft>): void {
    onChange({ ...draft, ...patch });
  }

  function updateYears(years: number): void {
    update({ years: Math.max(1, Math.min(50, Math.round(years))) });
  }

  function updateReturn(value: number): void {
    update({
      expectedAnnualReturnPercent: Math.max(0, Math.min(30, Math.round(value * 100) / 100)),
    });
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
            value={draft.years}
            onChange={(event) => updateYears(Number(event.target.value))}
          />
          <button type="button" aria-label="기간 1년 늘리기" onClick={() => updateYears(draft.years + 1)}>+</button>
        </div>
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
            value={draft.expectedAnnualReturnPercent}
            onChange={(event) => updateReturn(Number(event.target.value))}
          />
          <span>%</span>
          <button type="button" aria-label="기대수익률 0.25%p 올리기" onClick={() => updateReturn(draft.expectedAnnualReturnPercent + 0.25)}>+</button>
        </div>
        <output>{formatPercent(draft.expectedAnnualReturnPercent)}%</output>
      </fieldset>
    </section>
  );
}
