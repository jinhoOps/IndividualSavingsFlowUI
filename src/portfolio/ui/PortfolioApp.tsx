import { useEffect, useMemo, useState } from 'react';
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
import {
  BrowserPortfolioRepository,
  type PortfolioRepository,
} from '../infrastructure/portfolioRepository';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioManagementMenu } from './PortfolioManagementMenu';
import { PortfolioSummary } from './PortfolioSummary';

export function PortfolioApp({
  mainSourceRepository: providedMainRepository,
  repository: providedRepository,
  now = Date.now,
}: {
  mainSourceRepository?: PortfolioMainSourceRepository;
  repository?: PortfolioRepository;
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

  useEffect(() => {
    if (initial.kind !== 'ready') return;
    const draftFailed = initial.shouldPersistDraft
      && repository.saveDraft(initial.draft).status === 'unavailable';
    const appliedFailed = !draftFailed
      && initial.shouldPersistApplied
      && initial.plan !== null
      && repository.saveApplied(initial.plan).status === 'unavailable';
    if (appliedFailed || draftFailed) {
      setState((current) => current === null
        ? current
        : portfolioReducer(current, { type: 'save-failed' }));
    }
  }, [initial, repository]);

  function dispatchDraft(action: PortfolioAction): void {
    setState((current) => {
      if (current === null) return current;
      const next = portfolioReducer(current, action);
      if (next.draft !== current.draft && repository.saveDraft(next.draft).status === 'unavailable') {
        return portfolioReducer(next, { type: 'save-failed' });
      }
      return next;
    });
  }

  function apply(): void {
    setState((current) => {
      if (current === null || !validateApplicableDraft(current.draft)) return current;
      const saving = portfolioReducer(current, { type: 'apply-started' });
      const plan = planFromDraft(current.draft, now());
      if (repository.saveApplied(plan).status === 'unavailable') {
        return portfolioReducer(saving, { type: 'save-failed' });
      }
      const applied = portfolioReducer(saving, { type: 'apply-succeeded', plan });
      return repository.clearDraft().status === 'unavailable'
        ? portfolioReducer(applied, { type: 'draft-cleanup-failed' })
        : applied;
    });
  }

  function reset(): void {
    setState((current) => {
      if (current === null) return current;
      const next = portfolioReducer(current, { type: 'reset-confirmed', now: now() });
      if (next.applied === null || repository.saveApplied(next.applied).status === 'unavailable') {
        return portfolioReducer(current, { type: 'save-failed' });
      }
      return repository.clearDraft().status === 'unavailable'
        ? portfolioReducer(next, { type: 'draft-cleanup-failed' })
        : next;
    });
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
          {state.view === 'result' && state.applied !== null ? (
            <>
              <div className="portfolio-toolbar">
                <span role={state.saveState === 'saved' ? 'status' : 'alert'}>
                  {state.saveState === 'error'
                    ? '저장하지 못했습니다. 다시 시도해 주세요.'
                    : state.saveState === 'cleanup-error'
                      ? '배분은 적용했지만 편집 초안을 정리하지 못했습니다.'
                      : '저장됨'}
                </span>
                <Button type="button" variant="primary" onClick={() => dispatchDraft({ type: 'edit-opened' })}>배분 수정</Button>
              </div>
              <PortfolioSummary
                investmentWon={state.applied.syncedInvestmentWon}
                allocation={materializeAllocation(state.applied, state.applied.syncedInvestmentWon)}
              />
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
