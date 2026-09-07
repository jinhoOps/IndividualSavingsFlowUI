import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccountDraftContext,
  useAccountRecovery,
  useInitialRecovery,
} from '../../auth/AccountDraftContext';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import { adjustWon, formatWonInput, normalizeMoneyEdit, parseWonInput } from '../../core/domain/moneyInput';

const principalAdjustments = [
  { label: '-1000만', deltaWon: -10_000_000 },
  { label: '-100만', deltaWon: -1_000_000 },
  { label: '+100만', deltaWon: 1_000_000 },
  { label: '+1000만', deltaWon: 10_000_000 },
] as const;

function adjustPrincipal(rawAmount: string, deltaWon: number): string {
  return formatWonInput(adjustWon(parseWonInput(rawAmount), deltaWon), { zeroDisplay: 'zero' });
}

interface PrincipalRecoveryDraft {
  hasPrincipal: boolean;
  rawAmount: string;
}

function parsePrincipalRecoveryDraft(value: unknown): PrincipalRecoveryDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (typeof draft.hasPrincipal !== 'boolean' || typeof draft.rawAmount !== 'string') return null;
  return { hasPrincipal: draft.hasPrincipal, rawAmount: draft.rawAmount };
}

export function StartingPrincipalStep({
  onContinue,
}: {
  onContinue(initialInvestmentWon: number): void;
}) {
  const session = useContext(AccountDraftContext);
  const recovered = useInitialRecovery(
    'simulation-onboarding-principal',
    parsePrincipalRecoveryDraft,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [hasPrincipal, setHasPrincipal] = useState(() => recovered?.hasPrincipal ?? false);
  const [rawAmount, setRawAmount] = useState(() => recovered?.rawAmount ?? '');
  const [dirty, setDirty] = useState(false);
  const amount = parseWonInput(rawAmount);
  const validAmount = Number.isSafeInteger(amount) && amount > 0;

  useAccountRecovery(
    'simulation-onboarding-principal',
    { hasPrincipal, rawAmount },
    dirty,
    dirty,
  );

  useEffect(() => headingRef.current?.focus(), []);
  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || inputRef.current === null) return;
    inputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  });

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
            onClick={() => {
              setHasPrincipal(true);
              setDirty(true);
            }}
          >
            있어요
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              session?.recordRecoveryDraft('simulation-onboarding-principal', null);
              setDirty(false);
              onContinue(0);
            }}
          >
            없어요
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (validAmount) {
            session?.recordRecoveryDraft('simulation-onboarding-principal', null);
            setDirty(false);
            onContinue(amount);
          }
        }}>
          <label htmlFor="initial-investment">현재 모아둔 투자금</label>
          <input
            ref={inputRef}
            id="initial-investment"
            type="text"
            inputMode="numeric"
            value={rawAmount}
            aria-invalid={rawAmount.length > 0 && !validAmount}
            onChange={(event) => {
              const normalized = normalizeMoneyEdit(
                event.target.value,
                event.target.selectionStart ?? event.target.value.length,
                { zeroDisplay: 'zero' },
              );
              pendingCaretRef.current = normalized.caret;
              setRawAmount(normalized.displayValue);
              setDirty(true);
            }}
          />
          <div className="simulation-principal-adjustments">
            {principalAdjustments.map(({ label, deltaWon }) => (
              <Button
                key={label}
                type="button"
                variant="secondary"
                onClick={() => {
                  setRawAmount((value) => adjustPrincipal(value, deltaWon));
                  setDirty(true);
                }}
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
