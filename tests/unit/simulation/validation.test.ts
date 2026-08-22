import { describe, expect, it } from 'vitest';
import {
  createDefaultSimulationDraft,
  parseSimulationDraft,
  parseStoredSimulationDraft,
  targetForInitialInvestment,
} from '../../../src/simulation/domain/validation';

const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('Simulation draft validation', () => {
  it('selects the automatic target at each initial-investment boundary', () => {
    expect(targetForInitialInvestment(79_999_999)).toBe(100_000_000);
    expect(targetForInitialInvestment(80_000_000)).toBe(200_000_000);
    expect(targetForInitialInvestment(199_999_999)).toBe(200_000_000);
    expect(targetForInitialInvestment(200_000_000)).toBeNull();
  });

  it('creates the approved first-run defaults', () => {
    expect(createDefaultSimulationDraft(source, 456)).toEqual({
      schemaVersion: 3,
      source,
      initialInvestmentWon: 0,
      targetAmountWon: 100_000_000,
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

  it('upgrades v2 drafts with their required target while preserving their validated fields', () => {
    const v3Draft = {
      ...createDefaultSimulationDraft(source, 456),
      targetAmountWon: 100_000_000,
    };
    const { targetAmountWon: _targetAmountWon, ...v2Draft } = v3Draft;

    expect(parseStoredSimulationDraft({ ...v2Draft, schemaVersion: 2 })).toEqual({
      draft: v3Draft,
      migration: 'schema-upgraded',
    });
    expect(parseStoredSimulationDraft({
      ...v2Draft,
      schemaVersion: 2,
      initialInvestmentWon: 200_000_000,
    })).toEqual({
      draft: {
        ...v3Draft,
        initialInvestmentWon: 200_000_000,
        targetAmountWon: null,
      },
      migration: 'schema-upgraded',
    });
  });

  it('rejects a current target that is not greater than the initial investment', () => {
    const draft = createDefaultSimulationDraft(source, 456);

    expect(parseSimulationDraft({
      ...draft,
      targetAmountWon: draft.initialInvestmentWon,
    })).toBeNull();
  });

  it('accepts 0 through 30 years and rejects values outside the current range', () => {
    const draft = createDefaultSimulationDraft(source, 456);

    expect(parseSimulationDraft({ ...draft, years: 0 })).not.toBeNull();
    expect(parseSimulationDraft({ ...draft, years: 30 })).not.toBeNull();
    expect(parseSimulationDraft({ ...draft, years: -1 })).toBeNull();
    expect(parseSimulationDraft({ ...draft, years: 31 })).toBeNull();
  });

  it('rejects legacy collections', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    expect(parseSimulationDraft({ ...draft, strategies: [] })).toBeNull();
  });

  it('rejects a draft with a symbol own key without throwing', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    const candidate = { ...draft, [Symbol('extra')]: true };

    expect(() => parseSimulationDraft(candidate)).not.toThrow();
    expect(parseSimulationDraft(candidate)).toBeNull();
  });

  it('rejects percentages with more than two decimal places', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    expect(parseSimulationDraft({
      ...draft,
      expectedAnnualReturnPercent: 9.001,
    })).toBeNull();
  });
});
