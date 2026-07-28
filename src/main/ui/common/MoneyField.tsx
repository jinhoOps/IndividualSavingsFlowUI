import { parseWonInput } from '../../domain/money';

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

  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-slate-700" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        value={valueWon === 0 ? '' : valueWon.toLocaleString('ko-KR')}
        data-validation-path={validationPath}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        onChange={(event) => onChange(parseWonInput(event.target.value))}
      />
      {error ? <p className="m-0 text-sm font-bold text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
