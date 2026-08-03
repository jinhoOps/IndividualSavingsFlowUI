import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLauncher } from '../../journey/ui/AppLauncher';
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
import { SimulationMenu } from './SimulationMenu';
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
  const [resetFailed, setResetFailed] = useState(false);
  const initialPersisted = useRef(false);

  useEffect(() => {
    if (
      initialPersisted.current
      || runtime.kind === 'main-required'
      || !runtime.shouldPersist
      || draft === null
    ) return;

    initialPersisted.current = true;
    setSaveState('saving');
    setSaveState(repository.save(draft).status === 'saved' ? 'saved' : 'error');
  }, [draft, repository, runtime]);

  if (runtime.kind === 'main-required') {
    return (
      <main className="simulation-shell">
        <AppLauncher currentApp="simulation" />
        <section className="simulation-recovery">
          <h1>Main에서 월 저축·투자 금액을 먼저 정해주세요.</h1>
          <a className="ui-button ui-button--primary" href={appPath('main')}>Main에서 설정하기</a>
        </section>
      </main>
    );
  }
  function saveDraft(next: CompoundSimulationDraft): void {
    const valid = parseSimulationDraft(next);
    if (valid === null) {
      setSaveState('error');
      return;
    }
    setDraft(valid);
    setSaveState('saving');
    setSaveState(repository.save(valid).status === 'saved' ? 'saved' : 'error');
  }

  function reset(): void {
    if (repository.clear().status === 'unavailable') {
      setResetFailed(true);
      return;
    }
    setResetFailed(false);
    const next = bootstrapSimulation(mainRepository.load(), { status: 'empty' }, now());
    setRuntime(next);
    setDraft(null);
    setSaveState(next.kind !== 'main-required' && !next.persistenceAvailable ? 'error' : 'saved');
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
      setSaveState('saving');
      setSaveState(repository.save(next.draft).status === 'saved' ? 'saved' : 'error');
    }
  }

  const result = draft === null ? null : projectCompoundGrowth(draft);
  const resultIsFinite = result !== null && projectionIsFinite(result);
  const latestSource = runtime.kind === 'ready' ? runtime.latestMainSource : null;

  return (
    <main className="simulation-shell">
      <AppLauncher currentApp="simulation" />
      <div className="simulation-content">
        {draft === null && latestSource !== null ? (
          <SimulationOnboarding source={latestSource} now={now} onComplete={saveDraft} />
        ) : draft !== null && result !== null ? (
          <>
            <div className="simulation-toolbar">
              <SaveIndicator state={saveState} />
              <SimulationMenu onReset={reset} resetFailed={resetFailed} />
            </div>
            {runtime.durationAdjusted ? (
              <p role="status">기간 범위가 변경되어 30년으로 조정됐어요.</p>
            ) : null}
            {runtime.kind === 'stale-main' ? (
              <aside className="simulation-stale-main">
                <p role="status">이전 Main 기준</p>
                <p>최신 Main 정보를 불러오지 못했어요.</p>
                <button type="button" onClick={retryMain}>최신 Main 다시 불러오기</button>
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
