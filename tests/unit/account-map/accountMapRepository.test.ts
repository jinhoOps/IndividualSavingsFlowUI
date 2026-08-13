import { describe, expect, it, vi } from 'vitest';
import { BrowserAccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import type { WorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';

describe('Account Map repository', () => {
  it('rejects a stale revision without writing', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source);

    const result = await repository.save(5, { type: 'reset-map' });

    expect(result).toEqual({ status: 'conflict', currentRevision: 0 });
    expect(source.replace).not.toHaveBeenCalled();
  });

  it('returns domain rejection and storage failure explicitly', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source);
    expect(await repository.save(0, {
      type: 'archive-location', locationId: 'missing', replacementRemainderByPurpose: {},
    })).toEqual({ status: 'rejected', reason: 'location-not-found' });

    source.replace.mockResolvedValueOnce({ status: 'unavailable' });
    expect(await repository.save(0, { type: 'reset-map' })).toEqual({ status: 'unavailable' });
  });

  it('delegates migration and persists a valid command at the expected revision', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source, () => 20);

    expect(await repository.migrate(0)).toMatchObject({ status: 'saved' });
    expect(source.migrate).toHaveBeenCalledWith(0);
    expect(await repository.save(0, { type: 'reset-map' })).toMatchObject({ status: 'saved' });
    expect(source.replace).toHaveBeenCalledWith(0, expect.objectContaining({ accountMap: expect.any(Object) }));
  });

  it('rebases a saved intent onto latest unrelated fields and preserves protected slices', async () => {
    const workspace = connectedWorkspace();
    workspace.accountMap.applied!.layout = 'account';
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source, () => 20);

    const result = await repository.saveIntent(0, {
      kind: 'link',
      id: 'living',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
      },
    });

    expect(result).toMatchObject({ status: 'saved' });
    const candidate = source.replace.mock.calls.at(-1)?.[1];
    expect(candidate?.accountMap.applied?.layout).toBe('account');
    expect(candidate?.accountMap.applied?.links.find(({ id }) => id === 'living')?.monthlyAmountWon)
      .toBe(150_000);
    expect(JSON.stringify(candidate?.main)).toBe(JSON.stringify(workspace.main));
    expect(JSON.stringify(candidate?.simulation)).toBe(JSON.stringify(workspace.simulation));
    expect(JSON.stringify(candidate?.portfolio)).toBe(JSON.stringify(workspace.portfolio));
  });

  it('reports an intent field conflict without writing', async () => {
    const workspace = connectedWorkspace();
    workspace.accountMap.applied!.links[1] = {
      ...workspace.accountMap.applied!.links[1]!,
      monthlyAmountWon: 120_000,
    };
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source, () => 20);

    expect(await repository.saveIntent(0, {
      kind: 'link',
      id: 'living',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
      },
    })).toEqual({
      status: 'rejected',
      reason: 'field-conflict',
      field: 'monthlyAmountWon',
    });
    expect(source.replace).not.toHaveBeenCalled();
  });
});

function connectedWorkspace(): WorkspaceDocument {
  const workspace = createEmptyWorkspace(1);
  workspace.main.applied = main();
  workspace.locations = [location()];
  workspace.accountMap.applied = {
    schemaVersion: 1,
    sourceMainUpdatedAt: 1,
    customPurposes: [],
    links: [incomeLink(), livingLink()],
    layout: 'purpose',
    setupCompletedAt: 1,
    updatedAt: 1,
  };
  return workspace;
}

function main(): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 1,
    monthlyNetIncomeWon: 2_000_000,
    monthlyHousingWon: 500_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 200_000,
  };
}

function location(): FinancialLocation {
  return {
    id: 'checking',
    shortName: '생활비',
    institution: { id: 'hana', name: '하나은행' },
    kind: 'bank',
    roles: ['income', 'spending'],
    createdAt: 1,
    updatedAt: 1,
  };
}

function incomeLink(): PurposeLocationLink {
  return {
    id: 'income',
    purposeId: 'system:income',
    locationId: 'checking',
    monthlyAmountWon: 2_000_000,
    remainder: true,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}

function livingLink(): PurposeLocationLink {
  return {
    id: 'living',
    purposeId: 'system:living',
    locationId: 'checking',
    monthlyAmountWon: 100_000,
    remainder: false,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}

function fakeWorkspaceRepository(workspace: ReturnType<typeof createEmptyWorkspace>) {
  return {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    migrate: vi.fn(async () => ({ status: 'saved' as const, workspace })),
    update: vi.fn(),
    replace: vi.fn<WorkspaceRepository['replace']>(async () => ({ status: 'saved', workspace })),
    resetInvalid: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  } satisfies WorkspaceRepository;
}
