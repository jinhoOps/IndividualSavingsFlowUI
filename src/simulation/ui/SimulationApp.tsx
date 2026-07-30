import { useMemo, useState } from 'react';
import { AppLauncher } from '../../journey/ui/AppLauncher';
import { appPath } from '../../journey/routes';
import { bootstrapSimulation } from '../application/bootstrap';
import type { CompoundSimulationDraft } from '../domain/model';
import { projectCompoundGrowth } from '../domain/projection';
import { createDefaultSimulationDraft } from '../domain/validation';
import {
  BrowserMainSourceRepository,
  type MainSourceRepository,
} from '../infrastructure/mainSourceRepository';
import {
  BrowserSimulationRepository,
  type SimulationRepository,
} from '../infrastructure/simulationRepository';
import { AdvancedSettings } from './AdvancedSettings';
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
  const [draft, setDraft] = useState<CompoundSimulationDraft | null>(
    initial.kind === 'ready' ? initial.draft : null,
  );
  const [saveFailed, setSaveFailed] = useState(
    initial.kind === 'ready' && !initial.persistenceAvailable,
  );

  if (initial.kind === 'main-required') {
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
  const ready = initial;

  function saveDraft(next: CompoundSimulationDraft): void {
    setDraft(next);
    setSaveFailed(repository.save(next).status === 'unavailable');
  }

  function start(initialInvestmentWon: number): void {
    saveDraft({
      ...createDefaultSimulationDraft(ready.latestMainSource, now()),
      initialInvestmentWon,
    });
  }

  function restart(): void {
    repository.clear();
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
            {ready.mainChanged ? (
              <p role="status">Main의 저축·투자 금액이 변경되었습니다.</p>
            ) : null}
            {saveFailed ? <p role="status">자동 저장을 사용할 수 없습니다.</p> : null}
            <SimulationSummary draft={draft} result={projectCompoundGrowth(draft)} />
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
