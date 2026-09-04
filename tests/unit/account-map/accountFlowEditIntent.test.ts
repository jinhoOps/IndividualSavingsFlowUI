import { describe, expect, it } from 'vitest';
import { rebaseAccountFlowEditIntent } from '../../../src/account-map/domain/accountFlowEditIntent';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

describe('Account flow edit intent', () => {
  it('rebases a fixed amount change only when that fixed amount is unchanged upstream', () => {
    const workspace = workspaceWithTransfer();
    const result = rebaseAccountFlowEditIntent(workspace, {
      kind: 'transfer', surface: 'applied', id: 'salary-to-living',
      edit: {
        base: { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 500_000 }, status: 'active' },
        next: { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 700_000 }, status: 'active' },
      },
    });
    expect(result).toMatchObject({ ok: true, command: { type: 'edit-transfer', transferId: 'salary-to-living', fields: { allocation: { kind: 'fixed', monthlyAmountWon: 700_000 } } } });

    if (workspace.accountMap.applied?.schemaVersion !== 3) throw new Error('v3 applied map required');
    workspace.accountMap.applied.transfers[0] = {
      ...workspace.accountMap.applied.transfers[0]!, allocation: { kind: 'fixed', monthlyAmountWon: 600_000 },
    };
    expect(rebaseAccountFlowEditIntent(workspace, {
      kind: 'transfer', surface: 'applied', id: 'salary-to-living',
      edit: {
        base: { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 500_000 }, status: 'active' },
        next: { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 700_000 }, status: 'active' },
      },
    })).toEqual({ ok: false, reason: 'field-conflict', field: 'allocation' });
  });

  it.each([
    ['source change', { sourceLocationId: 'other', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 500_000 }, status: 'active' }],
    ['target change', { sourceLocationId: 'salary', targetLocationId: 'other', allocation: { kind: 'fixed', monthlyAmountWon: 500_000 }, status: 'active' }],
    ['fixed to sweep', { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'sweep' }, status: 'active' }],
  ] as const)('requires manual latest-state review for %s', (_name, next) => {
    expect(rebaseAccountFlowEditIntent(workspaceWithTransfer(), {
      kind: 'transfer', surface: 'applied', id: 'salary-to-living',
      edit: { base: fixedTransferFields(), next },
    })).toEqual({ ok: false, reason: 'manual-recovery', action: 'edit-transfer' });
  });

  it('requires manual latest-state review for transfer removal', () => {
    expect(rebaseAccountFlowEditIntent(workspaceWithTransfer(), {
      kind: 'remove-transfer', surface: 'applied', id: 'salary-to-living', base: fixedTransferFields(),
    })).toEqual({ ok: false, reason: 'manual-recovery', action: 'remove-transfer' });
  });

  it('requires manual latest-state review when reactivation now collides with topology', () => {
    const workspace = workspaceWithTransfer();
    if (workspace.accountMap.applied?.schemaVersion !== 3) throw new Error('v3 applied map required');
    workspace.accountMap.applied.transfers = [
      { ...workspace.accountMap.applied.transfers[0]!, status: 'suspended', suspendedReason: 'user' },
      { id: 'living-to-salary', sourceLocationId: 'living', targetLocationId: 'salary', allocation: { kind: 'fixed', monthlyAmountWon: 10 }, status: 'active', createdAt: 1, updatedAt: 1 },
    ];

    expect(rebaseAccountFlowEditIntent(workspace, {
      kind: 'transfer', surface: 'applied', id: 'salary-to-living',
      edit: {
        base: { ...fixedTransferFields(), status: 'suspended' },
        next: { ...fixedTransferFields(), status: 'active' },
      },
    })).toEqual({ ok: false, reason: 'manual-recovery', action: 'edit-transfer' });
  });
});

function workspaceWithTransfer() {
  const workspace = createEmptyWorkspace(1);
  workspace.main.applied = { schemaVersion: 2, updatedAt: 1, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
  workspace.locations = [
    { id: 'salary', shortName: '급여', kind: 'bank', institution: { name: '국민' }, roles: ['income'], createdAt: 1, updatedAt: 1 },
    { id: 'living', shortName: '생활', kind: 'bank', institution: { name: '하나' }, roles: ['spending'], createdAt: 1, updatedAt: 1 },
  ];
  workspace.accountMap.applied = {
    schemaVersion: 3, sourceMainUpdatedAt: 1, customPurposes: [], links: [],
    transfers: [{ id: 'salary-to-living', sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 500_000 }, status: 'active', createdAt: 1, updatedAt: 1 }],
    setupCompletedAt: 1, updatedAt: 1,
  };
  return workspace;
}

function fixedTransferFields() {
  return { sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed' as const, monthlyAmountWon: 500_000 }, status: 'active' as const };
}
