import type { WorkspaceDocument } from '../domain/model';
import { parseWorkspaceDocument } from '../domain/validation';
import type { WorkspaceOperation, WorkspacePayload } from './workspaceRemote';

export type CacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface PendingWorkspaceWrite {
  operation: WorkspaceOperation;
  expectedRevision: number | null;
  payload: Partial<WorkspacePayload>;
  mutationId: string;
}

export interface RecoveryDraft {
  baseRevision: number;
  value: unknown;
}

export const INVALID_PENDING_RECOVERY_KEY = '__invalid-pending-write__';

const operationPayloadKeys: Record<WorkspaceOperation, readonly (keyof WorkspacePayload)[]> = {
  initialize_workspace: ['main', 'simulation', 'portfolio', 'locations', 'accountMap'],
  save_main: ['main'],
  save_simulation: ['simulation'],
  save_portfolio: ['portfolio'],
  save_account_map: ['locations', 'accountMap'],
  restore_workspace: ['main', 'simulation', 'portfolio', 'locations', 'accountMap'],
};
export interface AccountCache {
  version: 1;
  snapshot: WorkspaceDocument | null;
  pending: PendingWorkspaceWrite | null;
  recoveryDrafts: Record<string, RecoveryDraft>;
}
export class AccountWorkspaceCache {
  readonly key: string;
  constructor(namespace: string, private readonly storage?: CacheStorage) {
    this.key = `isf-account-workspace-v1:${namespace}`;
  }
  read(): AccountCache | null {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw) as AccountCache;
      if (data.version !== 1) return null;
      const snapshot = data.snapshot === null ? null : parseWorkspaceDocument(data.snapshot);
      if (data.snapshot !== null && snapshot === null) return null;
      const recoveryDrafts = parseRecoveryDrafts(data.recoveryDrafts);
      const pending = isPendingWorkspaceWrite(data.pending) ? data.pending : null;
      if (data.pending !== null && pending === null) {
        recoveryDrafts[INVALID_PENDING_RECOVERY_KEY] = {baseRevision: 0, value: data.pending};
      }
      return {version: 1, snapshot, pending, recoveryDrafts};
    } catch { return null; }
  }
  save(
    snapshot: WorkspaceDocument | null,
    pending: PendingWorkspaceWrite | null,
    recoveryDrafts: Record<string, RecoveryDraft>,
  ): boolean {
    try {
      if (this.storage === undefined) return false;
      this.storage.setItem(this.key, JSON.stringify({
        version: 1, snapshot, pending, recoveryDrafts,
      } satisfies AccountCache));
      return true;
    } catch { return false; }
  }
  clear(): void { try {this.storage?.removeItem(this.key);} catch { /* Session memory is still revoked. */ } }
}

function isPendingWorkspaceWrite(value: unknown): value is PendingWorkspaceWrite {
  if (!isRecord(value)
    || !Object.hasOwn(operationPayloadKeys, value.operation as PropertyKey)
    || typeof value.mutationId !== 'string'
    || !isUuid(value.mutationId)
    || !isRecord(value.payload)) return false;
  const operation = value.operation as WorkspaceOperation;
  const expectedRevision = value.expectedRevision;
  if (operation === 'initialize_workspace') {
    if (expectedRevision !== null) return false;
  } else if (typeof expectedRevision !== 'number'
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return false;
  }
  const expected = operationPayloadKeys[operation];
  const actual = Object.keys(value.payload);
  return actual.length === expected.length && actual.every(key => expected.includes(key as keyof WorkspacePayload));
}

function parseRecoveryDrafts(value: unknown): Record<string, RecoveryDraft> {
  if (!isRecord(value)) return {};
  const recoveryDrafts: Record<string, RecoveryDraft> = {};
  for (const [key, draft] of Object.entries(value)) {
    const baseRevision = isRecord(draft) ? draft.baseRevision : undefined;
    if (!isRecord(draft)
      || typeof baseRevision !== 'number'
      || !Number.isSafeInteger(baseRevision)
      || baseRevision < 0
      || !Object.hasOwn(draft, 'value')) continue;
    recoveryDrafts[key] = {baseRevision, value: draft.value};
  }
  return recoveryDrafts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
