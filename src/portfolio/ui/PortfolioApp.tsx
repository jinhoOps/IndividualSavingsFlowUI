import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { Surface } from '../../components/common/Surface';
import { useDelayedPending } from '../../components/feedback/useDelayedPending';
import { appPath } from '../../journey/routes';
import { bootstrapPortfolio } from '../application/bootstrap';
import {
  createPortfolioState,
  planFromDraft,
  portfolioReducer,
  type PortfolioAction,
  type PortfolioState,
} from '../application/portfolioReducer';
import { materializeAllocation } from '../domain/allocation';
import {
  DEFAULT_PORTFOLIO_VIEW_PREFERENCES,
  type PortfolioPlan,
  type PortfolioViewPreferences,
} from '../domain/model';
import { parsePortfolioDraft, validateApplicableDraft } from '../domain/validation';
import {AccountDraftContext, useAccountRecovery, useInitialRecovery} from '../../auth/AccountDraftContext';
import {
  BrowserPortfolioMainSourceRepository,
  type PortfolioMainSourceRepository,
} from '../infrastructure/mainSourceRepository';
import {
  BrowserPortfolioRepository,
  type PortfolioRepository,
  type PortfolioWriteResult,
} from '../infrastructure/portfolioRepository';
import {
  BrowserPortfolioPreferencesRepository,
  type PortfolioPreferencesRepository,
} from '../infrastructure/portfolioPreferencesRepository';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioEditSurface } from './PortfolioEditSurface';
import { PortfolioManagementMenu } from './PortfolioManagementMenu';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioSetupFlow } from './PortfolioSetupFlow';

