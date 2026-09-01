import { describe, expect, it } from 'vitest';
import type { MainBootstrapIntroEntryReason } from '../../../src/main/application/bootstrap';
import {
  buildMainViewModel,
  type MainIntroEntryReason,
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
    [null, 'none', false, 'loading'],
    [setupState('welcome'), 'fresh', false, 'intro'],
    [setupState('welcome'), 'fresh', true, 'setup'],
    [setupState('income'), 'resume', false, 'setup'],
    [recoveryState(), 'none', false, 'recovery'],
    [dashboardState(), 'none', false, 'dashboard'],
  ] as const)('selects %s/%s/reduced=%s as %s', (
    state,
    introReason,
    reducedMotion,
    screen,
  ) => {
    expect(buildMainViewModel({
      state,
      introReason,
      reducedMotion,
      validationIssueCount: 0,
      hasProgressWarning: false,
      backupStatusKind: null,
      hasPendingImport: false,
      restorePending: false,
    }).screen).toBe(screen);
  });

  it('derives management and visible status without receiving UI messages', () => {
    const view = buildMainViewModel({
      state: dashboardState({ dirty: true, saveStatus: 'saving' }),
      introReason: 'none',
      reducedMotion: false,
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

  it.each([
    ['fresh', false, true],
    ['restart', false, true],
    ['fresh', true, false],
    ['resume', false, false],
    ['none', false, false],
  ] as const)('selects welcome intro for %s/reduced=%s as %s', (
    introReason: MainIntroEntryReason,
    reducedMotion,
    expected,
  ) => {
    const view = buildMainViewModel({
      state: setupState('welcome'),
      introReason,
      reducedMotion,
      validationIssueCount: 0,
      hasProgressWarning: false,
      backupStatusKind: null,
      hasPendingImport: false,
      restorePending: false,
    });

    expect(view.showIntro).toBe(expected);
  });

  it('exposes setup save errors only when validation has no issues', () => {
    const input = {
      state: setupState('income', { saveStatus: 'error' }),
      introReason: 'resume' as MainBootstrapIntroEntryReason,
      reducedMotion: false,
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
