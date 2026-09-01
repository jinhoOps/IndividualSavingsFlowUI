import { calculateCashflow, type CashflowSummary } from '../domain/cashflow';
import type { MainData, SetupStep } from '../domain/model';
import { validateMainData, type ValidationResult } from '../domain/validation';
import type { MainRepository } from '../infrastructure/mainRepository';
import { cloneMainData, type MainState } from './mainReducer';

export type ValidationIssue = ValidationResult['issues'][number];

export type SaveMainDraftResult =
  | { status: 'saved'; data: MainData; summary: CashflowSummary }
  | { status: 'validation-failed'; issues: ValidationIssue[] }
  | { status: 'storage-failed'; error: Error };

export type ResetInvalidMainResult =
  | { status: 'reset' }
  | { status: 'failed'; error: Error };

export async function saveMainDraft(
  state: MainState,
  repository: MainRepository,
): Promise<SaveMainDraftResult> {
  const validation = validateMainData(state.draft);
  if (!validation.valid) {
    return { status: 'validation-failed', issues: validation.issues };
  }

  const data = cloneMainData(state.draft);
  try {
    const persisted = await repository.save(data);
    return {
      status: 'saved',
      data: persisted,
      summary: calculateCashflow(persisted),
    };
  } catch (error) {
    return { status: 'storage-failed', error: toError(error) };
  }
}

export async function resetInvalidMainWorkspace(
  expectedRaw: string,
  repository: MainRepository,
): Promise<ResetInvalidMainResult> {
  try {
    await repository.resetInvalidWorkspace(expectedRaw);
    return { status: 'reset' };
  } catch (error) {
    return { status: 'failed', error: toError(error) };
  }
}

export function setupStepForIssue(path: string | undefined): SetupStep | null {
  if (path === 'monthlyNetIncomeWon') return 'income';
  if (path === 'monthlyHousingWon') return 'housing';
  if (path === 'monthlyLivingWon') return 'living';
  if (path === 'monthlySavingWon' || path === 'monthlyInvestmentWon') {
    return 'saving-investment';
  }
  return null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
