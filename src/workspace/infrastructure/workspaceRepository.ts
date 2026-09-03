import {
  RETIRED_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../domain/model';
import type { SimulationDraftMigration } from '../../simulation/domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import {
  BrowserWorkspaceSaveLock,
  CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE,
  RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLeaseOptions,
  type WorkspaceSaveLock,
} from './workspaceSaveLock';
import { convertRetiredWorkspaceDocument } from './retiredWorkspaceMigration';

type WorkspaceListener = (workspace: WorkspaceDocument) => void;

interface WorkspaceNotificationChannel {
  listeners: Set<WorkspaceListener>;
  handleStorageEvent: (event: StorageEvent) => void;
}

const unavailableStorageGroup = {};
const notificationChannels = new WeakMap<Window, Map<object, WorkspaceNotificationChannel>>();

export type WorkspaceLoadResult =
  | {
    status: 'found';
    workspace: WorkspaceDocument;
    needsMigration: boolean;
    simulationMigration?: SimulationDraftMigration;
  }
  | { status: 'empty'; workspace: WorkspaceDocument; needsMigration: false }
  | { status: 'invalid'; raw: string }
  | { status: 'unavailable' };

export type WorkspaceWriteResult =
  | { status: 'saved'; workspace: WorkspaceDocument }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'invalid' | 'unavailable' };

export type WorkspaceInvalidResetResult =
  | { status: 'saved'; workspace: WorkspaceDocument }
  | { status: 'changed' | 'unavailable' };

export interface WorkspaceRepository {
  load(): WorkspaceLoadResult;
  migrate(expectedRevision: number): Promise<WorkspaceWriteResult>;
  update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult>;
  replace(
    expectedRevision: number,
    candidate: WorkspaceDocument,
  ): Promise<WorkspaceWriteResult>;
  resetInvalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult>;
  subscribe(listener: (workspace: WorkspaceDocument) => void): () => void;
}

export interface BrowserWorkspaceRepositoryOptions {
  now?: () => number;
  saveLock?: WorkspaceSaveLock;
  retiredSaveLock?: WorkspaceSaveLock;
  saveLeaseOptions?: WorkspaceSaveLeaseOptions;
  eventTarget?: Window;
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  private readonly now: () => number;
  private readonly saveLock: WorkspaceSaveLock;
  private readonly retiredSaveLock: WorkspaceSaveLock;
  private readonly eventTarget: Window;
  private readonly notificationStorageGroup: object;

