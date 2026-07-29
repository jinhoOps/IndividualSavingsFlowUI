import { useLayoutEffect, useRef, useState } from 'react';
import { adjustWon, formatWonInput, normalizeMoneyEdit } from '../../domain/money';

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
    { label: '−10만', deltaWon: -100_000 },
    { label: '+10만', deltaWon: 100_000 },
    { label: '+50만', deltaWon: 500_000 },
  ] as const;

  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-slate-700" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
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
        <span aria-hidden="true">원</span>
      </div>
      <div className="flex gap-2">
        {adjustmentButtons.map(({ label: adjustmentLabel, deltaWon }) => (
          <button key={adjustmentLabel} type="button" disabled={disabled} onClick={() => onChange(adjustWon(valueWon, deltaWon))}>
            {adjustmentLabel}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={() => onChange(0)}>초기화</button>
      </div>
      {error ? <p className="m-0 text-sm font-bold text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
