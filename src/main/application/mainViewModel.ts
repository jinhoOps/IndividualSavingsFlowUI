import type { MainBootstrapIntroEntryReason } from './bootstrap';
import type { MainState } from './mainReducer';

export type MainScreenKind =
  | 'loading' | 'intro' | 'recovery' | 'setup' | 'dashboard';

export type MainIntroEntryReason = MainBootstrapIntroEntryReason | 'restart';

export interface MainViewModelInput {
  state: MainState | null;
  introReason: MainIntroEntryReason;
  reducedMotion: boolean;
  validationIssueCount: number;
  hasProgressWarning: boolean;
  backupStatusKind: 'success' | 'error' | null;
  hasPendingImport: boolean;
  restorePending: boolean;
}

export interface MainViewModel {
  screen: MainScreenKind;
  showIntro: boolean;
  showBackupStatus: boolean;
  showSetupSaveError: boolean;
  management: {
    saving: boolean;
    dirty: boolean;
    canExport: boolean;
    canImport: boolean;
    canRestart: boolean;
    importConfirmationOpen: boolean;
  };
}

export function shouldShowMainIntro(
  state: MainState | null,
  introReason: MainIntroEntryReason,
  reducedMotion: boolean,
): boolean {
  return state?.mode === 'setup'
    && state.setupStep === 'welcome'
    && (introReason === 'fresh' || introReason === 'restart')
    && !reducedMotion;
}

export function buildMainViewModel(input: MainViewModelInput): MainViewModel {
  const showIntro = shouldShowMainIntro(
    input.state,
    input.introReason,
    input.reducedMotion,
  );
  const screen: MainScreenKind = input.state === null
    ? 'loading'
    : showIntro
      ? 'intro'
      : input.state.mode === 'recovery'
        ? 'recovery'
        : input.state.mode === 'setup' && input.state.setupStep !== null
          ? 'setup'
          : 'dashboard';
  const hasApplied = input.state?.applied !== null
    && input.state?.applied !== undefined;

  return {
    screen,
    showIntro,
    showBackupStatus: !input.hasPendingImport && input.backupStatusKind !== null,
    showSetupSaveError: input.state?.saveStatus === 'error'
      && input.validationIssueCount === 0,
    management: {
      saving: input.state?.saveStatus === 'saving' || input.restorePending,
      dirty: input.state?.dirty ?? false,
      canExport: hasApplied,
      canImport: input.state?.mode === 'dashboard',
      canRestart: hasApplied,
      importConfirmationOpen: input.hasPendingImport,
    },
  };
}
