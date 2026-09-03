import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserWorkspaceSaveLock,
  RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

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

  keys(): IterableIterator<string> {
    return this.values.keys();
  }
}

describe('BrowserWorkspaceSaveLock namespaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the current v3 namespace for Web Locks and fallback leases by default', async () => {
    const requestedNames: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: async <T>(name: string, task: () => Promise<T>): Promise<T> => {
          requestedNames.push(name);
          return await task();
        },
      },
    });
    await new BrowserWorkspaceSaveLock().runExclusive(async () => undefined);

    expect(requestedNames).toEqual(['isf-workspace-v3-save']);

    vi.stubGlobal('navigator', {});
    const storage = new MemoryStorage();
    await new BrowserWorkspaceSaveLock(storage, {
      createOwnerToken: () => 'current-tab',
      now: () => 100,
      yieldAfterClaim: async () => undefined,
    }).runExclusive(async () => undefined);

    expect([...storage.keys()]).toContainEqual(
      expect.stringMatching(/^isf-workspace-v3-save-lease:/),
    );
    expect([...storage.keys()]).not.toContainEqual(
      expect.stringMatching(/^isf-workspace-v1-save-lease:/),
    );
  });

  it('uses only the retired v1 namespace when it is injected', async () => {
    const requestedNames: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: async <T>(name: string, task: () => Promise<T>): Promise<T> => {
          requestedNames.push(name);
          return await task();
        },
      },
    });
    await new BrowserWorkspaceSaveLock(undefined, {
      namespace: RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
    }).runExclusive(async () => undefined);

    expect(requestedNames).toEqual(['isf-workspace-v1-save']);

    vi.stubGlobal('navigator', {});
    const storage = new MemoryStorage();
    await new BrowserWorkspaceSaveLock(storage, {
      namespace: RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
      createOwnerToken: () => 'retired-tab',
      now: () => 100,
      yieldAfterClaim: async () => undefined,
    }).runExclusive(async () => undefined);

    expect([...storage.keys()]).toContainEqual(
      expect.stringMatching(/^isf-workspace-v1-save-lease:/),
    );
    expect([...storage.keys()]).not.toContainEqual(
      expect.stringMatching(/^isf-workspace-v3-save-lease:/),
    );
  });
});
