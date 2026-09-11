import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { MoneyAdjustments } from '../../components/common/MoneyAdjustments';
import { targetForInitialInvestment } from '../domain/validation';
import { formatTargetReachDuration, formatWon } from './format';

const TARGET_STEP = 10_000_000;
const adjustments = [
  { label: '-5천만', deltaWon: -50_000_000 },
  { label: '-1천만', deltaWon: -TARGET_STEP },
  { label: '+1천만', deltaWon: TARGET_STEP },
  { label: '+5천만', deltaWon: 50_000_000 },
] as const;

export function TargetAmountControl({
  initialInvestmentWon,
  targetAmountWon,
  targetReachMonth,
  onChange,
}: {
  initialInvestmentWon: number;
  targetAmountWon: number | null;
  targetReachMonth: number | null;
  onChange(value: number): void;
}) {
  const [raw, setRaw] = useState(() => formatInput(targetAmountWon));
  const [error, setError] = useState(false);
  const automaticTarget = targetForInitialInvestment(initialInvestmentWon);
  const isDefault = automaticTarget !== null && targetAmountWon === automaticTarget;

  useEffect(() => {
    setRaw(formatInput(targetAmountWon));
    setError(false);
  }, [targetAmountWon]);

  function valid(value: number | null): value is number {
    return value !== null && Number.isSafeInteger(value)
      && value > initialInvestmentWon && value % TARGET_STEP === 0;
  }

  function commit(value: number): void {
    setRaw(formatInput(value));
    setError(false);
    if (value !== targetAmountWon) onChange(value);
  }

  function commitInput(): void {
    const value = parseInput(raw);
    // Existing onboarding/imported goals may use any integer won amount.
    if (value === targetAmountWon && value !== null) {
      setRaw(formatInput(value));
      setError(false);
    } else if (valid(value)) commit(value);
    else setError(true);
  }

  function adjustedTarget(delta: number): number {
    const typed = parseInput(raw);
    const base = valid(typed) ? typed : targetAmountWon ?? initialInvestmentWon;
    // Old, non-step-aligned goals move to the next/previous whole step.
    return (delta > 0 ? Math.floor(base / TARGET_STEP) : Math.ceil(base / TARGET_STEP))
      * TARGET_STEP + delta;
  }

  return <section className="simulation-setting-block simulation-target" aria-labelledby="simulation-target-label">
    <div className="simulation-setting-block__heading">
      <label id="simulation-target-label" htmlFor="simulation-target-amount">목표 금액</label>
      <span className="simulation-target__status">
        <span className="simulation-target__badge">{isDefault ? '기본 목표' : '직접 설정'}</span>
        {automaticTarget !== null ? <Button type="button" variant="quiet"
          className="simulation-target__reset" aria-label="기본 목표로" title="기본 목표로 초기화"
          disabled={isDefault && !error && raw === formatInput(targetAmountWon)}
          onClick={() => commit(automaticTarget)}><RotateCcw size={16} aria-hidden="true" /></Button> : null}
      </span>
    </div>
    <div className="simulation-advanced__money-input">
      <input id="simulation-target-amount" type="text" inputMode="numeric" value={raw}
        aria-invalid={error}
        aria-describedby={`simulation-target-help${error ? ' simulation-target-error' : ''}`}
        onChange={(event) => { setRaw(event.target.value); setError(false); }}
        onBlur={commitInput}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitInput(); }
          if (event.key === 'Escape') { setRaw(formatInput(targetAmountWon)); setError(false); }
        }} />
      <span aria-hidden="true">원</span>
    </div>
    <div className="simulation-target__actions">
      <MoneyAdjustments label="목표 금액 빠른 조정" adjustments={adjustments}
        isAdjustmentDisabled={(delta) => !valid(adjustedTarget(delta))}
        onAdjust={(delta) => { const value = adjustedTarget(delta); if (valid(value)) commit(value); }} />
    </div>
    {error ? <p id="simulation-target-error" role="alert">
      현재 모아둔 돈보다 큰 금액을 1천만 원 단위로 입력해주세요.
    </p> : null}
    <p id="simulation-target-help" className="simulation-setting-help">
      {targetAmountWon !== null ? `${formatWon(targetAmountWon)} · ` : ''}1천만 원 단위로 조정
    </p>
    <output className="simulation-target__result" aria-label="목표까지 예상 기간" aria-live="polite">
      {targetReachMonth === null ? '현재 조건으로는 30년 내 도달이 어려워요.'
        : `예상 ${formatTargetReachDuration(targetReachMonth)}`}
    </output>
  </section>;
}

function formatInput(value: number | null): string {
  return value === null ? '' : new Intl.NumberFormat('ko-KR').format(value);
}

function parseInput(raw: string): number | null {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return null;
  const value = Number(raw.replaceAll(',', ''));
  return Number.isSafeInteger(value) ? value : null;
}
