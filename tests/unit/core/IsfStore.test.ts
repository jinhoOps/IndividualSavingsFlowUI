import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { IsfStore } from '../../../src/core/storage/IsfStore';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('IsfStore', () => {
  it('never deletes a pre-existing v1 database during initialization', async () => {
    const { indexedDb, openRequests } = installIndexedDb([
      { name: 'isf-hub-db-v1', version: 1 },
    ]);
    const store = new IsfStore();

    const initialization = store.init();
    await vi.waitFor(() => expect(openRequests).toHaveLength(1));

    expect(indexedDb.databases).not.toHaveBeenCalled();
    expect(indexedDb.deleteDatabase).not.toHaveBeenCalled();

    openRequests[0].result = fakeDatabase().database;
    openRequests[0].onsuccess?.(new Event('success'));
    await expect(initialization).resolves.toBeUndefined();
  });

  it('never creates legacy Main stores in a fresh v4 database', async () => {
    const { openRequests } = installIndexedDb();
    const storeNames = new Set<string>();
    const createObjectStore = vi.fn((name: string) => {
      storeNames.add(name);
      return { createIndex: vi.fn() };
    });
    const database = {
      close: vi.fn(),
      onversionchange: null,
      objectStoreNames: {
        contains: (name: string) => storeNames.has(name),
      },
      createObjectStore,
    } as unknown as IDBDatabase;
    const store = new IsfStore();

    const initialization = store.init();
    await vi.waitFor(() => expect(openRequests).toHaveLength(1));
    openRequests[0].result = database;
    openRequests[0].onupgradeneeded?.({ oldVersion: 0 } as IDBVersionChangeEvent);

    expect([...storeNames]).toEqual([
      'step1_history',
      'step2_simulations',
      'backups',
      'main_v2_history_entries',
    ]);
    expect(createObjectStore).not.toHaveBeenCalledWith('main_v1_history', expect.anything());
    expect(createObjectStore).not.toHaveBeenCalledWith('main_v1_history_entries', expect.anything());

    openRequests[0].onsuccess?.(new Event('success'));
    await expect(initialization).resolves.toBeUndefined();
  });

  it('adds a v2 Main history store without deleting existing v1 stores during the v4 upgrade', async () => {
    const { indexedDb, openRequests } = installIndexedDb();
    const existingStoreNames = new Set([
      'step1_history',
      'step2_simulations',
      'backups',
      'main_v1_history',
      'main_v1_history_entries',
    ]);
    const createIndex = vi.fn();
    const createObjectStore = vi.fn((name: string) => {
      existingStoreNames.add(name);
      return { createIndex };
    });
    const deleteObjectStore = vi.fn();
    const database = {
      close: vi.fn(),
      onversionchange: null,
      objectStoreNames: {
        contains: (name: string) => existingStoreNames.has(name),
      },
      createObjectStore,
      deleteObjectStore,
    } as unknown as IDBDatabase;
    const store = new IsfStore();

    const initialization = store.init();
    await vi.waitFor(() => expect(openRequests).toHaveLength(1));
    expect(indexedDb.open).toHaveBeenCalledWith('isf-v2-db', 4);
    openRequests[0].result = database;
    openRequests[0].onupgradeneeded?.({ oldVersion: 3 } as IDBVersionChangeEvent);

    expect(createObjectStore).toHaveBeenCalledWith('main_v2_history_entries', { autoIncrement: true });
    expect(createIndex).toHaveBeenCalledWith('updatedAt', 'updatedAt');
    expect(deleteObjectStore).not.toHaveBeenCalled();
    expect(existingStoreNames.has('main_v1_history')).toBe(true);
    expect(existingStoreNames.has('main_v1_history_entries')).toBe(true);

    openRequests[0].onsuccess?.(new Event('success'));
    await expect(initialization).resolves.toBeUndefined();
  });

  it('loads v2 history without consulting a future-dated v1 history record', async () => {
    const v2: MainData = {
      schemaVersion: 2,
      updatedAt: 20,
      monthlyNetIncomeWon: 4_200_000,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 600_000,
      monthlyInvestmentWon: 800_000,
    };
    const futureV1 = { schemaVersion: 1, updatedAt: 9_999_999_999_999 };
    const records: Record<string, unknown> = {
      main_v1_history: futureV1,
      main_v1_history_entries: futureV1,
      main_v2_history_entries: v2,
    };
    const touchedStores: string[] = [];
    const store = new IsfStore();
    vi.spyOn(store, 'perform').mockImplementation(async (storeName) => {
      touchedStores.push(storeName);
      return { value: records[storeName] } as IDBCursorWithValue;
    });

    await expect(store.loadLatestMainV2()).resolves.toEqual(v2);

    expect(touchedStores).toEqual(['main_v2_history_entries']);
  });

  it('rejects a blocked database upgrade instead of leaving initialization pending', async () => {
    const { openRequests } = installIndexedDb();
    const store = new IsfStore();

    const initialization = store.init();
    await vi.waitFor(() => expect(openRequests).toHaveLength(1));
    const request = openRequests[0];

    expect(request.onblocked).toBeTypeOf('function');
    request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent);

    await expect(initialization).rejects.toThrow('blocked');
  });

  it('closes and forgets a stale connection on version change so it can reopen', async () => {
    const { indexedDb, openRequests } = installIndexedDb();
    const firstDb = fakeDatabase();
    const store = new IsfStore();

    const firstInitialization = store.init();
    await vi.waitFor(() => expect(openRequests).toHaveLength(1));
    openRequests[0].result = firstDb.database;
    openRequests[0].onsuccess?.(new Event('success'));
    await firstInitialization;

    expect(firstDb.database.onversionchange).toBeTypeOf('function');
    firstDb.database.onversionchange?.(new Event('versionchange') as IDBVersionChangeEvent);
    expect(firstDb.close).toHaveBeenCalledOnce();

    const secondInitialization = store.init();
    await vi.waitFor(() => expect(indexedDb.open).toHaveBeenCalledTimes(2));
    const secondDb = fakeDatabase();
    openRequests[1].result = secondDb.database;
    openRequests[1].onsuccess?.(new Event('success'));
    await expect(secondInitialization).resolves.toBeUndefined();
  });

  it('does not resolve a request result until the transaction commits', async () => {
    const request = {} as ControlledRequest<string>;
    const transaction = controlledTransaction(request);
    const store = new IsfStore();
    vi.spyOn(store, 'init').mockResolvedValue(undefined);
    setDatabase(store, transaction.value);
    let settled = false;

    const result = store.perform(
      'main_v2_history_entries',
      'readwrite',
      () => request as unknown as IDBRequest<string>,
    );
    void result.then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf('function'));
    request.result = 'written';
    request.onsuccess?.(new Event('success'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(settled).toBe(false);
    transaction.value.oncomplete?.(new Event('complete'));
    await expect(result).resolves.toBe('written');
  });

  it('rejects when a transaction aborts after its request succeeds', async () => {
    const request = {} as ControlledRequest<string>;
    const transaction = controlledTransaction(request);
    const store = new IsfStore();
    vi.spyOn(store, 'init').mockResolvedValue(undefined);
    setDatabase(store, transaction.value);

    const result = store.perform(
      'main_v2_history_entries',
      'readwrite',
      () => request as unknown as IDBRequest<string>,
    );
    await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf('function'));
    request.result = 'not-durable';
    request.onsuccess?.(new Event('success'));
    transaction.value.error = new DOMException('commit failed', 'AbortError');
    transaction.value.onabort?.(new Event('abort'));

    await expect(result).rejects.toThrow('commit failed');
  });
});

