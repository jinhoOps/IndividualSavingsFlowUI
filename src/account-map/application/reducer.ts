import type { MainData } from '../../main/domain/model';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { AccountMapApplied, AccountMapDraft } from '../domain/model';

export interface MapInteractionState {
  transientNodeId: string | null;
  pinnedNodeId: string | null;
  modalNodeId: string | null;
}

export type AccountMapSaveFailure = 'conflict' | 'invalid' | 'unavailable' | 'rejected';

export type SaveState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'failed'; reason: AccountMapSaveFailure };

interface WorkspaceReadyState {
  workspace: WorkspaceDocument;
  main: MainData;
}

export type AccountMapState =
  | { mode: 'main-required' }
  | { mode: 'invalid'; raw?: string; retryRequested?: boolean }
  | { mode: 'unavailable'; retryRequested?: boolean }
  | (WorkspaceReadyState & { mode: 'migrating'; revision: number; save: SaveState })
  | (WorkspaceReadyState & {
      mode: 'setup';
      draft: AccountMapDraft | null;
      step: AccountMapDraft['step'];
      resumed: boolean;
      mainChanged: boolean;
      exitRequested: boolean;
      save: SaveState;
    })
  | (WorkspaceReadyState & {
      mode: 'map';
      applied: AccountMapApplied;
      interaction: MapInteractionState;
      save: SaveState;
    });

export type AccountMapEvent =
  | { type: 'migration-succeeded'; workspace: WorkspaceDocument }
  | { type: 'migration-failed'; reason: AccountMapSaveFailure }
  | { type: 'draft-updated'; draft: AccountMapDraft }
  | { type: 'review-requested' }
  | { type: 'connect-requested' }
  | { type: 'setup-exited' }
  | { type: 'setup-cancelled'; workspace?: WorkspaceDocument }
  | { type: 'apply-succeeded'; applied: AccountMapApplied; workspace?: WorkspaceDocument }
  | { type: 'reset-succeeded'; workspace: WorkspaceDocument }
  | { type: 'node-hovered'; nodeId: string }
  | { type: 'node-blurred'; nodeId: string }
  | { type: 'node-invoked'; nodeId: string }
  | { type: 'map-background-invoked' }
  | { type: 'modal-closed' | 'modal-outside-invoked' | 'escape-invoked' }
  | { type: 'layout-changed'; layout: AccountMapApplied['layout'] }
  | { type: 'save-requested' | 'retry-requested' }
  | { type: 'save-succeeded'; workspace: WorkspaceDocument }
  | { type: 'save-failed'; reason: AccountMapSaveFailure };

const emptyInteraction = (): MapInteractionState => ({
  transientNodeId: null,
  pinnedNodeId: null,
  modalNodeId: null,
});

export function accountMapReducer(state: AccountMapState, event: AccountMapEvent): AccountMapState {
  if (event.type === 'retry-requested') {
    if (state.mode === 'setup' || state.mode === 'map' || state.mode === 'migrating') {
      return { ...state, save: { status: 'pending' } };
    }
    if (state.mode === 'invalid' || state.mode === 'unavailable') {
      return { ...state, retryRequested: true };
    }
    return state;
  }

  if (state.mode === 'migrating') return reduceMigrating(state, event);
  if (state.mode === 'setup') return reduceSetup(state, event);
  if (state.mode === 'map') return reduceMap(state, event);
  return state;
}

function reduceMigrating(
  state: Extract<AccountMapState, { mode: 'migrating' }>,
  event: AccountMapEvent,
): AccountMapState {
  if (event.type === 'migration-failed' || event.type === 'save-failed') {
    return { ...state, save: { status: 'failed', reason: event.reason } };
  }
  if (event.type !== 'migration-succeeded') return state;
  const applied = event.workspace.accountMap.applied;
  if (applied !== null) {
    return {
      mode: 'map', workspace: event.workspace, main: state.main,
      applied: structuredClone(applied), interaction: emptyInteraction(), save: { status: 'idle' },
    };
  }
  const draft = event.workspace.accountMap.draft;
  return {
    mode: 'setup', workspace: event.workspace, main: state.main,
    draft: draft === null ? null : structuredClone(draft),
    step: draft?.step ?? 'connect', resumed: draft !== null,
    mainChanged: draft !== null && draft.sourceMainUpdatedAt !== state.main.updatedAt,
    exitRequested: false, save: { status: 'idle' },
  };
}