export function PortfolioApp({
  mainSourceRepository: providedMainRepository,
  repository: providedRepository,
  preferencesRepository: providedPreferencesRepository,
  now = Date.now,
}: {
  mainSourceRepository?: PortfolioMainSourceRepository;
  repository?: PortfolioRepository;
  preferencesRepository?: PortfolioPreferencesRepository;
  now?: () => number;
}) {
  const accountSession = useContext(AccountDraftContext);
  const autosaveDebounceMs = accountSession === null ? 0 : 500;
  const mainRepository = useMemo(
    () => providedMainRepository ?? new BrowserPortfolioMainSourceRepository(),
    [providedMainRepository],
  );
  const repository = useMemo(
    () => providedRepository ?? new BrowserPortfolioRepository(),
    [providedRepository],
  );
  const preferencesRepository = useMemo(
    () => providedPreferencesRepository ?? new BrowserPortfolioPreferencesRepository(),
    [providedPreferencesRepository],
  );
  const initial = useMemo(
    () => bootstrapPortfolio(mainRepository.load(), repository.load(), now()),
    [mainRepository, repository, now],
  );
  const recovered = useInitialRecovery('portfolio', parsePortfolioDraft);
  const [state, setState] = useState<PortfolioState | null>(() => {
    if (initial.kind !== 'ready') return null;
    const normal = createPortfolioState(initial);
    return recovered ? {...normal, draft: recovered, dirty: true, view: normal.applied ? 'edit' : 'setup', saveState: 'error'} : normal;
  });
  useAccountRecovery('portfolio', state?.draft, state?.saveState !== 'saved' && state?.dirty === true, state !== null);
  const stateRef = useRef(state);
  const initialPersistenceStarted = useRef(recovered !== null);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferedAutosave = useRef<{
    operation: () => Promise<PortfolioWriteResult>;
    onSettled: (result: PortfolioWriteResult | null) => void;
  } | null>(null);
  const mounted = useRef(false);
  const latestOperation = useRef(0);
  const applyOperationRef = useRef<number | null>(null);
  const applyPendingRef = useRef(false);
  const [applyPending, setApplyPending] = useState(false);
  const [preferences, setPreferences] = useState<PortfolioViewPreferences>(
    () => preferencesRepository.load(),
  );
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const delayedApply = useDelayedPending(applyPending, 600);
  const delayedAutomaticSaving = useDelayedPending(
    state?.saveState === 'saving' && !applyPending,
    600,
  );
  const showSaving = applyPending ? delayedApply : delayedAutomaticSaving;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void Promise.resolve().then(() => {
        if (mounted.current || autosaveTimer.current === null) return;
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
        bufferedAutosave.current = null;
      });
    };
  }, []);

  useEffect(() => {
    if (initial.kind !== 'ready') return;
    if (!initial.shouldPersistDraft && !initial.shouldPersistApplied) return;
    if (initialPersistenceStarted.current) return;
    initialPersistenceStarted.current = true;
    const token = beginOperation();
    enqueuePersistence(async () => {
      if (initial.shouldPersistDraft) {
        const draftResult = await repository.saveDraft(initial.draft);
        if (draftResult.status === 'unavailable') return 'failed' as const;
      }
      if (initial.shouldPersistApplied && initial.plan !== null) {
        const appliedResult = await repository.saveApplied(initial.plan);
        if (appliedResult.status === 'unavailable') return 'failed' as const;
      }
      return 'saved' as const;
    }, (result) => {
      if (token !== latestOperation.current) return;
      dispatchState({ type: result === 'saved' ? 'save-succeeded' : 'save-failed' });
    });
  }, [initial, repository]);

  function dispatchDraft(action: PortfolioAction): void {
    if (applyPendingRef.current) return;
    const current = stateRef.current;
    if (current === null) return;
    const next = portfolioReducer(current, action);
    commitState(next);
    if (next.draft === current.draft) return;
    const token = beginOperation();
    const operation = action.type === 'cancel-edit'
      ? () => repository.clearDraft()
      : () => repository.saveDraft(next.draft);
    const onSettled = (result: PortfolioWriteResult | null) => {
      if (token !== latestOperation.current) return;
      dispatchState(result?.status === 'saved'
        ? { type: 'save-succeeded' }
        : action.type === 'cancel-edit'
          ? { type: 'draft-cleanup-failed' }
          : { type: 'save-failed' });
    };
    if (action.type === 'cancel-edit') {
      flushAutosave();
      enqueuePersistence(operation, onSettled);
    } else {
      queueAutosave(operation, onSettled);
    }
  }

  function apply(): void {
    const current = stateRef.current;
    if (
      current === null
      || applyPendingRef.current
      || !validateApplicableDraft(current.draft)
    ) return;
    flushAutosave();
    applyPendingRef.current = true;
    setApplyPending(true);
    commitState(portfolioReducer(current, { type: 'apply-started' }));
    const plan = planFromDraft(current.draft, now());
    const token = nextOperationToken();
    applyOperationRef.current = token;
    enqueuePersistence(async () => {
      const appliedResult = await repository.saveApplied(plan);
      if (appliedResult.status === 'unavailable') return 'failed' as const;
      const clearResult = await repository.clearDraft();
      return clearResult.status === 'saved' ? 'saved' as const : 'cleanup-failed' as const;
    }, (result) => {
      if (applyOperationRef.current !== token) return;
      applyOperationRef.current = null;
      applyPendingRef.current = false;
      setApplyPending(false);
      if (token !== latestOperation.current) return;
      if (result === 'failed' || result === null) {
        dispatchState({ type: 'save-failed' });
        return;
      }
      dispatchState({ type: 'apply-succeeded', plan });
      if (result === 'cleanup-failed') dispatchState({ type: 'draft-cleanup-failed' });
    });
  }

  function reset(): void {
    if (stateRef.current === null || applyPendingRef.current) return;
    flushAutosave();
    const token = beginOperation();
    enqueuePersistence(
      () => repository.clearScope({ type: 'aggregate' }),
      (result) => {
        if (token !== latestOperation.current) return;
        if (result?.status !== 'saved') {
          dispatchState({ type: 'save-failed' });
          return;
        }
        dispatchState({ type: 'reset-confirmed', now: now() });
      },
    );
  }

  function commitState(next: PortfolioState | null): void {
    stateRef.current = next;
    setState(next);
  }

  function dispatchState(action: PortfolioAction): void {
    const current = stateRef.current;
    if (current === null) return;
    commitState(portfolioReducer(current, action));
  }

  function nextOperationToken(): number {
    latestOperation.current += 1;
    return latestOperation.current;
  }

  function beginOperation(): number {
    const token = nextOperationToken();
    dispatchState({ type: 'save-started' });
    return token;
  }

  function enqueuePersistence<T>(
    operation: () => Promise<T>,
    onSettled: (result: T | null) => void,
  ): void {
    const run = persistenceQueue.current.then(
      () => mounted.current ? operation() : null,
      () => mounted.current ? operation() : null,
    );
    persistenceQueue.current = run.then(() => undefined, () => undefined);
    void run.then(
      (result) => { if (mounted.current) onSettled(result); },
      () => { if (mounted.current) onSettled(null); },
    );
  }

  function queueAutosave(
    operation: () => Promise<PortfolioWriteResult>,
    onSettled: (result: PortfolioWriteResult | null) => void,
  ): void {
    if (autosaveDebounceMs <= 0) {
      enqueuePersistence(operation, onSettled);
      return;
    }
    bufferedAutosave.current = { operation, onSettled };
    if (autosaveTimer.current !== null) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(flushAutosave, autosaveDebounceMs);
  }

  function flushAutosave(): void {
    if (autosaveTimer.current !== null) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const buffered = bufferedAutosave.current;
    bufferedAutosave.current = null;
    if (buffered !== null && mounted.current) {
      enqueuePersistence(buffered.operation, buffered.onSettled);
    }
  }

  function updatePreferences(next: PortfolioViewPreferences): void {
    setPreferences(next);
    preferencesRepository.save(next);
  }

  return (
    <AppShell
      currentApp="portfolio"
      managementMenu={(
        <PortfolioManagementMenu
          onReset={reset}
          preferences={preferences}
          onPreferencesChange={updatePreferences}
        />
      )}
    >
      <main className="portfolio-shell">
        {initial.kind === 'main-required' ? (
          <RecoveryPanel reason={initial.reason} />
        ) : initial.kind === 'investment-required' ? (
          <InvestmentRequired plan={initial.preservedPlan} />
        ) : initial.kind === 'stale-main' ? (
          <StaleMain plan={initial.plan} preferences={preferences} />
        ) : state === null ? (
          <RecoveryPanel reason="unavailable" />
        ) : (
          <AppContentFrame
            as="div"
            className="portfolio-content"
            data-testid="portfolio-page-frame"
          >
          {state.view === 'setup' && state.setupStep !== null ? (
            <PortfolioSetupFlow
              step={state.setupStep}
              draft={state.draft}
              investmentWon={state.draft.syncedInvestmentWon}
              saveError={state.saveState === 'error'}
              applying={applyPending}
              showSaving={showSaving}
              fieldError={state.fieldError}
              onAction={dispatchDraft}
              onPrevious={() => dispatchState({ type: 'setup-previous' })}
              onNext={() => dispatchState({ type: 'setup-next' })}
              onApply={apply}
              now={now}
            />
          ) : state.applied !== null ? (
            <>
              <div
                data-testid="portfolio-result-controls"
                inert={state.view === 'edit' ? true : undefined}
                aria-hidden={state.view === 'edit' ? 'true' : undefined}
              >
                {state.saveState === 'error' || state.saveState === 'cleanup-error' ? (
                  <p role="alert" className="portfolio-summary-error">
                    {state.saveState === 'error'
                      ? '저장하지 못했습니다. 다시 시도해 주세요.'
                      : '배분은 적용했지만 편집 초안을 정리하지 못했습니다.'}
                  </p>
                ) : null}
                <PortfolioSummary
                  investmentWon={state.applied.syncedInvestmentWon}
                  allocation={materializeAllocation(state.applied, state.applied.syncedInvestmentWon)}
                  preferences={preferences}
                  onEdit={(event) => {
                    editTriggerRef.current = event.currentTarget;
                    dispatchState({ type: 'edit-opened' });
                  }}
                />
              </div>
              {state.view === 'edit' ? (
                <PortfolioEditSurface
                  draft={state.draft}
                  investmentWon={state.draft.syncedInvestmentWon}
                  dirty={state.dirty}
                  saveError={state.saveState === 'error'}
                  applying={applyPending}
                  showSaving={showSaving}
                  fieldError={state.fieldError}
                  returnFocusRef={editTriggerRef}
                  onAction={dispatchDraft}
                  onCancel={() => dispatchDraft({ type: 'cancel-edit' })}
                  onApply={apply}
                  showAmounts={preferences.showAmounts}
                  now={now}
                />
              ) : null}
            </>
          ) : (
            <>
              <AllocationEditor
                draft={state.draft}
                investmentWon={state.draft.syncedInvestmentWon}
                onAction={dispatchDraft}
                now={now}
                fieldError={state.fieldError}
              />
              <PortfolioApplyBar
                dirty={state.dirty || state.applied === null}
                saveError={state.saveState === 'error'}
                applying={applyPending}
                showAmounts={preferences.showAmounts}
                draft={state.draft}
                investmentWon={state.draft.syncedInvestmentWon}
                onCancel={() => dispatchDraft({ type: 'cancel-edit' })}
                onApply={apply}
              />
            </>
          )}
          </AppContentFrame>
        )}
      </main>
    </AppShell>
  );
}

