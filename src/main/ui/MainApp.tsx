import { useRef, useState } from 'react';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { useReducedMotion } from '../../components/motion/useReducedMotion';
import type { MainState } from '../application/mainReducer';
import {
  buildMainViewModel,
  shouldShowMainIntro,
} from '../application/mainViewModel';
import { calculateCashflow } from '../domain/cashflow';
import type { MainData } from '../domain/model';
import { BrowserMainRepository, type MainRepository } from '../infrastructure/mainRepository';
import { appPath } from '../../journey/routes';
import { JourneyEntryCard } from '../../journey/ui/JourneyEntryCard';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';
import { Button } from './common/Button';
import { Surface } from './common/Surface';
import { formatDashboardWon } from './dashboard/CashflowSummary';
import { SummaryDashboard } from './dashboard/SummaryDashboard';
import { MainManagementMenu } from './MainManagementMenu';
import { MainWelcomeIntro } from './MainWelcomeIntro';
import { createMainOperationGate } from './mainOperationGate';
import { SetupFlow } from './setup/SetupFlow';
import { useMainBackupController } from './useMainBackupController';
import { useMainPlanController } from './useMainPlanController';

export interface MainAppProps {
  repository?: MainRepository;
  workspaceRepository?: Pick<WorkspaceRepository, 'load' | 'replace'>;
  navigate?(href: string): void;
}

const browserWorkspaceRepository = new BrowserWorkspaceRepository();
const browserRepository = new BrowserMainRepository(browserWorkspaceRepository);

