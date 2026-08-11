import { describe, expect, it } from 'vitest';
import { normalizePortfolioName } from '../../../src/portfolio/domain/allocation';
import { parsePortfolioDraft, parsePortfolioPlan } from '../../../src/portfolio/domain/validation';

function validV2Plan() {
  return {
    schemaVersion: 2,
    scope: { type: 'aggregate' },
    items: [{
      id: 'a', name: '인덱스', shareUnits: 600_000, order: 0,
      classification: 'growth', classificationOrigin: 'automatic',
    }],
    cashShareUnits: 400_000,
    cashMode: 'automatic',
    syncedInvestmentWon: 100_000,
    appliedAt: 1,
    updatedAt: 1,
  };
}

function validV2Draft() {
  return {
    schemaVersion: 2,
    scope: { type: 'aggregate' },
    items: [{
      id: 'a', name: '인덱스', shareUnits: 600_000, order: 0,
      classification: 'growth', classificationOrigin: 'automatic',
    }],
    cashShareUnits: 400_000,
    cashMode: 'automatic',
    inputMode: 'amount',
    syncedInvestmentWon: 100_000,
    updatedAt: 1,
    isApplicable: true,
  };
}

const validPlanV2 = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{
    id: 'a', name: '미국 인덱스', shareUnits: 800_000, order: 0,
    classification: 'growth', classificationOrigin: 'automatic',
  }],
  cashShareUnits: 200_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 100_000,
  appliedAt: 1,
  updatedAt: 1,
};

const validPlanV1 = {
  ...validPlanV2,
  schemaVersion: 1,
};

describe('Portfolio validation', () => {
  it('normalizes names for duplicate comparison', () => {
    expect(normalizePortfolioName('  US   INDEX ')).toBe('us index');
  });

  it('accepts aggregate and non-empty location scopes in schema v2', () => {
    expect(parsePortfolioPlan({ ...validPlanV2, scope: { type: 'aggregate' } })).not.toBeNull();
    expect(parsePortfolioPlan({
      ...validPlanV2,
      scope: { type: 'location', locationId: 'loc-isa' },
    })).not.toBeNull();
  });

  it('rejects schema v1 and empty location scope IDs', () => {
    expect(parsePortfolioPlan(validPlanV1)).toBeNull();
    expect(parsePortfolioPlan({
      ...validPlanV2,
      scope: { type: 'location', locationId: '' },
    })).toBeNull();
  });

  it('rejects duplicate normalized names', () => {
    expect(parsePortfolioPlan({
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [
        {
          id: 'a', name: '미국  인덱스', shareUnits: 400_000, order: 0,
          classification: 'growth', classificationOrigin: 'automatic',
        },
        {
          id: 'b', name: '미국 인덱스', shareUnits: 400_000, order: 1,
          classification: 'growth', classificationOrigin: 'automatic',
        },
      ],
      cashShareUnits: 200_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 100_000,
      appliedAt: 1,
      updatedAt: 1,
    })).toBeNull();
  });

  it.each(['classification', 'classificationOrigin'] as const)('rejects invalid v2 %s', (field) => {
    const plan = validV2Plan();
    delete (plan.items[0] as Record<string, unknown>)[field];

    expect(parsePortfolioPlan(plan)).toBeNull();
  });

  it('requires v2 item classifications in plans and drafts', () => {
    const draft = validV2Draft();
    delete (draft.items[0] as Record<string, unknown>).classification;

    expect(parsePortfolioPlan(validV2Plan())).toMatchObject({ schemaVersion: 2 });
    expect(parsePortfolioDraft(draft)).toBeNull();
  });

  it('rejects a draft with a non-boolean applicability value', () => {
    expect(parsePortfolioDraft({ ...validV2Draft(), isApplicable: 'true' })).toBeNull();
  });

  it('rejects a draft marked inapplicable when its allocation is applicable', () => {
    expect(parsePortfolioDraft({ ...validV2Draft(), isApplicable: false })).toBeNull();
  });

  it('rejects a draft marked applicable when its investment makes it inapplicable', () => {
    expect(parsePortfolioDraft({
      ...validV2Draft(),
      syncedInvestmentWon: 0,
      isApplicable: true,
    })).toBeNull();
  });
});
