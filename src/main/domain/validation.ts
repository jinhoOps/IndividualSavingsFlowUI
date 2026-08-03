import type { MainData } from './model';

const mainDataKeys = new Set([
  'schemaVersion',
  'updatedAt',
  'monthlyNetIncomeWon',
  'monthlyHousingWon',
  'monthlyLivingWon',
  'monthlySavingWon',
  'monthlyInvestmentWon',
]);

export type ValidationCode = 'income_required' | 'amount_negative' | 'amount_not_safe_integer';

export interface ValidationResult {
  valid: boolean;
  issues: { path: string; code: ValidationCode }[];
}

const amountFields = [
  'monthlyNetIncomeWon',
  'monthlyHousingWon',
  'monthlyLivingWon',
  'monthlySavingWon',
  'monthlyInvestmentWon',
] as const;

export function isMainDataShape(value: unknown): value is MainData {
  return isRecord(value)
    && Object.keys(value).length === mainDataKeys.size
    && Object.keys(value).every((key) => mainDataKeys.has(key))
    && value.schemaVersion === 2
    && isNonnegativeSafeInteger(value.updatedAt)
    && isNonnegativeSafeInteger(value.monthlyNetIncomeWon)
    && isNonnegativeSafeInteger(value.monthlyHousingWon)
    && isNonnegativeSafeInteger(value.monthlyLivingWon)
    && isNonnegativeSafeInteger(value.monthlySavingWon)
    && isNonnegativeSafeInteger(value.monthlyInvestmentWon);
}

export function validateMainData(data: MainData): ValidationResult {
  const issues: ValidationResult['issues'] = [];

  if (data.monthlyNetIncomeWon <= 0) {
    issues.push({ path: 'monthlyNetIncomeWon', code: 'income_required' });
  }

  issues.push(...validateMainDraft(data).issues);

  return { valid: issues.length === 0, issues };
}

export function validateMainDraft(data: MainData): ValidationResult {
  const issues: ValidationResult['issues'] = [];

  for (const field of amountFields) {
    const amountWon = data[field];
    if (amountWon < 0) {
      issues.push({ path: field, code: 'amount_negative' });
    } else if (!Number.isSafeInteger(amountWon)) {
      issues.push({ path: field, code: 'amount_not_safe_integer' });
    }
  }

  return { valid: issues.length === 0, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
