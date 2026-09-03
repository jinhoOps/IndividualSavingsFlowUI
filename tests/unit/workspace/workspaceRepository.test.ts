import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RETIRED_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../../../src/workspace/domain/model';
import {
  BrowserWorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';
import {
  BrowserWorkspaceSaveLock,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLock,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';

class MemoryStorage implements Storage {
  constructor(protected readonly values = new Map<string, string>()) {}

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class HookedStorage extends MemoryStorage {
  constructor(
    values: Map<string, string>,
    private readonly setHook: (key: string, value: string, commit: () => void) => void,
    private readonly getHook?: (key: string, read: () => string | null) => string | null,
  ) {
    super(values);
  }

  override getItem(key: string): string | null {
    return this.getHook?.(key, () => super.getItem(key)) ?? super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    this.setHook(key, value, () => super.setItem(key, value));
  }
}

describe('BrowserWorkspaceSaveLock', () => {
  it('does not let a contender paused after a free snapshot overlap an owner already inside', async () => {
    const sharedValues = new Map<string, string>();
    let releaseFirstSnapshot: (() => void) | undefined;
    let markFirstSnapshot: (() => void) | undefined;
    const firstSnapshot = new Promise<void>((resolve) => {
      markFirstSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseFirstSnapshot = resolve;
    });
    const releases = new Map<string, () => void>();
    const releasePromises = new Map<string, Promise<void>>();
    for (const owner of ['tab-a', 'tab-b']) {
      releasePromises.set(owner, new Promise<void>((resolve) => {
        releases.set(owner, resolve);
      }));
    }
    const active = new Set<string>();
    const entered: string[] = [];
    let maxActive = 0;
    const task = (owner: string) => async () => {
      active.add(owner);
      entered.push(owner);
      maxActive = Math.max(maxActive, active.size);
      await releasePromises.get(owner);
      active.delete(owner);
    };
    const commonOptions = {
      now: () => 1_000,
      wait: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      yieldAfterClaim: async () => undefined,
      leaseDurationMs: 100,
      acquireTimeoutMs: 500,
      retryDelayMs: 10,
    };
    const firstLock = new BrowserWorkspaceSaveLock(new MemoryStorage(sharedValues), {
      ...commonOptions,
      createOwnerToken: () => 'tab-a',
      yieldAfterSnapshot: async () => {
        markFirstSnapshot?.();
        await snapshotGate;
      },
    });
    const secondLock = new BrowserWorkspaceSaveLock(new MemoryStorage(sharedValues), {
      ...commonOptions,
      createOwnerToken: () => 'tab-b',
    });

    const firstRun = firstLock.runExclusive(task('tab-a'));
    await firstSnapshot;
    const secondRun = secondLock.runExclusive(task('tab-b'));
    await Promise.resolve();
    await Promise.resolve();
    releaseFirstSnapshot?.();
    await vi.waitFor(() => expect(entered.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    releases.get('tab-a')?.();
    releases.get('tab-b')?.();
    await Promise.all([firstRun, secondRun]);

    expect(entered).toHaveLength(2);
    expect(maxActive).toBe(1);
  });

  it('rejects a contender whose choosing lease expires while paused after its snapshot', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    const clock = createControlledLeaseClock(1_000);
    let releaseFirstSnapshot: (() => void) | undefined;
    let markFirstSnapshot: (() => void) | undefined;
    const firstSnapshot = new Promise<void>((resolve) => {
      markFirstSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseFirstSnapshot = resolve;
    });
    let releaseSecondTask: (() => void) | undefined;
    let markSecondTask: (() => void) | undefined;
    const secondTaskStarted = new Promise<void>((resolve) => {
      markSecondTask = resolve;
    });
    const secondTaskGate = new Promise<void>((resolve) => {
      releaseSecondTask = resolve;
    });
    const staleTask = vi.fn();
    const firstLock = new BrowserWorkspaceSaveLock(storage, {
      ...leaseOptions('tab-a', clock),
      yieldAfterSnapshot: async () => {
        markFirstSnapshot?.();
        await snapshotGate;
      },
    });
    const secondLock = new BrowserWorkspaceSaveLock(storage, leaseOptions('tab-b', clock));

    const firstRun = firstLock.runExclusive(staleTask);
    await firstSnapshot;
    clock.setNow(1_101);
    const secondRun = secondLock.runExclusive(async () => {
      markSecondTask?.();
      await secondTaskGate;
    });
    await secondTaskStarted;
    releaseFirstSnapshot?.();

    await expect(firstRun).rejects.toThrow('Workspace save lock ownership was lost');
    expect(staleTask).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(leaseStorageKey('tab-b')) ?? '')).toMatchObject({
      owner: 'tab-b',
      choosing: false,
      ticket: 1,
    });

    releaseSecondTask?.();
    await secondRun;
  });

  it('rejects a contender when its exact choosing record changes before the ready write', async () => {
    const storage = new MemoryStorage();
    let releaseSnapshot: (() => void) | undefined;
    let markSnapshot: (() => void) | undefined;
    const snapshotReached = new Promise<void>((resolve) => {
      markSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    const task = vi.fn();
    const lock = new BrowserWorkspaceSaveLock(storage, {
      ...leaseOptions('tab-a', createControlledLeaseClock(1_000)),
      yieldAfterSnapshot: async () => {
        markSnapshot?.();
        await snapshotGate;
      },
    });

    const run = lock.runExclusive(task);
    await snapshotReached;
    storage.setItem(leaseStorageKey('tab-a'), JSON.stringify({
      owner: 'tab-a',
      choosing: true,
      ticket: 0,
      expiresAt: 1_099,
    }));
    releaseSnapshot?.();

    await expect(run).rejects.toThrow('Workspace save lock ownership was lost');
    expect(task).not.toHaveBeenCalled();
  });

  it('rechecks the acquisition deadline immediately before returning a successful turn', async () => {
    const clock = createControlledLeaseClock(1_000);
    const task = vi.fn();
    const lock = new BrowserWorkspaceSaveLock(new MemoryStorage(), {
      ...leaseOptions('tab-a', clock),
      leaseDurationMs: 500,
      acquireTimeoutMs: 100,
      yieldAfterClaim: async () => {
        clock.setNow(1_100);
      },
    });

    await expect(lock.runExclusive(task)).rejects.toThrow('Could not acquire the Workspace save lock');
    expect(task).not.toHaveBeenCalled();
  });

  it('orders contenders that select the same bakery ticket without overlapping', async () => {
    const sharedValues = new Map<string, string>();
    const entered: string[] = [];
    const snapshotWaiters: Array<{ owner: string; resolve: () => void }> = [];
    let releaseFirstTask: (() => void) | undefined;
    const firstTaskGate = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });
    const options = (owner: string) => ({
      createOwnerToken: () => owner,
      now: () => 1_000,
      wait: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      yieldAfterSnapshot: () => new Promise<void>((resolve) => snapshotWaiters.push({ owner, resolve })),
      yieldAfterClaim: async () => undefined,
      leaseDurationMs: 100,
      acquireTimeoutMs: 500,
      retryDelayMs: 10,
    });
    const firstLock = new BrowserWorkspaceSaveLock(new MemoryStorage(sharedValues), options('tab-a'));
    const secondLock = new BrowserWorkspaceSaveLock(new MemoryStorage(sharedValues), options('tab-b'));

    const firstRun = firstLock.runExclusive(async () => {
      entered.push('tab-a');
      await firstTaskGate;
    });
    await vi.waitFor(() => expect(snapshotWaiters).toHaveLength(1));
    const secondRun = secondLock.runExclusive(async () => {
      entered.push('tab-b');
    });
    await vi.waitFor(() => expect(snapshotWaiters).toHaveLength(2));
    releaseClaim(snapshotWaiters, 'tab-b');
    releaseClaim(snapshotWaiters, 'tab-a');
    await vi.waitFor(() => expect(entered).toEqual(['tab-a']));

    releaseFirstTask?.();
    await Promise.all([firstRun, secondRun]);
    expect(entered).toEqual(['tab-a', 'tab-b']);
  });

  it('does not remove a successor lease installed after the former owner final read', async () => {
    const sharedValues = new Map<string, string>();
    const firstKey = leaseStorageKey('tab-a');
    const successorRaw = activeLeaseRecord('tab-b', 2_000, 2);
    let replaceLeaseOnRelease = false;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const current = read();
        if (key === firstKey && replaceLeaseOnRelease) {
          replaceLeaseOnRelease = false;
          sharedValues.set(key, successorRaw);
        }
        return current;
      },
    );
    const lock = new BrowserWorkspaceSaveLock(
      storage,
      leaseOptions('tab-a', createControlledLeaseClock(1_000)),
    );

    await lock.runExclusive(async () => {
      replaceLeaseOnRelease = true;
    });

    expect(storage.getItem(firstKey)).toBe(successorRaw);
  });

  it('leaves foreign tombstones and malformed lease entries untouched while scanning storage indexes', async () => {
    const sharedValues = new Map<string, string>();
    const foreignKey = leaseStorageKey('foreign-tab');
    const foreignTombstone = inactiveLeaseRecord('foreign-tab');
    const malformedKey = leaseStorageKey('malformed-tab');
    sharedValues.set(foreignKey, foreignTombstone);
    sharedValues.set(malformedKey, '{malformed');
    const storage = new MemoryStorage(sharedValues);
    const lock = new BrowserWorkspaceSaveLock(
      storage,
      leaseOptions('tab-a', createControlledLeaseClock(1_000)),
    );

    await lock.runExclusive(async () => undefined);

    expect(storage.getItem(foreignKey)).toBe(foreignTombstone);
    expect(storage.getItem(malformedKey)).toBe('{malformed');
  });

  it('uses the workspace lease namespace without changing old Main lease records', async () => {
    const storage = new MemoryStorage();
    const oldKey = 'isf-main-v2-save-lease:legacy-tab';
    const oldRaw = inactiveLeaseRecord('legacy-tab');
    storage.setItem(oldKey, oldRaw);
    const lock = new BrowserWorkspaceSaveLock(
      storage,
      leaseOptions('tab-a', createControlledLeaseClock(1_000)),
    );

    await lock.runExclusive(async () => {
      expect(storage.getItem(leaseStorageKey('tab-a'))).not.toBeNull();
      expect(storage.getItem('isf-main-v2-save-lease:tab-a')).toBeNull();
    });

    expect(storage.getItem(oldKey)).toBe(oldRaw);
  });
});

