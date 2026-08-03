import type { CompoundSimulationDraft, SimulationMainSource } from '../domain/model';
import type { MainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { SimulationLoadResult } from '../infrastructure/simulationRepository';

export type SimulationBootstrapResult =
  | {
    kind: 'ready';
    draft: CompoundSimulationDraft | null;
    latestMainSource: SimulationMainSource;
    persistenceAvailable: boolean;
    shouldPersist: boolean;
    durationAdjusted: boolean;
  }
  | {
    kind: 'stale-main';
    draft: CompoundSimulationDraft;
    persistenceAvailable: boolean;
    shouldPersist: boolean;
    durationAdjusted: boolean;
  }
  | {
    kind: 'main-required';
    reason: 'empty' | 'invalid' | 'zero-contribution' | 'unavailable';
  };

export function bootstrapSimulation(
  mainResult: MainSourceLoadResult,
  simulationResult: SimulationLoadResult,
  now: number = Date.now(),
): SimulationBootstrapResult {
  if (
    mainResult.status === 'unavailable'
    && simulationResult.status === 'found'
  ) {
    return {
      kind: 'stale-main',
      draft: simulationResult.draft,
      persistenceAvailable: true,
      shouldPersist: simulationResult.migration !== null,
      durationAdjusted: simulationResult.migration === 'duration-capped',
    };
  }

  if (mainResult.status !== 'found') {
    return { kind: 'main-required', reason: mainResult.status };
  }

  const latestMainSource = mainResult.source;
  if (
    latestMainSource.monthlySavingsWon
    + latestMainSource.monthlyInvestmentWon === 0
  ) {
    return { kind: 'main-required', reason: 'zero-contribution' };
  }

  const loadedDraft = simulationResult.status === 'found'
    ? simulationResult.draft
    : null;
  const sourceChanged = loadedDraft !== null
    && !sameSource(loadedDraft.source, latestMainSource);
  const draft = loadedDraft === null || !sourceChanged
    ? loadedDraft
    : { ...loadedDraft, source: latestMainSource, updatedAt: now };
  const migration = simulationResult.status === 'found'
    ? simulationResult.migration
    : null;

  return {
    kind: 'ready',
    draft,
    latestMainSource,
    persistenceAvailable: simulationResult.status !== 'unavailable',
    shouldPersist: sourceChanged || migration !== null,
    durationAdjusted: migration === 'duration-capped',
  };
}

function sameSource(left: SimulationMainSource, right: SimulationMainSource): boolean {
  return left.monthlySavingsWon === right.monthlySavingsWon
    && left.monthlyInvestmentWon === right.monthlyInvestmentWon
    && left.mainUpdatedAt === right.mainUpdatedAt;
}
