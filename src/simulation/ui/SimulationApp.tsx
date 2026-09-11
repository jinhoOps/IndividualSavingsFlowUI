import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { appPath } from '../../journey/routes';
import { bootstrapSimulation } from '../application/bootstrap';
import type { CompoundSimulationDraft } from '../domain/model';
import { projectCompoundGrowth } from '../domain/projection';
import { parseSimulationDraft } from '../domain/validation';
import {
  BrowserMainSourceRepository,
  type MainSourceRepository,
} from '../infrastructure/mainSourceRepository';
import {
  BrowserSimulationRepository,
  type SimulationRepository,
} from '../infrastructure/simulationRepository';
import { AdvancedSettings } from './AdvancedSettings';
import { GrowthChart } from './GrowthChart';
import { SaveIndicator, type SimulationSaveState } from './SaveIndicator';
import { SimulationComparison } from './SimulationComparison';
import { SimulationControls } from './SimulationControls';
import { SimulationHero } from './SimulationHero';
import { SimulationManagementMenu } from './SimulationManagementMenu';
import { SimulationOnboarding } from './SimulationOnboarding';
import {AccountDraftContext, useAccountRecovery, useInitialRecovery} from '../../auth/AccountDraftContext';

export function SimulationApp({
  mainSourceRepository: providedMainRepository,
  repository: providedRepository,
  now = Date.now,
}: {
  mainSourceRepository?: MainSourceRepository;
  repository?: SimulationRepository;
  now?: () => number;
}) {
  const accountSession = useContext(AccountDraftContext);
  const autosaveDebounceMs = accountSession === null ? 0 : 500;
  const mainRepository = useMemo(
    () => providedMainRepository ?? new BrowserMainSourceRepository(),
    [providedMainRepository],
  );
  const repository = useMemo(
    () => providedRepository ?? new BrowserSimulationRepository(),
    [providedRepository],
  );
  const initial = useMemo(
    () => bootstrapSimulation(mainRepository.load(), repository.load(), now()),
    [mainRepository, repository, now],
  );
  const [runtime, setRuntime] = useState(initial);
  const recovered = useInitialRecovery('simulation', parseSimulationDraft);
  const [draft, setDraft] = useState<CompoundSimulationDraft | null>(
    recovered ?? (initial.kind === 'ready'
      ? initial.draft
      : initial.kind === 'stale-main' || initial.kind === 'goal-required' ? initial.draft : null),
  );
  const [saveState, setSaveState] = useState<SimulationSaveState>(
    recovered || (initial.kind !== 'main-required' && !initial.persistenceAvailable) ? 'error' : 'saved',
  );
  const initialPersisted = useRef(recovered !== null);
  useAccountRecovery('simulation', draft, saveState !== 'saved' && draft !== null);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferedAutosave = useRef<{draft: CompoundSimulationDraft; token: number} | null>(null);
  const mounted = useRef(false);
  const latestOperation = useRef(0);

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
    if (
      initialPersisted.current
      || runtime.kind === 'main-required'
      || runtime.kind === 'goal-required'
      || !runtime.shouldPersist
      || draft === null
    ) return;

    initialPersisted.current = true;
    queueSave(draft);
  }, [draft, repository, runtime]);

  if (runtime.kind === 'main-required') {
    return (
      <AppShell
        currentApp="simulation"
        managementMenu={<SimulationManagementMenu onReset={reset} />}
      >
        <main className="simulation-shell">
          <AppContentFrame
            as="section"
            className="ui-surface simulation-recovery"
            data-testid="simulation-page-frame"
          >
            <h1>Main에서 월 저축·투자 금액을 먼저 정해주세요.</h1>
            <a className="ui-button ui-button--primary" href={appPath('main')}>Main에서 설정하기</a>
          </AppContentFrame>
        </main>
      </AppShell>
    );
  }
  function saveDraft(next: CompoundSimulationDraft): void {
    const valid = parseSimulationDraft(next);
    if (valid === null) {
      setSaveState('error');
      return;
    }
    if (runtime.kind === 'goal-required') {
      completeGoal(runtime, valid);
      return;
    }
    setDraft(valid);
    queueSave(valid);
  }

  function completeGoal(
    goalRuntime: Extract<ReturnType<typeof bootstrapSimulation>, { kind: 'goal-required' }>,
    valid: CompoundSimulationDraft,
  ): void {
    flushAutosave();
    const token = beginOperation();
    enqueuePersistence(
      () => repository.save(valid),
      (result) => {
        if (token !== latestOperation.current) return;
        if (result?.status !== 'saved') {
          setSaveState('error');
          return;
        }
        setDraft(valid);
        setRuntime(goalCompletionRuntime(goalRuntime, valid));
        setSaveState('saved');
      },
    );
  }

  function reset(): Promise<boolean> {
    flushAutosave();
    const token = beginOperation();
    return enqueuePersistence(
      () => repository.clear(),
      (result) => {
        if (token !== latestOperation.current) return;
        if (result?.status !== 'cleared') {
          setSaveState('error');
          return;
        }
        const next = bootstrapSimulation(mainRepository.load(), { status: 'empty' }, now());
        setRuntime(next);
        setDraft(null);
        setSaveState(next.kind !== 'main-required' && !next.persistenceAvailable ? 'error' : 'saved');
      },
    ).then((result) => result?.status === 'cleared');
  }

  function retryMain(): void {
    if (runtime.kind !== 'stale-main' || draft === null) return;
    const next = bootstrapSimulation(mainRepository.load(), {
      status: 'found',
      draft,
      migration: null,
    }, now());
    if (next.kind !== 'ready') return;

    setRuntime(next);
    setDraft(next.draft);
    if (next.shouldPersist && next.draft !== null) {
      initialPersisted.current = true;
      queueSave(next.draft);
    }
  }

  function queueSave(next: CompoundSimulationDraft): void {
    const token = beginOperation();
    if (autosaveDebounceMs > 0) {
      bufferedAutosave.current = {draft: next, token};
      if (autosaveTimer.current !== null) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(flushAutosave, autosaveDebounceMs);
      return;
    }
    sendAutosave(next, token);
  }

  function flushAutosave(): void {
    if (autosaveTimer.current !== null) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const buffered = bufferedAutosave.current;
    bufferedAutosave.current = null;
    if (buffered !== null) sendAutosave(buffered.draft, buffered.token);
  }

  function sendAutosave(next: CompoundSimulationDraft, token: number): void {
    if (!mounted.current) return;
    enqueuePersistence(
      () => repository.save(next),
      (result) => {
        if (token !== latestOperation.current) return;
        setSaveState(result?.status === 'saved' ? 'saved' : 'error');
      },
    );
  }

  function beginOperation(): number {
    const token = latestOperation.current + 1;
    latestOperation.current = token;
    setSaveState('saving');
    return token;
  }

  function enqueuePersistence<T>(
    operation: () => Promise<T>,
    onSettled: (result: T | null) => void,
  ): Promise<T | null> {
    const run = persistenceQueue.current.then(
      () => mounted.current ? operation() : null,
      () => mounted.current ? operation() : null,
    );
    const settled = run.then((result) => result, () => null);
    persistenceQueue.current = settled.then(() => undefined);
    void settled.then((result) => {
      if (mounted.current) onSettled(result);
    });
    return settled;
  }

  const goalRequired = draft !== null && draft.targetAmountWon === null;
  const resultDraft = draft !== null && hasTarget(draft) ? draft : null;
  const result = resultDraft === null ? null : projectCompoundGrowth(resultDraft);
  const resultIsFinite = result !== null && projectionIsFinite(result);
  const latestSource = runtime.kind === 'ready' ? runtime.latestMainSource : null;

  return (
    <AppShell
      currentApp="simulation"
      managementMenu={<SimulationManagementMenu onReset={reset} />}
    >
      <main className="simulation-shell">
        <AppContentFrame
          as="div"
          className="simulation-content"
          data-testid="simulation-page-frame"
        >
        {draft === null && latestSource !== null ? (
          <SimulationOnboarding source={latestSource} now={now} onComplete={saveDraft} />
        ) : goalRequired && draft !== null ? (
          <SimulationOnboarding
            source={draft.source}
            initialDraft={draft}
            goalSaveState={saveState === 'saved' ? 'idle' : saveState}
            now={now}
            onComplete={saveDraft}
          />
        ) : resultDraft !== null && result !== null ? (
          <>
            <div className="simulation-toolbar">
              <SaveIndicator state={saveState} />
            </div>
            {runtime.durationAdjusted ? (
              <p role="status">기간 범위가 변경되어 30년으로 조정됐어요.</p>
            ) : null}
            {runtime.kind === 'stale-main' ? (
              <aside className="simulation-stale-main">
                <p role="status">이전 Main 기준</p>
                <p>최신 Main 정보를 불러오지 못했어요.</p>
                <Button type="button" variant="secondary" onClick={retryMain}>최신 Main 다시 불러오기</Button>
                <a href={appPath('main')}>Main 확인하기</a>
              </aside>
            ) : null}
            {resultIsFinite ? <SimulationHero draft={resultDraft} result={result} /> : null}
            <Surface as="section" className="simulation-projection" aria-labelledby="simulation-projection-title">
              <header className="simulation-projection__heading">
                <h2 id="simulation-projection-title">{resultDraft.years === 0 ? '현재 자산' : `${resultDraft.years}년 동안의 자산 변화`}</h2>
                <SegmentedControl label="표시 금액 기준" value={resultDraft.amountMode}
                  options={[{ value: 'nominal', label: '명목' }, { value: 'real', label: '실질' }]}
                  onChange={(amountMode) => saveDraft({ ...resultDraft, amountMode, updatedAt: now() })} />
              </header>
              <p className="simulation-projection__basis">{resultDraft.amountMode === 'nominal'
                ? '미래에 모일 금액 그대로 보여줘요.'
                : '물가 상승을 반영해 오늘의 가치로 보여줘요.'}</p>
              {resultIsFinite ? <GrowthChart result={result} amountMode={resultDraft.amountMode} embedded /> : (
                <p role="alert" className="simulation-calculation-error">
                  계산 결과를 표시할 수 없어요. 목표와 가정에서 입력값을 조정해주세요.
                </p>
              )}
              <SimulationControls draft={resultDraft} onChange={(next) => saveDraft({
                ...next,
                updatedAt: now(),
              })} />
              {resultIsFinite ? <SimulationComparison result={result} /> : null}
            </Surface>
            <AdvancedSettings draft={resultDraft} onChange={(next) => saveDraft({
              ...next,
              updatedAt: now(),
            })} />
          </>
        ) : (
          <p role="alert">시뮬레이션을 시작할 수 없어요.</p>
        )}
        </AppContentFrame>
      </main>
    </AppShell>
  );
}

