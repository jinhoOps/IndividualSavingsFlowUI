import type { WorkspaceLoadResult } from '../../workspace/infrastructure/workspaceRepository';
import type { AccountMapMainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { AccountMapState } from './reducer';

export function bootstrapAccountMap(
  mainResult: AccountMapMainSourceLoadResult,
  workspaceResult: WorkspaceLoadResult,
): AccountMapState {
  if (workspaceResult.status === 'unavailable' || mainResult.status === 'unavailable') {
    return { mode: 'unavailable' };
  }
  if (workspaceResult.status === 'invalid') {
    return { mode: 'invalid', raw: workspaceResult.raw };
  }
  if (mainResult.status === 'invalid') return { mode: 'invalid' };
  if (mainResult.status === 'empty') return { mode: 'main-required' };

  const workspace = structuredClone(workspaceResult.workspace);
  const main = structuredClone(mainResult.data);
  if (workspaceResult.needsMigration) {
    return {
      mode: 'migrating', workspace, main,
      revision: workspace.revision, save: { status: 'pending' },
    };
  }
  const applied = workspace.accountMap.applied;
  if (applied !== null) {
    return {
      mode: 'map', workspace, main, applied: structuredClone(applied),
      interaction: { transientNodeId: null, pinnedNodeId: null, modalNodeId: null },
      save: { status: 'idle' },
    };
  }
  const draft = workspace.accountMap.draft;
  return {
    mode: 'setup', workspace, main,
    draft: draft === null ? null : structuredClone(draft),
    step: draft?.step ?? 'connect',
    resumed: draft !== null,
    mainChanged: draft !== null && draft.sourceMainUpdatedAt !== main.updatedAt,
    exitRequested: false,
    save: { status: 'idle' },
  };
}
