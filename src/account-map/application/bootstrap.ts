import type { WorkspaceLoadResult } from '../../workspace/infrastructure/workspaceRepository';
import type { AccountMapMainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { AccountMapState } from './reducer';
import type {
  AccountMapApplied,
  AccountMapDraft,
  StoredAccountMapApplied,
  StoredAccountMapDraft,
} from '../domain/model';
import { mapNeedsMainConfirmation } from '../domain/accountFlowCommands';
import { projectAccountMapAppliedForView } from '../domain/accountMapVersioning';

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
  const applied = legacyAppliedForCurrentUi(workspace.accountMap.applied);
  if (applied !== null) {
    return {
      mode: 'map', workspace, main, applied: structuredClone(applied),
      interaction: { transientNodeId: null, pinnedNodeId: null, modalNodeId: null },
      mainConfirmationRequired: mapNeedsMainConfirmation(
        projectAccountMapAppliedForView(workspace.accountMap.applied!), main,
      ),
      save: { status: 'idle' }, recovery: { status: 'none' },
    };
  }
  const draft = legacyDraftForCurrentUi(workspace.accountMap.draft);
  return {
    mode: 'setup', workspace, main,
    draft: draft === null ? null : structuredClone(draft),
    step: draft?.step ?? 'connect',
    resumed: draft !== null,
    mainChanged: draft !== null && draft.sourceMainUpdatedAt !== main.updatedAt,
    exitRequested: false,
    save: { status: 'idle' }, recovery: { status: 'none' },
  };
}

export function legacyAppliedForCurrentUi(
  value: StoredAccountMapApplied | null,
): AccountMapApplied | null {
  if (value === null) return null;
  if (value.schemaVersion === 2) return structuredClone(value);
  return {
    schemaVersion: 2,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

export function legacyDraftForCurrentUi(
  value: StoredAccountMapDraft | null,
): AccountMapDraft | null {
  if (value === null) return null;
  if (value.schemaVersion === 1) return structuredClone(value);
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    step: value.step === 'review' ? 'review' : 'connect',
    updatedAt: value.updatedAt,
  };
}
