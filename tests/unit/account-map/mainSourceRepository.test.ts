import { describe, expect, it, vi } from 'vitest';
import { BrowserAccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import type { WorkspaceLoadResult } from '../../../src/workspace/infrastructure/workspaceRepository';

describe('Account Map Main source', () => {
  it('returns a defensive copy of all five applied Main values', () => {
    const workspace = createEmptyWorkspace(1);
    workspace.main.applied = { schemaVersion: 2, updatedAt: 3, monthlyNetIncomeWon: 10, monthlyHousingWon: 2, monthlyLivingWon: 3, monthlySavingWon: 4, monthlyInvestmentWon: 1 };
    const repository = new BrowserAccountMapMainSourceRepository({
      load: vi.fn((): WorkspaceLoadResult => ({ status: 'found', workspace, needsMigration: false })),
    });

    const result = repository.load();

    expect(result).toEqual({ status: 'found', data: workspace.main.applied });
    if (result.status === 'found') result.data.monthlyLivingWon = 999;
    expect(workspace.main.applied.monthlyLivingWon).toBe(3);
  });

  it.each(['invalid', 'unavailable'] as const)('passes through %s', (status) => {
    const repository = new BrowserAccountMapMainSourceRepository({
      load: vi.fn((): WorkspaceLoadResult => status === 'invalid'
        ? { status: 'invalid', raw: 'invalid' }
        : { status: 'unavailable' }),
    });
    expect(repository.load()).toEqual({ status });
  });
});
