import { describe, expect, it } from 'vitest';
import {
  createDefaultSimulationDraft,
  parseSimulationDraft,
} from '../../../src/simulation/domain/validation';

const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('Simulation draft validation', () => {
  it('creates the approved first-run defaults', () => {
    expect(createDefaultSimulationDraft(source, 456)).toEqual({
      schemaVersion: 1,
      source,
      initialInvestmentWon: 0,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: 456,
    });
  });

  it('accepts a complete valid draft', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    expect(parseSimulationDraft(draft)).toEqual(draft);
  });

  it('rejects out-of-range duration and legacy collections', () => {
    const draft = createDefaultSimulationDraft(source, 456);

    expect(parseSimulationDraft({ ...draft, years: 51 })).toBeNull();
    expect(parseSimulationDraft({ ...draft, strategies: [] })).toBeNull();
  });

  it('rejects percentages with more than two decimal places', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    expect(parseSimulationDraft({
      ...draft,
      expectedAnnualReturnPercent: 9.001,
    })).toBeNull();
  });
});
