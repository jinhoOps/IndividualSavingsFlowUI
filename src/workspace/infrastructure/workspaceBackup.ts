import type { WorkspaceDocument } from '../domain/model';
import { migrateWorkspaceV1, parseWorkspaceDocumentVersioned } from '../domain/migration';
import { validateWorkspaceDocumentV1 } from '../domain/validation';

export interface WorkspaceBackupEnvelope {
  format: 'isf-workspace-backup';
  formatVersion: 1;
  exportedAt: number;
  workspace: WorkspaceDocument;
}

export function exportWorkspaceBackup(
  workspace: WorkspaceDocument,
  now: number = Date.now(),
): string {
  const parsed = parseWorkspace(workspace);
  if (!isTimestamp(now)) throw new Error('backup-schema');
  return JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion: 1,
    exportedAt: now,
    workspace: parsed,
  } satisfies WorkspaceBackupEnvelope);
}

export function importWorkspaceBackup(text: string): WorkspaceDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('backup-json');
  }

  if (!hasExactKeys(value, ['format', 'formatVersion', 'exportedAt', 'workspace'])
    || value.format !== 'isf-workspace-backup'
    || value.formatVersion !== 1) {
    throw new Error('backup-format');
  }
  if (!isTimestamp(value.exportedAt)) throw new Error('backup-schema');
  return parseWorkspace(value.workspace, value.exportedAt);
}

function parseWorkspace(value: unknown, migrationTimestamp: number = Date.now()): WorkspaceDocument {
  const parsed = parseWorkspaceDocumentVersioned(value);
  if (parsed?.version === 2) return parsed.workspace;
  if (parsed?.version === 1) return migrateWorkspaceV1(parsed.workspace, migrationTimestamp);
  const currentReferenceResult = validateCurrentSharedReferences(value);
  if (currentReferenceResult === 'reference') throw new Error('backup-reference');
  const legacy = validateWorkspaceDocumentV1(value);
  throw new Error(legacy.status === 'reference' ? 'backup-reference' : 'backup-schema');
}

function validateCurrentSharedReferences(value: unknown): 'reference' | 'other' {
  if (!isRecord(value)
    || value.schemaVersion !== 2
    || !isRecord(value.accountMap)
    || !hasExactKeys(value.accountMap, ['applied', 'draft', 'legacyPhaseA'])
    || value.accountMap.applied !== null
    || value.accountMap.draft !== null
    || !isRecord(value.accountMap.legacyPhaseA)
    || !hasExactKeys(value.accountMap.legacyPhaseA, ['instruments', 'flows'])) return 'other';
  const legacy = validateWorkspaceDocumentV1({
    ...value,
    schemaVersion: 1,
    accountMap: {
      applied: null,
      draft: null,
      instruments: value.accountMap.legacyPhaseA.instruments,
      flows: value.accountMap.legacyPhaseA.flows,
    },
  });
  return legacy.status === 'reference' ? 'reference' : 'other';
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  const expected = new Set<string>(keys);
  return actual.length === expected.size
    && actual.every((key) => typeof key === 'string' && expected.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 8_640_000_000_000_000;
}
