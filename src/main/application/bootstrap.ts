import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import { calculateCashflow, type CashflowSummary } from '../domain/cashflow';
import { validateMainData, type ValidationResult } from '../domain/validation';
import type { MainRepository } from '../infrastructure/mainRepository';
import { cloneMainData, type MainState } from './mainReducer';

export type ValidationIssue = ValidationResult['issues'][number];

export type ApplyResult =
  | { ok: true; data: MainData; summary: CashflowSummary }
  | { ok: false; kind: 'validation'; issues: ValidationIssue[] }
  | { ok: false; kind: 'storage'; error: Error };

export async function bootstrapMain(repository: MainRepository): Promise<MainState> {
  try {
    const result = await repository.load();

    switch (result.status) {
      case 'empty': {
        const progress = repository.loadSetupProgress();
        return progress === null
          ? setupState(createEmptyMainData(), 'welcome')
          : setupState(progress.draft, progress.step);
      }
      case 'current': {
        const progress = repository.loadSetupProgress();
        if (progress?.kind === 'restart' && progress.draft.updatedAt >= result.data.updatedAt) {
          return setupState(progress.draft, progress.step, result.data);
        }
        return dashboardState(result.data);
      }
      case 'recovery': {
        const progress = repository.loadSetupProgress();
        if (progress !== null && progress.savedAt > result.data.updatedAt) {
          return setupState(progress.draft, progress.step, result.current);
        }
        return {
          mode: 'recovery',
          applied: result.current === null ? null : cloneMainData(result.current),
          draft: cloneMainData(result.data),
          setupStep: null,
          dirty: true,
          saveStatus: 'idle',
          loadError: null,
        };
      }
      case 'failed':
        return {
          mode: 'recovery',
          applied: null,
          draft: createEmptyMainData(),
          setupStep: null,
          dirty: false,
          saveStatus: 'idle',
          loadError: {
            message: result.reason,
            original: result.original,
            raw: result.raw,
            source: result.source,
          },
        };
    }
  } catch (error) {
    return {
      mode: 'recovery',
      applied: null,
      draft: createEmptyMainData(),
      setupStep: null,
      dirty: false,
      saveStatus: 'idle',
      loadError: { message: errorMessage(error), original: error },
    };
  }
}

export async function applyDraft(state: MainState, repository: MainRepository): Promise<ApplyResult> {
  const validation = validateMainData(state.draft);
  if (!validation.valid) {
    return { ok: false, kind: 'validation', issues: validation.issues };
  }

  const data = cloneMainData(state.draft);
  try {
    const persisted = await repository.save(data);
    return { ok: true, data: persisted, summary: calculateCashflow(persisted) };
  } catch (error) {
    return { ok: false, kind: 'storage', error: toError(error) };
  }
}

function setupState(draft: MainData, setupStep: SetupStep, applied: MainData | null = null): MainState {
  return {
    mode: 'setup',
    applied: applied === null ? null : cloneMainData(applied),
    draft: cloneMainData(draft),
    setupStep,
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
  };
}

function dashboardState(data: MainData): MainState {
  return {
    mode: 'dashboard',
    applied: cloneMainData(data),
    draft: cloneMainData(data),
    setupStep: null,
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
