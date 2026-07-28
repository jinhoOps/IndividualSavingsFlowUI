import { afterEach, describe, expect, it, vi } from 'vitest';
import { IsfStore } from '../../../src/core/storage/IsfStore';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('IsfStore', () => {
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
      'main_v1_history_entries',
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
      'main_v1_history_entries',
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

function installIndexedDb() {
  const openRequests: ControlledOpenRequest[] = [];
  const indexedDb = {
    databases: vi.fn().mockResolvedValue([]),
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