interface ControlledOpenRequest {
  result: IDBDatabase;
  error: DOMException | null;
  onblocked: ((event: IDBVersionChangeEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onsuccess: ((event: Event) => void) | null;
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
}

interface ControlledRequest<T> {
  result: T;
  error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

function installIndexedDb(databases: IDBDatabaseInfo[] = []) {
  const openRequests: ControlledOpenRequest[] = [];
  const indexedDb = {
    databases: vi.fn().mockResolvedValue(databases),
    deleteDatabase: vi.fn(),
    open: vi.fn(() => {
      const request = {
        result: undefined,
        error: null,
        onblocked: null,
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
      } as unknown as ControlledOpenRequest;
      openRequests.push(request);
      return request as unknown as IDBOpenDBRequest;
    }),
  };
  vi.stubGlobal('indexedDB', indexedDb);
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: indexedDb });
  return { indexedDb, openRequests };
}

function fakeDatabase() {
  const close = vi.fn();
  const database = {
    close,
    onversionchange: null,
    objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
  } as unknown as IDBDatabase;
  return { close, database };
}

function controlledTransaction<T>(request: ControlledRequest<T>) {
  const value = {
    error: null,
    onabort: null,
    oncomplete: null,
    objectStore: vi.fn(() => ({ put: vi.fn(() => request) })),
  } as unknown as IDBTransaction & {
    error: DOMException | null;
    onabort: ((event: Event) => void) | null;
    oncomplete: ((event: Event) => void) | null;
  };
  return { value };
}

function setDatabase(store: IsfStore, transaction: IDBTransaction) {
  const database = {
    transaction: vi.fn(() => transaction),
  } as unknown as IDBDatabase;
  (store as unknown as { db: IDBDatabase | null }).db = database;
}
