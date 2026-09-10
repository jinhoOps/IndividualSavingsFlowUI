import {createExpenseDraft} from '../../../src/main/domain/expenseAssistant';
import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';
import { INVALID_PENDING_RECOVERY_KEY } from '../../../src/workspace/infrastructure/accountWorkspaceCache';
import { workspaceFromRow, workspacePayload, type WorkspaceRemote, type RemoteCommit } from '../../../src/workspace/infrastructure/workspaceRemote';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

const localStorage = new MemoryStorage();

function row(workspace = createEmptyWorkspace(1000), user = 'user-a') {
  return {user_id: user, schema_version: 5, revision: workspace.revision,
    payload: workspacePayload(workspace), created_at: new Date(1000).toISOString(),
    updated_at: new Date(workspace.updatedAt).toISOString()};
}
function fixture() {
  let current = createEmptyWorkspace(1000);
  const calls: Array<{operation: string; revision: number | null; payload: unknown; id: string}> = [];
  const remote: WorkspaceRemote = {
    async read() { return row(current); },
    async write(operation, revision, payload, id): Promise<RemoteCommit> {
      calls.push({operation, revision, payload, id});
      if (revision !== current.revision) return {status: 'conflict', workspace: row(current)};
      current = {...current, ...payload, revision: current.revision + 1};
      return {status: 'saved', workspace: row(current), committed_revision: current.revision};
    },
  };
  let sequence = 0;
  const session = new AccountWorkspaceSession(remote, 'project:user-a', {
    userId: 'user-a', storage: localStorage,
    mutationId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  });
  return {session, remote, calls, setCurrent(value: WorkspaceDocument) {current = value;}};
}

