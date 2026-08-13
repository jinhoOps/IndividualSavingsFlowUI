import { describe, expect, it } from 'vitest';
import { bootstrapAccountMap } from '../../../src/account-map/application/bootstrap';
import type { AccountMapApplied, AccountMapDraft } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

describe('Account Map bootstrap', () => {
  it('does not create Account Map state without applied Main', () => {
    expect(bootstrapAccountMap({ status: 'empty' }, foundWorkspace())).toEqual({ mode: 'main-required' });
  });

  it('requires migration before setup or map state', () => {
    expect(bootstrapAccountMap(foundMain(), foundWorkspace(true))).toMatchObject({
      mode: 'migrating',
      revision: 0,
    });
  });

  it('resumes a saved draft and marks a changed Main reference', () => {
    const workspace = foundWorkspace().workspace;
    workspace.accountMap.draft = draft(10);

    expect(bootstrapAccountMap(foundMain(20), { status: 'found', workspace, needsMigration: false }))
      .toMatchObject({ mode: 'setup', step: 'review', resumed: true, mainChanged: true });
  });

  it('opens an applied map with empty interaction state', () => {
    const workspace = foundWorkspace().workspace;
    workspace.accountMap.applied = applied();

    expect(bootstrapAccountMap(foundMain(), { status: 'found', workspace, needsMigration: false }))
      .toMatchObject({
        mode: 'map',
        interaction: { transientNodeId: null, pinnedNodeId: null, modalNodeId: null },
        save: { status: 'idle' },
      });
  });

  it.each(['invalid', 'unavailable'] as const)('maps %s workspace state', (status) => {
    const workspaceResult = status === 'invalid'
      ? { status: 'invalid' as const, raw: 'bad' }
      : { status: 'unavailable' as const };
    expect(bootstrapAccountMap(foundMain(), workspaceResult)).toMatchObject({ mode: status });
  });
});

function main(updatedAt = 10): MainData {
  return { schemaVersion: 2, updatedAt, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}

function foundMain(updatedAt = 10) {
  return { status: 'found' as const, data: main(updatedAt) };
}

function foundWorkspace(needsMigration = false) {
  const workspace = createEmptyWorkspace(1);
  workspace.main.applied = main();
  return { status: 'found' as const, workspace, needsMigration };
}

function draft(sourceMainUpdatedAt: number): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt, customPurposes: [], links: [], step: 'review', updatedAt: 10 };
}

function applied(): AccountMapApplied {
  return { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], layout: 'purpose', setupCompletedAt: 10, updatedAt: 10 };
}
