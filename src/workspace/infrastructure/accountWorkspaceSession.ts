import type { WorkspaceDocument } from '../domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import { parsePortfolioDraft } from '../../portfolio/domain/validation';
import { parseSimulationDraft } from '../../simulation/domain/validation';
import type { WorkspaceRepository, WorkspaceWriteResult } from './workspaceRepository';
import {
  AccountWorkspaceCache,
  type CacheStorage,
  type PendingWorkspaceWrite,
  type RecoveryDraft,
} from './accountWorkspaceCache';
import { workspaceFromRow, workspacePayload, type WorkspaceOperation, type WorkspacePayload, type WorkspaceRemote } from './workspaceRemote';

export type AccountWorkspaceStatus = 'loading' | 'ready' | 'empty' | 'offline' | 'invalid' | 'unsupported' | 'expired' | 'saving' | 'uncertain' | 'conflict';
export type WorkspaceScope = 'main' | 'simulation' | 'portfolio' | 'account-map' | 'restore';
const keys: Record<WorkspaceScope, Array<keyof WorkspacePayload>> = {
  main: ['main'], simulation: ['simulation'], portfolio: ['portfolio'],
  'account-map': ['locations', 'accountMap'], restore: ['main', 'simulation', 'portfolio', 'locations', 'accountMap'],
};
const operations: Record<WorkspaceScope, WorkspaceOperation> = {
  main: 'save_main', simulation: 'save_simulation', portfolio: 'save_portfolio',
  'account-map': 'save_account_map', restore: 'restore_workspace',
};

