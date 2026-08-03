import { useMemo, useState } from 'react';
import { AppLauncher } from '../../journey/ui/AppLauncher';
import { appPath } from '../../journey/routes';
import { bootstrapSimulation } from '../application/bootstrap';
import type { CompoundSimulationDraft } from '../domain/model';
import { projectCompoundGrowth } from '../domain/projection';
import { createDefaultSimulationDraft, parseSimulationDraft } from '../domain/validation';
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
import { SimulationControls } from './SimulationControls';
import { SimulationSummary } from './SimulationSummary';
import { StartingPrincipalPrompt } from './StartingPrincipalPrompt';

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
    () => bootstrapSimulation(mainRepository.load(), repository.load()),
    [mainRepository, repository],
  );
  const [runtime, setRuntime] = useState(initial);
  const [draft, setDraft] = useState<CompoundSimulationDraft | null>(
    initial.kind === 'ready' ? initial.draft : null,
  );
  const [saveFailed, setSaveFailed] = useState(
    initial.kind === 'ready' && !initial.persistenceAvailable,
  );
  const [restartFailed, setRestartFailed] = useState(false);

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
  if (runtime.kind === 'stale-main') {
    const result = projectCompoundGrowth(runtime.draft);
    return (
      <main className="simulation-shell">
        <AppLauncher currentApp="simulation" />
        <div className="simulation-content">
          <p role="status">이전 Main 기준</p>
          <p>최신 Main 정보를 불러오지 못했습니다.</p>
          <a className="ui-button ui-button--secondary" href={appPath('main')}>Main 확인하기</a>
          <SimulationSummary draft={runtime.draft} result={result} />
          <GrowthChart result={result} amountMode={runtime.draft.amountMode} />
        </div>
      </main>
    );
  }
  const ready = runtime;

  function saveDraft(next: CompoundSimulationDraft): void {
    const valid = parseSimulationDraft(next);
    if (valid === null) {
      setSaveFailed(true);
      return;
    }
    setDraft(valid);
    setSaveFailed(repository.save(valid).status === 'unavailable');
  }

  function start(initialInvestmentWon: number): void {
    saveDraft({
      ...createDefaultSimulationDraft(ready.latestMainSource, now()),
      initialInvestmentWon,
    });
  }

  function restart(): void {
    if (repository.clear().status === 'unavailable') {
      setRestartFailed(true);
      return;
    }
    setRestartFailed(false);
    setRuntime(bootstrapSimulation(mainRepository.load(), { status: 'empty' }));
    setDraft(null);
  }

  return (
    <main className="simulation-shell">
      <AppLauncher currentApp="simulation" />
      <div className="simulation-content">
        {draft === null ? (
          <StartingPrincipalPrompt onStart={start} />
        ) : (
          <>
            {saveFailed ? <p role="status">자동 저장을 사용할 수 없습니다.</p> : null}
            {restartFailed ? <p role="alert">처음부터 다시 시작할 수 없습니다.</p> : null}
            <p className="simulation-assumption">
              기대수익률을 계속 재투자한다고 가정한 계산이며, 백테스트나 금융 자문이 아닙니다.
            </p>
            {(() => {
              const result = projectCompoundGrowth(draft);
              return (
                <>
                  <SimulationSummary draft={draft} result={result} />
                  <GrowthChart result={result} amountMode={draft.amountMode} />
                </>
              );
            })()}
            <SimulationControls draft={draft} onChange={(next) => saveDraft({
              ...next,
              updatedAt: now(),
            })} />
            <AdvancedSettings draft={draft} onChange={(next) => saveDraft({
              ...next,
              updatedAt: now(),
            })} />
            <button type="button" className="ui-button ui-button--quiet" onClick={restart}>
              처음부터 다시
            </button>
          </>
        )}
      </div>
    </main>
  );
}
