import type { WorkspaceDocumentV3, WorkspaceDocumentV4 } from '../domain/model';
import { validateWorkspaceV3Document } from '../domain/validation';

export type WorkspaceV4SourceConversionResult =
  | {
      status: 'converted';
      sourceVersion: 3;
      workspace: WorkspaceDocumentV4;
    }
  | { status: 'invalid'; reason: 'schema' | 'reference' };

const maximumTimestamp = 8_640_000_000_000_000;

/**
 * Converts only the exact historical v3 envelope. The version-named validator
 * remains stable when the active workspace validator moves to v4.
 */
export function convertWorkspaceV3Document(
  value: unknown,
  migratedAt: number,
): WorkspaceV4SourceConversionResult {
  if (!isTimestamp(migratedAt) || containsFutureTimestamp(value, migratedAt)) {
    return invalid('schema');
  }

  const validated = validateWorkspaceV3Document(value);
  if (validated.status !== 'valid') return invalid(validated.status);

  return {
    status: 'converted',
    sourceVersion: 3,
    workspace: toWorkspaceV4(validated.workspace, migratedAt),
  };
}

function toWorkspaceV4(source: WorkspaceDocumentV3, migratedAt: number): WorkspaceDocumentV4 {
  return {
    ...structuredClone(source),
    schemaVersion: 4,
    updatedAt: migratedAt,
  };
}

function containsFutureTimestamp(value: unknown, migratedAt: number): boolean {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== 'object' || current === null || seen.has(current)) continue;
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') continue;
      const nested = (current as Record<string, unknown>)[key];
      if (key.endsWith('At') && typeof nested === 'number' && nested > migratedAt) return true;
      if (typeof nested === 'object' && nested !== null) pending.push(nested);
    }
  }
  return false;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximumTimestamp;
}

function invalid(reason: 'schema' | 'reference'): WorkspaceV4SourceConversionResult {
  return { status: 'invalid', reason };
}
