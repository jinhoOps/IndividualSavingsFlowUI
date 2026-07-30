import { useState } from 'react';

export function StartingPrincipalPrompt({
  onStart,
}: {
  onStart(initialInvestmentWon: number): void;
}) {
  const [hasPrincipal, setHasPrincipal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rawAmount, setRawAmount] = useState('');

  const parsedAmount = Number(rawAmount);
  const validAmount = Number.isSafeInteger(parsedAmount) && parsedAmount >= 0;

  return (
    <section className="simulation-prompt" aria-labelledby="principal-title">
      <p className="simulation-eyebrow">시작 원금</p>
      <h1 id="principal-title">지금 모아둔 투자금이 있나요?</h1>
      {!editing ? (
        <div className="simulation-prompt__actions">
          <button type="button" className="ui-button ui-button--primary" onClick={() => {
            setHasPrincipal(true);
            setEditing(true);
          }}>
            있어요
          </button>
          <button type="button" className="ui-button ui-button--secondary" onClick={() => onStart(0)}>
            없어요
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (hasPrincipal && validAmount) onStart(parsedAmount);
        }}>
          <label htmlFor="initial-investment">현재 모아둔 투자금</label>
          <input
            id="initial-investment"
            type="text"
            inputMode="numeric"
            value={rawAmount}
            onChange={(event) => setRawAmount(event.target.value.replace(/[^\d]/g, ''))}
          />
          <button type="submit" className="ui-button ui-button--primary" disabled={!validAmount}>
            계산 시작
          </button>
        </form>
      )}
    </section>
  );
}
