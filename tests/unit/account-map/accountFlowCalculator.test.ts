import { describe, expect, it } from 'vitest';
import { calculateAccountFlow } from '../../../src/account-map/domain/accountFlowCalculator';
import type { AccountTransferLink, PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

describe('calculateAccountFlow', () => {
  it('routes the approved salary, living, brokerage, and living-sweep plan without inflating external income', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('salary'), location('living'), location('brokerage')],
      links: [
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
        purposeLink('living-local', 'system:living', 'living', 900_000),
        purposeLink('investing-local', 'system:investing', 'brokerage', 1_000_000),
      ],
      transfers: [
        transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 900_000 }),
        transfer('salary-brokerage', 'salary', 'brokerage', { kind: 'fixed', monthlyAmountWon: 1_000_000 }),
        transfer('living-sweep', 'living', 'brokerage', { kind: 'sweep' }),
      ],
    });

    expect(result.accountsById.salary).toMatchObject({
      externalIncomeWon: 3_100_000,
      inboundTransferWon: 0,
      outboundFixedWon: 1_900_000,
      availableWon: 3_100_000,
      unassignedWon: 1_200_000,
    });
    expect(result.accountsById.living).toMatchObject({
      inboundFixedWon: 900_000,
      localAllocationWon: 900_000,
      sweepWon: 0,
      unassignedWon: 0,
      shortfallWon: 0,
    });
    expect(result.accountsById.brokerage).toMatchObject({
      inboundFixedWon: 1_000_000,
      inboundSweepWon: 0,
      localAllocationWon: 1_000_000,
    });
    expect(result.transfersById['living-sweep']).toMatchObject({
      allocationKind: 'sweep',
      amountWon: 0,
      status: 'active',
    });
    expect(result.workspaceTotals).toEqual({ externalIncomeWon: 3_100_000 });
    expect(result.topologicalOrder).toEqual(['salary', 'living', 'brokerage']);
  });

  it('routes a nonzero sweep only after local allocation and fixed outbound transfers', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('salary'), location('living'), location('brokerage')],
      links: [
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
        purposeLink('living-local', 'system:living', 'living', 700_000),
      ],
      transfers: [
        transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 1_200_000 }),
        transfer('living-sweep', 'living', 'brokerage', { kind: 'sweep' }),
      ],
    });

    expect(result.transfersById['living-sweep'].amountWon).toBe(500_000);
    expect(result.accountsById.living).toMatchObject({
      remainderBeforeSweepWon: 500_000,
      sweepWon: 500_000,
      unassignedWon: 0,
    });
    expect(result.accountsById.brokerage.inboundSweepWon).toBe(500_000);
  });

  it('supports multiple sources and destinations and retains an explicit zero sweep rule', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('income-a'), location('income-b'), location('living'), location('brokerage')],
      links: [
        purposeLink('income-a-link', 'system:income', 'income-a', 2_000_000),
        purposeLink('income-b-link', 'system:income', 'income-b', 1_100_000),
        purposeLink('living-link', 'system:living', 'living', 1_000_000),
      ],
      transfers: [
        transfer('a-living', 'income-a', 'living', { kind: 'fixed', monthlyAmountWon: 600_000 }),
        transfer('a-brokerage', 'income-a', 'brokerage', { kind: 'fixed', monthlyAmountWon: 500_000 }),
        transfer('b-living', 'income-b', 'living', { kind: 'fixed', monthlyAmountWon: 400_000 }),
        transfer('b-brokerage', 'income-b', 'brokerage', { kind: 'fixed', monthlyAmountWon: 700_000 }),
        transfer('living-sweep', 'living', 'brokerage', { kind: 'sweep' }),
      ],
    });

    expect(result.accountsById.living.inboundFixedWon).toBe(1_000_000);
    expect(result.accountsById.brokerage.inboundFixedWon).toBe(1_200_000);
    expect(result.transfersById['living-sweep'].amountWon).toBe(0);
    expect(result.transfers.map(({ id }) => id)).toEqual(['a-brokerage', 'a-living', 'b-brokerage', 'b-living', 'living-sweep']);
  });

  it('treats a custom purpose allocation as a local account sink', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('salary'), location('emergency')],
      links: [
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
        purposeLink('custom-emergency', 'custom:emergency', 'emergency', 250_000),
      ],
      transfers: [transfer('salary-emergency', 'salary', 'emergency', { kind: 'fixed', monthlyAmountWon: 250_000 })],
    });

    expect(result.accountsById.emergency.localAllocations).toEqual([
      { purposeId: 'custom:emergency', amountWon: 250_000 },
    ]);
    expect(result.accountsById.emergency.unassignedWon).toBe(0);
  });

  it('reports account shortfall and unassigned amounts as planning warnings instead of dropping either account', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('salary'), location('short'), location('unassigned')],
      links: [
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
        purposeLink('short-local', 'system:living', 'short', 500_000),
      ],
      transfers: [
        transfer('salary-short', 'salary', 'short', { kind: 'fixed', monthlyAmountWon: 200_000 }),
        transfer('salary-unassigned', 'salary', 'unassigned', { kind: 'fixed', monthlyAmountWon: 300_000 }),
      ],
    });

    expect(result.accountsById.short.shortfallWon).toBe(300_000);
    expect(result.accountsById.unassigned.unassignedWon).toBe(300_000);
    expect(result.warnings).toEqual([
      { kind: 'unassigned', locationId: 'salary', amountWon: 2_600_000 },
      { kind: 'shortfall', locationId: 'short', amountWon: 300_000 },
      { kind: 'unassigned', locationId: 'unassigned', amountWon: 300_000 },
    ]);
  });

  it('keeps suspended transfer rules visible at zero while excluding them from routing', () => {
    const result = calculateAccountFlow({
      main: mainData(),
      locations: [location('salary'), location('living')],
      links: [purposeLink('income-salary', 'system:income', 'salary', 3_100_000)],
      transfers: [
        { ...transfer('suspended', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 600_000 }), status: 'suspended', suspendedReason: 'user' },
      ],
    });

    expect(result.accountsById.salary.outboundFixedWon).toBe(0);
    expect(result.accountsById.living.inboundTransferWon).toBe(0);
    expect(result.transfersById.suspended).toMatchObject({ status: 'suspended', amountWon: 0 });
  });

  it('uses location IDs for deterministic topology and output regardless of storage order', () => {
    const input = {
      main: mainData(),
      locations: [location('brokerage'), location('salary'), location('living')],
      links: [
        purposeLink('living-local', 'system:living', 'living', 800_000),
        purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
      ],
      transfers: [
        transfer('living-brokerage', 'living', 'brokerage', { kind: 'sweep' }),
        transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 1_000_000 }),
      ],
    };

    const reversed = {
      ...input,
      locations: [...input.locations].reverse(),
      links: [...input.links].reverse(),
      transfers: [...input.transfers].reverse(),
    };

    expect(calculateAccountFlow(reversed)).toEqual(calculateAccountFlow(input));
    expect(calculateAccountFlow(input).topologicalOrder).toEqual(['salary', 'living', 'brokerage']);
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

function transfer(
  id: string,
  sourceLocationId: string,
  targetLocationId: string,
  allocation: AccountTransferLink['allocation'],
): AccountTransferLink {
  return { id, sourceLocationId, targetLocationId, allocation, status: 'active', createdAt: 1, updatedAt: 1 };
}
