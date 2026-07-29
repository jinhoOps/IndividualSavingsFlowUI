import { useEffect, useRef, useState } from 'react';
import { applyDraft, bootstrapMain, type ValidationIssue } from '../application/bootstrap';
import { mainReducer, type MainAction, type MainState } from '../application/mainReducer';
import { calculateCashflow } from '../domain/cashflow';
import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import { exportMainData, exportRecoveryData, importMainData } from '../infrastructure/backup';
import { BrowserMainRepository, type MainRepository } from '../infrastructure/mainRepository';
import { formatDashboardWon } from './dashboard/CashflowSummary';
import { SummaryDashboard } from './dashboard/SummaryDashboard';
import { SetupFlow } from './setup/SetupFlow';

export interface MainAppProps {
  repository?: MainRepository;
}

const browserRepository = new BrowserMainRepository();

export function MainApp({ repository = browserRepository }: MainAppProps) {
  const [state, setState] = useState<MainState | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [backupStatus, setBackupStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void bootstrapMain(repository).then((loaded) => {
      if (active) setState(loaded);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  function dispatch(action: MainAction) {
    setState((current) => current === null ? current : mainReducer(current, action));
  }

  function changeDraft(draft: MainData) {
    if (savingRef.current) return;
    if (state?.mode === 'setup' && state.setupStep !== null) {
      persistSetupProgress(state.setupStep, draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'replace-draft', draft });
  }

  function changeSetupStep(step: SetupStep) {
    if (savingRef.current) return;
    if (state !== null) {
      persistSetupProgress(step, state.draft, state.applied === null ? 'initial' : 'restart');
    }
    setIssues([]);
    dispatch({ type: 'set-setup-step', step });
  }

  async function apply() {
    if (state === null || savingRef.current) return;

    savingRef.current = true;
    dispatch({ type: 'save-started' });
    try {
      const result = await applyDraft(state, repository);
      if (result.ok) {
        clearSetupProgress();
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

  function cancelDraft() {
    if (savingRef.current) return;
    repository.discardPending();
    clearSetupProgress();
    setIssues([]);
    setBackupStatus(null);
    dispatch({ type: 'cancel-draft' });
  }

  function restartSetup() {
    if (state === null || state.applied === null || savingRef.current) return;
    persistSetupProgress('welcome', state.applied, 'restart');
    setIssues([]);
    dispatch({ type: 'restart-setup' });
  }

  function startEmptySetup() {
    repository.discardPending(state?.mode === 'recovery' ? state.draft.updatedAt : undefined);
    clearSetupProgress();
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

  function discardRecoveryCandidate() {
    if (state === null || state.mode !== 'recovery' || savingRef.current) return;
    repository.discardRecovery(state.draft.updatedAt);
    repository.discardPending(state.draft.updatedAt);
    clearSetupProgress();
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

  function returnToCurrentPlan() {
    if (state === null || state.mode !== 'recovery' || state.applied === null || savingRef.current) return;
    repository.discardRecovery(state.draft.updatedAt);
    repository.discardPending(state.draft.updatedAt);
    clearSetupProgress();
    setIssues([]);
    dispatch({ type: 'cancel-draft' });
  }

  function persistSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind: 'initial' | 'restart',
  ) {
    try {
      repository.saveSetupProgress(step, draft, kind);
      setProgressWarning(null);
    } catch {
      setProgressWarning('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.');
    }
  }

  function clearSetupProgress() {
    try {
      repository.clearSetupProgress();
      setProgressWarning(null);
    } catch {
      setProgressWarning('설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.');
    }
  }

  async function importBackup(file: File) {
    if (state === null || savingRef.current) return;
    try {
      const imported = importMainData(await readFileText(file));
      setIssues([]);
      setBackupStatus({ kind: 'success', message: '백업을 초안으로 불러왔습니다. 적용해야 저장됩니다.' });
      dispatch({ type: 'replace-draft', draft: imported });
    } catch {
      setBackupStatus({ kind: 'error', message: '백업 파일을 불러오지 못했습니다. 올바른 JSON 백업인지 확인해 주세요.' });
    }
  }

  function exportAppliedBackup() {
    if (state?.applied === null || state?.applied === undefined) return;
    downloadJson(exportMainData(state.applied), 'individual-savings-flow-main.json');
  }

  if (state === null) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <p className="text-sm font-bold text-slate-600" role="status">자금 계획을 불러오는 중입니다.</p>
      </main>
    );
  }

  if (state.mode === 'recovery') {
    const original = state.loadError?.original ?? state.draft;
    return (
      <RecoveryView
        state={state}
        onDownload={() => downloadRecovery(original)}
        onStartEmpty={startEmptySetup}
        onRetry={apply}
        onDiscard={discardRecoveryCandidate}
        onReturnCurrent={returnToCurrentPlan}
      />
    );
  }

  if (state.mode === 'setup' && state.setupStep !== null) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        {progressWarning === null ? null : (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">
            {progressWarning}
          </p>
        )}
        {state.applied !== null ? (
          <div className="mb-4 flex justify-end">
            <button
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-400"
              type="button"
              disabled={state.saveStatus === 'saving'}
              onClick={cancelDraft}
            >
              취소
            </button>
          </div>
        ) : null}
        <SetupFlow
          draft={state.draft}
          step={state.setupStep}
          issues={issues}
          validationAttempt={validationAttempt}
          saving={state.saveStatus === 'saving'}
          onChange={changeDraft}
          onStepChange={changeSetupStep}
          onApply={apply}
        />
      </main>
    );
  }

  if (state.applied === null) return null;

  return (
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
      onRestart={restartSetup}
      onExport={exportAppliedBackup}
      onImportFile={importBackup}
      backupStatus={backupStatus}
    />
  );
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
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-xl shadow-amber-950/5 sm:p-10" aria-labelledby="recovery-title">
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
          <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800" type="button" onClick={onDownload}>
            기존 원본 JSON 다운로드
          </button>
          {hasRecoveryCandidate ? (
            <>
              <button
                className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-60"
                type="button"
                disabled={saving}
                onClick={onRetry}
              >
                {saving ? '저장 중' : '저장 다시 시도'}
              </button>
              <button
                className="rounded-xl border border-rose-200 bg-white px-4 py-3 font-bold text-rose-700 disabled:opacity-60"
                type="button"
                disabled={saving}
                onClick={onDiscard}
              >
                복구 초안 버리기
              </button>
              {state.applied === null ? null : (
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 disabled:opacity-60"
                  type="button"
                  disabled={saving}
                  onClick={onReturnCurrent}
                >
                  현재 계획으로 돌아가기
                </button>
              )}
            </>
          ) : (
            <button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white" type="button" onClick={onStartEmpty}>
              빈 초안으로 다시 시작
            </button>
          )}
        </div>
        {state.saveStatus === 'error' ? (
          <p className="mt-4 text-sm font-bold text-rose-700" role="alert">
            저장하지 못했습니다. 초안은 그대로 보존되어 있습니다. 다시 시도해 주세요.
          </p>
        ) : null}
      </section>
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

function downloadRecovery(original: unknown) {
  downloadJson(exportRecoveryData(original), 'individual-savings-flow-recovery.json');
}

function downloadJson(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Backup file could not be read.'));
    reader.readAsText(file);
  });
}
