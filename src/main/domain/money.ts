export function parseWonInput(value: string | number | null | undefined): number {
  const normalized = String(value ?? '').replace(/[\s,]/g, '');
  if (!/^\d+$/.test(normalized)) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export function formatWonInput(valueWon: number): string {
  if (!Number.isSafeInteger(valueWon) || valueWon <= 0) {
    return '';
  }

  return new Intl.NumberFormat('ko-KR').format(valueWon);
}

export interface NormalizedMoneyEdit {
  valueWon: number;
  displayValue: string;
  caret: number;
}

export function normalizeMoneyEdit(raw: string, selectionStart: number): NormalizedMoneyEdit {
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, raw.length));
  const digitCountBeforeCaret = (raw.slice(0, safeSelectionStart).match(/\d/g) ?? []).length;
  const digits = raw.replace(/\D/g, '');
  const valueWon = parseWonInput(digits);

  if (digits === '' || valueWon === 0) {
    return { valueWon: 0, displayValue: '', caret: 0 };
  }

  const displayValue = formatWonInput(valueWon);
  if (digitCountBeforeCaret === 0) {
    return { valueWon, displayValue, caret: 0 };
  }
  let caret = displayValue.length;
  let seenDigits = 0;

  for (let index = 0; index < displayValue.length; index += 1) {
    if (/\d/.test(displayValue[index])) {
      seenDigits += 1;
    }
    if (seenDigits === digitCountBeforeCaret) {
      caret = index + 1;
      break;
    }
  }

  return { valueWon, displayValue, caret };
}

export function adjustWon(valueWon: number, deltaWon: number): number {
  const current = Number.isSafeInteger(valueWon) && valueWon > 0 ? valueWon : 0;
  const delta = Number.isSafeInteger(deltaWon) ? deltaWon : 0;
  const adjusted = current + delta;

  return Number.isSafeInteger(adjusted) && adjusted > 0 ? adjusted : 0;
}
