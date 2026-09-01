import { bootstrapMain, type MainBootstrapResult } from './bootstrap';
import type { MainRepository } from '../infrastructure/mainRepository';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
} from '../../workspace/infrastructure/workspaceBackup';
import type { WorkspaceRepository } from '../../workspace/infrastructure/workspaceRepository';

export type WorkspaceImportFailureReason = 'json' | 'format' | 'reference' | 'schema';

export type ParseWorkspaceBackupResult =
  | { status: 'ready'; candidate: WorkspaceDocument }
  | { status: 'candidate-invalid'; reason: WorkspaceImportFailureReason }
  | { status: 'failed'; error: Error };

export type WorkspaceBackupExportResult =
  | { status: 'ready'; contents: string }
  | { status: 'current-invalid' }
  | { status: 'unavailable' }
  | { status: 'failed'; error: Error };

export type RestoreWorkspaceBackupResult =
  | { status: 'restored'; bootstrap: MainBootstrapResult }
  | { status: 'conflict' }
  | { status: 'current-invalid' }
  | { status: 'candidate-invalid'; reason: 'schema' }
  | { status: 'unavailable'; stage: 'load' | 'replace' }
  | { status: 'failed'; error: Error };

export function parseWorkspaceBackupCandidate(text: string): ParseWorkspaceBackupResult {
  try {
    return { status: 'ready', candidate: importWorkspaceBackup(text) };
  } catch (error) {
    const reason = importFailureReason(error);
    return reason === null
      ? { status: 'failed', error: toError(error) }
      : { status: 'candidate-invalid', reason };
  }
}

export function createWorkspaceBackupExport(
  repository: Pick<WorkspaceRepository, 'load'>,
): WorkspaceBackupExportResult {
  try {
    const loaded = repository.load();
    if (loaded.status === 'invalid') return { status: 'current-invalid' };
    if (loaded.status === 'unavailable') return { status: 'unavailable' };
    return { status: 'ready', contents: exportWorkspaceBackup(loaded.workspace) };
  } catch (error) {
    return { status: 'failed', error: toError(error) };
  }
}

export async function restoreWorkspaceBackup(
  candidate: WorkspaceDocument,
  workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'>,
  mainRepository: MainRepository,
): Promise<RestoreWorkspaceBackupResult> {
  try {
    const loaded = workspaceRepository.load();
    if (loaded.status === 'invalid') return { status: 'current-invalid' };
    if (loaded.status === 'unavailable') return { status: 'unavailable', stage: 'load' };

    const replaced = await workspaceRepository.replace(loaded.workspace.revision, candidate);
    if (replaced.status === 'conflict') return { status: 'conflict' };
    if (replaced.status === 'invalid') return { status: 'candidate-invalid', reason: 'schema' };
    if (replaced.status === 'unavailable') return { status: 'unavailable', stage: 'replace' };

    return { status: 'restored', bootstrap: await bootstrapMain(mainRepository) };
  } catch (error) {
    return { status: 'failed', error: toError(error) };
  }
}

function importFailureReason(error: unknown): WorkspaceImportFailureReason | null {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case 'backup-json': return 'json';
    case 'backup-format': return 'format';
    case 'backup-reference': return 'reference';
    case 'backup-schema': return 'schema';
    default: return null;
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
