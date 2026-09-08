import { describe, expect, it } from 'vitest';
import { suggestAccountTransfers } from '../../../src/account-map/domain/accountFlowSuggestion';
import type { AccountTransferLink, PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

describe('suggestAccountTransfers', () => {
  it('suggests deterministic fixed transfers when one active account receives all income', () => {
    const result = suggestAccountTransfers({
      main: mainData(),
      locations: [location('salary'), location('living'), location('brokerage')],
      links: [
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
        purposeLink('living', 'system:living', 'living', 600_000),
        purposeLink('housing', 'system:housing', 'living', 300_000),
        purposeLink('investing', 'system:investing', 'brokerage', 1_000_000),
        purposeLink('saving-at-salary', 'system:saving', 'salary', 200_000),
      ],
      transfers: [],
    });

    expect(result).toEqual([
      {
        sourceLocationId: 'salary',
        targetLocationId: 'brokerage',
        allocation: { kind: 'fixed', monthlyAmountWon: 1_000_000 },
        contributingPurposeIds: ['system:investing'],
      },
      {
        sourceLocationId: 'salary',
        targetLocationId: 'living',
        allocation: { kind: 'fixed', monthlyAmountWon: 900_000 },
        contributingPurposeIds: ['system:housing', 'system:living'],
      },
    ]);
  });

  it.each([
    ['income is allocated across multiple active locations', [
      purposeLink('income-a', 'system:income', 'salary', 2_000_000),
      purposeLink('income-b', 'system:income', 'secondary', 1_100_000),
      purposeLink('living', 'system:living', 'living', 900_000),
    ], [location('salary'), location('secondary'), location('living')], []],
    ['income location does not receive its full Main income amount', [
      purposeLink('income', 'system:income', 'salary', 3_000_000),
      purposeLink('living', 'system:living', 'living', 900_000),
    ], [location('salary'), location('living')], []],
    ['an outflow destination is unresolved', [
      purposeLink('income', 'system:income', 'salary', 3_100_000),
      purposeLink('living', 'system:living', 'missing', 900_000),
    ], [location('salary')], []],
    ['any user-declared transfer already exists', [
      purposeLink('income', 'system:income', 'salary', 3_100_000),
      purposeLink('living', 'system:living', 'living', 900_000),
    ], [location('salary'), location('living')], [transfer('existing', 'salary', 'living')]],
  ] as const)('returns no suggestions when %s', (_reason, links, locations, transfers) => {
    expect(suggestAccountTransfers({ main: mainData(), locations, links, transfers })).toEqual([]);
  });
});

function mainData(overrides: Partial<MainData> = {}): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 10,
    monthlyNetIncomeWon: 3_100_000,
    monthlyHousingWon: 0,
    monthlyLivingWon: 900_000,
    monthlySavingWon: 0,
    monthlyInvestmentWon: 1_000_000,
    ...overrides,
  };
}

function location(id: string): FinancialLocation {
  return { id, shortName: id, kind: 'bank', roles: ['income', 'spending'], createdAt: 1, updatedAt: 1 };
}

function purposeLink(id: string, purposeId: PurposeLocationLink['purposeId'], locationId: string, monthlyAmountWon: number): PurposeLocationLink {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: false, status: 'active', createdAt: 1, updatedAt: 1 };
}

function transfer(id: string, sourceLocationId: string, targetLocationId: string): AccountTransferLink {
  return {
    id,
    sourceLocationId,
    targetLocationId,
    allocation: { kind: 'fixed', monthlyAmountWon: 900_000 },
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}
