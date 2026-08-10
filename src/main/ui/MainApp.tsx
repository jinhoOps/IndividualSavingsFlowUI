import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { applyDraft, bootstrapMain, type ValidationIssue } from '../application/bootstrap';
import { mainReducer, type MainAction, type MainState } from '../application/mainReducer';
import { calculateCashflow } from '../domain/cashflow';
import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import { exportRecoveryData } from '../infrastructure/backup';
import { BrowserMainRepository, type MainRepository } from '../infrastructure/mainRepository';
import { appPath } from '../../journey/routes';
import { JourneyEntryCard } from '../../journey/ui/JourneyEntryCard';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
} from '../../workspace/infrastructure/workspaceBackup';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';
import { Button } from './common/Button';
import { Surface } from './common/Surface';
import { formatDashboardWon } from './dashboard/CashflowSummary';
import { SummaryDashboard } from './dashboard/SummaryDashboard';
import { MainManagementMenu } from './MainManagementMenu';
import { SetupFlow } from './setup/SetupFlow';

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
  const [state, setState] = useState<MainState | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [backupStatus, setBackupStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<WorkspaceDocument | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const progressWriteTailRef = useRef<Promise<void>>(Promise.resolve());
  const importSelectionRef = useRef(0);
  const restoreFocusRequestedRef = useRef(false);
  const savingRef = useRef(false);
  const [initialEditPath] = useState<keyof MainData | undefined>(() => consumeEditIntent());

  useEffect(() => {
    let active = true;
    void bootstrapMain(repository).then((loaded) => {
      if (active) setState(loaded);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!restoreFocusRequestedRef.current || backupStatus?.kind !== 'success') return;
    restoreFocusRequestedRef.current = false;
    const target = document.querySelector<HTMLElement>('[aria-label="관리 메뉴"]')
      ?? document.querySelector<HTMLElement>('[data-setup-heading]')
      ?? document.querySelector<HTMLElement>([
        '[aria-label="설정 단계"] button:not(:disabled)',
        '[aria-label="설정 단계"] input:not(:disabled)',
        '[aria-label="설정 단계"] [tabindex]:not([tabindex="-1"])',
      ].join(', '));
    target?.focus();
  }, [backupStatus, state]);

  function dispatch(action: MainAction) {
    setState((current) => current === null ? current : mainReducer(current, action));
  }

  function changeDraft(draft: MainData) {
    if (savingRef.current) return;
    if (state?.mode === 'setup' && state.setupStep !== null) {
      void persistSetupProgress(state.setupStep, draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'replace-draft', draft });
  }

  function changeSetupStep(step: SetupStep) {
    if (savingRef.current) return;
    if (state !== null) {
      void persistSetupProgress(step, state.draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'set-setup-step', step });
  }

  async function apply() {
    if (state === null || savingRef.current) return;

    savingRef.current = true;
    dispatch({ type: 'save-started' });
    try {
      await progressWriteTailRef.current;
      const result = await applyDraft(state, repository);
      if (result.ok) {
        await clearSetupProgress();
        setIssues([]);
        setBackupStatus(null);
        dispatch({ type: 'save-succeeded', data: result.data });
        return;
      }

      if (result.kind === 'validation') {
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
      savingRef.current = false;
    }
  }

  async function cancelDraft() {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      if (!await clearSetupProgress()) return;
      setIssues([]);
      setBackupStatus(null);
      dispatch({ type: 'cancel-draft' });
    } finally {
      savingRef.current = false;
    }
  }

  function restartSetup() {
    if (state === null || state.applied === null || savingRef.current) return;
    void persistSetupProgress('welcome', state.applied, 'restart');
    setIssues([]);
    dispatch({ type: 'restart-setup' });
  }

  async function startEmptySetup() {
    if (state === null || savingRef.current) return;
    savingRef.current = true;
    dispatch({ type: 'save-started' });
    try {
      if (state.mode === 'recovery' && state.loadError?.raw !== undefined) {
        await repository.resetInvalidWorkspace(state.loadError.raw);
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
      savingRef.current = false;
    }
  }

  async function discardRecoveryCandidate() {
    if (state === null || state.mode !== 'recovery' || savingRef.current) return;
    savingRef.current = true;
    const cleared = await clearSetupProgress();
    savingRef.current = false;
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
    if (state === null || state.mode !== 'recovery' || state.applied === null || savingRef.current) return;
    savingRef.current = true;
    const cleared = await clearSetupProgress();
    savingRef.current = false;
    if (!cleared) return;
    setIssues([]);
    dispatch({ type: 'cancel-draft' });
  }

  function persistSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind: 'initial' | 'restart',
  ): Promise<boolean> {
    return queueProgressWrite(
      () => repository.saveSetupProgress(step, draft, kind),
      '설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.',
    );
  }

  function clearSetupProgress(): Promise<boolean> {
    return queueProgressWrite(
      () => repository.clearSetupProgress(),
      '설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.',
    );
  }

  function queueProgressWrite(
    operation: () => Promise<void>,
    failureMessage: string,
  ): Promise<boolean> {
    const attempted = progressWriteTailRef.current.then(operation);
    const handled = attempted.then(
      () => {
        setProgressWarning(null);
        return true;
      },
      () => {
        setProgressWarning(failureMessage);
        return false;
      },
    );
    progressWriteTailRef.current = handled.then(() => undefined);
    return handled;
  }

  async function prepareWorkspaceImport(file: File) {
    if (state === null || state.mode !== 'dashboard' || savingRef.current) return;
    const selection = importSelectionRef.current + 1;
    importSelectionRef.current = selection;
    try {
      const imported = importWorkspaceBackup(await readFileText(file));
      if (selection !== importSelectionRef.current) return;
      setIssues([]);
      setBackupStatus(null);
      setPendingImport(imported);
    } catch (error) {
      if (selection !== importSelectionRef.current) return;
      setPendingImport(null);
      setBackupStatus({ kind: 'error', message: importFailureMessage(error) });
    }
  }

  async function restoreWorkspaceBackup(): Promise<boolean> {
    if (pendingImport === null || savingRef.current) return false;
    savingRef.current = true;
    setRestorePending(true);
    try {
      const loaded = workspaceRepository.load();
      if (loaded.status === 'invalid') {
        return failRestore('현재 저장된 workspace를 먼저 복구해야 합니다. 현재 데이터는 바뀌지 않았습니다.');
      }
      if (loaded.status === 'unavailable') {
        return failRestore('저장소를 사용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.');
      }

      const result = await workspaceRepository.replace(loaded.workspace.revision, pendingImport);
      if (result.status === 'conflict') {
        return failRestore('다른 탭에서 데이터가 변경되었습니다. 현재 데이터는 바뀌지 않았습니다.');
      }
      if (result.status === 'invalid') {
        return failRestore('백업의 앱 데이터를 적용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다.');
      }
      if (result.status === 'unavailable') {
        return failRestore('백업을 저장하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.');
      }

      const reloaded = await bootstrapMain(repository);
      restoreFocusRequestedRef.current = true;
      setIssues([]);
      setProgressWarning(null);
      setPendingImport(null);
      setState(reloaded);
      setBackupStatus({ kind: 'success', message: '모든 앱 데이터를 백업에서 복원했습니다.' });
      return true;
    } catch {
      return failRestore('백업을 복원하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setRestorePending(false);
    }
  }

  function failRestore(message: string): false {
    setBackupStatus({ kind: 'error', message });
    return false;
  }

  function exportCurrentWorkspace() {
    const loaded = workspaceRepository.load();
    if (loaded.status === 'invalid') {
      setBackupStatus({
        kind: 'error',
        message: '현재 저장된 workspace를 먼저 복구해야 백업할 수 있습니다.',
      });
      return;
    }
    if (loaded.status === 'unavailable') {
      setBackupStatus({ kind: 'error', message: '저장소를 사용할 수 없어 백업하지 못했습니다.' });
      return;
    }
    const downloaded = downloadJson(
      exportWorkspaceBackup(loaded.workspace),
      'individual-savings-flow-workspace.json',
    );
    setBackupStatus(downloaded
      ? { kind: 'success', message: '모든 앱 데이터 백업을 내보냈습니다.' }
      : {
        kind: 'error',
        message: '백업 파일을 다운로드하지 못했습니다. 브라우저 다운로드 설정을 확인하고 다시 시도해 주세요.',
      });
  }

  function exportRecoveryOriginal(original: unknown, raw?: string) {
    const downloaded = downloadRecovery(original, raw);
    setBackupStatus(downloaded
      ? { kind: 'success', message: '기존 원본 JSON을 다운로드했습니다.' }
      : {
        kind: 'error',
        message: '원본 JSON을 다운로드하지 못했습니다. 브라우저 다운로드 설정을 확인하고 다시 시도해 주세요.',
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
      onCancelImport={() => setPendingImport(null)}
      onConfirmImport={restoreWorkspaceBackup}
    />
  );

  if (state === null) {
    return (
      <AppShell currentApp="main" managementMenu={managementMenu} statusRegion={backupStatusRegion}>
        <main className="grid min-h-dvh place-items-center px-6">
          <p className="text-sm font-bold text-slate-600" role="status">자금 계획을 불러오는 중입니다.</p>
        </main>
      </AppShell>
    );
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
        <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
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
        />
        </main>
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
    <main className="grid min-h-dvh place-items-center px-5 py-10">
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
    </main>
  );
}

export function setupStepForIssue(path: string | undefined): SetupStep | null {
  if (path === undefined) return null;
  if (path === 'monthlyNetIncomeWon') return 'income';
  if (path === 'monthlyHousingWon') return 'housing';
  if (path === 'monthlyLivingWon') return 'living';
  if (path === 'monthlySavingWon' || path === 'monthlyInvestmentWon') return 'saving-investment';
  return null;
}

function downloadRecovery(original: unknown, raw?: string): boolean {
  return downloadJson(
    raw ?? exportRecoveryData(original),
    'individual-savings-flow-recovery.json',
  );
}

function downloadJson(contents: string, filename: string): boolean {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    const blob = new Blob([contents], { type: 'application/json' });
    url = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    anchor?.remove();
    if (url !== null) {
      const objectUrl = url;
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Download already settled; URL cleanup failure must not change its reported result.
        }
      }, 0);
    }
  }
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Backup file could not be read.'));
    reader.readAsText(file);
  });
}

function importFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '백업 파일을 읽지 못했습니다. 현재 데이터는 바뀌지 않았습니다.';
  }
  switch (error.message) {
    case 'backup-json':
      return '백업 JSON을 읽을 수 없습니다. 현재 데이터는 바뀌지 않았습니다.';
    case 'backup-format':
      return '새 전체 workspace 백업 파일만 가져올 수 있습니다. 현재 데이터는 바뀌지 않았습니다.';
    case 'backup-reference':
      return '백업의 앱 연결 정보가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.';
    case 'backup-schema':
      return '백업의 앱 데이터가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.';
    default:
      return '백업 파일을 읽지 못했습니다. 현재 데이터는 바뀌지 않았습니다.';
  }
}

function navigateTo(href: string): void {
  window.location.assign(href);
}