function reduceSetup(
  state: Extract<AccountMapState, { mode: 'setup' }>,
  event: AccountMapEvent,
): AccountMapState {
  switch (event.type) {
    case 'draft-updated':
      return { ...state, draft: structuredClone(event.draft), step: event.draft.step, resumed: true };
    case 'review-requested':
      return { ...state, step: 'review', draft: withDraftStep(state, 'review') };
    case 'connect-requested':
      return { ...state, step: 'connect', draft: withDraftStep(state, 'connect') };
    case 'setup-exited':
      return { ...state, exitRequested: true };
    case 'setup-cancelled':
      return {
        ...state,
        workspace: event.workspace ?? {
          ...state.workspace,
          accountMap: { ...state.workspace.accountMap, draft: null },
        },
        draft: null, step: 'connect', resumed: false,
        mainChanged: false, exitRequested: false, save: { status: 'idle' },
      };
    case 'apply-succeeded': {
      const workspace = event.workspace ?? {
        ...state.workspace,
        accountMap: { ...state.workspace.accountMap, applied: event.applied, draft: null },
      };
      return {
        mode: 'map', workspace, main: state.main, applied: structuredClone(event.applied),
        interaction: emptyInteraction(), save: { status: 'idle' },
      };
    }
    case 'save-requested':
      return { ...state, save: { status: 'pending' } };
    case 'save-succeeded':
      return { ...state, workspace: event.workspace, save: { status: 'idle' } };
    case 'save-failed':
      return { ...state, save: { status: 'failed', reason: event.reason } };
    default:
      return state;
  }
}

function reduceMap(
  state: Extract<AccountMapState, { mode: 'map' }>,
  event: AccountMapEvent,
): AccountMapState {
  switch (event.type) {
    case 'reset-succeeded':
      return {
        mode: 'setup', workspace: event.workspace, main: state.main,
        draft: null, step: 'connect', resumed: false, mainChanged: false,
        exitRequested: false, save: { status: 'idle' },
      };
    case 'node-hovered':
      return { ...state, interaction: { ...state.interaction, transientNodeId: event.nodeId } };
    case 'node-blurred':
      return state.interaction.transientNodeId !== event.nodeId
        ? state
        : { ...state, interaction: { ...state.interaction, transientNodeId: null } };
    case 'node-invoked':
      return state.interaction.pinnedNodeId === event.nodeId
        ? {
            ...state,
            interaction: { transientNodeId: null, pinnedNodeId: event.nodeId, modalNodeId: event.nodeId },
          }
        : {
            ...state,
            interaction: { transientNodeId: null, pinnedNodeId: event.nodeId, modalNodeId: null },
          };
    case 'map-background-invoked':
      return { ...state, interaction: emptyInteraction() };
    case 'modal-closed':
    case 'modal-outside-invoked':
      return { ...state, interaction: { ...state.interaction, modalNodeId: null } };
    case 'escape-invoked':
      return state.interaction.modalNodeId !== null
        ? { ...state, interaction: { ...state.interaction, modalNodeId: null } }
        : { ...state, interaction: emptyInteraction() };
    case 'layout-changed':
      return { ...state, applied: { ...state.applied, layout: event.layout } };
    case 'save-requested':
      return { ...state, save: { status: 'pending' } };
    case 'save-succeeded':
      return {
        ...state,
        workspace: event.workspace,
        applied: event.workspace.accountMap.applied ?? state.applied,
        save: { status: 'idle' },
      };
    case 'save-failed':
      return { ...state, save: { status: 'failed', reason: event.reason } };
    default:
      return state;
  }
}

function withDraftStep(
  state: Extract<AccountMapState, { mode: 'setup' }>,
  step: AccountMapDraft['step'],
): AccountMapDraft | null {
  return state.draft === null ? null : { ...state.draft, step };
}