describe('BrowserWorkspaceRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a fresh empty workspace without writing when the current key is absent', () => {
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const repository = new BrowserWorkspaceRepository(storage, { now: () => 100 });

    expect(repository.load()).toEqual({
      status: 'empty',
      workspace: createEmptyWorkspace(100),
      needsMigration: false,
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('ignores populated old keys when the current workspace key is absent', () => {
    const storage = new MemoryStorage();
    storage.setItem('isf-main-v2', '{"main":true}');
    storage.setItem('isf-simulation-compound-v1', '{"simulation":true}');
    storage.setItem('isf-portfolio-allocation-v1', '{"portfolio":true}');
    const repository = new BrowserWorkspaceRepository(storage, { now: () => 100 });

    expect(repository.load()).toEqual({
      status: 'empty',
      workspace: createEmptyWorkspace(100),
      needsMigration: false,
    });
    expect(storage.getItem('isf-main-v2')).toBe('{"main":true}');
    expect(storage.getItem('isf-simulation-compound-v1')).toBe('{"simulation":true}');
    expect(storage.getItem('isf-portfolio-allocation-v1')).toBe('{"portfolio":true}');
  });

  it('loads one valid workspace without changing its serialized value', () => {
    const storage = new MemoryStorage();
    const workspace = createEmptyWorkspace(100);
    const raw = JSON.stringify(workspace);
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const repository = new BrowserWorkspaceRepository(storage);

    expect(repository.load()).toEqual({ status: 'found', workspace, needsMigration: false });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });

  it('reads valid v3 exclusively even when the retired source changes later', () => {
    const storage = new MemoryStorage();
    const current = { ...createEmptyWorkspace(300), revision: 7 };
    const retired = retiredWorkspace(2);
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify(retired));
    const repository = new BrowserWorkspaceRepository(storage, { now: () => 500 });

    expect(repository.load()).toEqual({ status: 'found', workspace: current, needsMigration: false });

    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify({
      ...retired,
      revision: 99,
      updatedAt: 450,
    }));

    expect(repository.load()).toEqual({ status: 'found', workspace: current, needsMigration: false });
  });

  it.each([1, 2] as const)(
    'converts a valid retired v%s source in memory without writing',
    (sourceVersion) => {
      const source = retiredWorkspace(sourceVersion);
      const sourceRaw = JSON.stringify(source, null, 2);
      const storage = new MemoryStorage(new Map([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]));
      const setItem = vi.spyOn(storage, 'setItem');
      const repository = new BrowserWorkspaceRepository(storage, { now: () => 500 });

      expect(repository.load()).toMatchObject({
        status: 'found',
        needsMigration: true,
        workspace: {
          schemaVersion: 3,
          revision: 4,
          updatedAt: 500,
          main: source.main,
          simulation: source.simulation,
          portfolio: source.portfolio,
          locations: source.locations,
        },
      });
      expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    },
  );

  it('migrates through guarded v3 write/readback while preserving retired bytes', async () => {
    const sourceRaw = JSON.stringify(retiredWorkspace(2), null, 2);
    const storage = new MemoryStorage(new Map([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]));
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });
    const loaded = repository.load();
    if (loaded.status !== 'found') throw new Error('expected converted source');

    const result = await repository.migrate(loaded.workspace.revision);

    expect(result).toMatchObject({
      status: 'saved',
      workspace: { schemaVersion: 3, revision: 5, updatedAt: 501 },
    });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(
      result.status === 'saved' ? result.workspace : null,
    ));
    expect(repository.load()).toEqual({
      status: 'found',
      workspace: result.status === 'saved' ? result.workspace : createEmptyWorkspace(0),
      needsMigration: false,
    });
  });

  it('rejects an invalid retired source without writing either workspace key', async () => {
    const sourceRaw = JSON.stringify({ ...retiredWorkspace(2), unexpected: true });
    const storage = new MemoryStorage(new Map([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]));
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });

    expect(repository.load()).toEqual({ status: 'invalid', raw: sourceRaw });
    await expect(repository.update(4, (workspace) => workspace)).resolves.toEqual({
      status: 'invalid',
    });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('removes an unverified partial v3 write without changing retired bytes', async () => {
    const sourceRaw = JSON.stringify(retiredWorkspace(2), null, 2);
    const values = new Map<string, string>([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]);
    let corruptNextCurrentWrite = true;
    const storage = new HookedStorage(values, (key, _value, commit) => {
      commit();
      if (key === WORKSPACE_STORAGE_KEY && corruptNextCurrentWrite) {
        corruptNextCurrentWrite = false;
        values.set(key, '{partial-v3');
      }
    });
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });

    await expect(repository.migrate(4)).resolves.toEqual({ status: 'unavailable' });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('re-reads the retired source under its lock before nesting the current lock', async () => {
    const events: string[] = [];
    const original = retiredWorkspace(2);
    const latest = { ...original, revision: 5, updatedAt: 450 };
    const storage = new MemoryStorage(new Map([
      [RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify(original)],
    ]));
    const repository = new BrowserWorkspaceRepository(storage, {
      retiredSaveLock: createRecordingLock('retired', events, () => {
        storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify(latest));
      }),
      saveLock: createRecordingLock('current', events),
      now: () => 500,
    });

    await expect(repository.update(5, (workspace) => workspace)).resolves.toMatchObject({
      status: 'saved',
      workspace: { revision: 6 },
    });
    expect(events).toEqual([
      'retired:enter',
      'current:enter',
      'current:exit',
      'retired:exit',
    ]);
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '')).toMatchObject({ revision: 6 });
  });

  it('keeps v3 canonical after an old tab writes a newer retired source', async () => {
    const source = retiredWorkspace(2);
    const sourceRaw = JSON.stringify(source);
    const storage = new MemoryStorage(new Map([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]));
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });
    const migrated = await repository.migrate(source.revision);
    if (migrated.status !== 'saved') throw new Error('expected saved migration');
    const migratedMain = structuredClone(migrated.workspace.main);
    const oldTabSource = retiredWorkspace(2);
    oldTabSource.revision = 99;
    oldTabSource.updatedAt = 499;
    if (oldTabSource.main.applied !== null) {
      oldTabSource.main.applied.monthlyInvestmentWon = 999_999;
      oldTabSource.main.applied.updatedAt = 499;
    }
    const oldTabRaw = JSON.stringify(oldTabSource);
    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, oldTabRaw);

    expect(repository.load()).toEqual({
      status: 'found',
      workspace: migrated.workspace,
      needsMigration: false,
    });
    await expect(repository.update(migrated.workspace.revision, (workspace) => workspace))
      .resolves.toMatchObject({ status: 'saved', workspace: { revision: 6, main: migratedMain } });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(oldTabRaw);
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '').revision).toBe(6);
  });

  it('keeps a stale retired-source revision as a conflict without creating v3', async () => {
    const sourceRaw = JSON.stringify(retiredWorkspace(2));
    const storage = new MemoryStorage(new Map([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]));
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });

    await expect(repository.replace(3, createEmptyWorkspace(500))).resolves.toEqual({
      status: 'conflict',
      currentRevision: 4,
    });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('rejects a malformed Simulation target without accepting a partial workspace', () => {
    const malformed = {
      ...createEmptyWorkspace(100),
      simulation: {
        draft: {
          schemaVersion: 3,
          source: { monthlySavingsWon: 300_000, monthlyInvestmentWon: 200_000, mainUpdatedAt: 100 },
          initialInvestmentWon: 200_000_000,
          targetAmountWon: 200_000_000,
          years: 20,
          expectedAnnualReturnPercent: 9,
          baseRatePercent: 2.75,
          inflationOffsetPercentPoints: -0.25,
          amountMode: 'nominal',
          updatedAt: 200,
        },
      },
    };
    const raw = JSON.stringify(malformed);
    const storage = new MemoryStorage(new Map([[WORKSPACE_STORAGE_KEY, raw]]));

    expect(new BrowserWorkspaceRepository(storage).load()).toEqual({ status: 'invalid', raw });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });

  it('reports invalid v3 JSON without reading or falling back to retired v1', () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, '{malformed');
    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify(retiredWorkspace(2)));
    const getItem = vi.spyOn(storage, 'getItem');

    expect(new BrowserWorkspaceRepository(storage).load()).toEqual({
      status: 'invalid',
      raw: '{malformed',
    });
    expect(getItem).not.toHaveBeenCalledWith(RETIRED_WORKSPACE_STORAGE_KEY);
  });

  it('reports an invalid current schema without falling back to retired v1', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ ...createEmptyWorkspace(100), unexpected: true });
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, JSON.stringify(retiredWorkspace(2)));
    const getItem = vi.spyOn(storage, 'getItem');

    expect(new BrowserWorkspaceRepository(storage).load()).toEqual({
      status: 'invalid',
      raw,
    });
    expect(getItem).not.toHaveBeenCalledWith(RETIRED_WORKSPACE_STORAGE_KEY);
  });

  it('reports unavailable when current storage cannot be read', () => {
    const storage = new HookedStorage(
      new Map(),
      (_key, _value, commit) => commit(),
      () => { throw new Error('blocked'); },
    );

    expect(new BrowserWorkspaceRepository(storage).load()).toEqual({ status: 'unavailable' });
  });

  it('leaves retired bytes unchanged when the source cannot be read for conversion', async () => {
    const sourceRaw = JSON.stringify(retiredWorkspace(2));
    const values = new Map<string, string>([[RETIRED_WORKSPACE_STORAGE_KEY, sourceRaw]]);
    let failRetiredRead = true;
    const storage = new HookedStorage(
      values,
      (_key, _value, commit) => commit(),
      (key, read) => {
        if (key === RETIRED_WORKSPACE_STORAGE_KEY && failRetiredRead) {
          throw new Error('retired source blocked');
        }
        return read();
      },
    );
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 500,
    });

    await expect(repository.update(4, (workspace) => workspace)).resolves.toEqual({
      status: 'unavailable',
    });
    failRetiredRead = false;
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(sourceRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('resets an exact invalid retired raw into v3 without mutating the retired source', async () => {
    const invalidRaw = '{malformed-retired-workspace';
    const storage = new MemoryStorage(new Map([
      [RETIRED_WORKSPACE_STORAGE_KEY, invalidRaw],
    ]));
    const setItem = vi.spyOn(storage, 'setItem');
    const removeItem = vi.spyOn(storage, 'removeItem');
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 200,
    });

    await expect(repository.resetInvalid(invalidRaw)).resolves.toEqual({
      status: 'saved',
      workspace: { ...createEmptyWorkspace(200), revision: 1 },
    });

    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '')).toEqual({
      ...createEmptyWorkspace(200),
      revision: 1,
    });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(invalidRaw);
    expect(setItem).not.toHaveBeenCalledWith(RETIRED_WORKSPACE_STORAGE_KEY, expect.any(String));
    expect(removeItem).not.toHaveBeenCalledWith(RETIRED_WORKSPACE_STORAGE_KEY);
  });

  it('preserves an invalid retired source when a valid v3 winner appears before current lock work', async () => {
    const events: string[] = [];
    const invalidRaw = '{malformed-retired-workspace';
    const winner = { ...createEmptyWorkspace(300), revision: 7 };
    const winnerRaw = JSON.stringify(winner);
    const storage = new MemoryStorage(new Map([
      [RETIRED_WORKSPACE_STORAGE_KEY, invalidRaw],
    ]));
    const repository = new BrowserWorkspaceRepository(storage, {
      retiredSaveLock: createRecordingLock('retired', events),
      saveLock: createRecordingLock('current', events, () => {
        storage.setItem(WORKSPACE_STORAGE_KEY, winnerRaw);
      }),
      now: () => 400,
    });

    await expect(repository.resetInvalid(invalidRaw)).resolves.toEqual({ status: 'changed' });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(winnerRaw);
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(invalidRaw);
    expect(events).toEqual([
      'retired:enter',
      'current:enter',
      'current:exit',
      'retired:exit',
    ]);
  });

  it('does not reset when the invalid retired raw changes under the retired lock', async () => {
    const events: string[] = [];
    const expectedRaw = '{first-invalid-retired-workspace';
    const winnerRaw = '{winner-invalid-retired-workspace';
    const storage = new MemoryStorage(new Map([
      [RETIRED_WORKSPACE_STORAGE_KEY, expectedRaw],
    ]));
    const repository = new BrowserWorkspaceRepository(storage, {
      retiredSaveLock: createRecordingLock('retired', events),
      saveLock: createRecordingLock('current', events, () => {
        storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, winnerRaw);
      }),
      now: () => 400,
    });

    await expect(repository.resetInvalid(expectedRaw)).resolves.toEqual({ status: 'changed' });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(winnerRaw);
    expect(events).toEqual([
      'retired:enter',
      'current:enter',
      'current:exit',
      'retired:exit',
    ]);
  });

  it('removes an unverified v3 reset write without changing invalid retired bytes', async () => {
    const invalidRaw = '{malformed-retired-workspace';
    const values = new Map<string, string>([
      [RETIRED_WORKSPACE_STORAGE_KEY, invalidRaw],
    ]);
    let corruptNextCurrentWrite = true;
    const storage = new HookedStorage(values, (key, _value, commit) => {
      commit();
      if (key === WORKSPACE_STORAGE_KEY && corruptNextCurrentWrite) {
        corruptNextCurrentWrite = false;
        values.set(key, '{partial-v3');
      }
    });
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      retiredSaveLock: createSerialLock(),
      now: () => 200,
    });

    await expect(repository.resetInvalid(invalidRaw)).resolves.toEqual({ status: 'unavailable' });
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(invalidRaw);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('resets one exact invalid raw to a committed empty workspace under the save lock', async () => {
    const invalidRaw = '{malformed-workspace';
    const retiredRaw = JSON.stringify(retiredWorkspace(2), null, 2);
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, invalidRaw);
    storage.setItem(RETIRED_WORKSPACE_STORAGE_KEY, retiredRaw);
    storage.setItem('isf-main-v2', '{old-main');
    storage.setItem('isf-rebuild-v1', '{old-rebuild');
    const setItem = vi.spyOn(storage, 'setItem');
    const getItem = vi.spyOn(storage, 'getItem');
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 200,
    });

    await expect(repository.resetInvalid(invalidRaw)).resolves.toEqual({
      status: 'saved',
      workspace: { ...createEmptyWorkspace(200), revision: 1 },
    });

    expect(setItem.mock.calls.filter(([key]) => key === WORKSPACE_STORAGE_KEY)).toHaveLength(1);
    expect(getItem).not.toHaveBeenCalledWith(RETIRED_WORKSPACE_STORAGE_KEY);
    expect(storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY)).toBe(retiredRaw);
    expect(storage.getItem('isf-main-v2')).toBe('{old-main');
    expect(storage.getItem('isf-rebuild-v1')).toBe('{old-rebuild');
  });

  it('does not reset when another writer replaces the invalid raw before lock entry', async () => {
    const expectedRaw = '{first-invalid';
    const winnerRaw = '{winner-invalid';
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, expectedRaw);
    const saveLock: WorkspaceSaveLock = {
      async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
        storage.setItem(WORKSPACE_STORAGE_KEY, winnerRaw);
        return await task({ assertOwned: () => undefined });
      },
    };
    const repository = new BrowserWorkspaceRepository(storage, { saveLock, now: () => 200 });

    await expect(repository.resetInvalid(expectedRaw)).resolves.toEqual({ status: 'changed' });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(winnerRaw);
  });

  it('does not reset an exact raw that is already a valid workspace', async () => {
    const workspace = { ...createEmptyWorkspace(400), revision: 4 };
    const raw = JSON.stringify(workspace);
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 500,
    });

    await expect(repository.resetInvalid(raw)).resolves.toEqual({ status: 'changed' });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });

  it('checks the expected revision after entering the acquired lock', async () => {
    const storage = new MemoryStorage();
    const winner = { ...createEmptyWorkspace(100), revision: 1, updatedAt: 101 };
    const mutate = vi.fn((workspace: WorkspaceDocument) => workspace);
    const saveLock: WorkspaceSaveLock = {
      async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
        storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(winner));
        return await task({ assertOwned: () => undefined });
      },
    };
    const repository = new BrowserWorkspaceRepository(storage, { saveLock, now: () => 200 });

    await expect(repository.update(0, mutate)).resolves.toEqual({
      status: 'conflict',
      currentRevision: 1,
    });
    expect(mutate).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '')).toEqual(winner);
  });

  it('commits one verified write with the next revision and a monotonic timestamp', async () => {
    const storage = new MemoryStorage();
    const current = { ...createEmptyWorkspace(1_000), revision: 7 };
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const setItem = vi.spyOn(storage, 'setItem');
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 999,
    });

    const result = await repository.update(7, (workspace) => workspace);

    expect(result).toEqual({
      status: 'saved',
      workspace: { ...current, revision: 8, updatedAt: 1_001 },
    });
    const committedWrites = setItem.mock.calls.filter(([key]) => key === WORKSPACE_STORAGE_KEY);
    expect(committedWrites).toHaveLength(1);
    expect(committedWrites[0]?.[1]).toBe(JSON.stringify({
      ...current,
      revision: 8,
      updatedAt: 1_001,
    }));
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(committedWrites[0]?.[1]);
  });

  it('rejects invalid mutator output before writing', async () => {
    const storage = new MemoryStorage();
    const current = createEmptyWorkspace(100);
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const setItem = vi.spyOn(storage, 'setItem');
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 200,
    });

    const result = await repository.update(0, (workspace) => ({
      ...workspace,
      unexpected: true,
    } as WorkspaceDocument));

    expect(result).toEqual({ status: 'invalid' });
    expect(setItem.mock.calls.filter(([key]) => key === WORKSPACE_STORAGE_KEY)).toHaveLength(0);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(current));
  });

  it('replaces a valid candidate while assigning repository revision metadata', async () => {
    const storage = new MemoryStorage();
    const current = createEmptyWorkspace(100);
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 200,
    });
    const candidate = { ...current, revision: 99, updatedAt: 99 };

    await expect(repository.replace(0, candidate)).resolves.toEqual({
      status: 'saved',
      workspace: { ...candidate, revision: 1, updatedAt: 200 },
    });
  });

  it('reports unavailable and restores the previous raw value when verification fails', async () => {
    const current = createEmptyWorkspace(100);
    const previousRaw = JSON.stringify(current);
    const values = new Map<string, string>([[WORKSPACE_STORAGE_KEY, previousRaw]]);
    let corruptNextWorkspaceWrite = true;
    const storage = new HookedStorage(values, (key, _value, commit) => {
      commit();
      if (key === WORKSPACE_STORAGE_KEY && corruptNextWorkspaceWrite) {
        corruptNextWorkspaceWrite = false;
        values.set(key, '{corrupted-write');
      }
    });
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 200,
    });

    await expect(repository.update(0, (workspace) => workspace)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(previousRaw);
  });

  it('prevents a paused stale lock contender from overwriting the winner', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const clock = createControlledLeaseClock(1_000);
    let releaseFirstSnapshot: (() => void) | undefined;
    let markFirstSnapshot: (() => void) | undefined;
    const firstSnapshot = new Promise<void>((resolve) => {
      markFirstSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseFirstSnapshot = resolve;
    });
    const first = new BrowserWorkspaceRepository(firstStorage, {
      now: () => 100,
      saveLeaseOptions: {
        ...leaseOptions('tab-a', clock),
        yieldAfterSnapshot: async () => {
          markFirstSnapshot?.();
          await snapshotGate;
        },
      },
    });
    const second = new BrowserWorkspaceRepository(secondStorage, {
      now: () => 200,
      saveLeaseOptions: leaseOptions('tab-b', clock),
    });

    const staleWrite = first.update(0, (workspace) => workspace);
    await firstSnapshot;
    clock.setNow(1_101);
    await expect(second.update(0, (workspace) => workspace)).resolves.toMatchObject({
      status: 'saved',
      workspace: { revision: 1, updatedAt: 201 },
    });
    releaseFirstSnapshot?.();

    await expect(staleWrite).resolves.toEqual({ status: 'unavailable' });
    expect(JSON.parse(firstStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '')).toMatchObject({
      revision: 1,
      updatedAt: 201,
    });
  });

  it('notifies same-tab subscribers only after a verified commit', async () => {
    const storage = new MemoryStorage();
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    const result = await repository.update(0, (workspace) => workspace);

    expect(result.status).toBe('saved');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ revision: 1, updatedAt: 101 }));
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(listener.mock.calls[0]?.[0]));
    unsubscribe();
  });

  it('notifies another repository instance in the same storage and window exactly once', async () => {
    const storage = new MemoryStorage();
    const subscriberRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const writerRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn((workspace: WorkspaceDocument) => {
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(workspace));
    });
    const unsubscribe = subscriberRepository.subscribe(listener);

    const result = await writerRepository.update(0, (workspace) => workspace);

    expect(result.status).toBe('saved');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ revision: 1, updatedAt: 101 }));
    unsubscribe();
  });

  it('does not broadcast same-tab commits to a different storage group', async () => {
    const subscriberRepository = new BrowserWorkspaceRepository(new MemoryStorage(), {
      saveLock: createSerialLock(),
    });
    const writerRepository = new BrowserWorkspaceRepository(new MemoryStorage(), {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribe = subscriberRepository.subscribe(listener);

    await expect(writerRepository.update(0, (workspace) => workspace)).resolves.toMatchObject({
      status: 'saved',
      workspace: { revision: 1 },
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not broadcast same-tab commits to a different window group', async () => {
    const storage = new MemoryStorage();
    const subscriberWindow = createTrackingWindow();
    const writerWindow = createTrackingWindow();
    const subscriberRepository = new BrowserWorkspaceRepository(storage, {
      eventTarget: subscriberWindow,
      saveLock: createSerialLock(),
    });
    const writerRepository = new BrowserWorkspaceRepository(storage, {
      eventTarget: writerWindow,
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribe = subscriberRepository.subscribe(listener);

    await expect(writerRepository.update(0, (workspace) => workspace)).resolves.toMatchObject({
      status: 'saved',
      workspace: { revision: 1 },
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not notify same-tab subscribers when serialized verification fails', async () => {
    const values = new Map<string, string>();
    let corruptNextWorkspaceWrite = true;
    const storage = new HookedStorage(values, (key, _value, commit) => {
      commit();
      if (key === WORKSPACE_STORAGE_KEY && corruptNextWorkspaceWrite) {
        corruptNextWorkspaceWrite = false;
        values.set(key, '{corrupted-write');
      }
    });
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    await expect(repository.update(0, (workspace) => workspace)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(listener).not.toHaveBeenCalled();
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    unsubscribe();
  });

  it('notifies subscribers for valid workspace storage events', () => {
    const storage = new MemoryStorage();
    const repository = new BrowserWorkspaceRepository(storage);
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    const workspace = { ...createEmptyWorkspace(100), revision: 3 };

    window.dispatchEvent(new StorageEvent('storage', {
      key: WORKSPACE_STORAGE_KEY,
      newValue: JSON.stringify(workspace),
    }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(workspace);
    unsubscribe();
  });

  it('ignores storage events for unrelated keys', () => {
    const repository = new BrowserWorkspaceRepository(new MemoryStorage());
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'isf-main-v2',
      newValue: JSON.stringify(createEmptyWorkspace(100)),
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ignores malformed and schema-invalid workspace storage events', () => {
    const repository = new BrowserWorkspaceRepository(new MemoryStorage());
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    window.dispatchEvent(new StorageEvent('storage', {
      key: WORKSPACE_STORAGE_KEY,
      newValue: '{malformed',
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: WORKSPACE_STORAGE_KEY,
      newValue: JSON.stringify({ ...createEmptyWorkspace(100), unexpected: true }),
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: WORKSPACE_STORAGE_KEY,
      newValue: null,
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops same-tab and storage-event delivery after unsubscribe', async () => {
    const storage = new MemoryStorage();
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    unsubscribe();

    await repository.update(0, (workspace) => workspace);
    window.dispatchEvent(new StorageEvent('storage', {
      key: WORKSPACE_STORAGE_KEY,
      newValue: JSON.stringify({ ...createEmptyWorkspace(200), revision: 2 }),
    }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps a duplicate callback subscription active until its own handle unsubscribes', async () => {
    const storage = new MemoryStorage();
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const listener = vi.fn();
    const unsubscribeFirst = repository.subscribe(listener);
    const unsubscribeSecond = repository.subscribe(listener);

    await repository.update(0, (workspace) => workspace);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    await repository.update(1, (workspace) => workspace);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribeSecond();
    await repository.update(2, (workspace) => workspace);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('continues notification after another subscriber throws', async () => {
    const storage = new MemoryStorage();
    const repository = new BrowserWorkspaceRepository(storage, {
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const throwingListener = vi.fn(() => {
      throw new Error('subscriber failure');
    });
    const receivingListener = vi.fn();
    const unsubscribeThrowing = repository.subscribe(throwingListener);
    const unsubscribeReceiving = repository.subscribe(receivingListener);

    await repository.update(0, (workspace) => workspace);

    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(receivingListener).toHaveBeenCalledTimes(1);
    unsubscribeThrowing();
    unsubscribeReceiving();
  });

  it('shares one storage-event handler and removes it after the group last unsubscribe', async () => {
    const storage = new MemoryStorage();
    const eventTarget = createTrackingWindow();
    const first = new BrowserWorkspaceRepository(storage, {
      eventTarget,
      saveLock: createSerialLock(),
    });
    const second = new BrowserWorkspaceRepository(storage, {
      eventTarget,
      saveLock: createSerialLock(),
      now: () => 100,
    });
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = first.subscribe(firstListener);
    const unsubscribeSecond = second.subscribe(secondListener);

    expect(eventTarget.storageListenerCount()).toBe(1);
    unsubscribeFirst();
    expect(eventTarget.storageListenerCount()).toBe(1);
    unsubscribeSecond();
    expect(eventTarget.storageListenerCount()).toBe(0);

    await second.update(0, (workspace) => workspace);
    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).not.toHaveBeenCalled();
  });
});

function retiredWorkspace(sourceVersion: 1 | 2) {
  const main = {
    applied: {
      schemaVersion: 2 as const,
      monthlyNetIncomeWon: 3_000_000,
      monthlyHousingWon: 700_000,
      monthlyLivingWon: 900_000,
      monthlySavingWon: 400_000,
      monthlyInvestmentWon: 200_000,
      updatedAt: 100,
    },
    setupProgress: null,
  };
  const common = {
    schemaVersion: sourceVersion,
    revision: 4,
    updatedAt: 400,
    main,
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [],
  };
  return sourceVersion === 1
    ? {
        ...common,
        schemaVersion: 1 as const,
        accountMap: { applied: null, draft: null, instruments: [], flows: [] },
      }
    : {
        ...common,
        schemaVersion: 2 as const,
        accountMap: {
          applied: null,
          draft: null,
          legacyPhaseA: { instruments: [], flows: [] },
        },
      };
}

function createRecordingLock(
  name: string,
  events: string[],
  beforeTask?: () => void,
): WorkspaceSaveLock {
  return {
    async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
      events.push(`${name}:enter`);
      beforeTask?.();
      try {
        return await task({ assertOwned: () => undefined });
      } finally {
        events.push(`${name}:exit`);
      }
    },
  };
}

function createSerialLock(): WorkspaceSaveLock {
  let tail = Promise.resolve();
  const guard = { assertOwned: () => undefined };
  return {
    runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
      const result = tail.then(() => task(guard), () => task(guard));
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

interface ControlledLeaseClock {
  now(): number;
  wait(delayMs: number): Promise<void>;
  setNow(value: number): void;
}

function createControlledLeaseClock(initialNow: number): ControlledLeaseClock {
  let now = initialNow;
  return {
    now: () => now,
    wait: async (delayMs) => {
      now += delayMs;
      await Promise.resolve();
    },
    setNow: (value) => {
      now = value;
    },
  };
}

function leaseOptions(owner: string, clock: ControlledLeaseClock) {
  return {
    createOwnerToken: () => owner,
    now: clock.now,
    wait: clock.wait,
    yieldAfterClaim: async () => undefined,
    leaseDurationMs: 100,
    acquireTimeoutMs: 500,
    retryDelayMs: 10,
  };
}

function leaseStorageKey(owner: string): string {
  return `isf-workspace-v3-save-lease:${encodeURIComponent(owner)}`;
}

function activeLeaseRecord(owner: string, expiresAt: number, ticket = 1): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket,
    expiresAt,
  });
}

function inactiveLeaseRecord(owner: string): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket: 0,
    expiresAt: 0,
  });
}

function releaseClaim(
  waiters: Array<{ owner: string; resolve: () => void }>,
  owner: string,
): void {
  const index = waiters.findIndex((waiter) => waiter.owner === owner);
  if (index === -1) throw new Error(`Expected a pending claim for ${owner}.`);
  waiters.splice(index, 1)[0]?.resolve();
}

type TrackingWindow = Window & { storageListenerCount(): number };

function createTrackingWindow(): TrackingWindow {
  const target = new EventTarget();
  const storageListeners = new Set<EventListenerOrEventListenerObject>();
  return {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      target.addEventListener(type, listener);
      if (type === 'storage') storageListeners.add(listener);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      target.removeEventListener(type, listener);
      if (type === 'storage') storageListeners.delete(listener);
    },
    dispatchEvent: (event: Event) => target.dispatchEvent(event),
    storageListenerCount: () => storageListeners.size,
  } as unknown as TrackingWindow;
}
