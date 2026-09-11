import { createEmptyMainData } from '../domain/model';
import type { WorkspaceDocument } from '../../workspace/domain/model';

/** Reset editable Main inputs and all assistant history in a single workspace write. */
export function withMainSetupReset(current: WorkspaceDocument, savedAt: number): WorkspaceDocument {
  if (!current.main.applied) throw new Error('Main plan is required.');
  return { ...current, main: { ...current.main, expenseAssistant: null, setupProgress: {
    kind: 'restart', step: 'welcome', savedAt,
    draft: { ...createEmptyMainData(), updatedAt: current.main.applied.updatedAt },
  } } };
}
