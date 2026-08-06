import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';

const principalAdjustments = [
  { label: '-1000만', deltaWon: -10_000_000 },
  { label: '-100만', deltaWon: -1_000_000 },
  { label: '+100만', deltaWon: 1_000_000 },
  { label: '+1000만', deltaWon: 10_000_000 },
] as const;

function adjustPrincipal(rawAmount: string, deltaWon: number): string {
  const current = Number(rawAmount);
  const safeCurrent = Number.isSafeInteger(current) && current >= 0 ? current : 0;
  return String(Math.max(0, safeCurrent + deltaWon));
}

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
    <Surface as="section" className="simulation-onboarding-step" aria-labelledby="principal-title">
      <p className="simulation-eyebrow">시작 자산</p>
      <h1 id="principal-title" ref={headingRef} tabIndex={-1}>
        지금 모아둔 투자금이 있나요?
      </h1>
      {!hasPrincipal ? (
        <div className="simulation-prompt__actions">
          <Button
            type="button"
            variant="primary"
            onClick={() => setHasPrincipal(true)}
          >
            있어요
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onContinue(0)}
          >
            없어요
          </Button>
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
          <div className="simulation-principal-adjustments">
            {principalAdjustments.map(({ label, deltaWon }) => (
              <Button
                key={label}
                type="button"
                variant="secondary"
                onClick={() => setRawAmount((value) => adjustPrincipal(value, deltaWon))}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button type="submit" variant="primary" disabled={!validAmount}>
            다음
          </Button>
        </form>
      )}
    </Surface>
  );
}