describe('account workspace session', () => {
  it('locks without losing recovery and ignores a pending write response after automatic sign-out', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    await session.refresh();
    session.recordRecoveryDraft('main', {typed: '1300000'});
    let finish!: (result: RemoteCommit) => void;
    remote.write = () => new Promise(resolve => {finish = resolve;});
    const saving = session.scope('main').update(0, w => w);
    session.lock();
    finish({status: 'saved', workspace: row({...createEmptyWorkspace(), revision: 1})});
    await saving;
    expect(session.status).toBe('expired');
    expect(session.readRecoveryDraft('main')).toEqual({typed: '1300000'});
    expect(session.scope('main').load()).toEqual({status: 'unavailable'});
    expect(await session.refresh()).toBe('expired');
  });
  it('waits for server hydration and rejects another account or an unsupported schema', async () => {
    localStorage.clear();
    const {session} = fixture();
    expect(session.scope('main').load()).toEqual({status: 'unavailable'});
    expect(await session.refresh()).toBe('ready');
    expect(session.scope('main').load().status).toBe('found');
    expect(workspaceFromRow({...row(), user_id: 'user-b'}, 'user-a')).toBeNull();
    expect(workspaceFromRow({...row(), revision: '9007199254740992'}, 'user-a')).toBeNull();
    expect(workspaceFromRow({...row(), schema_version: 3}, 'user-a')).toBeNull();
    expect(workspaceFromRow({...row(), schema_version: 6}, 'user-a')).toBeNull();
  });

  it('only sends the owned slice, preserving local legacy records', async () => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v3', 'original');
    const {session, calls} = fixture();
    await session.refresh();
    const result = await session.scope('main').update(0, w => ({...w,
      main: {...w.main, setupProgress: {kind: 'initial', step: 'income', savedAt: 1,
        draft: {schemaVersion: 2, monthlyNetIncomeWon: 100, monthlyHousingWon: 0,
          monthlyLivingWon: 0, monthlySavingWon: 0, monthlyInvestmentWon: 0, updatedAt: 1}}}}));
    expect(result.status).toBe('saved');
    expect(calls[0].operation).toBe('save_main');
    expect(Object.keys(calls[0].payload as object)).toEqual(['main']);
    expect(localStorage.getItem('isf-workspace-v3')).toBe('original');
    expect(session.snapshot?.revision).toBe(1);
  });

  it('rejects out-of-scope writes even through replace', async () => {
    const {session, calls} = fixture();
    await session.refresh();
    const candidate = {...session.snapshot!, main: {applied: null, setupProgress: null},
      locations: [{id: 'bad'}]} as WorkspaceDocument;
    expect(await session.scope('simulation').replace(0, candidate)).toEqual({status: 'invalid'});
    expect(calls).toHaveLength(0);
  });

  it('retains the same mutation when a committed response is lost', async () => {
    localStorage.clear();
    const {session, remote, calls} = fixture();
    await session.refresh();
    const write = remote.write;
    remote.write = async (...args) => {await write(...args); throw new Error('network');};
    const result = await session.scope('main').update(0, w => w);
    expect(result.status).toBe('unavailable');
    expect(session.snapshot?.revision).toBe(0);
    expect(session.status).toBe('uncertain');
    remote.write = async (operation, revision, payload, id) => {
      calls.push({operation, revision, payload, id});
      return {status: 'saved', workspace: row({...createEmptyWorkspace(1000), revision: 1}), committed_revision: 1};
    };
    expect((await session.retry()).status).toBe('saved');
    expect(calls[0]?.id).toBe(calls[1]?.id);
    expect(session.snapshot?.revision).toBe(1);
    expect(session.pending).toBeNull();
  });

  it('blocks a stale writer and requires explicit reapply for its preserved candidate', async () => {
    localStorage.clear();
    const {session, setCurrent, calls} = fixture();
    await session.refresh();
    setCurrent({...createEmptyWorkspace(1000), revision: 2});
    const result = await session.scope('main').update(0, w => w);
    expect(result).toEqual({status: 'conflict', currentRevision: 2});
    expect(session.pending?.expectedRevision).toBe(0);
    expect(session.snapshot?.revision).toBe(2);
    expect(calls).toHaveLength(1);
    expect((await session.reapply()).status).toBe('saved');
    expect(calls[1].revision).toBe(2);
    expect(calls[1].id).not.toBe(calls[0].id);
  });

  it('preserves latest expense answers when explicitly reapplying an older direct Main edit', async () => {
    localStorage.clear();
    const {session, setCurrent, calls} = fixture(); await session.refresh();
    const latest = createEmptyWorkspace(1000); latest.revision = 2;
    latest.main.expenseAssistant = {schemaVersion: 1, draft: createExpenseDraft(1000), lastApplied: null};
    latest.main.expenseAssistant.draft.answers.rent = {amountWon: 600000, period: 'month'};
    setCurrent(latest);
    expect((await session.scope('main').update(0, w => w)).status).toBe('conflict');
    expect((await session.reapply()).status).toBe('saved');
    expect(calls[1].payload).toEqual({main: latest.main});
    expect(session.snapshot?.main.expenseAssistant).toEqual(latest.main.expenseAssistant);
  });

  it('ignores a late read after logout and removes only its own cache', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    await session.refresh();
    localStorage.setItem('unrelated', 'keep');
    let finish!: (value: unknown) => void;
    remote.read = () => new Promise(resolve => {finish = resolve;});
    const request = session.refresh();
    session.dispose(true);
    finish(row({...createEmptyWorkspace(1000), revision: 5}));
    await request;
    expect(session.snapshot).toBeNull();
    expect(session.scope('main').load().status).toBe('unavailable');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('does not roll back to a lower revision or mistake failure for an empty workspace', async () => {
    const {session, remote, setCurrent} = fixture();
    setCurrent({...createEmptyWorkspace(1000), revision: 4});
    await session.refresh();
    setCurrent(createEmptyWorkspace(1000));
    await session.refresh();
    expect(session.snapshot?.revision).toBe(4);
    remote.read = async () => {throw new Error('offline');};
    await session.refresh();
    expect(session.status).toBe('offline');
    expect(session.snapshot?.revision).toBe(4);
    expect((await session.scope('main').update(4, w => w)).status).toBe('unavailable');
  });

  it('keeps the server save successful when the cache is full', async () => {
    const {remote} = fixture();
    const session = new AccountWorkspaceSession(remote, 'project:user-a', {
      userId: 'user-a', storage: {getItem: () => null, setItem() {throw new Error('quota');}, removeItem() {}},
    });
    await session.refresh();
    expect((await session.scope('main').update(0, w => w)).status).toBe('saved');
    expect(session.cacheFailed).toBe(true);
  });

  it('reports recovery-cache failure when browser storage is unavailable', async () => {
    const {remote} = fixture();
    const session = new AccountWorkspaceSession(remote, 'project:no-storage', {userId: 'user-a'});

    await session.refresh();

    expect(session.cacheFailed).toBe(true);
  });

  it('treats a concurrent initialization as an existing server workspace, not a saved import', async () => {
    localStorage.clear();
    const remote: WorkspaceRemote = {
      read: async () => null,
      write: async () => ({status: 'exists', workspace: row({...createEmptyWorkspace(1000), revision: 4})}),
    };
    const session = new AccountWorkspaceSession(remote, 'project:user-a', {
      userId: 'user-a', storage: localStorage, mutationId: () => '00000000-0000-4000-8000-000000000001',
    });

    await session.refresh();
    await expect(session.initialize(createEmptyWorkspace(1000)))
      .resolves.toEqual({status: 'conflict', currentRevision: 4});

    expect(session.initializationExists).toBe(true);
    expect(session.pending).toBeNull();
    expect(session.snapshot?.revision).toBe(4);
  });

  it('persists typed recovery drafts independently from an immutable pending mutation', async () => {
    localStorage.clear();
    const {session, remote, calls} = fixture();
    await session.refresh();
    const write = remote.write;
    remote.write = async (...args) => { await write(...args); throw new Error('network'); };

    await session.scope('main').update(0, workspace => workspace);
    session.recordRecoveryDraft('main-editor', {monthlyNetIncomeWon: 5_000_000});

    expect(session.recoveryDrafts).toEqual({
      'main-editor': {baseRevision: 0, value: {monthlyNetIncomeWon: 5_000_000}},
    });
    expect(session.readRecoveryDraft('main-editor')).toEqual({monthlyNetIncomeWon: 5_000_000});
    expect(session.localEdits).toBe(true);
    expect(calls[0]?.id).toBe(session.pending?.mutationId);

    session.recordRecoveryDraft('main-editor', null);
    expect(session.readRecoveryDraft('main-editor')).toBeNull();
    expect(session.localEdits).toBe(false);
  });

  it('clears only a Main recovery draft covered by a committed Main payload', async () => {
    localStorage.clear();
    const {session} = fixture();
    const main = {
      schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 4_000_000,
      monthlyHousingWon: 900_000, monthlyLivingWon: 1_000_000,
      monthlySavingWon: 500_000, monthlyInvestmentWon: 600_000,
    };
    await session.refresh();
    session.recordRecoveryDraft('main', main);
    session.recordRecoveryDraft('unrelated', {keep: true});

    await expect(session.scope('main').update(0, workspace => ({
      ...workspace, main: {...workspace.main, applied: main},
    }))).resolves.toMatchObject({status: 'saved'});

    expect(session.readRecoveryDraft('main')).toBeNull();
    expect(session.readRecoveryDraft('unrelated')).toEqual({keep: true});
  });

  it('does not notify again when a recovery effect records an unchanged fresh object', async () => {
    localStorage.clear();
    const {session} = fixture();
    await session.refresh();
    let notifications = 0;
    session.subscribe(() => {notifications += 1;});

    session.recordRecoveryDraft('main', {draft: {amount: 1}});
    session.recordRecoveryDraft('main', {draft: {amount: 1}});

    expect(notifications).toBe(1);
  });

  it('does not let a generic reapply resend a conflicted whole-workspace restore', async () => {
    localStorage.clear();
    const {session, setCurrent, calls} = fixture();
    await session.refresh();
    setCurrent({...createEmptyWorkspace(1000), revision: 2});

    await expect(session.scope('restore').replace(0, createEmptyWorkspace(1000)))
      .resolves.toEqual({status: 'conflict', currentRevision: 2});
    await expect(session.reapply()).resolves.toEqual({status: 'invalid'});

    expect(calls).toHaveLength(1);
    expect(session.pending).toBeNull();
  });

  it('ignores an older refresh response after a newer response is accepted', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    let resolveOld!: (value: unknown) => void;
    let calls = 0;
    remote.read = () => {
      calls += 1;
      return calls === 1
        ? new Promise(resolve => {resolveOld = resolve;})
        : Promise.resolve(row({...createEmptyWorkspace(1000), revision: 3}));
    };

    const old = session.refresh();
    await expect(session.refresh()).resolves.toBe('ready');
    resolveOld(null);
    await old;

    expect(session.status).toBe('ready');
    expect(session.snapshot?.revision).toBe(3);
  });

  it('keeps an undecodable remote row for explicit validated restore', async () => {
    localStorage.clear();
    const invalidRow = {...row(), payload: {main: {broken: true}}};
    const candidate = createEmptyWorkspace(1000);
    const remote: WorkspaceRemote = {
      read: async () => invalidRow,
      write: async (operation, revision) => ({
        status: 'saved', workspace: row({...candidate, revision: (revision ?? 0) + 1}), committed_revision: (revision ?? 0) + 1,
      }),
    };
    const session = new AccountWorkspaceSession(remote, 'project:user-a', {
      userId: 'user-a', storage: localStorage, mutationId: () => '00000000-0000-4000-8000-000000000002',
    });

    await expect(session.refresh()).resolves.toBe('invalid');
    expect(session.rawRemote).toEqual(invalidRow);
    await expect(session.restore(candidate, 0)).resolves.toMatchObject({status: 'saved'});
    expect(session.rawRemote).toBeNull();
    expect(session.snapshot?.revision).toBe(1);
  });

  it('reads a prior v1 cache without recovery drafts while offline', async () => {
    localStorage.clear();
    const cached = createEmptyWorkspace(1000);
    localStorage.setItem('isf-account-workspace-v1:project:legacy', JSON.stringify({
      version: 1, snapshot: {...cached, schemaVersion: 3, main: {applied: cached.main.applied, setupProgress: cached.main.setupProgress}}, pending: null,
    }));
    const session = new AccountWorkspaceSession({
      read: async () => {throw new Error('offline');},
      write: async () => ({status: 'invalid'}),
    }, 'project:legacy', {userId: 'user-a', storage: localStorage});

    await expect(session.refresh()).resolves.toBe('offline');
    expect(session.snapshot).toEqual(cached);
    expect(session.recoveryDrafts).toEqual({});
  });

  it('does not retry a cached pending write whose operation and payload scope disagree', () => {
    localStorage.clear();
    const malformed = {operation: 'save_main', expectedRevision: 0,
      payload: {simulation: {draft: null}}, mutationId: '00000000-0000-4000-8000-000000000003'};
    localStorage.setItem('isf-account-workspace-v3:project:broken', JSON.stringify({
      version: 3, snapshot: createEmptyWorkspace(1000), pending: malformed,
    }));
    const session = new AccountWorkspaceSession({
      read: async () => null,
      write: async () => ({status: 'invalid'}),
    }, 'project:broken', {userId: 'user-a', storage: localStorage});

    expect(session.pending).toBeNull();
    expect(session.readRecoveryDraft(INVALID_PENDING_RECOVERY_KEY)).toEqual(malformed);
  });

  it('lets Account Map replace its pending conflict with a validated fresh-revision rebase', async () => {
    localStorage.clear();
    const {session, setCurrent, calls} = fixture();
    await session.refresh();
    const accountMap = session.scope('account-map');
    const initial = session.snapshot!;
    setCurrent({...createEmptyWorkspace(1000), revision: 2});

    await expect(accountMap.replace(0, initial)).resolves.toEqual({status: 'conflict', currentRevision: 2});
    await expect(accountMap.replace(2, session.snapshot!)).resolves.toMatchObject({status: 'saved'});

    expect(calls).toHaveLength(2);
    expect(calls[1]?.operation).toBe('save_account_map');
    expect(calls[1]?.id).not.toBe(calls[0]?.id);
  });

  it('immediately adopts Main-null refreshes for Account Map and drops only its recovery records', async () => {
    localStorage.clear();
    const {session, setCurrent, calls} = fixture();
    await session.refresh();
    session.scope('account-map');
    session.recordRecoveryDraft('account-map-draft', {id: 'draft'});
    session.recordRecoveryDraft('main', {id: 'keep'});
    setCurrent({...createEmptyWorkspace(1000), revision: 1});

    await expect(session.refresh()).resolves.toBe('ready');

    expect(session.snapshot?.revision).toBe(1);
    expect(session.snapshot?.main.applied).toBeNull();
    expect(session.readRecoveryDraft('account-map-draft')).toBeNull();
    expect(session.readRecoveryDraft('main')).toEqual({id: 'keep'});
    expect(session.externalRevision).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it.each(['refresh', 'conflict'] as const)('abandons an Account Map overlay Main write after Main is removed via %s', async mode => {
    localStorage.clear();
    const {session, remote, setCurrent, calls} = fixture();
    const main = {schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 4_000_000,
      monthlyHousingWon: 900_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 500_000, monthlyInvestmentWon: 600_000};
    setCurrent({...createEmptyWorkspace(1000), main: { expenseAssistant: null,applied: main, setupProgress: null}});
    await session.refresh();
    session.scope('account-map');
    session.recordRecoveryDraft('account-map-main', {...main, monthlyNetIncomeWon: 5_000_000});
    setCurrent({...createEmptyWorkspace(1000), revision: 1});
    if (mode === 'refresh') remote.write = async () => {throw new Error('offline');};
    await session.scope('main').update(0, workspace => ({...workspace,
      main: {...workspace.main, applied: {...main, monthlyNetIncomeWon: 5_000_000}}}));
    if (mode === 'refresh') {
      expect(session.pending?.operation).toBe('save_main');
      await session.refresh();
    }
    expect(session.snapshot?.main.applied).toBeNull();
    expect(session.status).toBe('ready');
    expect(session.pending).toBeNull();
    expect(session.readRecoveryDraft('account-map-main')).toBeNull();
    expect(session.externalRevision).toBe(1);
    await expect(session.reapply()).resolves.toEqual({status: 'unavailable'});
    expect(calls).toHaveLength(mode === 'conflict' ? 1 : 0);
  });

  it('abandons a cached overlay write on the first authenticated refresh before any UI scope mounts', async () => {
    localStorage.clear();
    const {session, remote, setCurrent} = fixture();
    const main = {schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 4_000_000,
      monthlyHousingWon: 900_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 500_000, monthlyInvestmentWon: 600_000};
    setCurrent({...createEmptyWorkspace(1000), main: { expenseAssistant: null,applied: main, setupProgress: null}});
    await session.refresh();
    session.scope('account-map');
    remote.write = async () => {throw new Error('response lost');};
    await session.scope('main').update(0, workspace => workspace);
    session.dispose();
    setCurrent({...createEmptyWorkspace(1000), revision: 1});
    const reauthenticated = new AccountWorkspaceSession(remote, 'project:user-a', {userId: 'user-a', storage: localStorage});
    await expect(reauthenticated.refresh()).resolves.toBe('ready');
    expect(reauthenticated.pending).toBeNull();
    await expect(reauthenticated.retry()).resolves.toEqual({status: 'unavailable'});
  });

  it('expires PGRST301 writes and ignores a late rejected write after disposal', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    await session.refresh();
    remote.write = async () => {throw Object.assign(new Error('expired'), {code: 'PGRST301'});};
    await expect(session.scope('main').update(0, workspace => workspace)).resolves.toEqual({status: 'unavailable'});
    expect(session.status).toBe('expired');

    localStorage.clear();
    const second = fixture();
    await second.session.refresh();
    let reject!: (reason: unknown) => void;
    second.remote.write = () => new Promise((_resolve, rejectWrite) => {reject = rejectWrite;});
    const write = second.session.scope('main').update(0, workspace => workspace);
    second.session.dispose();
    reject(new Error('late network error'));
    await expect(write).resolves.toEqual({status: 'unavailable'});
    expect(second.session.status).toBe('saving');
  });

  it('keeps a valid cached snapshot ready after a server rejects an invalid candidate', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    await session.refresh();
    remote.write = async () => ({status: 'invalid'});

    await expect(session.scope('main').update(0, workspace => workspace)).resolves.toEqual({status: 'invalid'});

    expect(session.status).toBe('ready');
    expect(session.pending).toBeNull();
    expect(session.snapshot?.revision).toBe(0);
  });

  it('clears recovery drafts from disposed memory while leaving the account cache intact', async () => {
    localStorage.clear();
    const {session, remote} = fixture();
    await session.refresh();
    session.recordRecoveryDraft('main', {amount: 1});
    session.dispose();

    expect(session.recoveryDrafts).toEqual({});
    const restored = new AccountWorkspaceSession(remote, 'project:user-a', {userId: 'user-a', storage: localStorage});
    expect(restored.readRecoveryDraft('main')).toEqual({amount: 1});
  });
});
