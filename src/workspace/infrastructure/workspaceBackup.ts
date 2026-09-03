import type { WorkspaceDocument } from '../domain/model';
import { validateWorkspaceDocument } from '../domain/validation';
import { convertRetiredWorkspaceDocument } from './retiredWorkspaceMigration';

export interface WorkspaceBackupEnvelope {
  format: 'isf-workspace-backup';
  formatVersion: 2;
  exportedAt: number;
  workspace: WorkspaceDocument;
}

export function exportWorkspaceBackup(
  workspace: WorkspaceDocument,
  now: number = Date.now(),
): string {
  const current = validateWorkspaceDocument(workspace);
  if (current.status !== 'valid') {
    throw new Error(current.status === 'reference' ? 'backup-reference' : 'backup-schema');
  }
  if (!isTimestamp(now)) throw new Error('backup-schema');
  return JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion: 2,
    exportedAt: now,
    workspace: current.workspace,
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
    || value.format !== 'isf-workspace-backup') {
    throw new Error('backup-format');
  }
  if (!isTimestamp(value.exportedAt)) throw new Error('backup-schema');
  if (value.formatVersion === 2) {
    const current = validateWorkspaceDocument(value.workspace);
    if (current.status !== 'valid') {
      throw new Error(current.status === 'reference' ? 'backup-reference' : 'backup-schema');
    }
    return current.workspace;
  }
  if (value.formatVersion === 1) {
    const retired = convertRetiredWorkspaceDocument(value.workspace, value.exportedAt);
    if (retired.status === 'invalid') {
      throw new Error(retired.reason === 'reference' ? 'backup-reference' : 'backup-schema');
    }
    return retired.workspace;
  }
  throw new Error('backup-format');
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