  constructor(
    private readonly storageOverride?: Storage,
    options: BrowserWorkspaceRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.saveLock = options.saveLock
      ?? new BrowserWorkspaceSaveLock(storageOverride, {
        ...options.saveLeaseOptions,
        namespace: CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE,
      });
    this.retiredSaveLock = options.retiredSaveLock
      ?? new BrowserWorkspaceSaveLock(storageOverride, {
        ...options.saveLeaseOptions,
        namespace: RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
      });
    this.eventTarget = options.eventTarget ?? window;
    this.notificationStorageGroup = resolveStorageGroup(storageOverride);
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  load(): WorkspaceLoadResult {
    let currentRaw: string | null;
    try {
      currentRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (currentRaw !== null) return this.parseCurrentRaw(currentRaw);

    let retiredRaw: string | null;
    try {
      retiredRaw = this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (retiredRaw === null) return this.createEmptyLoadResult();

    try {
      const converted = convertRetiredWorkspaceDocument(JSON.parse(retiredRaw), this.now());
      if (converted.status === 'invalid') return { status: 'invalid', raw: retiredRaw };
      if (converted.simulationMigration === null) {
        return {
          status: 'found',
          workspace: converted.workspace,
          needsMigration: true,
        };
      }
      return {
        status: 'found',
        workspace: converted.workspace,
        needsMigration: true,
        simulationMigration: converted.simulationMigration,
      };
    } catch (error) {
      return error instanceof SyntaxError
        ? { status: 'invalid', raw: retiredRaw }
        : { status: 'unavailable' };
    }
  }

  async migrate(expectedRevision: number): Promise<WorkspaceWriteResult> {
    return await this.update(expectedRevision, (current) => current);
  }

  async update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    try {
      const useRetiredLock = this.shouldUseRetiredLock();
      if (useRetiredLock === null) return { status: 'unavailable' };
      if (useRetiredLock) {
        return await this.retiredSaveLock.runExclusive(async (retiredGuard) => {
          const snapshot = this.load();
          if (snapshot.status === 'invalid' || snapshot.status === 'unavailable') {
            return { status: snapshot.status };
          }
          if (snapshot.status === 'empty') return { status: 'unavailable' };

          return await this.saveLock.runExclusive(async (currentGuard) => {
            const current = this.loadCurrentOnly();
            if (current.status === 'unavailable') return { status: 'unavailable' };
            if (current.status === 'invalid') return { status: 'invalid' };
            if (current.status === 'empty' && !snapshot.needsMigration) {
              return { status: 'unavailable' };
            }
            const loaded = current.status === 'empty' ? snapshot : current;
            const guard: WorkspaceSaveGuard = {
              assertOwned: () => {
                retiredGuard.assertOwned();
                currentGuard.assertOwned();
              },
            };
            return this.updateLocked(expectedRevision, mutate, guard, loaded);
          });
        });
      }
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

  async resetInvalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult> {
    try {
      const useRetiredLock = this.shouldUseRetiredLock();
      if (useRetiredLock === null) return { status: 'unavailable' };
      if (useRetiredLock) {
        return await this.retiredSaveLock.runExclusive(async (retiredGuard) => {
          let retiredRaw: string | null;
          try {
            retiredGuard.assertOwned();
            retiredRaw = this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY);
          } catch {
            return { status: 'unavailable' };
          }
          if (retiredRaw !== expectedRaw) return { status: 'changed' };

          try {
            const converted = convertRetiredWorkspaceDocument(JSON.parse(retiredRaw), this.now());
            if (converted.status !== 'invalid') return { status: 'changed' };
          } catch (error) {
            if (!(error instanceof SyntaxError)) return { status: 'unavailable' };
          }

          return await this.saveLock.runExclusive(async (currentGuard) => {
            const guard: WorkspaceSaveGuard = {
              assertOwned: () => {
                retiredGuard.assertOwned();
                currentGuard.assertOwned();
              },
            };
            try {
              guard.assertOwned();
              if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null) {
                return { status: 'changed' };
              }
              guard.assertOwned();
              if (this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY) !== expectedRaw) {
                return { status: 'changed' };
              }
            } catch {
              return { status: 'unavailable' };
            }
            return this.commitEmptyReset(guard, null);
          });
        });
      }
      return await this.saveLock.runExclusive(async (guard) => (
        this.resetCurrentInvalidLocked(expectedRaw, guard)
      ));
    } catch {
      return { status: 'unavailable' };
    }
  }

  subscribe(listener: (workspace: WorkspaceDocument) => void): () => void {
    return subscribeToWorkspaceChannel(
      this.eventTarget,
      this.notificationStorageGroup,
      listener,
    );
  }

  private updateLocked(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
    guard: WorkspaceSaveGuard,
    loadedOverride?: WorkspaceLoadResult,
  ): WorkspaceWriteResult {
    const loaded = loadedOverride ?? this.loadCurrentOnly();
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

    const writeResult = this.writeVerifiedWorkspace(next, guard);
    return writeResult.status === 'saved' ? writeResult : { status: 'unavailable' };
  }

  private resetCurrentInvalidLocked(
    expectedRaw: string,
    guard: WorkspaceSaveGuard,
  ): WorkspaceInvalidResetResult {
    let observedRaw: string;
    try {
      guard.assertOwned();
      const currentRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      if (currentRaw !== expectedRaw) return { status: 'changed' };
      try {
        if (parseWorkspaceDocument(JSON.parse(currentRaw)) !== null) {
          return { status: 'changed' };
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) return { status: 'unavailable' };
      }
      observedRaw = currentRaw;
    } catch {
      return { status: 'unavailable' };
    }

    return this.commitEmptyReset(guard, observedRaw);
  }

  private commitEmptyReset(
    guard: WorkspaceSaveGuard,
    expectedPreviousRaw: string | null,
  ): WorkspaceInvalidResetResult {
    const next = parseWorkspaceDocument({
      ...createEmptyWorkspace(this.now()),
      revision: 1,
    });
    if (next === null) return { status: 'unavailable' };

    return this.writeVerifiedWorkspace(next, guard, expectedPreviousRaw);
  }

  private writeVerifiedWorkspace(
    next: WorkspaceDocument,
    guard: WorkspaceSaveGuard,
    expectedPreviousRaw?: string | null,
  ): WorkspaceInvalidResetResult {
    const serialized = JSON.stringify(next);
    let previousRaw: string | null | undefined;

    try {
      guard.assertOwned();
      previousRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      if (expectedPreviousRaw !== undefined && previousRaw !== expectedPreviousRaw) {
        return { status: 'changed' };
      }
      guard.assertOwned();
      this.storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
      guard.assertOwned();
      const verifiedRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      if (verifiedRaw !== serialized) {
        this.restorePreviousRaw(guard, previousRaw, verifiedRaw);
        return { status: 'unavailable' };
      }
    } catch {
      if (previousRaw !== undefined) {
        this.restorePreviousRaw(guard, previousRaw, this.readCurrentRawSafely(guard));
      }
      return { status: 'unavailable' };
    }

    publishToWorkspaceChannel(this.eventTarget, this.notificationStorageGroup, next);
    return { status: 'saved', workspace: next };
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
      guard.assertOwned();
      if (previousRaw === null) this.storage.removeItem(WORKSPACE_STORAGE_KEY);
      else this.storage.setItem(WORKSPACE_STORAGE_KEY, previousRaw);
    } catch {
      // A lost lease or newer raw value must never be rolled back.
    }
  }

