import { describe, expect, it } from 'vitest';
import type { AccountMapApplied, PurposeLocationLink } from '../../../src/account-map/domain/model';
import {
  customPurposeTargetCapacity,
  mainPurposeReferences,
  overallMainState,
  recalculateRemainder,
  reconcilePurpose,
} from '../../../src/account-map/domain/reconciliation';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

const locations: FinancialLocation[] = [
  location('checking'),
  location('cash'),
  { ...location('archived'), archivedAt: 50 },
];

describe('purpose reconciliation', () => {
  it('maps the five system purpose references to Main', () => {
    expect(mainPurposeReferences(mainData())).toEqual({
      'system:income': 2_000_000,
      'system:housing': 500_000,
      'system:living': 1_000_000,
      'system:saving': 300_000,
      'system:investing': 200_000,
    });
  });

  it('separates purpose excess from the overall Main deficit', () => {
    const main = mainData({
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 900_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    });
    const applied = appliedState([
      link('living-checking', 'system:living', 'checking', 1_100_000),
    ]);

    expect(overallMainState(main)).toEqual({ remainingWon: -200_000, kind: 'deficit' });
    expect(reconcilePurpose('system:living', applied, locations, main)).toEqual({
      targetWon: 900_000,
      activeAllocatedWon: 1_100_000,
      unassignedWon: 0,
      excessWon: 200_000,
    });
  });

  it('subtracts active child targets from the parent direct target', () => {
    const applied = appliedState([], [{
      id: 'custom:telecom',
      parentId: 'system:living',
      name: '통신비',
      targetMonthlyWon: 60_000,
      createdAt: 1,
      updatedAt: 1,
    }]);

    expect(reconcilePurpose('system:living', applied, locations, mainData()).targetWon)
      .toBe(940_000);
    expect(reconcilePurpose('custom:telecom', applied, locations, mainData()).targetWon)
      .toBe(60_000);
  });

  it('calculates custom target capacity and excludes the purpose being edited', () => {
    const purposes: AccountMapApplied['customPurposes'] = [
      {
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 60_000,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'custom:archived',
        parentId: 'system:living',
        name: '보관됨',
        targetMonthlyWon: 900_000,
        archivedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      },
    ];

    expect(customPurposeTargetCapacity('system:living', purposes, mainData())).toBe(940_000);
    expect(customPurposeTargetCapacity('system:living', purposes, mainData(), 'custom:telecom'))
      .toBe(1_000_000);
  });

  it('does not count archived children, suspended links, or links to archived locations', () => {
    const applied = appliedState([
      link('active', 'system:living', 'checking', 200_000),
      { ...link('suspended', 'system:living', 'cash', 300_000), status: 'suspended', remainder: false, suspendedReason: 'user' },
      link('archived-location', 'system:living', 'archived', 400_000),
    ], [{
      id: 'custom:old',
      parentId: 'system:living',
      name: '과거 목적',
      targetMonthlyWon: 100_000,
      archivedAt: 30,
      createdAt: 1,
      updatedAt: 30,
    }]);

    expect(reconcilePurpose('system:living', applied, locations, mainData())).toEqual({
      targetWon: 1_000_000,
      activeAllocatedWon: 200_000,
      unassignedWon: 800_000,
      excessWon: 0,
    });
  });

  it('reflects Main changes without mutating links', () => {
    const applied = appliedState([link('living', 'system:living', 'checking', 800_000)]);
    const before = structuredClone(applied);

    expect(reconcilePurpose('system:living', applied, locations, mainData()).unassignedWon).toBe(200_000);
    expect(reconcilePurpose('system:living', applied, locations, mainData({ monthlyLivingWon: 700_000 })).excessWon).toBe(100_000);
    expect(applied).toEqual(before);
  });

  it('recalculates only the selected remainder link without mutating input', () => {
    const links = [
      link('remainder', 'system:living', 'checking', 600_000, true),
      link('fixed', 'system:living', 'cash', 250_000),
    ];

    const result = recalculateRemainder('system:living', 'remainder', 1_000_000, links);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.links.map(({ id, monthlyAmountWon, remainder }) => ({ id, monthlyAmountWon, remainder })))
        .toEqual([
          { id: 'remainder', monthlyAmountWon: 750_000, remainder: true },
          { id: 'fixed', monthlyAmountWon: 250_000, remainder: false },
        ]);
    }
    expect(links[0]?.monthlyAmountWon).toBe(600_000);
  });

  it('rejects remainder recalculation when fixed active links exceed target', () => {
    const result = recalculateRemainder('system:living', 'remainder', 200_000, [
      link('remainder', 'system:living', 'checking', 0, true),
      link('fixed', 'system:living', 'cash', 250_000),
    ]);

    expect(result).toEqual({ ok: false, reason: 'fixed-links-exceed-target', excessWon: 50_000 });
  });
});

function mainData(overrides: Partial<MainData> = {}): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 1,
    monthlyNetIncomeWon: 2_000_000,
    monthlyHousingWon: 500_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 200_000,
    ...overrides,
  };
}

function appliedState(
  links: PurposeLocationLink[],
  customPurposes: AccountMapApplied['customPurposes'] = [],
): AccountMapApplied {
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: 1,
    customPurposes,
    links,
    layout: 'purpose',
    setupCompletedAt: 1,
    updatedAt: 1,
  };
}

function link(
  id: string,
  purposeId: PurposeLocationLink['purposeId'],
  locationId: string,
  monthlyAmountWon: number,
  remainder = false,
): PurposeLocationLink {
  return {
    id,
    purposeId,
    locationId,
    monthlyAmountWon,
    remainder,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}

function location(id: string): FinancialLocation {
  return {
    id,
    shortName: id,
    kind: 'bank',
    roles: ['spending'],
    createdAt: 1,
    updatedAt: 1,
  };
}
