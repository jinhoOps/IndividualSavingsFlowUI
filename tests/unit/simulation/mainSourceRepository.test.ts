import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserMainSourceRepository,
} from '../../../src/simulation/infrastructure/mainSourceRepository';
import type { MainData } from '../../../src/main/domain/model';
import { createEmptyWorkspace, WORKSPACE_STORAGE_KEY } from '../../../src/workspace/domain/model';
import { BrowserWorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';
import { MemoryStorage } from './MemoryStorage';

const appliedMain: MainData = {
  schemaVersion: 2,
  updatedAt: 123,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('BrowserMainSourceRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('projects only applied workspace Main savings, investments, and revision time', () => {
    const workspace = createEmptyWorkspace(100);
    workspace.main.applied = appliedMain;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));

    expect(new BrowserMainSourceRepository(new BrowserWorkspaceRepository(storage)).load()).toEqual({
      status: 'found',
      source: {
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 123,
      },
    });
  });

  it('reports empty without a workspace even when old Main records are populated', () => {
    const oldRaw = JSON.stringify({ ...appliedMain, monthlySavingWon: 999_000 });
    storage.setItem('isf-main-v2', oldRaw);
    storage.setItem('isf-rebuild-v1', JSON.stringify({ monthlyInvest: 900_000 }));

    expect(new BrowserMainSourceRepository(new BrowserWorkspaceRepository(storage)).load())
      .toEqual({ status: 'empty' });
    expect(storage.getItem('isf-main-v2')).toBe(oldRaw);
  });

  it('reports empty when only workspace setup progress exists', () => {
    const workspace = createEmptyWorkspace(100);
    workspace.main.setupProgress = {
      kind: 'initial',
      step: 'review',
      draft: appliedMain,
      savedAt: 123,
    };
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));

    expect(new BrowserMainSourceRepository(new BrowserWorkspaceRepository(storage)).load())
      .toEqual({ status: 'empty' });
  });

  it('preserves invalid and unavailable results without subscribing or writing', () => {
    const invalidLoad = vi.fn(() => ({ status: 'invalid', raw: '{broken' } as const));
    const unavailableLoad = vi.fn(() => ({ status: 'unavailable' } as const));

    expect(new BrowserMainSourceRepository({ load: invalidLoad }).load()).toEqual({ status: 'invalid' });
    expect(new BrowserMainSourceRepository({ load: unavailableLoad }).load()).toEqual({ status: 'unavailable' });
    expect(invalidLoad).toHaveBeenCalledOnce();
    expect(unavailableLoad).toHaveBeenCalledOnce();
  });
});