  private readCurrentRawSafely(guard: WorkspaceSaveGuard): string | null {
    try {
      guard.assertOwned();
      return this.storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private shouldUseRetiredLock(): boolean | null {
    try {
      if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null) return false;
      return this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY) !== null;
    } catch {
      return null;
    }
  }

  private loadCurrentOnly(): WorkspaceLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    return raw === null ? this.createEmptyLoadResult() : this.parseCurrentRaw(raw);
  }

  private parseCurrentRaw(raw: string): WorkspaceLoadResult {
    try {
      const parsed = parseWorkspaceDocument(JSON.parse(raw));
      if (parsed === null) return { status: 'invalid', raw };
      return { status: 'found', workspace: parsed, needsMigration: false };
    } catch (error) {
      return error instanceof SyntaxError
        ? { status: 'invalid', raw }
        : { status: 'unavailable' };
    }
  }

  private createEmptyLoadResult(): WorkspaceLoadResult {
    try {
      return { status: 'empty', workspace: createEmptyWorkspace(this.now()), needsMigration: false };
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function monotonicTimestamp(current: number, now: number): number {
  return Math.max(current + 1, now);
}

function resolveStorageGroup(storageOverride?: Storage): object {
  if (storageOverride !== undefined) return storageOverride;
  try {
    return window.localStorage;
  } catch {
    return unavailableStorageGroup;
  }
}

function subscribeToWorkspaceChannel(
  eventTarget: Window,
  storageGroup: object,
  listener: WorkspaceListener,
): () => void {
  let channels = notificationChannels.get(eventTarget);
  if (channels === undefined) {
    channels = new Map();
    notificationChannels.set(eventTarget, channels);
  }
  let channel = channels.get(storageGroup);
  if (channel === undefined) {
    channel = createWorkspaceNotificationChannel(eventTarget, storageGroup);
    channels.set(storageGroup, channel);
  }
  const subscription: WorkspaceListener = (workspace) => listener(workspace);
  channel.listeners.add(subscription);

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    channel?.listeners.delete(subscription);
    if (channel?.listeners.size !== 0) return;
    eventTarget.removeEventListener('storage', channel.handleStorageEvent);
    channels?.delete(storageGroup);
  };
}

function createWorkspaceNotificationChannel(
  eventTarget: Window,
  storageGroup: object,
): WorkspaceNotificationChannel {
  const channel: WorkspaceNotificationChannel = {
    listeners: new Set(),
    handleStorageEvent: (event) => {
      if (event.key !== WORKSPACE_STORAGE_KEY || event.newValue === null) return;
      if (event.storageArea !== null && event.storageArea !== storageGroup) return;
      try {
        const workspace = parseWorkspaceDocument(JSON.parse(event.newValue));
        if (workspace !== null) notifyWorkspaceListeners(channel.listeners, workspace);
      } catch {
        // Ignore malformed cross-tab notifications; load() retains the invalid raw for recovery UI.
      }
    },
  };
  eventTarget.addEventListener('storage', channel.handleStorageEvent);
  return channel;
}

function publishToWorkspaceChannel(
  eventTarget: Window,
  storageGroup: object,
  workspace: WorkspaceDocument,
): void {
  const channel = notificationChannels.get(eventTarget)?.get(storageGroup);
  if (channel !== undefined) notifyWorkspaceListeners(channel.listeners, workspace);
}

function notifyWorkspaceListeners(
  listeners: Set<WorkspaceListener>,
  workspace: WorkspaceDocument,
): void {
  for (const listener of listeners) {
    try {
      listener(structuredClone(workspace));
    } catch {
      // A subscriber cannot undo a verified workspace commit or block other subscribers.
    }
  }
}
