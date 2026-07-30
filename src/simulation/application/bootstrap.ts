import type { CompoundSimulationDraft, SimulationMainSource } from '../domain/model';
import type { MainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { SimulationLoadResult } from '../infrastructure/simulationRepository';

export type SimulationBootstrapResult =
  | {
    kind: 'ready';
    draft: CompoundSimulationDraft | null;
    latestMainSource: SimulationMainSource;
    mainChanged: boolean;
    persistenceAvailable: boolean;
  }
  | {
    kind: 'main-required';
    reason: 'empty' | 'invalid' | 'zero-contribution' | 'unavailable';
  };

export function bootstrapSimulation(
  mainResult: MainSourceLoadResult,
  simulationResult: SimulationLoadResult,
): SimulationBootstrapResult {
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

  const draft = simulationResult.status === 'found'
    ? simulationResult.draft
    : null;

  return {
    kind: 'ready',
    draft,
    latestMainSource,
    mainChanged: draft !== null
      && draft.source.mainUpdatedAt !== latestMainSource.mainUpdatedAt,
    persistenceAvailable: simulationResult.status !== 'unavailable',
  };
}
