import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { MoneyAdjustments } from '../../components/common/MoneyAdjustments';
import { Surface } from '../../components/common/Surface';
import type { CompoundSimulationDraft } from '../domain/model';
import { findTargetReachMonth } from '../domain/projection';
import {
  targetForEditedInitialInvestment,
} from '../domain/validation';
import { formatPercent, formatWon } from './format';
import { TargetAmountControl } from './TargetAmountControl';

const initialInvestmentAdjustments = [
  { label: '-5천만', deltaWon: -50_000_000 },
  { label: '-1천만', deltaWon: -10_000_000 },
  { label: '+1천만', deltaWon: 10_000_000 },
  { label: '+5천만', deltaWon: 50_000_000 },
] as const;

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
  const [initialRaw, setInitialRaw] = useState(() => formatMoneyInput(draft.initialInvestmentWon));
  const [baseError, setBaseError] = useState(false);
  const [offsetError, setOffsetError] = useState(false);
  const [initialError, setInitialError] = useState(false);

  useEffect(() => setBaseRaw(String(draft.baseRatePercent)), [draft.baseRatePercent]);
  useEffect(
    () => setOffsetRaw(String(draft.inflationOffsetPercentPoints)),
    [draft.inflationOffsetPercentPoints],
  );
  useEffect(
    () => setInitialRaw(formatMoneyInput(draft.initialInvestmentWon)),
    [draft.initialInvestmentWon],
  );

  const update = (patch: Partial<CompoundSimulationDraft>) => onChange({
    ...draft,
    ...patch,
  });
  const commitInitialInvestment = (value: number) => {
    setInitialRaw(formatMoneyInput(value));
    setInitialError(false);
    update({
      initialInvestmentWon: value,
      targetAmountWon: targetForEditedInitialInvestment(
        draft.initialInvestmentWon,
        draft.targetAmountWon,
        value,
      ),
    });
  };

  return (
    <Surface as="section" className="simulation-calculation-settings" aria-labelledby="simulation-settings-title">
      <details className="simulation-settings-disclosure">
        <summary className="simulation-settings-heading">
          <span className="simulation-settings-heading__icon" aria-hidden="true"><SlidersHorizontal size={20} /></span>
          <span className="simulation-settings-heading__copy">
            <span id="simulation-settings-title">목표와 가정</span>
            <span className="simulation-settings-heading__summary">
              목표 {draft.targetAmountWon === null ? '미설정' : formatWon(draft.targetAmountWon)} · 시작 {formatWon(draft.initialInvestmentWon)}
            </span>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="simulation-settings-disclosure__content">
          <div className="simulation-settings-amounts">
            <TargetAmountControl initialInvestmentWon={draft.initialInvestmentWon}
              targetAmountWon={draft.targetAmountWon}
              targetReachMonth={findTargetReachMonth(draft)}
              onChange={(targetAmountWon) => update({ targetAmountWon })} />
            <section className="simulation-setting-block" aria-label="시작 자산">
              <label className="simulation-advanced__money-field">
                현재 모아둔 돈
                <div className="simulation-advanced__money-input">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={initialRaw}
                    aria-invalid={initialError}
                    aria-describedby={initialError ? 'simulation-initial-investment-error' : undefined}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setInitialRaw(raw);
                      setInitialError(parseMoneyInput(raw) === null);
                    }}
                    onBlur={() => {
                      const value = parseMoneyInput(initialRaw);
                      if (value === null) {
                        setInitialRaw(formatMoneyInput(draft.initialInvestmentWon));
                        setInitialError(false);
                        return;
                      }
                      commitInitialInvestment(value);
                    }}
                  />
                  <span aria-hidden="true">원</span>
                </div>
              </label>
              <MoneyAdjustments className="simulation-principal-adjustments" label="현재 모아둔 돈 빠른 조정"
                adjustments={initialInvestmentAdjustments}
                onAdjust={(deltaWon) => commitInitialInvestment(adjustInitialInvestment(draft.initialInvestmentWon, deltaWon))} />
              {initialError ? (
                <p id="simulation-initial-investment-error" role="alert">
                  0원 이상 안전한 정수로 입력해주세요.
                </p>
              ) : null}
              <p className="simulation-advanced__help">
                지금까지 모은 자산이에요. 매달 넣는 저축·투자액과 별도로 계산해요.
              </p>
            </section>
          </div>
          <section className="simulation-advanced" aria-labelledby="simulation-assumptions-title">
            <div className="simulation-advanced__summary-copy">
              <h3 id="simulation-assumptions-title">금리와 물가 가정</h3>
              <span>기준금리 {formatPercent(draft.baseRatePercent)}% · 물가상승률 {formatPercent(inflation)}%</span>
            </div>
            <div className="simulation-advanced__content">
              <div>
                <label>
                  기준금리
                  <div className="simulation-advanced__money-input">
                    <input
                      type="number"
                      step="0.01"
                      value={baseRaw}
                      aria-invalid={baseError}
                      aria-describedby={baseError ? 'simulation-base-rate-error' : undefined}
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
                    <span aria-hidden="true">%</span>
                  </div>
                </label>
                {baseError ? <p id="simulation-base-rate-error" role="alert">−100%보다 크고 소수점 둘째 자리까지 입력해주세요.</p> : null}
              </div>
              <div>
                <label>
                  물가상승률 차이
                  <div className="simulation-advanced__money-input">
                    <input
                      type="number"
                      step="0.01"
                      value={offsetRaw}
                      aria-invalid={offsetError}
                      aria-describedby={offsetError ? 'simulation-inflation-offset-error' : undefined}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const value = Number(raw);
                        const valid = validRate(raw, value) && draft.baseRatePercent + value > -100;
                        setOffsetRaw(raw);
                        setOffsetError(!valid);
                        if (valid) update({ inflationOffsetPercentPoints: value });
                      }}
                    />
                    <span aria-hidden="true">%p</span>
                  </div>
                </label>
                {offsetError ? <p id="simulation-inflation-offset-error" role="alert">−100%보다 크고 소수점 둘째 자리까지 입력해주세요.</p> : null}
              </div>
              <p className="simulation-assumptions-note">전부 저축했을 때는 기준금리를, 오늘의 가치는 물가상승률을 사용해요. 물가상승률은 기준금리와 입력한 차이를 더한 값이에요.</p>
              <p className="simulation-assumptions-note">수익을 계속 재투자한다고 가정한 계산이며, 백테스트나 금융 자문이 아닙니다.</p>
            </div>
          </section>
        </div>
      </details>
    </Surface>
  );
}

function validRate(raw: string, value: number): boolean {
  return /^-?\d+(?:\.\d{0,2})?$/.test(raw) && Number.isFinite(value) && value > -100;
}

function formatMoneyInput(valueWon: number): string {
  if (!Number.isSafeInteger(valueWon) || valueWon < 0) return String(valueWon);
  return new Intl.NumberFormat('ko-KR').format(valueWon);
}

function parseMoneyInput(raw: string): number | null {
  const digits = raw.replaceAll(',', '');
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function adjustInitialInvestment(value: number, deltaWon: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value + deltaWon));
}
