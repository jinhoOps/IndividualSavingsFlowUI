import { useEffect, useMemo, useRef, useState } from 'react';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { useReducedMotion } from '../../components/motion/useReducedMotion';
import {
  bootstrapMain,
  type MainBootstrapIntroEntryReason,
  type MainBootstrapResult,
} from '../application/bootstrap';
import { mainReducer, type MainAction, type MainState } from '../application/mainReducer';
import {
  resetInvalidMainWorkspace,
  saveMainDraft,
  setupStepForIssue,
  type ValidationIssue,
} from '../application/mainSetupCommands';
import { createSetupProgressQueue } from '../application/setupProgressQueue';
import { calculateCashflow } from '../domain/cashflow';
import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
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

export interface MainAppProps {
  repository?: MainRepository;
  workspaceRepository?: Pick<WorkspaceRepository, 'load' | 'replace'>;
  navigate?(href: string): void;
}

export type MainIntroEntryReason = MainBootstrapIntroEntryReason | 'restart';

interface MainIntroEntry {
  id: number;
  reason: MainIntroEntryReason;
}

const browserWorkspaceRepository = new BrowserWorkspaceRepository();
const browserRepository = new BrowserMainRepository(browserWorkspaceRepository);

export function MainApp({
  repository = browserRepository,
  workspaceRepository = browserWorkspaceRepository,
  navigate = navigateTo,
}: MainAppProps) {
  const [state, setState] = useState<MainState | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const [introEntry, setIntroEntry] = useState<MainIntroEntry>({ id: 0, reason: 'none' });
  const operationGate = useRef(createMainOperationGate()).current;
  const initialBootstrapRequestRef = useRef<{
    repository: MainRepository;
    promise: Promise<MainBootstrapResult>;
  } | null>(null);
  const introEntryIdRef = useRef(0);
  const persistedFreshIntroEntryIdsRef = useRef(new Set<number>());
  const [initialEditPath] = useState<keyof MainData | undefined>(() => consumeEditIntent());
  const progressQueue = useMemo(() => createSetupProgressQueue(repository), [repository]);
  const reducedMotion = useReducedMotion();
  const showIntro = state?.mode === 'setup'
    && state.setupStep === 'welcome'
    && (introEntry.reason === 'fresh' || introEntry.reason === 'restart')
    && !reducedMotion;
  const {
    backupStatus,
    pendingImport,
    restorePending,
    prepareWorkspaceImport,
    cancelWorkspaceImport,
    clearBackupStatus,
    restorePendingImport,
    exportCurrentWorkspace,
    exportRecoveryOriginal,
  } = useMainBackupController({
    state,
    mainRepository: repository,
    workspaceRepository,
    operationGate,
    showIntro,
    onBootstrapAccepted: acceptBackupBootstrap,
  });

  useEffect(() => {
    let active = true;
    let request = initialBootstrapRequestRef.current;
    if (request === null || request.repository !== repository) {
      request = { repository, promise: bootstrapMain(repository) };
      initialBootstrapRequestRef.current = request;
    }
    void request.promise.then((loaded) => {
      if (active) setBootstrapResult(loaded);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    if (
      introEntry.reason !== 'fresh'
      || state === null
      || state.mode !== 'setup'
      || state.setupStep !== 'welcome'
    ) return;
    if (persistedFreshIntroEntryIdsRef.current.has(introEntry.id)) return;
    persistedFreshIntroEntryIdsRef.current.add(introEntry.id);
    void persistSetupProgress('welcome', state.draft, 'initial');
  }, [introEntry, state]);

  useEffect(() => {
    if (
      !reducedMotion
      || state?.mode !== 'setup'
      || state.setupStep !== 'welcome'
      || (introEntry.reason !== 'fresh' && introEntry.reason !== 'restart')
    ) return;
    completeWelcomeIntro(introEntry.id);
  }, [introEntry, reducedMotion, state]);

  function setBootstrapResult(loaded: MainBootstrapResult) {
    setState(loaded.state);
    setIntroEntry(nextIntroEntry(loaded.introEntryReason));
  }

  function acceptBackupBootstrap(loaded: MainBootstrapResult) {
    setIssues([]);
    setProgressWarning(null);
    setBootstrapResult(loaded);
  }

  function nextIntroEntry(reason: MainIntroEntryReason): MainIntroEntry {
    introEntryIdRef.current += 1;
    return { id: introEntryIdRef.current, reason };
  }

  function completeWelcomeIntro(entryId: number) {
    setIntroEntry((current) => current.id !== entryId
      ? current
      : { ...current, reason: 'none' });
  }

  function dispatch(action: MainAction) {
    setState((current) => current === null ? current : mainReducer(current, action));
  }

  function changeDraft(draft: MainData) {
    if (operationGate.busy) return;
    if (state?.mode === 'setup' && state.setupStep !== null) {
      void persistSetupProgress(state.setupStep, draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'replace-draft', draft });
  }

  function changeSetupStep(step: SetupStep) {
    if (operationGate.busy) return;
    if (state !== null) {
      void persistSetupProgress(step, state.draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'set-setup-step', step });
  }

  async function apply() {
    if (state === null || operationGate.busy) return;

    operationGate.busy = true;
    dispatch({ type: 'save-started' });
    try {
      await progressQueue.waitForIdle();
      const result = await saveMainDraft(state, repository);
      if (result.status === 'saved') {
        await clearSetupProgress();
        setIssues([]);
        clearBackupStatus();
        dispatch({ type: 'save-succeeded', data: result.data });
        return;
      }

      if (result.status === 'validation-failed') {
        setIssues(result.issues);
        setValidationAttempt((attempt) => attempt + 1);
        if (state.mode === 'setup') {
          const step = setupStepForIssue(result.issues[0]?.path);
          if (step !== null) {
            persistSetupProgress(step, state.draft, state.applied === null ? 'initial' : 'restart');
            dispatch({ type: 'set-setup-step', step });
          }
        }
        dispatch({ type: 'save-failed' });
        return;
      }
      dispatch({ type: 'save-failed' });
    } finally {
      operationGate.busy = false;
    }
  }

  async function cancelDraft() {
    if (operationGate.busy) return;
    operationGate.busy = true;
    try {
      if (!await clearSetupProgress()) return;
      setIssues([]);
      clearBackupStatus();
      dispatch({ type: 'cancel-draft' });
    } finally {
      operationGate.busy = false;
    }
  }

  function restartSetup() {
    if (state === null || state.applied === null || operationGate.busy) return;
    void persistSetupProgress('welcome', state.applied, 'restart');
    setIntroEntry(nextIntroEntry('restart'));
    setIssues([]);
    dispatch({ type: 'restart-setup' });
  }

  async function startEmptySetup() {
    if (state === null || operationGate.busy) return;
    operationGate.busy = true;
    dispatch({ type: 'save-started' });
    try {
      if (state.mode === 'recovery' && state.loadError?.raw !== undefined) {
        const result = await resetInvalidMainWorkspace(state.loadError.raw, repository);
        if (result.status !== 'reset') {
          dispatch({ type: 'save-failed' });
          return;
        }
      }
      setIssues([]);
      setState({
        mode: 'setup',
        applied: null,
        draft: createEmptyMainData(),
        setupStep: 'welcome',
        dirty: false,
        saveStatus: 'idle',
        loadError: null,
      });
    } catch {
      dispatch({ type: 'save-failed' });
    } finally {
      operationGate.busy = false;
    }
  }

  async function discardRecoveryCandidate() {
    if (state === null || state.mode !== 'recovery' || operationGate.busy) return;
    operationGate.busy = true;
    const cleared = await clearSetupProgress();
    operationGate.busy = false;
    if (!cleared) return;
    setIssues([]);
    setState({
      mode: 'setup',
      applied: null,
      draft: createEmptyMainData(),
      setupStep: 'welcome',
      dirty: false,
      saveStatus: 'idle',
      loadError: null,
    });
  }

  async function returnToCurrentPlan() {
    if (state === null || state.mode !== 'recovery' || state.applied === null || operationGate.busy) return;
    operationGate.busy = true;
    const cleared = await clearSetupProgress();
    operationGate.busy = false;
    if (!cleared) return;
    setIssues([]);
    dispatch({ type: 'cancel-draft' });
  }

  function persistSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind: 'initial' | 'restart',
  ): Promise<boolean> {
    return progressQueue.save(step, draft, kind).then((result) => {
      if (result.status === 'saved') {
        setProgressWarning(null);
        return true;
      }
      setProgressWarning('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.');
      return false;
    });
  }

  function clearSetupProgress(): Promise<boolean> {
    return progressQueue.clear().then((result) => {
      if (result.status === 'saved') {
        setProgressWarning(null);
        return true;
      }
      setProgressWarning('설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.');
      return false;
    });
  }

  function continueToSimulation() {
    if (state?.applied === null || state?.applied === undefined) return;
    navigate(appPath('simulation'));
  }

  const journeyEntry = <JourneyEntryCard enabled={state?.applied !== null && state?.applied !== undefined} onContinue={continueToSimulation} />;
  const showBackupStatus = pendingImport === null && backupStatus !== null;
  const backupStatusRegion = (
    <div
      className={`mx-auto w-full max-w-6xl ${showBackupStatus ? 'px-5 pt-4 sm:px-8' : ''}`}
      aria-live="polite"
      aria-atomic="true"
      data-testid="workspace-backup-status"
    >
      {showBackupStatus ? (
        <p
          className={`m-0 rounded-xl px-4 py-3 text-sm font-bold ${backupStatus.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`}
          role={backupStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {backupStatus.message}
        </p>
      ) : null}
    </div>
  );
  const managementMenu = (
    <MainManagementMenu
      saving={state?.saveStatus === 'saving' || restorePending}
      dirty={state?.dirty ?? false}
      canExport={state?.applied !== null && state?.applied !== undefined}
      canImport={state?.mode === 'dashboard'}
      canRestart={state?.applied !== null && state?.applied !== undefined}
      importConfirmationOpen={pendingImport !== null}
      importFailureMessage={pendingImport === null || backupStatus?.kind !== 'error'
        ? undefined
        : backupStatus.message}
      onCancel={cancelDraft}
      onRestart={restartSetup}
      onExport={exportCurrentWorkspace}
      onImportFile={prepareWorkspaceImport}
      onCancelImport={cancelWorkspaceImport}
      onConfirmImport={restorePendingImport}
    />
  );

  if (state === null) {
    return (
      <AppContentFrame
        className="grid min-h-dvh place-items-center py-8"
        data-testid="main-page-frame"
      >
        <p className="text-sm font-bold text-slate-600" role="status">자금 계획을 불러오는 중입니다.</p>
      </AppContentFrame>
    );
  }

  if (showIntro) {
    return <MainWelcomeIntro key={introEntry.id} onComplete={() => completeWelcomeIntro(introEntry.id)} />;
  }

  if (state.mode === 'recovery') {
    const original = state.loadError?.original ?? state.draft;
    return (
      <AppShell currentApp="main" managementMenu={managementMenu} statusRegion={backupStatusRegion}>
        <RecoveryView
          state={state}
          onDownload={() => exportRecoveryOriginal(original, state.loadError?.raw)}
          onStartEmpty={startEmptySetup}
          onRetry={apply}
          onDiscard={discardRecoveryCandidate}
          onReturnCurrent={returnToCurrentPlan}
        />
      </AppShell>
    );
  }

  if (state.mode === 'setup' && state.setupStep !== null) {
    const isRestartSetup = state.applied !== null;
    const setupNotice = (
      <>
        {progressWarning === null ? null : (
          <p className="m-0 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">
            {progressWarning}
          </p>
        )}
        {state.saveStatus === 'error' && issues.length === 0 ? (
          <Surface className="mt-3 rounded-xl border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800" role="alert">
            <p className="m-0">저장하지 못했습니다. 입력한 내용은 그대로 보존되어 있습니다.</p>
            <Button
              className="mt-3 rounded-full"
              variant="primary"
              type="button"
              onClick={apply}
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
            draft={state.draft}
            step={state.setupStep}
            issues={issues}
            validationAttempt={validationAttempt}
            saving={state.saveStatus === 'saving'}
            onChange={changeDraft}
            onStepChange={changeSetupStep}
            onApply={apply}
            onCancel={isRestartSetup ? cancelDraft : undefined}
            notice={setupNotice}
            motionPreset="initial-assembly"
          />
        </AppContentFrame>
      </AppShell>
    );
  }

  if (state.applied === null) return null;

  return (
    <AppShell currentApp="main" managementMenu={managementMenu} statusRegion={backupStatusRegion}>
      <SummaryDashboard
        applied={state.applied}
        draft={state.draft}
        dirty={state.dirty}
        issues={issues}
        validationAttempt={validationAttempt}
        saveStatus={state.saveStatus}
        onDraftChange={changeDraft}
        onApply={apply}
        onCancel={cancelDraft}
        backupStatus={progressWarning === null
          ? null
          : { kind: 'error', message: progressWarning }}
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
