import { describe, expect, it } from 'vitest';
import {
  buildMainViewModel,
} from '../../../src/main/application/mainViewModel';
import { type MainState } from '../../../src/main/application/mainReducer';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';

function data(overrides: Partial<MainData> = {}): MainData {
  return {
    ...createEmptyMainData(),
    monthlyNetIncomeWon: 3_000_000,
    monthlyHousingWon: 900_000,
    monthlyLivingWon: 700_000,
    monthlySavingWon: 500_000,
    monthlyInvestmentWon: 400_000,
    ...overrides,
  };
}

function setupState(setupStep: SetupStep, overrides: Partial<MainState> = {}): MainState {
  const state: MainState = {
    mode: 'setup',
    applied: null,
    draft: data(),
    setupStep,
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
    ...overrides,
  };
  return {
    ...state,
    applied: state.applied === null ? null : { ...state.applied },
    draft: { ...state.draft },
  };
}

function recoveryState(overrides: Partial<MainState> = {}): MainState {
  const state: MainState = {
    mode: 'recovery',
    applied: null,
    draft: data(),
    setupStep: null,
    dirty: true,
    saveStatus: 'idle',
    loadError: null,
    ...overrides,
  };
  return {
    ...state,
    applied: state.applied === null ? null : { ...state.applied },
    draft: { ...state.draft },
  };
}

function dashboardState(overrides: Partial<MainState> = {}): MainState {
  const applied = data();
  const state: MainState = {
    mode: 'dashboard',
    applied: { ...applied },
    draft: { ...applied },
    setupStep: null,
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
    ...overrides,
  };
  return {
    ...state,
    applied: state.applied === null ? null : { ...state.applied },
    draft: { ...state.draft },
  };
}

describe('mainViewModel', () => {
  it.each([
    [null, 'loading'],
    [setupState('welcome'), 'setup'],
    [setupState('income'), 'setup'],
    [recoveryState(), 'recovery'],
    [dashboardState(), 'dashboard'],
  ] as const)('selects %s as %s without a Main intro', (state, screen) => {
    expect(buildMainViewModel({state, validationIssueCount: 0, hasProgressWarning: false,
      backupStatusKind: null, hasPendingImport: false, restorePending: false}).screen).toBe(screen);
  });

  it('derives management and visible status without receiving UI messages', () => {
    const view = buildMainViewModel({
      state: dashboardState({ dirty: true, saveStatus: 'saving' }),
      validationIssueCount: 0,
      hasProgressWarning: true,
      backupStatusKind: 'error',
      hasPendingImport: false,
      restorePending: true,
    });

    expect(view.management).toEqual({
      saving: true,
      dirty: true,
      canExport: true,
      canImport: true,
      canRestart: true,
      importConfirmationOpen: false,
    });
    expect(view.showBackupStatus).toBe(true);
    expect(view.showSetupSaveError).toBe(false);
  });

  it('exposes setup save errors only when validation has no issues', () => {
    const input = {
      state: setupState('income', { saveStatus: 'error' }),
      validationIssueCount: 0,
      hasProgressWarning: false,
      backupStatusKind: null,
      hasPendingImport: false,
      restorePending: false,
    };

    expect(buildMainViewModel(input).showSetupSaveError).toBe(true);
    expect(buildMainViewModel({ ...input, validationIssueCount: 1 }).showSetupSaveError).toBe(false);
  });
});
