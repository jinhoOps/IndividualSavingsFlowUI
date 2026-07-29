import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';

export interface MainState {
  mode: 'setup' | 'dashboard' | 'recovery';
  applied: MainData | null;
  draft: MainData;
  setupStep: SetupStep | null;
  dirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  loadError: { message: string; original: unknown; raw?: string } | null;
}

export type MainAction =
  | { type: 'replace-draft'; draft: MainData }
  | { type: 'cancel-draft' }
  | { type: 'set-setup-step'; step: SetupStep }
  | { type: 'restart-setup' }
  | { type: 'save-started' }
  | { type: 'save-succeeded'; data: MainData }
  | { type: 'save-failed' };

export function mainReducer(state: MainState, action: MainAction): MainState {
  switch (action.type) {
    case 'replace-draft':
      return {
        ...state,
        draft: cloneMainData(action.draft),
        dirty: true,
        saveStatus: 'idle',
      };
    case 'cancel-draft':
      return {
        ...state,
        mode: state.applied === null ? 'setup' : 'dashboard',
        draft: state.applied === null ? createEmptyMainData() : cloneMainData(state.applied),
        setupStep: state.applied === null ? 'welcome' : null,
        dirty: false,
        saveStatus: 'idle',
      };
    case 'set-setup-step':
      return { ...state, mode: 'setup', setupStep: action.step };
    case 'restart-setup':
      return {
        ...state,
        mode: 'setup',
        draft: state.applied === null ? createEmptyMainData() : cloneMainData(state.applied),
        setupStep: 'welcome',
        dirty: false,
        saveStatus: 'idle',
      };
    case 'save-started':
      return { ...state, saveStatus: 'saving' };
    case 'save-succeeded': {
      const data = cloneMainData(action.data);
      return {
        ...state,
        mode: 'dashboard',
        applied: data,
        draft: cloneMainData(data),
        setupStep: null,
        dirty: false,
        saveStatus: 'saved',
        loadError: null,
      };
    }
    case 'save-failed':
      return { ...state, saveStatus: 'error' };
  }
}

export function cloneMainData(data: MainData): MainData {
  return { ...data };
}
