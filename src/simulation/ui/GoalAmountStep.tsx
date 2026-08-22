import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';

export function GoalAmountStep({
  initialInvestmentWon,
  onContinue,
}: {
  initialInvestmentWon: number;
  onContinue(targetAmountWon: number): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rawAmount, setRawAmount] = useState('');
  const targetAmountWon = Number(rawAmount);
  const validAmount = Number.isSafeInteger(targetAmountWon)
    && targetAmountWon > initialInvestmentWon;
  const showError = rawAmount.length > 0 && !validAmount;

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <Surface as="section" className="simulation-onboarding-step" aria-labelledby="goal-amount-title">
      <p className="simulation-eyebrow">다음 목표</p>
      <h1 id="goal-amount-title" ref={headingRef} tabIndex={-1}>
        다음에는 얼마를 모으고 싶나요?
      </h1>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (validAmount) onContinue(targetAmountWon);
      }}>
        <label htmlFor="goal-amount">목표 금액</label>
        <input
          id="goal-amount"
          type="text"
          inputMode="numeric"
          value={rawAmount}
          aria-invalid={showError}
          aria-describedby={showError ? 'goal-amount-error' : undefined}
          onChange={(event) => setRawAmount(event.target.value.replace(/[^\d]/g, ''))}
        />
        {showError ? (
          <p id="goal-amount-error" role="alert">
            현재 모아둔 투자금보다 큰 금액을 입력해주세요.
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={!validAmount}>
          다음
        </Button>
      </form>
    </Surface>
  );
}
