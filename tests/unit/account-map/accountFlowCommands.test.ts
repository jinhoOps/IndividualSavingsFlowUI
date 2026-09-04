import { describe, expect, it } from 'vitest';
import {
  applyAccountFlowCommand,
  mapNeedsMainConfirmation,
} from '../../../src/account-map/domain/accountFlowCommands';
import type { AccountMapAppliedV3, AccountTransferLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

describe('Account flow commands', () => {
  it('upgrades only the selected applied sub-slice when adding a transfer', () => {
    const workspace = workspaceWithLegacyApplied();
    const untouched = {
      main: structuredClone(workspace.main),
      simulation: structuredClone(workspace.simulation),
      portfolio: structuredClone(workspace.portfolio),
      locations: structuredClone(workspace.locations),
      draft: structuredClone(workspace.accountMap.draft),
    };

    const result = applyAccountFlowCommand(workspace, {
      type: 'add-transfer',
      surface: 'applied',
      transfer: {
        id: 'salary-to-living', sourceLocationId: 'salary', targetLocationId: 'living',
        allocation: { kind: 'fixed', monthlyAmountWon: 1_000_000 },
      },
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied).toMatchObject({
      schemaVersion: 3,
      transfers: [expect.objectContaining({ id: 'salary-to-living', status: 'active', createdAt: 20 })],
    });
    expect(result.workspace.main).toEqual(untouched.main);
    expect(result.workspace.simulation).toEqual(untouched.simulation);
    expect(result.workspace.portfolio).toEqual(untouched.portfolio);
    expect(result.workspace.locations).toEqual(untouched.locations);
    expect(result.workspace.accountMap.draft).toEqual(untouched.draft);
  });

  it('rejects transfer writes when the Main basis is absent', () => {
    const workspace = workspaceWithLegacyApplied();
    workspace.main.applied = null;
    const before = structuredClone(workspace);

    expect(applyAccountFlowCommand(workspace, {
      type: 'add-transfer', surface: 'applied',
      transfer: transferInput('salary-to-living', 'salary', 'living', 100),
    }, 20)).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['self-transfer', { sourceLocationId: 'salary', targetLocationId: 'salary', allocation: { kind: 'fixed', monthlyAmountWon: 1 } }],
    ['endpoint-not-found', { sourceLocationId: 'salary', targetLocationId: 'missing', allocation: { kind: 'fixed', monthlyAmountWon: 1 } }],
    ['endpoint-archived', { sourceLocationId: 'salary', targetLocationId: 'archived', allocation: { kind: 'fixed', monthlyAmountWon: 1 } }],
    ['invalid-amount', { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: -1 } }],
  ] as const)('rejects %s without changing the workspace', (reason, transfer) => {
    const workspace = workspaceWithAppliedV3();
    const before = structuredClone(workspace);

    expect(applyAccountFlowCommand(workspace, {
      type: 'add-transfer', surface: 'applied', transfer: { id: `invalid-${reason}`, ...transfer },
    }, 20)).toEqual({ ok: false, reason });
    expect(workspace).toEqual(before);
  });

  it('rejects duplicate pairs, cycles, and a second sweep from one source', () => {
    const duplicate = workspaceWithAppliedV3([transfer('one', 'salary', 'living', 100)]);
    expect(applyAccountFlowCommand(duplicate, {
      type: 'add-transfer', surface: 'applied', transfer: transferInput('two', 'salary', 'living', 200),
    }, 20)).toEqual({ ok: false, reason: 'duplicate-transfer' });

    const cycle = workspaceWithAppliedV3([transfer('one', 'salary', 'living', 100)]);
    expect(applyAccountFlowCommand(cycle, {
      type: 'add-transfer', surface: 'applied', transfer: transferInput('two', 'living', 'salary', 200),
    }, 20)).toEqual({ ok: false, reason: 'cycle' });

    const sweep = workspaceWithAppliedV3([{ ...transfer('one', 'salary', 'living', 0), allocation: { kind: 'sweep' } }]);
    expect(applyAccountFlowCommand(sweep, {
      type: 'add-transfer', surface: 'applied', transfer: { id: 'two', sourceLocationId: 'salary', targetLocationId: 'brokerage', allocation: { kind: 'sweep' } },
    }, 20)).toEqual({ ok: false, reason: 'multiple-sweeps' });
  });

  it('rejects an invalid edited fixed amount without changing the source workspace', () => {
    const workspace = workspaceWithAppliedV3([transfer('salary-to-living', 'salary', 'living', 100)]);
    const before = structuredClone(workspace);

    expect(applyAccountFlowCommand(workspace, {
      type: 'edit-transfer', surface: 'applied', transferId: 'salary-to-living',
      fields: { allocation: { kind: 'fixed', monthlyAmountWon: -1 } },
    }, 20)).toEqual({ ok: false, reason: 'invalid-amount' });
    expect(workspace).toEqual(before);
  });

  it('confirms a newer Main basis by recalculating purpose remainders without changing transfers', () => {
    const workspace = workspaceWithAppliedV3([transfer('salary-to-living', 'salary', 'living', 100)]);
    workspace.main.applied = main(30, 800_000);
    workspace.accountMap.applied!.links = [
      purposeLink('living-fixed', 'living', 200_000, false),
      purposeLink('living-remainder', 'living-two', 800_000, true),
    ];
    if (workspace.accountMap.applied?.schemaVersion !== 3) throw new Error('v3 applied map required');
    const beforeTransfers = structuredClone(workspace.accountMap.applied.transfers);

    expect(mapNeedsMainConfirmation(workspace.accountMap.applied!, workspace.main.applied)).toBe(true);
    const result = applyAccountFlowCommand(workspace, { type: 'confirm-current-main' }, 40);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const applied = result.workspace.accountMap.applied as AccountMapAppliedV3;
    expect(applied.sourceMainUpdatedAt).toBe(30);
    expect(applied.links.find(({ id }) => id === 'living-remainder')?.monthlyAmountWon).toBe(600_000);
    expect(applied.transfers).toEqual(beforeTransfers);
    expect(mapNeedsMainConfirmation(applied, workspace.main.applied)).toBe(false);
  });

  it('rejects a changed Main basis that leaves fixed purpose allocations above the target without writes', () => {
    const workspace = workspaceWithAppliedV3();
    workspace.main.applied = main(30, 100_000);
    workspace.accountMap.applied!.links = [
      purposeLink('living-fixed', 'living', 200_000, false),
      purposeLink('living-remainder', 'living-two', 800_000, true),
    ];
    const before = structuredClone(workspace);

    expect(applyAccountFlowCommand(workspace, { type: 'confirm-current-main' }, 40))
      .toEqual({ ok: false, reason: 'purpose-fixed-excess' });
    expect(workspace).toEqual(before);
  });

  it('rejects a fixed-only purpose allocation that exceeds the refreshed target', () => {
    const workspace = workspaceWithAppliedV3();
    workspace.main.applied = main(30, 100_000);
    workspace.accountMap.applied!.links = [purposeLink('living-fixed', 'living', 200_000, false)];
    const before = structuredClone(workspace);

    expect(applyAccountFlowCommand(workspace, { type: 'confirm-current-main' }, 40))
      .toEqual({ ok: false, reason: 'purpose-fixed-excess' });
    expect(workspace).toEqual(before);
  });
});

function workspaceWithLegacyApplied() {
  const workspace = createEmptyWorkspace(1);
  workspace.main.applied = main();
  workspace.locations = locations();
  workspace.accountMap.applied = {
    schemaVersion: 2, sourceMainUpdatedAt: 10, customPurposes: [], links: [], setupCompletedAt: 10, updatedAt: 10,
  };
  return workspace;
}

function workspaceWithAppliedV3(transfers: AccountTransferLink[] = []) {
  const workspace = workspaceWithLegacyApplied();
  workspace.accountMap.applied = {
    schemaVersion: 3, sourceMainUpdatedAt: 10, customPurposes: [], links: [], transfers, setupCompletedAt: 10, updatedAt: 10,
  };
  return workspace;
}

function main(updatedAt = 10, monthlyLivingWon = 1_000_000): MainData {
  return { schemaVersion: 2, updatedAt, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}

function locations(): FinancialLocation[] {
  return [
    { id: 'salary', shortName: '급여', kind: 'bank', institution: { name: '국민' }, roles: ['income'], createdAt: 1, updatedAt: 1 },
    { id: 'living', shortName: '생활', kind: 'bank', institution: { name: '하나' }, roles: ['spending'], createdAt: 1, updatedAt: 1 },
    { id: 'living-two', shortName: '생활2', kind: 'bank', institution: { name: '우리' }, roles: ['spending'], createdAt: 1, updatedAt: 1 },
    { id: 'brokerage', shortName: '증권', kind: 'brokerage', institution: { name: '미래' }, roles: ['investing'], createdAt: 1, updatedAt: 1 },
    { id: 'archived', shortName: '해지', kind: 'bank', institution: { name: '토스' }, roles: ['saving'], archivedAt: 2, createdAt: 1, updatedAt: 2 },
  ];
}

function transfer(id: string, sourceLocationId: string, targetLocationId: string, monthlyAmountWon: number): AccountTransferLink {
  return { id, sourceLocationId, targetLocationId, allocation: { kind: 'fixed', monthlyAmountWon }, status: 'active', createdAt: 1, updatedAt: 1 };
}

function transferInput(id: string, sourceLocationId: string, targetLocationId: string, monthlyAmountWon: number) {
  return { id, sourceLocationId, targetLocationId, allocation: { kind: 'fixed' as const, monthlyAmountWon } };
}

function purposeLink(id: string, locationId: string, monthlyAmountWon: number, remainder: boolean) {
  return { id, purposeId: 'system:living' as const, locationId, monthlyAmountWon, remainder, status: 'active' as const, createdAt: 1, updatedAt: 1 };
}
