import type {
  CompoundSimulationDraft,
  SimulationDraftMigration,
  SimulationMainSource,
} from '../domain/model';
import type { MainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { SimulationLoadResult } from '../infrastructure/simulationRepository';

type GoalRequiredAfterGoal =
  | { kind: 'ready'; latestMainSource: SimulationMainSource }
  | { kind: 'stale-main' }
  | { kind: 'main-required'; reason: 'empty' | 'invalid' | 'zero-contribution' };

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
    kind: 'goal-required';
    draft: CompoundSimulationDraft;
    latestMainSource: SimulationMainSource;
    persistenceAvailable: boolean;
    shouldPersist: boolean;
    durationAdjusted: boolean;
    afterGoal: GoalRequiredAfterGoal;
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
  const loadedDraft = simulationResult.status === 'found'
    ? simulationResult.draft
    : null;
  const migration = simulationResult.status === 'found'
    ? simulationResult.migration
    : null;

  if (loadedDraft?.targetAmountWon === null) {
    if (mainResult.status === 'unavailable') {
      return goalRequiredResult(
        loadedDraft,
        migration,
        { kind: 'stale-main' },
      );
    }
    if (mainResult.status !== 'found') {
      return goalRequiredResult(
        loadedDraft,
        migration,
        { kind: 'main-required', reason: mainResult.status },
      );
    }
    if (
      mainResult.source.monthlySavingsWon
      + mainResult.source.monthlyInvestmentWon === 0
    ) {
      return goalRequiredResult(
        loadedDraft,
        migration,
        { kind: 'main-required', reason: 'zero-contribution' },
      );
    }

    const sourceChanged = !sameSource(loadedDraft.source, mainResult.source);
    const draft = sourceChanged
      ? { ...loadedDraft, source: mainResult.source, updatedAt: now }
      : loadedDraft;
    return goalRequiredResult(
      draft,
      migration,
      { kind: 'ready', latestMainSource: mainResult.source },
      sourceChanged,
    );
  }

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

  const sourceChanged = loadedDraft !== null
    && !sameSource(loadedDraft.source, latestMainSource);
  const draft = loadedDraft === null || !sourceChanged
    ? loadedDraft
    : { ...loadedDraft, source: latestMainSource, updatedAt: now };
  return {
    kind: 'ready',
    draft,
    latestMainSource,
    persistenceAvailable: simulationResult.status !== 'unavailable',
    shouldPersist: sourceChanged || migration !== null,
    durationAdjusted: migration === 'duration-capped',
  };
}

function goalRequiredResult(
  draft: CompoundSimulationDraft,
  migration: SimulationDraftMigration | null,
  afterGoal: GoalRequiredAfterGoal,
  sourceChanged = false,
): Extract<SimulationBootstrapResult, { kind: 'goal-required' }> {
  return {
    kind: 'goal-required',
    draft,
    latestMainSource: draft.source,
    persistenceAvailable: true,
    shouldPersist: sourceChanged || migration !== null,
    durationAdjusted: migration === 'duration-capped',
    afterGoal,
  };
}

function sameSource(left: SimulationMainSource, right: SimulationMainSource): boolean {
  return left.monthlySavingsWon === right.monthlySavingsWon
    && left.monthlyInvestmentWon === right.monthlyInvestmentWon
    && left.mainUpdatedAt === right.mainUpdatedAt;
}
