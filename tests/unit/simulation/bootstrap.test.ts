import { describe, expect, it } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { bootstrapSimulation } from '../../../src/simulation/application/bootstrap';

const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 100,
};
const draft = createDefaultSimulationDraft(source, 456);

describe('bootstrapSimulation', () => {
  it('replaces only Main-owned source fields and requests persistence', () => {
    const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 200 };
    const result = bootstrapSimulation(
      { status: 'found', source: latest },
      { status: 'found', draft, migration: null },
      999,
    );

    expect(result).toEqual({
      kind: 'ready',
      draft: {
        ...draft,
        source: latest,
        updatedAt: 999,
      },
      latestMainSource: latest,
      persistenceAvailable: true,
      shouldPersist: true,
      durationAdjusted: false,
    });
  });

  it('does not rewrite an unchanged current draft', () => {
    expect(bootstrapSimulation(
      { status: 'found', source },
      { status: 'found', draft, migration: null },
      999,
    )).toEqual({
      kind: 'ready',
      draft,
      latestMainSource: source,
      persistenceAvailable: true,
      shouldPersist: false,
      durationAdjusted: false,
    });
  });

  it('keeps a valid saved result when Main storage is unavailable', () => {
    expect(bootstrapSimulation(
      { status: 'unavailable' },
      { status: 'found', draft, migration: null },
      999,
    )).toEqual({
      kind: 'stale-main',
      draft,
      persistenceAvailable: true,
      shouldPersist: false,
      durationAdjusted: false,
    });
  });

  it('preserves a duration migration notice when Main is unavailable', () => {
    const adjusted = { ...draft, years: 30 };
    expect(bootstrapSimulation(
      { status: 'unavailable' },
      { status: 'found', draft: adjusted, migration: 'duration-capped' },
      999,
    )).toEqual({
      kind: 'stale-main',
      draft: adjusted,
      persistenceAvailable: true,
      shouldPersist: true,
      durationAdjusted: true,
    });
  });

  it('requires Main setup when monthly savings and investments are both zero', () => {
    expect(bootstrapSimulation(
      {
        status: 'found',
        source: {
          ...source,
          monthlySavingsWon: 0,
          monthlyInvestmentWon: 0,
        },
      },
      { status: 'empty' },
      999,
    )).toEqual({ kind: 'main-required', reason: 'zero-contribution' });
  });

  it('starts a session when draft storage is unavailable', () => {
    expect(bootstrapSimulation(
      { status: 'found', source },
      { status: 'unavailable' },
      999,
    )).toEqual({
      kind: 'ready',
      draft: null,
      latestMainSource: source,
      persistenceAvailable: false,
      shouldPersist: false,
      durationAdjusted: false,
    });
  });
});
