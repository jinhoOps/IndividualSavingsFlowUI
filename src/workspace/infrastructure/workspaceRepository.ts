import {
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../domain/model';
import type { SimulationDraftMigration } from '../../simulation/domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import {
  BrowserWorkspaceSaveLock,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLeaseOptions,
  type WorkspaceSaveLock,
} from './workspaceSaveLock';

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
  saveLeaseOptions?: WorkspaceSaveLeaseOptions;
  eventTarget?: Window;
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  private readonly now: () => number;
  private readonly saveLock: WorkspaceSaveLock;
  private readonly eventTarget: Window;
  private readonly notificationStorageGroup: object;

  constructor(
    private readonly storageOverride?: Storage,
    options: BrowserWorkspaceRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.saveLock = options.saveLock
      ?? new BrowserWorkspaceSaveLock(storageOverride, options.saveLeaseOptions);
    this.eventTarget = options.eventTarget ?? window;
    this.notificationStorageGroup = resolveStorageGroup(storageOverride);
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
        return { status: 'empty', workspace: createEmptyWorkspace(this.now()), needsMigration: false };
      } catch {
        return { status: 'unavailable' };
      }
    }
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

  async migrate(expectedRevision: number): Promise<WorkspaceWriteResult> {
    return await this.update(expectedRevision, (current) => current);
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

  async resetInvalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult> {
    try {
      return await this.saveLock.runExclusive(async (guard) => (
        this.resetInvalidLocked(expectedRaw, guard)
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

    publishToWorkspaceChannel(this.eventTarget, this.notificationStorageGroup, next);
    return { status: 'saved', workspace: next };
  }

  private resetInvalidLocked(
    expectedRaw: string,
    guard: WorkspaceSaveGuard,
  ): WorkspaceInvalidResetResult {
    let observedRaw: string;
    try {
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

    const next = parseWorkspaceDocument({
      ...createEmptyWorkspace(this.now()),
      revision: 1,
    });
    if (next === null) return { status: 'unavailable' };
    const serialized = JSON.stringify(next);

    try {
      guard.assertOwned();
      if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== observedRaw) {
        return { status: 'changed' };
      }
      guard.assertOwned();
      this.storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
      const verifiedRaw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
      if (verifiedRaw !== serialized) {
        this.restorePreviousRaw(guard, observedRaw, verifiedRaw);
        return { status: 'unavailable' };
      }
    } catch {
      this.restorePreviousRaw(guard, observedRaw, this.readCurrentRawSafely());
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
