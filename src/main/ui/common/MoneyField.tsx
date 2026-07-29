import { useLayoutEffect, useRef, useState } from 'react';
import { adjustWon, formatWonInput, normalizeMoneyEdit } from '../../domain/money';
import { Button } from './Button';

export interface MoneyFieldProps {
  id: string;
  label: string;
  valueWon: number;
  error?: string;
  validationPath?: string;
  disabled?: boolean;
  onChange(valueWon: number): void;
}

export function MoneyField({ id, label, valueWon, error, validationPath, disabled = false, onChange }: MoneyFieldProps) {
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const previousValueWonRef = useRef(valueWon);
  const [displayValue, setDisplayValue] = useState(() => formatWonInput(valueWon));

  useLayoutEffect(() => {
    if (previousValueWonRef.current !== valueWon) {
      previousValueWonRef.current = valueWon;
      setDisplayValue(formatWonInput(valueWon));
    }
  }, [valueWon]);

  useLayoutEffect(() => {
    if (pendingCaretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
      pendingCaretRef.current = null;
    }
  });

  const adjustmentButtons = [
    { label: '-10만', deltaWon: -100_000 },
    { label: '+10만', deltaWon: 100_000 },
    { label: '+50만', deltaWon: 500_000 },
  ] as const;

  return (
    <div className="money-field">
      <label className="text-sm font-bold text-slate-700" htmlFor={id}>{label}</label>
      <div className="money-field__input-row">
        <input
          ref={inputRef}
          className="money-field__input"
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          data-validation-path={validationPath}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          onChange={(event) => {
            const normalized = normalizeMoneyEdit(event.target.value, event.target.selectionStart ?? event.target.value.length);
            pendingCaretRef.current = normalized.caret;
            setDisplayValue(normalized.displayValue);
            onChange(normalized.valueWon);
          }}
        />
        <span className="money-field__unit" aria-hidden="true">원</span>
      </div>
      <div className="money-field__adjustments">
        {adjustmentButtons.map(({ label: adjustmentLabel, deltaWon }) => (
          <Button key={adjustmentLabel} type="button" variant="quiet" disabled={disabled} onClick={() => onChange(adjustWon(valueWon, deltaWon))}>
            {adjustmentLabel}
          </Button>
        ))}
        <Button className="money-field__reset" type="button" variant="quiet" disabled={disabled} onClick={() => onChange(0)}>초기화</Button>
      </div>
      {error ? <p className="m-0 text-sm font-bold text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
