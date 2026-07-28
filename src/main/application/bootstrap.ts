import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import { validateMainData, type ValidationResult } from '../domain/validation';
import type { MainRepository } from '../infrastructure/mainRepository';
import { cloneMainData, type MainState } from './mainReducer';

export type ValidationIssue = ValidationResult['issues'][number];

export type ApplyResult =
  | { ok: true; data: MainData }
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
      case 'current':
      case 'migrated':
        return dashboardState(result.data);
      case 'recovery':
        return {
          mode: 'recovery',
          applied: cloneMainData(result.current),
          draft: cloneMainData(result.data),
          setupStep: null,
          dirty: true,
          saveStatus: 'idle',
          loadError: null,
        };
      case 'failed':
        return {
          mode: 'recovery',
          applied: null,
          draft: createEmptyMainData(),
          setupStep: null,
          dirty: false,
          saveStatus: 'idle',
          loadError: { message: result.reason, original: result.original },
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
    await repository.save(data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, kind: 'storage', error: toError(error) };
  }
}

function setupState(draft: MainData, setupStep: SetupStep): MainState {
  return {
    mode: 'setup',
    applied: null,
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
