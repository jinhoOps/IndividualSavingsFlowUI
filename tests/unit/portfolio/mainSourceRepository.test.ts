import { describe, expect, it, vi } from 'vitest';
import {
  BrowserPortfolioMainSourceRepository,
} from '../../../src/portfolio/infrastructure/mainSourceRepository';
import type { MainData } from '../../../src/main/domain/model';
import { createEmptyWorkspace, WORKSPACE_STORAGE_KEY, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import { BrowserWorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';
import { MemoryStorage } from '../simulation/MemoryStorage';

const validMain: MainData = {
  schemaVersion: 2,
  updatedAt: 10,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 250_000,
};

describe('BrowserPortfolioMainSourceRepository', () => {
  it('reads the applied Main slice and preserves the current result projection', () => {
    const storage = new MemoryStorage();
    const workspace = createEmptyWorkspace(100);
    workspace.main.applied = validMain;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));

    expect(new BrowserPortfolioMainSourceRepository(new BrowserWorkspaceRepository(storage)).load())
      .toEqual({
        status: 'found',
        source: { monthlyInvestmentWon: 250_000, mainUpdatedAt: 10 },
      });
  });

  it('does not consume old Main keys when the workspace or applied slice is missing', () => {
    const storage = new MemoryStorage();
    const oldRaw = JSON.stringify(validMain);
    storage.setItem('isf-main-v2', oldRaw);
    storage.setItem('isf-rebuild-v1', JSON.stringify({ monthlyInvest: 999_000 }));

    const repository = new BrowserPortfolioMainSourceRepository(new BrowserWorkspaceRepository(storage));
    expect(repository.load()).toEqual({ status: 'empty' });
    expect(storage.getItem('isf-main-v2')).toBe(oldRaw);

    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(createEmptyWorkspace(100)));
    expect(repository.load()).toEqual({ status: 'empty' });
  });

  it('validates the applied value with the canonical Main parser at the reader boundary', () => {
    const workspace = createEmptyWorkspace(100);
    const malformed = {
      ...workspace,
      main: { ...workspace.main, applied: { ...validMain, monthlyInvestmentWon: -1 } },
    } as unknown as WorkspaceDocument;

    expect(new BrowserPortfolioMainSourceRepository({
      load: () => ({ status: 'found', workspace: malformed }),
    }).load()).toEqual({ status: 'invalid' });
  });

  it('preserves invalid and unavailable results without subscribing or writing', () => {
    const invalidLoad = vi.fn(() => ({ status: 'invalid', raw: '{' } as const));
    const unavailableLoad = vi.fn(() => ({ status: 'unavailable' } as const));

    expect(new BrowserPortfolioMainSourceRepository({ load: invalidLoad }).load())
      .toEqual({ status: 'invalid' });
    expect(new BrowserPortfolioMainSourceRepository({ load: unavailableLoad }).load())
      .toEqual({ status: 'unavailable' });
    expect(invalidLoad).toHaveBeenCalledOnce();
    expect(unavailableLoad).toHaveBeenCalledOnce();
  });
});
