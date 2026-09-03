const DEFAULT_LEASE_DURATION_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 2_000;
const DEFAULT_RETRY_DELAY_MS = 25;

export interface WorkspaceSaveLockNamespace {
  lockName: string;
  leasePrefix: string;
}

export const CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE = {
  lockName: 'isf-workspace-v3-save',
  leasePrefix: 'isf-workspace-v3-save-lease:',
} satisfies WorkspaceSaveLockNamespace;

export const RETIRED_WORKSPACE_SAVE_LOCK_NAMESPACE = {
  lockName: 'isf-workspace-v1-save',
  leasePrefix: 'isf-workspace-v1-save-lease:',
} satisfies WorkspaceSaveLockNamespace;

export interface WorkspaceSaveGuard {
  assertOwned(): void;
}

export interface WorkspaceSaveLock {
  runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T>;
}

export interface WorkspaceSaveLeaseOptions {
  namespace?: WorkspaceSaveLockNamespace;
  createOwnerToken?: () => string;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
  yieldAfterSnapshot?: () => Promise<void>;
  yieldAfterClaim?: () => Promise<void>;
  leaseDurationMs?: number;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
}

interface WorkspaceSaveLease {
  owner: string;
  choosing: boolean;
  ticket: number;
  expiresAt: number;
}

export class BrowserWorkspaceSaveLock implements WorkspaceSaveLock {
  private readonly createOwnerToken: () => string;
  private readonly now: () => number;
  private readonly wait: (delayMs: number) => Promise<void>;
  private readonly yieldAfterSnapshot: () => Promise<void>;
  private readonly yieldAfterClaim: () => Promise<void>;
  private readonly leaseDurationMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly namespace: WorkspaceSaveLockNamespace;
  private readonly owner: string;
  private localTail = Promise.resolve();

  constructor(
    private readonly storageOverride?: Storage,
    options: WorkspaceSaveLeaseOptions = {},
  ) {
    this.namespace = options.namespace ?? CURRENT_WORKSPACE_SAVE_LOCK_NAMESPACE;
    this.createOwnerToken = options.createOwnerToken ?? createLeaseOwnerToken;
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? waitFor;
    this.yieldAfterSnapshot = options.yieldAfterSnapshot ?? (() => Promise.resolve());
    this.yieldAfterClaim = options.yieldAfterClaim ?? (() => waitFor(0));
    this.leaseDurationMs = positiveDuration(options.leaseDurationMs, DEFAULT_LEASE_DURATION_MS);
    this.acquireTimeoutMs = positiveDuration(options.acquireTimeoutMs, DEFAULT_ACQUIRE_TIMEOUT_MS);
    this.retryDelayMs = positiveDuration(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
    this.owner = this.createOwnerToken();
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks !== undefined) {
      return await navigator.locks.request(
        this.namespace.lockName,
        () => task({ assertOwned: () => undefined }),
      );
    }

    const result = this.localTail.then(
      () => this.runFallbackExclusive(task),
      () => this.runFallbackExclusive(task),
    );
    this.localTail = result.then(() => undefined, () => undefined);
    return await result;
  }

  private async runFallbackExclusive<T>(
    task: (guard: WorkspaceSaveGuard) => Promise<T>,
  ): Promise<T> {
    const key = workspaceSaveLeaseKey(this.namespace, this.owner);
    const ticket = await this.acquireBakeryTurn(this.owner, key);
    const guard = { assertOwned: () => this.renewAndAssertOwned(this.owner, key, ticket) };
    try {
      guard.assertOwned();
      return await task(guard);
    } finally {
      this.releaseIfOwned(this.owner, key, ticket);
    }
  }

