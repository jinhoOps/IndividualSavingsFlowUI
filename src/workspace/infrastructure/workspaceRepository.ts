import { convertWorkspaceV4Document, upgradeWorkspaceV4 } from './workspaceV4Migration';
import type { ExpenseAssistantDraft } from '../../main/domain/expenseAssistant';
import {
  PREVIOUS_WORKSPACE_STORAGE_KEY,
  RETIRED_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_V4_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../domain/model';
import type { SimulationDraftMigration } from '../../simulation/domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import {
  BrowserWorkspaceSaveLock,
  CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE,
  V4_WORKSPACE_SAVE_LOCK_NAMESPACE,
  PREVIOUS_WORKSPACE_SAVE_LOCK_NAMESPACE,
  RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLeaseOptions,
  type WorkspaceSaveLock,
} from './workspaceSaveLock';
import { convertRetiredWorkspaceToV4 } from './retiredWorkspaceMigration';
import { convertWorkspaceV3Document } from './workspaceV3Migration';

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
  resetMainSetup?(expectedRevision: number): Promise<WorkspaceWriteResult>;
  saveExpense?(expectedRevision: number, draft: ExpenseAssistantDraft, complete: boolean): Promise<WorkspaceWriteResult>;
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
  previousSaveLock?: WorkspaceSaveLock;
  v4SaveLock?: WorkspaceSaveLock;
  retiredSaveLock?: WorkspaceSaveLock;
  saveLeaseOptions?: WorkspaceSaveLeaseOptions;
  eventTarget?: Window;
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  private readonly now: () => number;
  private readonly saveLock: WorkspaceSaveLock;
  private readonly previousSaveLock: WorkspaceSaveLock;
  private readonly v4SaveLock: WorkspaceSaveLock;
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
    this.v4SaveLock = options.v4SaveLock ?? new BrowserWorkspaceSaveLock(storageOverride, { ...options.saveLeaseOptions, namespace: V4_WORKSPACE_SAVE_LOCK_NAMESPACE });
    this.previousSaveLock = options.previousSaveLock
      ?? new BrowserWorkspaceSaveLock(storageOverride, {
        ...options.saveLeaseOptions,
        namespace: PREVIOUS_WORKSPACE_SAVE_LOCK_NAMESPACE,
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
    const current = this.loadCurrentOnly();
    if (current.status !== 'empty') return current;

    const v4 = this.loadV4Only();
    if (v4.status !== 'empty') return v4;

    const previous = this.loadPreviousOnly();
    if (previous.status !== 'empty') return previous;

    const retired = this.loadRetiredOnly();
    return retired.status === 'empty' ? this.createEmptyLoadResult() : retired;
  }

  async migrate(expectedRevision: number): Promise<WorkspaceWriteResult> {
    return await this.update(expectedRevision, (current) => current);
  }

  async update(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    try {
      const source = this.detectSource();
      if (source === 'unavailable') return { status: 'unavailable' };
      if (source === 'v4') return await this.updateFromV4(expectedRevision, mutate);
      if (source === 'v3') return await this.updateFromPrevious(expectedRevision, mutate);
      if (source === 'retired') return await this.updateFromRetired(expectedRevision, mutate);
      return await this.saveLock.runExclusive(async (guard) => (
        this.updateV5OrEmptyLocked(expectedRevision, mutate, guard)
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
      const source = this.detectSource();
      if (source === 'unavailable') return { status: 'unavailable' };
      if (source === 'v5') return await this.saveLock.runExclusive(async (guard) => (
        this.resetCurrentInvalidLocked(expectedRaw, guard)
      ));
      if (source === 'v4') return await this.resetV4Invalid(expectedRaw);
      if (source === 'v3') return await this.resetPreviousInvalid(expectedRaw);
      if (source === 'retired') return await this.resetRetiredInvalid(expectedRaw);
      return { status: 'changed' };
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

  private async updateV5OrEmptyLocked(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
    guard: WorkspaceSaveGuard,
  ): Promise<WorkspaceWriteResult> {
    const current = this.loadCurrentOnly();
    if (current.status !== 'empty') return this.updateLocked(expectedRevision, mutate, guard, current);
    const source = this.detectSource();
    if (source !== 'empty' && source !== 'v5') return { status: 'unavailable' };
    return this.updateLocked(expectedRevision, mutate, guard, current);
  }

  private async updateFromV4(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    return await this.v4SaveLock.runExclusive(async (previousGuard) => (
      await this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(previousGuard, currentGuard);
        const current = this.loadCurrentOnly();
        if (current.status === 'invalid' || current.status === 'unavailable') return { status: current.status };
        if (current.status === 'found') return this.updateLocked(expectedRevision, mutate, currentGuard, current);
        const previous = this.loadV4Only();
        if (previous.status === 'invalid' || previous.status === 'unavailable') return { status: previous.status };
        if (previous.status === 'empty') return { status: 'unavailable' };
        return this.updateLocked(expectedRevision, mutate, guard, previous);
      })
    ));
  }

  private async updateFromPrevious(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    return await this.previousSaveLock.runExclusive(async (previousGuard) => (
      await this.v4SaveLock.runExclusive(async (v4Guard) => this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(previousGuard, v4Guard, currentGuard);
        const current = this.loadCurrentOnly();
        if (current.status === 'invalid' || current.status === 'unavailable') return { status: current.status };
        if (current.status === 'found') return this.updateLocked(expectedRevision, mutate, currentGuard, current);
        const v4 = this.loadV4Only();
        if (v4.status !== 'empty') return this.updateLocked(expectedRevision, mutate, guard, v4);
        const previous = this.loadPreviousOnly();
        if (previous.status === 'invalid' || previous.status === 'unavailable') return { status: previous.status };
        if (previous.status === 'empty') return { status: 'unavailable' };
        return this.updateLocked(expectedRevision, mutate, guard, previous);
      }))
    ));
  }

  private async updateFromRetired(
    expectedRevision: number,
    mutate: (current: WorkspaceDocument) => WorkspaceDocument,
  ): Promise<WorkspaceWriteResult> {
    return await this.retiredSaveLock.runExclusive(async (retiredGuard) => (
      await this.v4SaveLock.runExclusive(async (v4Guard) => this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(retiredGuard, v4Guard, currentGuard);
        const current = this.loadCurrentOnly();
        if (current.status === 'invalid' || current.status === 'unavailable') return { status: current.status };
        if (current.status === 'found') return this.updateLocked(expectedRevision, mutate, currentGuard, current);
        const v4 = this.loadV4Only();
        if (v4.status !== 'empty') return this.updateLocked(expectedRevision, mutate, guard, v4);
        const retired = this.loadRetiredOnly();
        if (retired.status === 'invalid' || retired.status === 'unavailable') return { status: retired.status };
        if (retired.status === 'empty') return { status: 'unavailable' };
        return this.updateLocked(expectedRevision, mutate, guard, retired);
      }))
    ));
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

  private async resetV4Invalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult> {
    return await this.v4SaveLock.runExclusive(async (previousGuard) => {
      const previous = this.loadV4Only();
      if (previous.status !== 'invalid') return previous.status === 'unavailable'
        ? { status: 'unavailable' }
        : { status: 'changed' };
      if (previous.raw !== expectedRaw) return { status: 'changed' };
      return await this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(previousGuard, currentGuard);
        try {
          guard.assertOwned();
          if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null
            || this.storage.getItem(WORKSPACE_V4_STORAGE_KEY) !== expectedRaw) {
            return { status: 'changed' };
          }
        } catch {
          return { status: 'unavailable' };
        }
        return this.commitEmptyReset(guard, null);
      });
    });
  }

  private async resetPreviousInvalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult> {
    return await this.previousSaveLock.runExclusive(async (previousGuard) => {
      const previous = this.loadPreviousOnly();
      if (previous.status !== 'invalid') return previous.status === 'unavailable'
        ? { status: 'unavailable' }
        : { status: 'changed' };
      if (previous.raw !== expectedRaw) return { status: 'changed' };
      return await this.v4SaveLock.runExclusive(async (v4Guard) => this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(previousGuard, v4Guard, currentGuard);
        try {
          guard.assertOwned();
          if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null
            || this.storage.getItem(WORKSPACE_V4_STORAGE_KEY) !== null
            || this.storage.getItem(PREVIOUS_WORKSPACE_STORAGE_KEY) !== expectedRaw) {
            return { status: 'changed' };
          }
        } catch {
          return { status: 'unavailable' };
        }
        return this.commitEmptyReset(guard, null);
      }));
    });
  }

  private async resetRetiredInvalid(expectedRaw: string): Promise<WorkspaceInvalidResetResult> {
    return await this.retiredSaveLock.runExclusive(async (retiredGuard) => {
      const retired = this.loadRetiredOnly();
      if (retired.status !== 'invalid') return retired.status === 'unavailable'
        ? { status: 'unavailable' }
        : { status: 'changed' };
      if (retired.raw !== expectedRaw) return { status: 'changed' };
      return await this.v4SaveLock.runExclusive(async (v4Guard) => this.saveLock.runExclusive(async (currentGuard) => {
        const guard = combineGuards(retiredGuard, v4Guard, currentGuard);
        try {
          guard.assertOwned();
          if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null
            || this.storage.getItem(WORKSPACE_V4_STORAGE_KEY) !== null
            || this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY) !== expectedRaw) {
            return { status: 'changed' };
          }
        } catch {
          return { status: 'unavailable' };
        }
        return this.commitEmptyReset(guard, null);
      }));
    });
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

  private detectSource(): 'v5' | 'v4' | 'v3' | 'retired' | 'empty' | 'unavailable' {
    try {
      if (this.storage.getItem(WORKSPACE_STORAGE_KEY) !== null) return 'v5';
      if (this.storage.getItem(WORKSPACE_V4_STORAGE_KEY) !== null) return 'v4';
      if (this.storage.getItem(PREVIOUS_WORKSPACE_STORAGE_KEY) !== null) return 'v3';
      if (this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY) !== null) return 'retired';
      return 'empty';
    } catch {
      return 'unavailable';
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

  private loadV4Only(): WorkspaceLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(WORKSPACE_V4_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (raw === null) return this.createEmptyLoadResult();
    try {
      const converted = convertWorkspaceV4Document(JSON.parse(raw));
      if (converted.status === 'invalid') return { status: 'invalid', raw };
      return {
        status: 'found',
        workspace: converted.workspace,
        needsMigration: true,
      };
    } catch (error) {
      return error instanceof SyntaxError ? { status: 'invalid', raw } : { status: 'unavailable' };
    }
  }

  private loadPreviousOnly(): WorkspaceLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(PREVIOUS_WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (raw === null) return this.createEmptyLoadResult();
    try {
      const converted = convertWorkspaceV3Document(JSON.parse(raw), this.now());
      if (converted.status === 'invalid') return { status: 'invalid', raw };
      return {
        status: 'found',
        workspace: upgradeWorkspaceV4(converted.workspace),
        needsMigration: true,
      };
    } catch (error) {
      return error instanceof SyntaxError ? { status: 'invalid', raw } : { status: 'unavailable' };
    }
  }

  private loadRetiredOnly(): WorkspaceLoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(RETIRED_WORKSPACE_STORAGE_KEY);
    } catch {
      return { status: 'unavailable' };
    }
    if (raw === null) return this.createEmptyLoadResult();
    try {
      const converted = convertRetiredWorkspaceToV4(JSON.parse(raw), this.now());
      if (converted.status === 'invalid') return { status: 'invalid', raw };
      if (converted.simulationMigration === null) {
        return { status: 'found', workspace: upgradeWorkspaceV4(converted.workspace), needsMigration: true };
      }
      return {
        status: 'found',
        workspace: upgradeWorkspaceV4(converted.workspace),
        needsMigration: true,
        simulationMigration: converted.simulationMigration,
      };
    } catch (error) {
      return error instanceof SyntaxError ? { status: 'invalid', raw } : { status: 'unavailable' };
    }
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

function combineGuards(...guards: readonly WorkspaceSaveGuard[]): WorkspaceSaveGuard {
  return {
    assertOwned: () => {
      for (const guard of guards) guard.assertOwned();
    },
  };
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
