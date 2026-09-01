import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import type { MainRepository } from '../infrastructure/mainRepository';
import { cloneMainData, type MainState } from './mainReducer';

export type MainBootstrapIntroEntryReason = 'fresh' | 'resume' | 'none';

export interface MainBootstrapResult {
  state: MainState;
  introEntryReason: MainBootstrapIntroEntryReason;
}

export async function bootstrapMain(repository: MainRepository): Promise<MainBootstrapResult> {
  try {
    const result = await repository.load();

    switch (result.status) {
      case 'empty': {
        const progress = repository.loadSetupProgress();
        return progress === null
          ? { state: setupState(createEmptyMainData(), 'welcome'), introEntryReason: 'fresh' }
          : { state: setupState(progress.draft, progress.step), introEntryReason: 'resume' };
      }
      case 'current': {
        const progress = repository.loadSetupProgress();
        if (progress?.kind === 'restart' && progress.draft.updatedAt >= result.data.updatedAt) {
          return {
            state: setupState(progress.draft, progress.step, result.data),
            introEntryReason: 'resume',
          };
        }
        return { state: dashboardState(result.data), introEntryReason: 'none' };
      }
      case 'recovery': {
        const progress = repository.loadSetupProgress();
        if (progress !== null && progress.savedAt > result.data.updatedAt) {
          return {
            state: setupState(progress.draft, progress.step, result.current),
            introEntryReason: 'resume',
          };
        }
        return {
          state: {
            mode: 'recovery',
            applied: result.current === null ? null : cloneMainData(result.current),
            draft: cloneMainData(result.data),
            setupStep: null,
            dirty: true,
            saveStatus: 'idle',
            loadError: null,
          },
          introEntryReason: 'none',
        };
      }
      case 'failed':
        return {
          state: {
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
          },
          introEntryReason: 'none',
        };
    }
  } catch (error) {
    return {
      state: {
        mode: 'recovery',
        applied: null,
        draft: createEmptyMainData(),
        setupStep: null,
        dirty: false,
        saveStatus: 'idle',
        loadError: { message: errorMessage(error), original: error },
      },
      introEntryReason: 'none',
    };
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
