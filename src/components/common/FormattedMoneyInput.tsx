import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import {
  adjustWon,
  formatWonInput,
  normalizeMoneyEdit,
  type ZeroDisplay,
} from "../../core/domain/moneyInput";
import { Button } from "./Button";

export interface MoneyAdjustment {
  label: string;
  deltaWon: number;
}

export const DEFAULT_MONEY_ADJUSTMENTS: readonly MoneyAdjustment[] = [
  { label: "-50만", deltaWon: -500_000 },
  { label: "-10만", deltaWon: -100_000 },
  { label: "+10만", deltaWon: 100_000 },
  { label: "+50만", deltaWon: 500_000 },
];

export interface FormattedMoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "onChange" | "type" | "inputMode" | "value"
> {
  valueWon: number;
  onValueWonChange(valueWon: number): void;
  zeroDisplay?: ZeroDisplay;
  adjustments?: boolean | readonly MoneyAdjustment[];
}

/**
 * A controlled won input whose visual string remains local while the typed
 * value is normalized. The local state avoids a parent render interrupting an
 * in-progress composition or moving the caret after commas are inserted.
 */
export const FormattedMoneyInput = forwardRef<
  HTMLInputElement,
  FormattedMoneyInputProps
>(function FormattedMoneyInput(
  {
    valueWon,
    onValueWonChange,
    zeroDisplay = "empty",
    adjustments = false,
    disabled = false,
    className = "",
    onCompositionStart,
    onCompositionEnd,
    ...inputProps
  },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const composingRef = useRef(false);
  const lastEmittedValueWonRef = useRef(valueWon);
  const [displayValue, setDisplayValue] = useState(() =>
    formatWonInput(valueWon, { zeroDisplay }),
  );
  const adjustmentButtons =
    adjustments === true
      ? DEFAULT_MONEY_ADJUSTMENTS
      : adjustments === false
        ? []
        : adjustments;

  useImperativeHandle(forwardedRef, () => inputRef.current!, []);

  useLayoutEffect(() => {
    if (lastEmittedValueWonRef.current === valueWon) return;
    lastEmittedValueWonRef.current = valueWon;
    setDisplayValue(formatWonInput(valueWon, { zeroDisplay }));
  }, [valueWon, zeroDisplay]);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || inputRef.current === null) return;
    inputRef.current.setSelectionRange(
      pendingCaretRef.current,
      pendingCaretRef.current,
    );
    pendingCaretRef.current = null;
  });

  function commit(raw: string, selectionStart: number): void {
    const normalized = normalizeMoneyEdit(raw, selectionStart, { zeroDisplay });
    pendingCaretRef.current = normalized.caret;
    setDisplayValue(normalized.displayValue);
    lastEmittedValueWonRef.current = normalized.valueWon;
    onValueWonChange(normalized.valueWon);
  }

  return (
    <div className="formatted-money-input">
      <input
        {...inputProps}
        ref={inputRef}
        className={className}
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        onCompositionStart={(event) => {
          composingRef.current = true;
          onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          commit(
            event.currentTarget.value,
            event.currentTarget.selectionStart ??
              event.currentTarget.value.length,
          );
          onCompositionEnd?.(event);
        }}
        onChange={(event) => {
          if (composingRef.current) {
            setDisplayValue(event.currentTarget.value);
            return;
          }
          commit(
            event.currentTarget.value,
            event.currentTarget.selectionStart ??
              event.currentTarget.value.length,
          );
        }}
      />
      {adjustmentButtons.length === 0 ? null : (
        <div className="formatted-money-input__adjustments">
          {adjustmentButtons.map(({ label, deltaWon }) => (
            <Button
              key={label}
              type="button"
              variant="quiet"
              disabled={disabled}
              onClick={() => {
                const nextValueWon = adjustWon(valueWon, deltaWon);
                lastEmittedValueWonRef.current = nextValueWon;
                setDisplayValue(formatWonInput(nextValueWon, { zeroDisplay }));
                onValueWonChange(nextValueWon);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});
