import { useEffect, useState } from 'react';
import { applyDraft, bootstrapMain, type ValidationIssue } from '../application/bootstrap';
import { mainReducer, type MainAction, type MainState } from '../application/mainReducer';
import { calculateCashflow } from '../domain/cashflow';
import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import { exportRecoveryData } from '../infrastructure/backup';
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
    if (state?.mode === 'setup' && state.setupStep !== null) {
      repository.saveSetupProgress(state.setupStep, draft);
    }
    setIssues([]);
    dispatch({ type: 'replace-draft', draft });
  }

  function changeSetupStep(step: SetupStep) {
    if (state !== null) repository.saveSetupProgress(step, state.draft);
    setIssues([]);
    dispatch({ type: 'set-setup-step', step });
  }

  async function apply() {
    if (state === null || state.saveStatus === 'saving') return;

    dispatch({ type: 'save-started' });
    const result = await applyDraft(state, repository);
    if (result.ok) {
      repository.clearSetupProgress();
      setIssues([]);
      dispatch({ type: 'save-succeeded', data: result.data });
      return;
    }

    if (result.kind === 'validation') {
      setIssues(result.issues);
      setValidationAttempt((attempt) => attempt + 1);
      if (state.mode === 'setup') {
        const step = setupStepForIssue(result.issues[0]?.path);
        if (step !== null) dispatch({ type: 'set-setup-step', step });
      }
      dispatch({ type: 'save-failed' });
      return;
    }

    dispatch({ type: 'save-failed' });
  }

  function cancelDraft() {
    repository.clearSetupProgress();
    setIssues([]);
    dispatch({ type: 'cancel-draft' });
  }

  function restartSetup() {
    setIssues([]);
    dispatch({ type: 'restart-setup' });
  }

  function startEmptySetup() {
    repository.clearSetupProgress();
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
      />
    );
  }

  if (state.mode === 'setup' && state.setupStep !== null) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        {state.applied !== null ? (
          <div className="mb-4 flex justify-end">
            <button
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-400"
              type="button"
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
    />
  );
}

interface RecoveryViewProps {
  state: MainState;
  onDownload(): void;
  onStartEmpty(): void;
}

function RecoveryView({ state, onDownload, onStartEmpty }: RecoveryViewProps) {
  const currentIncome = state.applied === null ? null : calculateCashflow(state.applied).incomeWon;
  const pendingIncome = calculateCashflow(state.draft).incomeWon;

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
          <button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white" type="button" onClick={onStartEmpty}>
            빈 초안으로 다시 시작
          </button>
        </div>
      </section>
    </main>
  );
}

function setupStepForIssue(path: string | undefined): SetupStep | null {
  if (path === undefined) return null;
  if (path === 'incomes' || path.startsWith('incomes.')) return 'income';
  if (path.startsWith('expenses.')) return 'expense';
  if (path.startsWith('savings.') || path.startsWith('investments.')) return 'saving-investment';
  if (path.startsWith('accounts.')) return 'account';
  return null;
}

function downloadRecovery(original: unknown) {
  const blob = new Blob([exportRecoveryData(original)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'individual-savings-flow-recovery.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
