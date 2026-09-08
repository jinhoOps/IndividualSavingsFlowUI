import { describe, expect, it } from 'vitest';
import {
  parseStoredAccountMapApplied,
  parseStoredAccountMapDraft,
  projectAccountMapAppliedForView,
  projectAccountMapDraftForView,
  upgradeAccountMapAppliedForTransferSave,
  upgradeAccountMapDraftForTransferSave,
} from '../../../src/account-map/domain/accountMapVersioning';
import type {
  AccountMapApplied,
  AccountMapDraft,
  AccountTransferLink,
} from '../../../src/account-map/domain/model';

const appliedV2: AccountMapApplied = {
  schemaVersion: 2,
  sourceMainUpdatedAt: 10,
  customPurposes: [],
  links: [],
  setupCompletedAt: 20,
  updatedAt: 21,
};

const draftV1: AccountMapDraft = {
  schemaVersion: 1,
  sourceMainUpdatedAt: 10,
  customPurposes: [],
  links: [],
  step: 'connect',
  updatedAt: 11,
};

const transfer: AccountTransferLink = {
  id: 'transfer-1',
  sourceLocationId: 'salary',
  targetLocationId: 'spending',
  allocation: { kind: 'fixed', monthlyAmountWon: 100_000 },
  status: 'active',
  createdAt: 30,
  updatedAt: 31,
};

const appliedV3 = {
  ...appliedV2,
  schemaVersion: 3 as const,
  transfers: [transfer],
};

const draftV2 = {
  ...draftV1,
  schemaVersion: 2 as const,
  step: 'transfers' as const,
  transfers: [transfer],
};

describe('Account Map versioned transfer contracts', () => {
  it('accepts every supported applied and draft storage version', () => {
    expect(parseStoredAccountMapApplied(appliedV2)).not.toBeNull();
    expect(parseStoredAccountMapApplied(appliedV3)).not.toBeNull();
    expect(parseStoredAccountMapDraft(draftV1)).not.toBeNull();
    expect(parseStoredAccountMapDraft(draftV2)).not.toBeNull();
  });

  it('rejects unknown transfer allocation shapes and multiple active sweeps', () => {
    const appliedWithTwoActiveSweeps = {
      ...appliedV3,
      transfers: [
        { ...transfer, id: 'sweep-1', allocation: { kind: 'sweep' } },
        { ...transfer, id: 'sweep-2', allocation: { kind: 'sweep' } },
      ],
    };
    const appliedWithUnknownTransferAllocation = {
      ...appliedV3,
      transfers: [{ ...transfer, allocation: { kind: 'variable' } }],
    };

    expect(parseStoredAccountMapApplied(appliedWithTwoActiveSweeps)).toBeNull();
    expect(parseStoredAccountMapApplied(appliedWithUnknownTransferAllocation)).toBeNull();
  });

  it('projects old storage into a v3 view without changing the source', () => {
    const appliedSource = structuredClone(appliedV2);
    const draftSource = structuredClone(draftV1);
    const applied = projectAccountMapAppliedForView(appliedSource);
    const draft = projectAccountMapDraftForView(draftSource);

    expect(applied).toMatchObject({ schemaVersion: 3, transfers: [] });
    expect(draft).toMatchObject({ schemaVersion: 2, transfers: [], step: 'locations' });
    expect(appliedSource).toEqual(appliedV2);
    expect(draftSource).toEqual(draftV1);
  });

  it('upgrades only the selected state with transfer data and current step', () => {
    const applied = upgradeAccountMapAppliedForTransferSave(appliedV2, [transfer]);
    const draft = upgradeAccountMapDraftForTransferSave(draftV1, [transfer], 'review');

    expect(applied).toEqual({ ...appliedV2, schemaVersion: 3, transfers: [transfer] });
    expect(draft).toEqual({ ...draftV1, schemaVersion: 2, transfers: [transfer], step: 'review' });
    expect(appliedV2).toEqual({
      schemaVersion: 2,
      sourceMainUpdatedAt: 10,
      customPurposes: [],
      links: [],
      setupCompletedAt: 20,
      updatedAt: 21,
    });
    expect(draftV1.step).toBe('connect');
  });
});
