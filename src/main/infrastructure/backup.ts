import type { MainData } from '../domain/model';
import { validateMainData } from '../domain/validation';
import { migrateLegacyMain } from './legacyMigration';

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

  const result = migrateLegacyMain(parsed);
  if (result.status !== 'current') {
    throw new Error('Backup data is not valid MainData.');
  }
  if (!validateMainData(result.data).valid) {
    throw new Error('Backup data contains an invalid plan.');
  }
  return result.data;
}

export function exportRecoveryData(original: unknown): string {
  return JSON.stringify(original) ?? 'null';
}
