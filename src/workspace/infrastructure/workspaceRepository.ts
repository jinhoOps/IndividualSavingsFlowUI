import {
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import {
  BrowserWorkspaceSaveLock,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLeaseOptions,
  type WorkspaceSaveLock,
} from './workspaceSaveLock';

export type WorkspaceLoadResult =
  | { status: 'found'; workspace: WorkspaceDocument }
  | { status: 'empty'; workspace: WorkspaceDocument }
  | { status: 'invalid'; raw: string }
  | { status: 'unavailable' };

export type WorkspaceWriteResult =
  | { status: 'saved'; workspace: WorkspaceDocument }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'invalid' | 'unavailable' };

export interface WorkspaceRepository {
  load(): WorkspaceLoadResult;
  update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult>;
  replace(
    expectedRevision: number,
    candidate: WorkspaceDocument,
  ): Promise<WorkspaceWriteResult>;
  subscribe(listener: (workspace: WorkspaceDocument) => void): () => void;
}

export interface BrowserWorkspaceRepositoryOptions {
  now?: () => number;
  saveLock?: WorkspaceSaveLock;
  saveLeaseOptions?: WorkspaceSaveLeaseOptions;
  eventTarget?: Window;
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  private readonly now: () => number;
  private readonly saveLock: WorkspaceSaveLock;
  private readonly eventTarget: Window;
  private readonly listeners = new Set<(workspace: WorkspaceDocument) => void>();
  private listeningForStorageEvents = false;

  constructor(
    private readonly storageOverride?: Storage,
    options: BrowserWorkspaceRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.saveLock = options.saveLock
      ?? new BrowserWorkspaceSaveLock(storageOverride, options.saveLeaseOptions);
    this.eventTarget = options.eventTarget ?? window;
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  load(): WorkspaceLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (raw === null) {
      try {
        return { status: 'empty', workspace: createEmptyWorkspace(this.now()) };
      } catch {
        return { status: 'unavailable' };
      }
    }
    try {
      const workspace = parseWorkspaceDocument(JSON.parse(raw));
      return workspace === null
        ? { status: 'invalid', raw }
        : { status: 'found', workspace };
    } catch (error) {
      return error instanceof SyntaxError
        ? { status: 'invalid', raw }
        : { status: 'unavailable' };
    }
  }

  async update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    try {
      return await this.saveLock.runExclusive(async (guard) => (
        this.updateLocked(expectedRevision, mutate, guard)
      ));
    } catch {
      return { status: 'unavailable' };
    }
  }

  async replace(
    expectedRevision: number,
    candidate: WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    return await this.update(expectedRevision, () => candidate);
  }

  subscribe(listener: (workspace: WorkspaceDocument) => void): () => void {
    this.listeners.add(listener);
    if (!this.listeningForStorageEvents) {
      this.eventTarget.addEventListener('storage', this.handleStorageEvent);
      this.listeningForStorageEvents = true;
    }
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.listeningForStorageEvents) {
        this.eventTarget.removeEventListener('storage', this.handleStorageEvent);
        this.listeningForStorageEvents = false;
      }
    };
  }

  private updateLocked(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
    guard: WorkspaceSaveGuard,
  ): WorkspaceWriteResult {
    const loaded = this.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
      return { status: loaded.status };
    }
    const current = loaded.workspace;
    if (current.revision !== expectedRevision) {
      return { status: 'conflict', currentRevision: current.revision };
    }

    const candidate = mutate(structuredClone(current));
    const next = parseWorkspaceDocument({
      ...candidate,
      revision: current.revision + 1,
      updatedAt: monotonicTimestamp(current.updatedAt, this.now()),
    });
    if (next === null) return { status: 'invalid' };

    const serialized = JSON.stringify(next);
    let previousRaw: string | null | undefined;
    try {
      previousRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      guard.assertOwned();
      this.storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
      const verifiedRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      if (verifiedRaw !== serialized) {
        this.restorePreviousRaw(guard, previousRaw, verifiedRaw);
        return { status: 'unavailable' };
      }
    } catch {
      if (previousRaw !== undefined) {
        this.restorePreviousRaw(guard, previousRaw, this.readCurrentRawSafely());
      }
      return { status: 'unavailable' };
    }

    this.notify(next);
    return { status: 'saved', workspace: next };
  }

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== WORKSPACE_STORAGE_KEY || event.newValue === null) return;
    if (event.storageArea !== null) {
      try {
        if (event.storageArea !== this.storage) return;
      } catch {
        return;
      }
    }
    try {
      const workspace = parseWorkspaceDocument(JSON.parse(event.newValue));
      if (workspace !== null) this.notify(workspace);
    } catch {
      // Ignore malformed cross-tab notifications; load() retains the invalid raw for recovery UI.
    }
  };

  private notify(workspace: WorkspaceDocument): void {
    for (const listener of this.listeners) {
      try {
        listener(structuredClone(workspace));
      } catch {
        // A subscriber cannot undo a verified workspace commit or block other subscribers.
      }
    }
  }

  private restorePreviousRaw(
    guard: WorkspaceSaveGuard,
    previousRaw: string | null,
    observedRaw: string | null,
  ): void {
    if (observedRaw === previousRaw) return;
    try {
      guard.assertOwned();
      if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== observedRaw) return;
      guard.assertOwned();
      if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== observedRaw) return;
      if (previousRaw === null) this.storage.removeItem(WORKSPACE_STORAGE_KEY);
      else this.storage.setItem(WORKSPACE_STORAGE_KEY, previousRaw);
    } catch {
      // A lost lease or newer raw value must never be rolled back.
    }
  }

  private readCurrentRawSafely(): string | null {
    try {
      return this.storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}

function monotonicTimestamp(current: number, now: number): number {
  return Math.max(current + 1, now);
}