export function MainApp({
  repository = browserRepository,
  workspaceRepository = browserWorkspaceRepository,
  navigate = navigateTo,
}: MainAppProps) {
  const operationGate = useRef(createMainOperationGate()).current;
  const reducedMotion = useReducedMotion();
  const plan = useMainPlanController({ repository, operationGate, reducedMotion });
  const showIntro = shouldShowMainIntro(
    plan.state,
    plan.introEntry.reason,
    reducedMotion,
  );
  const backup = useMainBackupController({
    state: plan.state,
    mainRepository: repository,
    workspaceRepository,
    operationGate,
    showIntro,
    onBootstrapAccepted: plan.acceptBootstrapResult,
  });
  const view = buildMainViewModel({
    state: plan.state,
    introReason: plan.introEntry.reason,
    reducedMotion,
    validationIssueCount: plan.issues.length,
    hasProgressWarning: plan.progressWarning !== null,
    backupStatusKind: backup.backupStatus?.kind ?? null,
    hasPendingImport: backup.pendingImport !== null,
    restorePending: backup.restorePending,
  });
  const [initialEditPath] = useState<keyof MainData | undefined>(() => consumeEditIntent());

  function continueToSimulation() {
    if (plan.state?.applied === null || plan.state?.applied === undefined) return;
    navigate(appPath('simulation'));
  }

  const journeyEntry = <JourneyEntryCard enabled={view.management.canExport} onContinue={continueToSimulation} />;
  const showBackupStatus = view.showBackupStatus;
  const backupStatusRegion = (
    <div
      className={`mx-auto w-full max-w-6xl ${showBackupStatus ? 'px-5 pt-4 sm:px-8' : ''}`}
      aria-live="polite"
      aria-atomic="true"
      data-testid="workspace-backup-status"
    >
      {showBackupStatus && backup.backupStatus !== null ? (
        <p
          className={`m-0 rounded-xl px-4 py-3 text-sm font-bold ${backup.backupStatus.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`}
          role={backup.backupStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {backup.backupStatus.message}
        </p>
      ) : null}
    </div>
  );
  const managementMenu = (
    <MainManagementMenu
      saving={view.management.saving}
      dirty={view.management.dirty}
      canExport={view.management.canExport}
      canImport={view.management.canImport}
      canRestart={view.management.canRestart}
      importConfirmationOpen={view.management.importConfirmationOpen}
      importFailureMessage={backup.pendingImport === null || backup.backupStatus?.kind !== 'error'
        ? undefined
        : backup.backupStatus.message}
      onCancel={plan.cancelDraft}
      onRestart={plan.restartSetup}
      onExport={backup.exportCurrentWorkspace}
      onImportFile={backup.prepareWorkspaceImport}
      onCancelImport={backup.cancelWorkspaceImport}
      onConfirmImport={backup.restorePendingImport}
    />
  );

  if (plan.state === null || view.screen === 'loading') {
    return (
      <AppContentFrame
        className="grid min-h-dvh place-items-center py-8"
        data-testid="main-page-frame"
      >
        <p className="text-sm font-bold text-slate-600" role="status">자금 계획을 불러오는 중입니다.</p>
      </AppContentFrame>
    );
  }

  if (view.screen === 'intro') {
    return <MainWelcomeIntro key={plan.introEntry.id} onComplete={() => plan.completeWelcomeIntro(plan.introEntry.id)} />;
  }

  if (view.screen === 'recovery' && plan.state.mode === 'recovery') {
    const original = plan.state.loadError?.original ?? plan.state.draft;
    return (
      <AppShell currentApp="main" managementMenu={managementMenu} statusRegion={backupStatusRegion}>
        <RecoveryView
          state={plan.state}
          onDownload={() => backup.exportRecoveryOriginal(original, plan.state?.loadError?.raw)}
          onStartEmpty={plan.startEmptySetup}
          onRetry={plan.apply}
          onDiscard={plan.discardRecoveryCandidate}
          onReturnCurrent={plan.returnToCurrentPlan}
        />
      </AppShell>
    );
  }

  if (view.screen === 'setup' && plan.state.mode === 'setup' && plan.state.setupStep !== null) {
    const isRestartSetup = plan.state.applied !== null;
    const setupNotice = (
      <>
        {plan.progressWarning === null ? null : (
          <p className="m-0 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">
            {plan.progressWarning}
          </p>
        )}
        {view.showSetupSaveError ? (
          <Surface className="mt-3 rounded-xl border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800" role="alert">
            <p className="m-0">저장하지 못했습니다. 입력한 내용은 그대로 보존되어 있습니다.</p>
            <Button
              className="mt-3 rounded-full"
              variant="primary"
              type="button"
              onClick={plan.apply}
            >
              저장 다시 시도
            </Button>
          </Surface>
        ) : null}
      </>
    );
    return (
      <AppShell currentApp="main" showLauncher={false} statusRegion={backupStatusRegion}>
        <AppContentFrame
          className="min-h-dvh py-8 sm:py-12"
          data-testid="main-page-frame"
        >
          <SetupFlow
            draft={plan.state.draft}
            step={plan.state.setupStep}
            issues={plan.issues}
            validationAttempt={plan.validationAttempt}
            saving={plan.state.saveStatus === 'saving'}
            onChange={plan.changeDraft}
            onStepChange={plan.changeSetupStep}
            onApply={plan.apply}
            onCancel={isRestartSetup ? plan.cancelDraft : undefined}
            notice={setupNotice}
            motionPreset="initial-assembly"
          />
        </AppContentFrame>
      </AppShell>
    );
  }

  if (plan.state.applied === null) return null;

  return (
    <AppShell currentApp="main" managementMenu={managementMenu} statusRegion={backupStatusRegion}>
      <SummaryDashboard
        applied={plan.state.applied}
        draft={plan.state.draft}
        dirty={view.management.dirty}
        issues={plan.issues}
        validationAttempt={plan.validationAttempt}
        saveStatus={plan.state.saveStatus}
        onDraftChange={plan.changeDraft}
        onApply={plan.apply}
        onCancel={plan.cancelDraft}
        backupStatus={plan.progressWarning === null
          ? null
          : { kind: 'error', message: plan.progressWarning }}
        journeyEntry={journeyEntry}
        initialFocusPath={initialEditPath}
      />
    </AppShell>
  );
}

function consumeEditIntent(): keyof MainData | undefined {
  if (typeof window === 'undefined') return undefined;
  const url = new URL(window.location.href);
  if (url.searchParams.get('edit') !== 'investment') return undefined;
  url.searchParams.delete('edit');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return 'monthlyInvestmentWon';
}

interface RecoveryViewProps {
  state: MainState;
  onDownload(): void;
  onStartEmpty(): void;
  onRetry(): void;
  onDiscard(): void;
  onReturnCurrent(): void;
}

function RecoveryView({
  state,
  onDownload,
  onStartEmpty,
  onRetry,
  onDiscard,
  onReturnCurrent,
}: RecoveryViewProps) {
  const currentIncome = state.applied === null ? null : calculateCashflow(state.applied).incomeWon;
  const pendingIncome = calculateCashflow(state.draft).incomeWon;
  const hasRecoveryCandidate = state.loadError === null;
  const saving = state.saveStatus === 'saving';

  return (
    <AppContentFrame
      className="grid min-h-dvh place-items-center py-10"
      data-testid="main-page-frame"
    >
      <Surface as="section" className="w-full max-w-xl border-amber-200 p-6 shadow-xl shadow-amber-950/5 sm:p-10" aria-labelledby="recovery-title">
        <p className="mb-3 text-sm font-black tracking-wide text-amber-700">안전한 데이터 복구</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950" id="recovery-title">저장 복구가 필요합니다</h1>
        <p className="mt-4 leading-7 text-slate-600">
          {state.loadError?.message ?? '마지막 저장이 완전히 끝나지 않아 적용 중인 계획과 저장 대기 중인 초안을 함께 보존했습니다.'}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {currentIncome === null ? null : (
            <p className="rounded-2xl bg-slate-100 p-4 font-bold text-slate-700">
              현재 적용 중 · {formatDashboardWon(currentIncome)}
            </p>
          )}
          <p className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-900">
            저장 대기 중 · {formatDashboardWon(pendingIncome)}
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={onDownload}>
            기존 원본 JSON 다운로드
          </Button>
          {hasRecoveryCandidate ? (
            <>
              <Button
                variant="primary"
                type="button"
                disabled={saving}
                onClick={onRetry}
              >
                {saving ? '저장 중' : '저장 다시 시도'}
              </Button>
              <Button
                className="border-rose-200 text-rose-700"
                type="button"
                disabled={saving}
                onClick={onDiscard}
              >
                복구 초안 버리기
              </Button>
              {state.applied === null ? null : (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={onReturnCurrent}
                >
                  현재 계획으로 돌아가기
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" type="button" onClick={onStartEmpty}>
              빈 초안으로 다시 시작
            </Button>
          )}
        </div>
        {state.saveStatus === 'error' ? (
          <p className="mt-4 text-sm font-bold text-rose-700" role="alert">
            저장하지 못했습니다. 초안은 그대로 보존되어 있습니다. 다시 시도해 주세요.
          </p>
        ) : null}
      </Surface>
    </AppContentFrame>
  );
}

function navigateTo(href: string): void {
  window.location.assign(href);
}
