import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
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

export function SimulationApp({
  mainSourceRepository: providedMainRepository,
  repository: providedRepository,
  now = Date.now,
}: {
  mainSourceRepository?: MainSourceRepository;
  repository?: SimulationRepository;
  now?: () => number;
}) {
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
  const [draft, setDraft] = useState<CompoundSimulationDraft | null>(
    initial.kind === 'ready'
      ? initial.draft
      : initial.kind === 'stale-main' ? initial.draft : null,
  );
  const [saveState, setSaveState] = useState<SimulationSaveState>(
    initial.kind !== 'main-required' && !initial.persistenceAvailable ? 'error' : 'saved',
  );
  const initialPersisted = useRef(false);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const latestOperation = useRef(0);

  useEffect(() => {
    if (
      initialPersisted.current
      || runtime.kind === 'main-required'
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
          <Surface as="section" className="simulation-recovery">
            <h1>Main에서 월 저축·투자 금액을 먼저 정해주세요.</h1>
            <a className="ui-button ui-button--primary" href={appPath('main')}>Main에서 설정하기</a>
          </Surface>
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
    setDraft(valid);
    queueSave(valid);
  }

  function reset(): Promise<boolean> {
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
    const run = persistenceQueue.current.then(operation, operation);
    const settled = run.then((result) => result, () => null);
    persistenceQueue.current = settled.then(() => undefined);
    void settled.then(onSettled);
    return settled;
  }

  const result = draft === null ? null : projectCompoundGrowth(draft);
  const resultIsFinite = result !== null && projectionIsFinite(result);
  const latestSource = runtime.kind === 'ready' ? runtime.latestMainSource : null;

  return (
    <AppShell
      currentApp="simulation"
      managementMenu={<SimulationManagementMenu onReset={reset} />}
    >
      <main className="simulation-shell">
        <div className="simulation-content">
        {draft === null && latestSource !== null ? (
          <SimulationOnboarding source={latestSource} now={now} onComplete={saveDraft} />
        ) : draft !== null && result !== null ? (
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
            {resultIsFinite ? (
              <>
                <SimulationHero draft={draft} result={result} />
                <GrowthChart result={result} amountMode={draft.amountMode} />
                <SimulationComparison result={result} />
              </>
            ) : (
              <p role="alert" className="simulation-calculation-error">
                계산 결과를 표시할 수 없어요. 계산 기준을 조정해주세요.
              </p>
            )}
            <SimulationControls draft={draft} onChange={(next) => saveDraft({
              ...next,
              updatedAt: now(),
            })} />
            <AdvancedSettings draft={draft} onChange={(next) => saveDraft({
              ...next,
              updatedAt: now(),
            })} />
          </>
        ) : (
          <p role="alert">시뮬레이션을 시작할 수 없어요.</p>
        )}
        </div>
      </main>
    </AppShell>
  );
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