function goalCompletionRuntime(
  runtime: Extract<ReturnType<typeof bootstrapSimulation>, { kind: 'goal-required' }>,
  draft: CompoundSimulationDraft,
): ReturnType<typeof bootstrapSimulation> {
  if (runtime.afterGoal.kind === 'stale-main') {
    return {
      kind: 'stale-main',
      draft,
      persistenceAvailable: runtime.persistenceAvailable,
      shouldPersist: false,
      durationAdjusted: runtime.durationAdjusted,
    };
  }
  if (runtime.afterGoal.kind === 'main-required') {
    return runtime.afterGoal;
  }
  return {
    kind: 'ready',
    draft,
    latestMainSource: runtime.afterGoal.latestMainSource,
    persistenceAvailable: runtime.persistenceAvailable,
    shouldPersist: false,
    durationAdjusted: runtime.durationAdjusted,
  };
}

function hasTarget(
  draft: CompoundSimulationDraft,
): draft is CompoundSimulationDraft & { targetAmountWon: number } {
  return draft.targetAmountWon !== null;
}

function projectionIsFinite(result: ReturnType<typeof projectCompoundGrowth>): boolean {
  return [
    result.finalCurrentPlanWon,
    result.finalAllSavingsWon,
    result.advantageOverAllSavingsWon,
    result.principalRatioPercent ?? 0,
    ...result.points.flatMap((point) => Object.values(point)),
  ].every(Number.isFinite);
}
