import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
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
import type { PortfolioPlan } from '../domain/model';
import { validateApplicableDraft } from '../domain/validation';
import {
  BrowserPortfolioMainSourceRepository,
  type PortfolioMainSourceRepository,
} from '../infrastructure/mainSourceRepository';
import type { InvestmentLocationRepository } from '../infrastructure/locationRepository';
import {
  BrowserPortfolioRepository,
  type PortfolioRepository,
} from '../infrastructure/portfolioRepository';
import { AllocationEditor } from './AllocationEditor';
import { InvestmentLocations } from './InvestmentLocations';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioManagementMenu } from './PortfolioManagementMenu';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioSetupFlow } from './PortfolioSetupFlow';

export function PortfolioApp({
  mainSourceRepository: providedMainRepository,
  repository: providedRepository,
  locationRepository,
  now = Date.now,
}: {
  mainSourceRepository?: PortfolioMainSourceRepository;
  repository?: PortfolioRepository;
  locationRepository?: InvestmentLocationRepository;
  now?: () => number;
}) {
  const mainRepository = useMemo(
    () => providedMainRepository ?? new BrowserPortfolioMainSourceRepository(),
    [providedMainRepository],
  );
  const repository = useMemo(
    () => providedRepository ?? new BrowserPortfolioRepository(),
    [providedRepository],
  );
  const initial = useMemo(
    () => bootstrapPortfolio(mainRepository.load(), repository.load(), now()),
    [mainRepository, repository, now],
  );
  const [state, setState] = useState<PortfolioState | null>(
    initial.kind === 'ready' ? createPortfolioState(initial) : null,
  );
  const stateRef = useRef(state);
  const initialPersistenceStarted = useRef(false);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const latestOperation = useRef(0);

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
    const current = stateRef.current;
    if (current === null) return;
    const next = portfolioReducer(current, action);
    commitState(next);
    if (next.draft === current.draft) return;
    const token = beginOperation();
    enqueuePersistence(
      action.type === 'cancel-edit'
        ? () => repository.clearDraft()
        : () => repository.saveDraft(next.draft),
      (result) => {
        if (token !== latestOperation.current) return;
        dispatchState(result?.status === 'saved'
          ? { type: 'save-succeeded' }
          : action.type === 'cancel-edit'
            ? { type: 'draft-cleanup-failed' }
            : { type: 'save-failed' });
      },
    );
  }

  function apply(): void {
    const current = stateRef.current;
    if (current === null || !validateApplicableDraft(current.draft)) return;
    commitState(portfolioReducer(current, { type: 'apply-started' }));
    const plan = planFromDraft(current.draft, now());
    const token = nextOperationToken();
    enqueuePersistence(async () => {
      const appliedResult = await repository.saveApplied(plan);
      if (appliedResult.status === 'unavailable') return 'failed' as const;
      const clearResult = await repository.clearDraft();
      return clearResult.status === 'saved' ? 'saved' as const : 'cleanup-failed' as const;
    }, (result) => {
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
    if (stateRef.current === null) return;
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
    const run = persistenceQueue.current.then(operation, operation);
    persistenceQueue.current = run.then(() => undefined, () => undefined);
    void run.then(onSettled, () => onSettled(null));
  }

  return (
    <AppShell
      currentApp="portfolio"
      managementMenu={<PortfolioManagementMenu onReset={reset} />}
    >
      <main className="portfolio-shell">
        {initial.kind === 'main-required' ? (
          <RecoveryPanel message="Main 계획에서 투자금을 먼저 설정해 주세요." />
        ) : initial.kind === 'investment-required' ? (
          <InvestmentRequired plan={initial.preservedPlan} />
        ) : initial.kind === 'stale-main' ? (
          <StaleMain plan={initial.plan} />
        ) : state === null ? (
          <RecoveryPanel message="Portfolio를 시작할 수 없습니다." />
        ) : (
          <div className="portfolio-content">
          {state.view === 'setup' && state.setupStep !== null ? (
            <PortfolioSetupFlow
              step={state.setupStep}
              draft={state.draft}
              investmentWon={state.draft.syncedInvestmentWon}
              saveError={state.saveState === 'error'}
              fieldError={state.fieldError}
              onAction={dispatchDraft}
              onPrevious={() => dispatchState({ type: 'setup-previous' })}
              onNext={() => dispatchState({ type: 'setup-next' })}
              onApply={apply}
              now={now}
            />
          ) : state.view === 'result' && state.applied !== null ? (
            <>
              <div className="portfolio-toolbar">
                <span role={state.saveState === 'saved' ? 'status' : 'alert'}>
                  {state.saveState === 'error'
                    ? '저장하지 못했습니다. 다시 시도해 주세요.'
                    : state.saveState === 'cleanup-error'
                      ? '배분은 적용했지만 편집 초안을 정리하지 못했습니다.'
                      : state.saveState === 'saving' ? '저장 중' : '저장됨'}
                </span>
                <Button type="button" variant="primary" onClick={() => dispatchDraft({ type: 'edit-opened' })}>배분 수정</Button>
              </div>
              <PortfolioSummary
                investmentWon={state.applied.syncedInvestmentWon}
                allocation={materializeAllocation(state.applied, state.applied.syncedInvestmentWon)}
              />
              <InvestmentLocations repository={locationRepository} />
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
                draft={state.draft}
                investmentWon={state.draft.syncedInvestmentWon}
                onCancel={() => dispatchDraft({ type: 'cancel-edit' })}
                onApply={apply}
              />
            </>
          )}
          </div>
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
      <div data-testid="portfolio-gated-content" className="portfolio-content portfolio-content--blurred" inert>
        <PortfolioSummary investmentWon={placeholder.syncedInvestmentWon} allocation={materializeAllocation(placeholder, placeholder.syncedInvestmentWon)} />
      </div>
      <div className="portfolio-gate__message">
        <h1 id="portfolio-gate-title">투자금을 먼저 정해 주세요</h1>
        <a href={`${appPath('main')}?edit=investment`}>Main에서 투자금 설정</a>
      </div>
    </section>
  );
}

function StaleMain({ plan }: { plan: PortfolioPlan }) {
  return (
    <div className="portfolio-content">
      <Surface as="aside" className="portfolio-recovery">
        <p role="status">이전 Main 기준</p>
        <p>최신 Main 정보를 불러오지 못했습니다.</p>
        <a href={appPath('portfolio')}>최신 Main 다시 불러오기</a>
        <a href={appPath('main')}>Main 확인하기</a>
      </Surface>
      <PortfolioSummary investmentWon={plan.syncedInvestmentWon} allocation={materializeAllocation(plan, plan.syncedInvestmentWon)} />
    </div>
  );
}

function RecoveryPanel({ message }: { message: string }) {
  return (
    <Surface as="section" className="portfolio-recovery">
      <h1>{message}</h1>
      <a href={`${appPath('main')}?edit=investment`}>Main에서 투자금 설정</a>
    </Surface>
  );
}
