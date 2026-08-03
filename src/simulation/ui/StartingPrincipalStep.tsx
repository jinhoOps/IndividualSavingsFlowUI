import { useEffect, useRef, useState } from 'react';

export function StartingPrincipalStep({
  onContinue,
}: {
  onContinue(initialInvestmentWon: number): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [hasPrincipal, setHasPrincipal] = useState(false);
  const [rawAmount, setRawAmount] = useState('');
  const amount = Number(rawAmount);
  const validAmount = Number.isSafeInteger(amount) && amount > 0;

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="simulation-onboarding-step" aria-labelledby="principal-title">
      <p className="simulation-eyebrow">시작 자산</p>
      <h1 id="principal-title" ref={headingRef} tabIndex={-1}>
        지금 모아둔 투자금이 있나요?
      </h1>
      {!hasPrincipal ? (
        <div className="simulation-prompt__actions">
          <button
            type="button"
            className="ui-button ui-button--primary"
            onClick={() => setHasPrincipal(true)}
          >
            있어요
          </button>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => onContinue(0)}
          >
            없어요
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (validAmount) onContinue(amount);
        }}>
          <label htmlFor="initial-investment">현재 모아둔 투자금</label>
          <input
            id="initial-investment"
            type="text"
            inputMode="numeric"
            value={rawAmount}
            aria-invalid={rawAmount.length > 0 && !validAmount}
            onChange={(event) => setRawAmount(event.target.value.replace(/[^\d]/g, ''))}
          />
          <button type="submit" className="ui-button ui-button--primary" disabled={!validAmount}>
            다음
          </button>
        </form>
      )}
    </section>
  );
}