  private async acquireBakeryTurn(owner: string, key: string): Promise<number> {
    try {
      const startedAt = this.now();
      const deadline = startedAt + this.acquireTimeoutMs;
      const maxAttempts = Math.max(1, Math.ceil(this.acquireTimeoutMs / this.retryDelayMs) + 1);
      const choosing: WorkspaceSaveLease = {
        owner,
        choosing: true,
        ticket: 0,
        expiresAt: startedAt + this.leaseDurationMs,
      };
      const choosingRaw = this.writeAndConfirmLease(key, choosing);
      const snapshot = this.readActiveLeases(startedAt);
      await this.yieldAfterSnapshot();

      const claimNow = this.now();
      this.assertChoosingLeaseOwned(key, choosingRaw, owner, claimNow, deadline);
      const highestTicket = snapshot.reduce((highest, contender) => (
        contender.ticket > highest ? contender.ticket : highest
      ), 0);
      if (highestTicket >= Number.MAX_SAFE_INTEGER) {
        throw new Error('Could not acquire the Workspace save lock.');
      }

      const ticket = highestTicket + 1;
      this.writeAndConfirmLease(key, {
        owner,
        choosing: false,
        ticket,
        expiresAt: claimNow + this.leaseDurationMs,
      });
      await this.yieldAfterClaim();

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const now = this.now();
        if (now >= deadline) break;
        this.renewAndAssertOwned(owner, key, ticket);
        if (this.hasBakeryTurn(owner, key, ticket, now)) {
          this.assertReadyLeaseOwnedWithinDeadline(owner, key, ticket, deadline);
          return ticket;
        }

        const remainingMs = deadline - now;
        if (attempt === maxAttempts - 1) break;
        await this.wait(Math.min(this.retryDelayMs, remainingMs));
      }

      throw new Error('Could not acquire the Workspace save lock.');
    } catch (error) {
      this.abandonIfOwned(owner, key);
      throw error;
    }
  }

  private assertChoosingLeaseOwned(
    key: string,
    expectedRaw: string,
    owner: string,
    now: number,
    deadline: number,
  ): void {
    const currentRaw = this.storage.getItem(key);
    const current = readWorkspaceSaveLease(currentRaw);
    if (currentRaw !== expectedRaw
      || current?.owner !== owner
      || !current.choosing
      || current.ticket !== 0
      || current.expiresAt <= now
      || now >= deadline) {
      throw new Error('Workspace save lock ownership was lost.');
    }
  }

  private assertReadyLeaseOwnedWithinDeadline(
    owner: string,
    key: string,
    ticket: number,
    deadline: number,
  ): void {
    const now = this.now();
    if (now >= deadline) {
      throw new Error('Could not acquire the Workspace save lock.');
    }
    this.assertReadyLeaseOwned(owner, key, ticket, now);
  }

  private hasBakeryTurn(owner: string, key: string, ticket: number, now: number): boolean {
    return !this.readActiveLeases(now).some((contender) => {
      if (workspaceSaveLeaseKey(this.namespace, contender.owner) === key) return false;
      if (contender.choosing) return true;
      return contender.ticket < ticket
        || (contender.ticket === ticket && contender.owner < owner);
    });
  }

  private readActiveLeases(now: number): WorkspaceSaveLease[] {
    const leases: WorkspaceSaveLease[] = [];
    const length = this.storage.length;
    for (let index = 0; index < length; index += 1) {
      const key = this.storage.key(index);
      if (key === null || !key.startsWith(this.namespace.leasePrefix)) continue;
      const lease = readWorkspaceSaveLease(this.storage.getItem(key));
      if (lease === null
        || key !== workspaceSaveLeaseKey(this.namespace, lease.owner)
        || lease.expiresAt <= now
        || (!lease.choosing && lease.ticket === 0)) {
        continue;
      }
      leases.push(lease);
    }
    return leases;
  }

  private renewAndAssertOwned(owner: string, key: string, ticket: number): void {
    const now = this.now();
    this.assertReadyLeaseOwned(owner, key, ticket, now);
    this.writeAndConfirmLease(key, {
      owner,
      choosing: false,
      ticket,
      expiresAt: now + this.leaseDurationMs,
    });
  }

  private assertReadyLeaseOwned(owner: string, key: string, ticket: number, now: number): void {
    const current = readWorkspaceSaveLease(this.storage.getItem(key));
    if (current?.owner !== owner
      || current.choosing
      || current.ticket !== ticket
      || current.expiresAt <= now) {
      throw new Error('Workspace save lock ownership was lost.');
    }
  }

  private writeAndConfirmLease(key: string, lease: WorkspaceSaveLease): string {
    const serialized = JSON.stringify(lease);
    this.storage.setItem(key, serialized);
    if (this.storage.getItem(key) !== serialized) {
      throw new Error('Workspace save lock ownership was lost.');
    }
    return serialized;
  }

  private abandonIfOwned(owner: string, key: string): void {
    try {
      const currentRaw = this.storage.getItem(key);
      const current = readWorkspaceSaveLease(currentRaw);
      if (current?.owner === owner && this.storage.getItem(key) === currentRaw) {
        this.storage.setItem(key, inactiveWorkspaceSaveLease(owner));
      }
    } catch {
      // An abandoned contender expires and is ignored by other tabs.
    }
  }

  private releaseIfOwned(owner: string, key: string, ticket: number): void {
    try {
      const currentRaw = this.storage.getItem(key);
      const current = readWorkspaceSaveLease(currentRaw);
      if (current?.owner === owner
        && !current.choosing
        && current.ticket === ticket
        && current.expiresAt > this.now()
        && this.storage.getItem(key) === currentRaw) {
        this.storage.setItem(key, inactiveWorkspaceSaveLease(owner));
      }
    } catch {
      // An unreleased lease expires, allowing another tab to recover after a crash or storage failure.
    }
  }
}

function workspaceSaveLeaseKey(namespace: WorkspaceSaveLockNamespace, owner: string): string {
  return `${namespace.leasePrefix}${encodeURIComponent(owner)}`;
}

function readWorkspaceSaveLease(raw: string | null): WorkspaceSaveLease | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)
      || typeof parsed.owner !== 'string'
      || typeof parsed.choosing !== 'boolean'
      || typeof parsed.ticket !== 'number'
      || !Number.isSafeInteger(parsed.ticket)
      || (parsed.choosing ? parsed.ticket !== 0 : parsed.ticket < 0)
      || !isFiniteNumber(parsed.expiresAt)) {
      return null;
    }
    return {
      owner: parsed.owner,
      choosing: parsed.choosing,
      ticket: parsed.ticket,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function inactiveWorkspaceSaveLease(owner: string): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket: 0,
    expiresAt: 0,
  });
}

function createLeaseOwnerToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitFor(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function positiveDuration(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