function InvestmentRequired({ plan }: { plan: PortfolioPlan | null }) {
  const placeholder = plan ?? {
    schemaVersion: 2 as const,
    scope: { type: 'aggregate' } as const,
    items: [],
    cashShareUnits: 1_000_000,
    cashMode: 'automatic' as const,
    syncedInvestmentWon: 0,
    appliedAt: 0,
    updatedAt: 0,
  };
  return (
    <section className="portfolio-gate" aria-labelledby="portfolio-gate-title">
      <AppContentFrame
        as="div"
        data-testid="portfolio-page-frame"
        className="portfolio-gate__frame"
      >
        <div className="portfolio-content portfolio-content--blurred" inert>
          <PortfolioSummary
            investmentWon={placeholder.syncedInvestmentWon}
            allocation={materializeAllocation(placeholder, placeholder.syncedInvestmentWon)}
            preferences={DEFAULT_PORTFOLIO_VIEW_PREFERENCES}
          />
        </div>
        <div className="portfolio-gate__message">
          <h1 id="portfolio-gate-title">투자금을 먼저 정해 주세요</h1>
          <a className="ui-button ui-button--primary" href={`${appPath('main')}?edit=investment`}>Main에서 투자금 설정</a>
        </div>
      </AppContentFrame>
    </section>
  );
}

