import type { MainData } from '../domain/model';
import { validateMainData } from '../domain/validation';
import { isMainDataShape } from './mainRepository';

export function exportMainData(data: MainData): string {
  return JSON.stringify(data);
}

export function importMainData(json: string): MainData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Backup data is not valid JSON.');
  }

  if (!isMainDataShape(parsed)) {
    throw new Error('Backup data is not valid MainData.');
  }
  if (!validateMainData(parsed).valid) {
    throw new Error('Backup data contains an invalid plan.');
  }
  return {
    schemaVersion: parsed.schemaVersion,
    updatedAt: parsed.updatedAt,
    monthlyNetIncomeWon: parsed.monthlyNetIncomeWon,
    monthlyHousingWon: parsed.monthlyHousingWon,
    monthlyLivingWon: parsed.monthlyLivingWon,
    monthlySavingWon: parsed.monthlySavingWon,
    monthlyInvestmentWon: parsed.monthlyInvestmentWon,
  };
}

export function exportRecoveryData(original: unknown): string {
  return JSON.stringify(original) ?? 'null';
}
