import { describe, expect, it } from 'vitest';
import { accountMapReducer, type AccountMapState } from '../../../src/account-map/application/reducer';
import type { AccountMapEditIntent } from '../../../src/account-map/domain/editIntent';
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

  it('keeps UI state during pending, transport failure, and retry', () => {
    const pinned = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    const pending = accountMapReducer(pinned, { type: 'save-requested' });
    expect(pending.mode === 'map' && pending.save.status).toBe('pending');
    const failed = accountMapReducer(pending, { type: 'save-failed', reason: 'unavailable' });
    expect(failed.mode === 'map' && failed).toMatchObject({
      interaction: { pinnedNodeId: 'a' },
      save: { status: 'failed', reason: 'unavailable' },
    });
    const retry = accountMapReducer(failed, { type: 'retry-requested' });
    expect(retry.mode === 'map' && retry.save.status).toBe('pending');
  });

  it('stores a stale setup intent without replacing the typed draft or current workspace', () => {
    const current = setupState();
    const latest = workspaceWithMain(2);
    const conflicted = accountMapReducer(current, {
      type: 'save-conflicted',
      latest,
      intent: linkIntent(),
    });

    expect(conflicted.mode === 'setup' && conflicted).toMatchObject({
      workspace: { revision: 0 },
      draft: current.mode === 'setup' ? current.draft : null,
      save: { status: 'idle' },
      recovery: { status: 'stale', latest: { revision: 2 }, intent: linkIntent() },
    });
  });

  it('stores a stale modal intent without closing the active modal', () => {
    let current = mapState();
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'a' });
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'a' });
    const latest = workspaceWithMain(2);

    const conflicted = accountMapReducer(current, {
      type: 'save-conflicted',
      latest,
      intent: linkIntent(),
    });

    expect(conflicted.mode === 'map' && conflicted).toMatchObject({
      workspace: { revision: 0 },
      interaction: { modalNodeId: 'a' },
      recovery: { status: 'stale', latest: { revision: 2 }, intent: linkIntent() },
    });
  });

  it('retains the stale intent and exposes collision field metadata', () => {
    const latest = workspaceWithMain(2);
    const stale = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest, intent: linkIntent(),
    });
    const collided = accountMapReducer(stale, {
      type: 'reapply-collided', field: 'monthlyAmountWon', reason: 'field-conflict',
    });

    expect(collided.mode === 'map' && collided.recovery).toEqual({
      status: 'collision',
      latest,
      intent: linkIntent(),
      field: 'monthlyAmountWon',
      reason: 'field-conflict',
    });
  });

  it('adopts the replayed workspace and clears recovery after reapply succeeds', () => {
    const stale = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest: workspaceWithMain(2), intent: linkIntent(),
    });
    const saved = workspaceWithMain(3);
    saved.accountMap.applied = applied('purpose');
    const reapplied = accountMapReducer(stale, { type: 'reapply-succeeded', workspace: saved });

    expect(reapplied.mode === 'map' && reapplied).toMatchObject({
      workspace: { revision: 3 },
      recovery: { status: 'none' },
      save: { status: 'idle' },
    });
  });

  it('adopts latest map or setup mode when the user keeps the latest value', () => {
    const latestMap = workspaceWithMain(2);
    latestMap.accountMap.applied = applied('account');
    const staleSetup = accountMapReducer(setupState(), {
      type: 'save-conflicted', latest: latestMap, intent: linkIntent(),
    });
    const mapped = accountMapReducer(staleSetup, { type: 'latest-kept' });
    expect(mapped).toMatchObject({ mode: 'map', workspace: { revision: 2 }, applied: { layout: 'account' }, recovery: { status: 'none' } });

    const latestSetup = workspaceWithMain(3);
    latestSetup.accountMap.draft = draft();
    const staleMap = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest: latestSetup, intent: linkIntent(),
    });
    const setup = accountMapReducer(staleMap, { type: 'latest-kept' });
    expect(setup).toMatchObject({ mode: 'setup', workspace: { revision: 3 }, draft: expect.any(Object), recovery: { status: 'none' } });
  });

  it('adopts a concurrently updated Main source across stale recovery paths', () => {
    const latestMain = { ...main(), updatedAt: 20, monthlyLivingWon: 900_000 };
    const latestMap = workspaceWithMain(2);
    latestMap.main.applied = latestMain;
    latestMap.accountMap.applied = applied('account');
    const staleMap = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest: latestMap, intent: linkIntent(),
    });
    const reapplied = accountMapReducer(staleMap, { type: 'reapply-succeeded', workspace: latestMap });
    expect(reapplied).toMatchObject({ mode: 'map', main: latestMain });

    let modal = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    modal = accountMapReducer(modal, { type: 'node-invoked', nodeId: 'a' });
    const manual = accountMapReducer(modal, {
      type: 'save-manual-conflicted', latest: latestMap,
      action: 'edit-node', targets: [{ kind: 'node', id: 'a' }], reason: 'compound-edit',
    });
    const reviewed = accountMapReducer(manual, { type: 'review-latest' });
    expect(reviewed).toMatchObject({ mode: 'map', main: latestMain });

    const latestSetup = workspaceWithMain(3);
    latestSetup.main.applied = latestMain;
    latestSetup.accountMap.draft = draft();
    const staleSetup = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest: latestSetup, intent: linkIntent(),
    });
    const kept = accountMapReducer(staleSetup, { type: 'latest-kept' });
    expect(kept).toMatchObject({ mode: 'setup', main: latestMain, mainChanged: true });
  });

  it('adopts the migrated workspace Main and recomputes setup status from it', () => {
    const latestMain = { ...main(), updatedAt: 20, monthlyLivingWon: 900_000 };
    const latest = workspaceWithMain(2);
    latest.main.applied = latestMain;
    latest.accountMap.draft = draft();

    const migrated = accountMapReducer(migratingState(), {
      type: 'migration-succeeded', workspace: latest,
    });

    expect(migrated).toMatchObject({
      mode: 'setup',
      workspace: { revision: 2 },
      main: latestMain,
      mainChanged: true,
    });
  });

  it('requires Main immediately when the migrated workspace no longer has one', () => {
    const latest = workspaceWithMain(2);
    latest.main.applied = null;

    expect(accountMapReducer(migratingState(), {
      type: 'migration-succeeded', workspace: latest,
    })).toEqual({ mode: 'main-required' });
  });

  it('requires Main when a concurrent recovery workspace removed its applied plan', () => {
    const withoutMain = { ...createEmptyWorkspace(2), revision: 2 };

    const stale = accountMapReducer(mapState(), {
      type: 'save-conflicted', latest: withoutMain, intent: linkIntent(),
    });
    expect(accountMapReducer(stale, { type: 'latest-kept' })).toEqual({ mode: 'main-required' });
    expect(accountMapReducer(stale, { type: 'reapply-succeeded', workspace: withoutMain }))
      .toEqual({ mode: 'main-required' });

    let modal = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    modal = accountMapReducer(modal, { type: 'node-invoked', nodeId: 'a' });
    const manual = accountMapReducer(modal, {
      type: 'save-manual-conflicted', latest: withoutMain,
      action: 'edit-node', targets: [{ kind: 'node', id: 'a' }], reason: 'compound-edit',
    });
    expect(accountMapReducer(manual, { type: 'review-latest' })).toEqual({ mode: 'main-required' });
  });

  it('keeps the modal open while adopting latest for manual compound review', () => {
    let current = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'a' });
    const latest = workspaceWithMain(2);
    latest.accountMap.applied = applied('account');
    const conflicted = accountMapReducer(current, {
      type: 'save-manual-conflicted', latest, action: 'edit-node', targets: [{ kind: 'node', id: 'a' }], reason: 'compound-edit',
    });
    expect(conflicted).toMatchObject({
      mode: 'map', workspace: { revision: 0 }, interaction: { modalNodeId: 'a' },
      recovery: { status: 'manual', latest: { revision: 2 }, action: 'edit-node', targets: [{ kind: 'node', id: 'a' }], reason: 'compound-edit' },
    });

    const reviewing = accountMapReducer(conflicted, { type: 'review-latest' });
    expect(reviewing).toMatchObject({
      mode: 'map', workspace: { revision: 2 }, applied: { layout: 'account' },
      interaction: { modalNodeId: 'a' }, recovery: { status: 'none' },
    });
  });

  it('keeps manual recovery and inputs when the latest workspace removed the modal target', () => {
    let current: AccountMapState = mapState();
    if (current.mode !== 'map') throw new Error('map state required');
    current = { ...current, workspace: { ...current.workspace, locations: [{ id: 'checking', shortName: '생활비', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 }] } };
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'location:checking' });
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'location:checking' });
    const latest = workspaceWithMain(2);
    latest.accountMap.applied = applied('purpose');
    const conflicted = accountMapReducer(current, {
      type: 'save-manual-conflicted', latest, action: 'edit-node', targets: [{ kind: 'node', id: 'location:checking' }], reason: 'compound-edit',
    });

    const reviewed = accountMapReducer(conflicted, { type: 'review-latest' });

    expect(reviewed).toMatchObject({
      mode: 'map', workspace: { revision: 0 }, interaction: { modalNodeId: 'location:checking' },
      recovery: { status: 'manual', reason: 'target-missing', action: 'edit-node', targets: [{ kind: 'node', id: 'location:checking' }] },
    });
  });

  it('keeps setup input when manual review finds that latest already has an applied map', () => {
    const current = setupState();
    const latest = workspaceWithMain(2);
    latest.accountMap.applied = applied('purpose');
    const conflicted = accountMapReducer(current, {
      type: 'save-manual-conflicted', latest, action: 'apply-map', targets: [], reason: 'compound-edit',
    });

    const reviewed = accountMapReducer(conflicted, { type: 'review-latest' });

    expect(reviewed).toMatchObject({
      mode: 'setup', workspace: { revision: 0 }, draft: current.mode === 'setup' ? current.draft : null,
      recovery: { status: 'manual', reason: 'target-missing', action: 'apply-map' },
    });
  });

  it('keeps compound modal input when a child link disappears or its location is archived', () => {
    const current = mapState();
    const latest = workspaceWithMain(2);
    latest.locations = [{ id: 'checking', shortName: '생활비', kind: 'bank', roles: ['spending'], archivedAt: 2, createdAt: 1, updatedAt: 2 }];
    latest.accountMap.applied = {
      ...applied('purpose'),
      links: [{ id: 'living', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 }],
    };
    const conflicted = accountMapReducer(current, {
      type: 'save-manual-conflicted', latest, action: 'edit-node', targets: [{ kind: 'link', id: 'living' }], reason: 'compound-edit',
    });

    const reviewed = accountMapReducer(conflicted, { type: 'review-latest' });

    expect(reviewed).toMatchObject({
      mode: 'map', workspace: { revision: 0 },
      recovery: { status: 'manual', reason: 'target-missing', targets: [{ kind: 'link', id: 'living' }] },
    });
  });

  it('keeps the active map modal when latest no longer has an applied map', () => {
    let current = accountMapReducer(mapState(), { type: 'node-invoked', nodeId: 'a' });
    current = accountMapReducer(current, { type: 'node-invoked', nodeId: 'a' });
    const latest = workspaceWithMain(2);
    latest.accountMap.draft = draft();
    const conflicted = accountMapReducer(current, {
      type: 'save-manual-conflicted', latest, action: 'edit-node', targets: [{ kind: 'node', id: 'a' }], reason: 'compound-edit',
    });

    const reviewed = accountMapReducer(conflicted, { type: 'review-latest' });

    expect(reviewed).toMatchObject({
      mode: 'map', workspace: { revision: 0 }, interaction: { modalNodeId: 'a' },
      recovery: { status: 'manual', reason: 'target-missing', action: 'edit-node' },
    });
  });

  it.each([
    ['archive-location', { kind: 'link' as const, id: 'replacement-link' }],
    ['restore-location', { kind: 'restorable-link' as const, id: 'restored-link' }],
  ] as const)('keeps %s recovery when a replacement remainder target disappeared', (action, target) => {
    const latest = workspaceWithMain(2);
    latest.locations = [{
      id: 'checking', shortName: '생활비', kind: 'bank', roles: ['spending'],
      ...(action === 'restore-location' ? { archivedAt: 2 } : {}), createdAt: 1, updatedAt: 2,
    }];
    latest.accountMap.applied = applied('purpose');
    const conflicted = accountMapReducer(mapState(), {
      type: 'save-manual-conflicted', latest, action, targets: [{ kind: 'location', id: 'checking' }, target], reason: 'compound-edit',
    });

    const reviewed = accountMapReducer(conflicted, { type: 'review-latest' });

    expect(reviewed).toMatchObject({
      mode: 'map', workspace: { revision: 0 },
      recovery: { status: 'manual', reason: 'target-missing', action, targets: expect.arrayContaining([target]) },
    });
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
    save: { status: 'idle' }, recovery: { status: 'none' },
  };
}

function setupState(): AccountMapState {
  const workspace = createEmptyWorkspace(1);
  return {
    mode: 'setup', workspace, main: main(), draft: draft(), step: 'connect', resumed: false,
    mainChanged: false, exitRequested: false, save: { status: 'idle' }, recovery: { status: 'none' },
  };
}

function migratingState(): AccountMapState {
  const workspace = workspaceWithMain(1);
  return {
    mode: 'migrating', workspace, main: main(), revision: 1, save: { status: 'pending' },
  };
}

function main(): MainData {
  return { schemaVersion: 2, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}

function workspaceWithMain(revision: number) {
  const workspace = createEmptyWorkspace(revision);
  workspace.revision = revision;
  workspace.main.applied = main();
  return workspace;
}

function draft(): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 10 };
}

function applied(layout: AccountMapApplied['layout']): AccountMapApplied {
  return { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], layout, setupCompletedAt: 10, updatedAt: 10 };
}

function linkIntent(): AccountMapEditIntent {
  return {
    kind: 'link',
    id: 'living',
    edit: {
      base: { monthlyAmountWon: 700_000, status: 'active', remainder: true },
      next: { monthlyAmountWon: 650_000, status: 'active', remainder: true },
    },
  };
}
