import type { WorkspaceDocument, WorkspaceDocumentV4 } from '../domain/model';
import { validateWorkspaceV4Document } from '../domain/validation';

export function upgradeWorkspaceV4(source: WorkspaceDocumentV4): WorkspaceDocument {
  return { ...structuredClone(source), schemaVersion: 5, main: { ...structuredClone(source.main), expenseAssistant: null } };
}

export function convertWorkspaceV4Document(value: unknown):
  | { status: 'converted'; workspace: WorkspaceDocument }
  | { status: 'invalid'; reason: 'schema' | 'reference' } {
  const result = validateWorkspaceV4Document(value);
  return result.status === 'valid'
    ? { status: 'converted', workspace: upgradeWorkspaceV4(result.workspace) }
    : { status: 'invalid', reason: result.status };
}
