import type { WorkspaceDocument } from '../domain/model';
import {
  parseWorkspaceDocument,
  validateWorkspaceCrossReferences,
} from '../domain/validation';

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
  return parseWorkspace(value.workspace);
}

function parseWorkspace(value: unknown): WorkspaceDocument {
  const parsed = parseWorkspaceDocument(value);
  if (parsed !== null) return parsed;
  if (hasCrossReferenceShape(value)) {
    try {
      if (!validateWorkspaceCrossReferences(value as WorkspaceDocument)) {
        throw new Error('backup-reference');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'backup-reference') throw error;
    }
  }
  throw new Error('backup-schema');
}

function hasCrossReferenceShape(value: unknown): boolean {
  if (!isRecord(value)
    || !isRecord(value.portfolio)
    || !Array.isArray(value.portfolio.plans)
    || !Array.isArray(value.locations)
    || !isRecord(value.accountMap)
    || !Array.isArray(value.accountMap.instruments)
    || !Array.isArray(value.accountMap.flows)) return false;
  return true;
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
