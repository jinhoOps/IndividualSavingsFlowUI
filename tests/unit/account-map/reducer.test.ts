import { describe, expect, it } from 'vitest';
import { accountMapReducer, type AccountMapState } from '../../../src/account-map/application/reducer';
import type { AccountMapApplied, AccountMapDraft } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

describe('Account Map reducer', () => {
  it('pins before opening the same node modal', () => {
    const hovered = accountMapReducer(mapState(), { type: 'node-hovered', nodeId: 'system:living' });
    const pinned = accountMapReducer(hovered, { type: 'node-invoked', nodeId: 'system:living' });
    expect(pinned.mode === 'map' && pinned.interaction).toMatchObject({ pinnedNodeId: 'system:living', modalNodeId: null });
    const opened = accountMapReducer(pinned, { type: 'node-invoked', nodeId: 'system:living' });
    expect(opened.mode === 'map' && opened.interaction.modalNodeId).toBe('system:living');
  });

  it('clears transient focus on blur and all focus on empty map invocation', () => {
    let state = accountMapReducer(mapState(), { type: 'node-hovered', nodeId: 'a' });
    state = accountMapReducer(state, { type: 'node-blurred', nodeId: 'a' });
    expect(state.mode === 'map' && state.interaction.transientNodeId).toBeNull();
    state = accountMapReducer(state, { type: 'node-invoked', nodeId: 'a' });
    state = accountMapReducer(state, { type: 'map-background-invoked' });
    expect(state.mode === 'map' && state.interaction).toMatchObject({ transientNodeId: null, pinnedNodeId: null });
  });

  it('Escape first closes a modal, then clears the pinned node', () => {
    let state = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    state = accountMapReducer(state, { type: 'node-invoked', nodeId: 'a' });
    state = accountMapReducer(state, { type: 'escape-invoked' });
    expect(state.mode === 'map' && state.interaction).toMatchObject({ modalNodeId: null, pinnedNodeId: 'a' });
    state = accountMapReducer(state, { type: 'escape-invoked' });
    expect(state.mode === 'map' && state.interaction.pinnedNodeId).toBeNull();
  });

  it('keeps UI state during pending, conflict, and retry', () => {
    const pinned = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    const pending = accountMapReducer(pinned, { type: 'save-requested' });
    expect(pending.mode === 'map' && pending.save.status).toBe('pending');
    const failed = accountMapReducer(pending, { type: 'save-failed', reason: 'conflict' });
    expect(failed.mode === 'map' && failed).toMatchObject({
      interaction: { pinnedNodeId: 'a' },
      save: { status: 'failed', reason: 'conflict' },
    });
    const retry = accountMapReducer(failed, { type: 'retry-requested' });
    expect(retry.mode === 'map' && retry.save.status).toBe('pending');
  });

  it('moves setup to review, preserves draft on exit, and clears only draft on cancellation', () => {
    const initial = setupState();
    const review = accountMapReducer(initial, { type: 'review-requested' });
    expect(review.mode === 'setup' && review.step).toBe('review');
    const exited = accountMapReducer(review, { type: 'setup-exited' });
    expect(exited.mode === 'setup' && exited).toMatchObject({ exitRequested: true, draft: expect.any(Object) });
    const cancelled = accountMapReducer(exited, { type: 'setup-cancelled' });
    expect(cancelled.mode === 'setup' && cancelled).toMatchObject({ draft: null, step: 'connect', exitRequested: false });
  });

  it('adopts the saved workspace revision after setup cancellation', () => {
    const workspace = { ...createEmptyWorkspace(7), revision: 7 };
    const cancelled = accountMapReducer(setupState(), { type: 'setup-cancelled', workspace });
    expect(cancelled.mode === 'setup' && cancelled.workspace.revision).toBe(7);
  });

  it('switches layout locally and enters map after apply succeeds', () => {
    const setup = setupState();
    const mapped = accountMapReducer(setup, { type: 'apply-succeeded', applied: applied('purpose') });
    const changed = accountMapReducer(mapped, { type: 'layout-changed', layout: 'account' });
    expect(changed.mode === 'map' && changed.applied.layout).toBe('account');
  });

  it('returns to fresh setup after a map-only reset', () => {
    const current = mapState();
    const workspace = createEmptyWorkspace(20);
    const reset = accountMapReducer(current, { type: 'reset-succeeded', workspace });
    expect(reset).toMatchObject({ mode: 'setup', draft: null, step: 'connect' });
  });
});

function mapState(): AccountMapState {
  const workspace = createEmptyWorkspace(1);
  return {
    mode: 'map', workspace, main: main(), applied: applied('purpose'),
    interaction: { transientNodeId: null, pinnedNodeId: null, modalNodeId: null },
    save: { status: 'idle' },
  };
}

function setupState(): AccountMapState {
  const workspace = createEmptyWorkspace(1);
  return {
    mode: 'setup', workspace, main: main(), draft: draft(), step: 'connect', resumed: false,
    mainChanged: false, exitRequested: false, save: { status: 'idle' },
  };
}

function main(): MainData {
  return { schemaVersion: 2, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}

function draft(): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 10 };
}

function applied(layout: AccountMapApplied['layout']): AccountMapApplied {
  return { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], layout, setupCompletedAt: 10, updatedAt: 10 };
}