/** One authenticated user's lifetime. Scope ports are the only app write entry points. */
export class AccountWorkspaceSession {
  snapshot: WorkspaceDocument | null = null;
  pending: PendingWorkspaceWrite | null = null;
  recoveryDrafts: Record<string, RecoveryDraft> = {};
  rawRemote: unknown | null = null;
  initializationExists = false;
  status: AccountWorkspaceStatus = 'loading';
  cacheFailed = false;
  externalRevision = 0;
  localEdits = false;
  private disposed = false;
  private busy = false;
  private editGeneration = 0;
  private refreshGeneration = 0;
  private accountMapScopeUsed = false;
  private incoming: WorkspaceDocument | null = null;
  private readonly cache: AccountWorkspaceCache;
  private readonly listeners = new Set<() => void>();
  private readonly scopes = new Map<WorkspaceScope, WorkspaceRepository>();
  private readonly id: () => string;
  constructor(private readonly remote: WorkspaceRemote, namespace: string,
    private readonly options: {userId: string; storage?: CacheStorage; mutationId?: () => string}) {
    this.cache = new AccountWorkspaceCache(namespace, options.storage);
    this.id = options.mutationId ?? (() => crypto.randomUUID());
    const cache = this.cache.read();
    this.pending = cache?.pending ?? null;
    this.recoveryDrafts = cache?.recoveryDrafts ?? {};
    // Cached financial data becomes visible only after authenticated refresh succeeds or fails offline.
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  private emit(): void { if (!this.disposed) this.listeners.forEach(listener => listener()); }
  markEdited(): void {this.localEdits = true; this.editGeneration++;}
  recordRecoveryDraft(key: string, value: unknown | null): void {
    if (!key) return;
    if (value === null) {
      if (!Object.hasOwn(this.recoveryDrafts, key)) return;
      delete this.recoveryDrafts[key];
      this.localEdits = this.hasRecoveryDrafts();
    }
    else {
      const baseRevision = this.snapshot?.revision ?? 0;
      let next: unknown;
      try {
        next = structuredClone(value);
      } catch {
        this.cacheFailed = true;
        this.emit();
        return;
      }
      const previous = this.recoveryDrafts[key];
      if (previous?.baseRevision === baseRevision && sameJson(previous.value, next)) return;
      this.recoveryDrafts[key] = {baseRevision, value: next};
    }
    if (value !== null) this.localEdits = true;
    this.persist();
    this.emit();
  }
  readRecoveryDraft(key: string): unknown | null {
    const draft = this.recoveryDrafts[key];
    if (!draft) return null;
    try { return structuredClone(draft.value); } catch { return null; }
  }
  private hasRecoveryDrafts(): boolean { return Object.keys(this.recoveryDrafts).length > 0; }
  private persist(): void {
    this.cacheFailed = !this.cache.save(this.snapshot, this.pending, this.recoveryDrafts);
  }
  private adopt(row: unknown): boolean {
    const next = workspaceFromRow(row, this.options.userId);
    if (next === null) return false;
    if (this.snapshot === null || next.revision >= this.snapshot.revision) this.snapshot = next;
    return true;
  }
  async refresh(): Promise<AccountWorkspaceStatus> {
    if (this.disposed || this.busy) return this.status;
    const generation = ++this.refreshGeneration;
    try {
      const row = await this.remote.read();
      if (this.disposed || generation !== this.refreshGeneration) return this.status;
      if (row === null) {
        if (this.snapshot !== null) this.status = 'invalid';
        else this.status = this.pending ? 'uncertain' : 'empty';
      } else {
        const oldRevision = this.snapshot?.revision;
        const decoded = workspaceFromRow(row, this.options.userId);
        if (!decoded) {
          this.rawRemote = cloneRemote(row);
          this.status = remoteSchemaVersion(row) !== 3 ? 'unsupported' : 'invalid';
        } else {
          if (oldRevision !== undefined && decoded.revision > oldRevision
            && this.accountMapScopeUsed && decoded.main.applied === null) {
            this.snapshot = decoded;
            this.incoming = null;
            if (this.pending?.operation === 'save_account_map') this.pending = null;
            this.discardAccountMapRecoveryDrafts();
            this.externalRevision++;
            this.rawRemote = null;
            this.status = 'ready';
            this.persist();
          } else if (oldRevision !== undefined && decoded.revision > oldRevision
            && (this.localEdits || this.hasRecoveryDrafts()) && !this.pending) {
            if (!this.incoming || decoded.revision > this.incoming.revision) this.externalRevision++;
            this.incoming = decoded;
          } else {
            this.adopt(row);
            if (oldRevision !== undefined && this.snapshot!.revision > oldRevision) this.externalRevision++;
          }
          this.rawRemote = null;
          this.status = this.pending ? (this.status === 'conflict' ? 'conflict' : 'uncertain') : 'ready';
          this.persist();
        }
      }
    } catch (error) {
      if (this.disposed || generation !== this.refreshGeneration) return this.status;
      const code = (error as {code?: string; status?: number})?.code;
      this.status = code === 'PGRST301' || code === '42501' || (error as {status?: number})?.status === 401 ? 'expired' : 'offline';
      if (this.status === 'offline' && this.snapshot === null) this.snapshot = this.cache.read()?.snapshot ?? null;
    }
    this.emit();
    return this.status;
  }
  scope(scope: WorkspaceScope): WorkspaceRepository {
    if (scope === 'account-map') this.accountMapScopeUsed = true;
    const existing = this.scopes.get(scope);
    if (existing) return existing;
    const port: WorkspaceRepository = {
      load: () => this.snapshot && !this.disposed
        ? {status: 'found', workspace: structuredClone(this.snapshot), needsMigration: false}
        : {status: 'unavailable'},
      update: (revision, mutate) => {
        if (!this.snapshot) return Promise.resolve({status: 'unavailable'});
        let candidate: WorkspaceDocument;
        try {candidate = mutate(structuredClone(this.snapshot));} catch {return Promise.resolve({status: 'invalid'});}
        return this.save(scope, revision, candidate);
      },
      replace: (revision, candidate) => this.save(scope, revision, candidate),
      migrate: async () => ({status: 'invalid'}),
      resetInvalid: async () => ({status: 'unavailable'}),
      subscribe: listener => this.subscribe(() => {if (this.snapshot) listener(structuredClone(this.snapshot));}),
    };
    this.scopes.set(scope, port);
    return port;
  }
  private save(scope: WorkspaceScope, revision: number, candidate: WorkspaceDocument): Promise<WorkspaceWriteResult> {
    const rebasingAccountMapConflict = scope === 'account-map'
      && this.status === 'conflict'
      && this.pending?.operation === 'save_account_map';
    if (this.disposed || !this.snapshot || this.busy
      || (this.status !== 'ready' && !rebasingAccountMapConflict)
      || (this.pending !== null && !rebasingAccountMapConflict)) return Promise.resolve({status: 'unavailable'});
    if (revision !== this.snapshot.revision) return Promise.resolve({status: 'conflict', currentRevision: this.snapshot.revision});
    const validated = parseWorkspaceDocument(candidate);
    if (!validated || Object.keys(workspacePayload(this.snapshot)).some(key =>
      !keys[scope].includes(key as keyof WorkspacePayload) && JSON.stringify(validated[key as keyof WorkspacePayload]) !== JSON.stringify(this.snapshot![key as keyof WorkspacePayload]))) {
      return Promise.resolve({status: 'invalid'});
    }
    const payload = Object.fromEntries(keys[scope].map(key => [key, validated[key]]));
    this.pending = {operation: operations[scope], expectedRevision: revision, payload, mutationId: this.id()};
    return this.sendPending();
  }
  async initialize(candidate: WorkspaceDocument): Promise<WorkspaceWriteResult> {
    if (this.disposed || this.busy || this.status !== 'empty' || !parseWorkspaceDocument(candidate)) return {status: 'invalid'};
    this.initializationExists = false;
    this.pending = {operation: 'initialize_workspace', expectedRevision: null, payload: workspacePayload(candidate), mutationId: this.id()};
    return this.sendPending();
  }
  async restore(candidate: WorkspaceDocument, expectedRevision: number): Promise<WorkspaceWriteResult> {
    const validated = parseWorkspaceDocument(candidate);
    if (this.disposed || this.busy || validated === null || !Number.isSafeInteger(expectedRevision)
      || expectedRevision < 0 || this.status === 'expired') return {status: 'invalid'};
    const currentRevision = this.snapshot?.revision ?? remoteRevision(this.rawRemote, this.options.userId);
    if (currentRevision === null) return {status: 'invalid'};
    if (expectedRevision !== currentRevision) return {status: 'conflict', currentRevision};
    if (this.pending !== null && !(this.pending.operation === 'restore_workspace' && this.status === 'conflict')) {
      return {status: 'unavailable'};
    }
    this.pending = {
      operation: 'restore_workspace', expectedRevision,
      payload: workspacePayload(validated), mutationId: this.id(),
    };
    return this.sendPending();
  }
  retry(): Promise<WorkspaceWriteResult> {
    if (!this.pending || this.busy || this.disposed || this.status === 'expired') return Promise.resolve({status: 'unavailable'});
    return this.sendPending();
  }
  reapply(): Promise<WorkspaceWriteResult> {
    if (!this.pending || !this.snapshot || this.status !== 'conflict') return Promise.resolve({status: 'unavailable'});
    if (this.pending.operation === 'restore_workspace') {
      this.pending = null;
      this.status = 'ready';
      this.persist();
      this.emit();
      return Promise.resolve({status: 'invalid'});
    }
    if (this.pending.operation === 'save_account_map' && this.snapshot.main.applied === null) {
      this.discardPending();
      return Promise.resolve({status: 'invalid'});
    }
    const candidate = {...this.snapshot, ...this.pending.payload};
    if (!parseWorkspaceDocument(candidate)) return Promise.resolve({status: 'invalid'});
    this.pending = {...this.pending, expectedRevision: this.snapshot.revision, mutationId: this.id()};
    return this.sendPending();
  }
  discardPending(): void {
    this.pending = null; this.localEdits = this.hasRecoveryDrafts();
    if (this.incoming && (!this.snapshot || this.incoming.revision > this.snapshot.revision)) this.snapshot = this.incoming;
    this.incoming = null;
    this.status = this.snapshot ? 'ready' : 'empty'; this.persist(); this.emit();
  }
  private async sendPending(): Promise<WorkspaceWriteResult> {
    const pending = this.pending;
    if (!pending || this.disposed) return {status: 'unavailable'};
    this.refreshGeneration++;
    this.busy = true; this.status = 'saving'; this.persist(); this.emit();
    const editGeneration = this.editGeneration;
    try {
      const result = await this.remote.write(pending.operation, pending.expectedRevision, structuredClone(pending.payload), pending.mutationId);
      if (this.disposed) return {status: 'unavailable'};
      if (result.status === 'invalid') {
        this.pending = null;
        this.status = this.snapshot !== null && this.rawRemote === null ? 'ready' : 'invalid';
        return {status: 'invalid'};
      }
      if (!this.adopt(result.workspace)) {this.status = 'uncertain'; return {status: 'unavailable'};}
      if (result.status === 'exists') {
        this.initializationExists = true;
        this.pending = null;
        this.status = 'ready';
        if (this.editGeneration === editGeneration) this.localEdits = this.hasRecoveryDrafts();
        return {status: 'conflict', currentRevision: this.snapshot!.revision};
      }
      if (result.status === 'conflict') {
        this.status = 'conflict';
        if (pending.operation === 'save_account_map' && this.snapshot!.main.applied === null) {
          this.pending = null;
          this.discardAccountMapRecoveryDrafts();
          this.externalRevision++;
          this.status = 'ready';
        }
        return {status: 'conflict', currentRevision: this.snapshot!.revision};
      }
      this.pending = null; this.status = 'ready'; this.rawRemote = null;
      this.clearCoveredRecoveryDrafts(pending);
      if (this.editGeneration === editGeneration) this.localEdits = this.hasRecoveryDrafts();
      return {status: 'saved', workspace: structuredClone(this.snapshot!)};
    } catch (error) {
      if (this.disposed) return {status: 'unavailable'};
      const code = (error as {code?: string})?.code;
      this.status = code === 'PGRST301' || code === '42501' || (error as {status?: number})?.status === 401
        ? 'expired'
        : 'uncertain';
      return {status: 'unavailable'};
    } finally {
      this.busy = false;
      if (!this.disposed) {this.persist(); this.emit();}
    }
  }
  dispose(clearCache = false): void {
    this.disposed = true;
    if (clearCache) this.cache.clear();
    this.refreshGeneration++;
    this.snapshot = null; this.pending = null; this.recoveryDrafts = {}; this.rawRemote = null; this.listeners.clear();
  }

  private clearCoveredRecoveryDrafts(pending: PendingWorkspaceWrite): void {
    if (pending.operation === 'save_main' && mainRecoveryIsCovered(this.recoveryDrafts.main?.value, pending.payload)) {
      delete this.recoveryDrafts.main;
    }
    if (pending.operation === 'save_simulation'
      && simulationRecoveryIsCovered(this.recoveryDrafts.simulation?.value, pending.payload)) {
      delete this.recoveryDrafts.simulation;
    }
    if (pending.operation === 'save_portfolio'
      && portfolioRecoveryIsCovered(this.recoveryDrafts.portfolio?.value, pending.payload)) {
      delete this.recoveryDrafts.portfolio;
    }
  }

  private discardAccountMapRecoveryDrafts(): void {
    for (const key of Object.keys(this.recoveryDrafts)) {
      if (key === 'account-map' || key.startsWith('account-map-')) delete this.recoveryDrafts[key];
    }
    this.localEdits = this.hasRecoveryDrafts();
  }
}

function cloneRemote(value: unknown): unknown {
  try { return structuredClone(value); } catch { return value; }
}

function remoteSchemaVersion(value: unknown): unknown {
  return typeof value === 'object' && value !== null ? (value as {schema_version?: unknown}).schema_version : undefined;
}

function remoteRevision(value: unknown, userId: string): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (row.user_id !== userId || row.schema_version !== 3) return null;
  const rawRevision = row.revision;
  const revision = typeof rawRevision === 'string' && /^\d+$/.test(rawRevision)
    ? Number(rawRevision)
    : rawRevision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0
    ? revision
    : null;
}

function mainRecoveryIsCovered(value: unknown, payload: Partial<WorkspacePayload>): boolean {
  if (!isRecord(payload.main)) return false;
  const setup = payload.main.setupProgress;
  return sameMainWithoutUpdatedAt(value, payload.main.applied)
    || (isRecord(setup) && sameMainWithoutUpdatedAt(value, setup.draft));
}

function simulationRecoveryIsCovered(value: unknown, payload: Partial<WorkspacePayload>): boolean {
  if (!isRecord(payload.simulation) || payload.simulation.draft === null) return false;
  const recovery = parseSimulationDraft(value);
  return recovery !== null && sameJson(recovery, payload.simulation.draft);
}

function portfolioRecoveryIsCovered(value: unknown, payload: Partial<WorkspacePayload>): boolean {
  if (!isRecord(payload.portfolio) || payload.portfolio.draft === null) return false;
  const recovery = parsePortfolioDraft(value);
  return recovery !== null && sameJson(recovery, payload.portfolio.draft);
}

function sameMainWithoutUpdatedAt(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).filter(key => key !== 'updatedAt').sort();
  const rightKeys = Object.keys(right).filter(key => key !== 'updatedAt').sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
