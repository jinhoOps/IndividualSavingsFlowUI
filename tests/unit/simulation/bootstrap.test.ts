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
  it('resumes a draft while flagging a newer Main source without overwriting it', () => {
    const latest = { ...source, mainUpdatedAt: 200 };
    const result = bootstrapSimulation(
      { status: 'found', source: latest },
      { status: 'found', draft },
    );

    expect(result).toEqual({
      kind: 'ready',
      draft,
      latestMainSource: latest,
      mainChanged: true,
      persistenceAvailable: true,
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
    )).toEqual({ kind: 'main-required', reason: 'zero-contribution' });
  });

  it('starts a session when draft storage is unavailable', () => {
    expect(bootstrapSimulation(
      { status: 'found', source },
      { status: 'unavailable' },
    )).toEqual({
      kind: 'ready',
      draft: null,
      latestMainSource: source,
      mainChanged: false,
      persistenceAvailable: false,
    });
  });
});
