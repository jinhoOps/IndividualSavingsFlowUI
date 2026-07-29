import type { MainData } from './model';

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