function StaleMain({
  plan,
  preferences,
}: {
  plan: PortfolioPlan;
  preferences: PortfolioViewPreferences;
}) {
  return (
    <AppContentFrame
      as="div"
      className="portfolio-content"
      data-testid="portfolio-page-frame"
    >
      <Surface as="aside" className="portfolio-recovery">
        <p role="status">이전 Main 기준</p>
        <p>최신 Main 정보를 불러오지 못했습니다.</p>
        <div className="portfolio-recovery__actions">
          <a className="ui-button ui-button--primary" href={appPath('portfolio')}>최신 Main 다시 불러오기</a>
          <a className="ui-button ui-button--secondary" href={appPath('main')}>Main 확인하기</a>
        </div>
      </Surface>
      <PortfolioSummary
        investmentWon={plan.syncedInvestmentWon}
        allocation={materializeAllocation(plan, plan.syncedInvestmentWon)}
        preferences={preferences}
      />
    </AppContentFrame>
  );
}

function RecoveryPanel({ reason }: { reason: 'empty' | 'invalid' | 'unavailable' }) {
  const recovery = reason === 'empty' ? {
    title: 'Main 계획에서 투자금을 먼저 설정해 주세요.',
    description: '자금 흐름에서 월 투자금을 정하면 배분을 시작할 수 있어요.',
    href: `${appPath('main')}?edit=investment`,
    action: 'Main에서 투자금 설정',
  } : reason === 'invalid' ? {
    title: '저장된 데이터를 확인해 주세요',
    description: '현재 데이터는 변경하지 않았어요. 자금 흐름에서 백업으로 복구할 수 있어요.',
    href: appPath('main'),
    action: '자금 흐름에서 복구하기',
  } : {
    title: '저장소를 불러오지 못했어요',
    description: '브라우저 저장소를 사용할 수 있는지 확인한 뒤 다시 불러와 주세요.',
    href: appPath('portfolio'),
    action: '다시 불러오기',
  };
  return (
    <AppContentFrame
      as="section"
      className="ui-surface portfolio-recovery"
      data-testid="portfolio-page-frame"
    >
      <h1>{recovery.title}</h1>
      <p>{recovery.description}</p>
      <div className="portfolio-recovery__actions">
        <a className="ui-button ui-button--primary" href={recovery.href}>{recovery.action}</a>
      </div>
    </AppContentFrame>
  );
}
