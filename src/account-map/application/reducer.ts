import type { MainData } from '../../main/domain/model';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { AccountMapEditIntent } from '../domain/editIntent';
import { mapNeedsMainConfirmation } from '../domain/accountFlowCommands';
import { projectAccountMapAppliedForView, projectAccountMapDraftForView } from '../domain/accountMapVersioning';
import type {
  AccountMapApplied,
  AccountMapDraft,
  AccountMapDraftV2,
  AccountMapSetupStep,
  StoredAccountMapApplied,
  StoredAccountMapDraft,
} from '../domain/model';

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

export type RecoveryState =
  | { status: 'none' }
  | { status: 'stale'; latest: WorkspaceDocument; intent: AccountMapEditIntent }
  | { status: 'manual'; latest: WorkspaceDocument; action: ManualRecoveryAction; targets: ManualRecoveryTarget[]; reason: 'compound-edit' | 'removal' | 'target-missing' }
  | {
      status: 'collision';
      latest: WorkspaceDocument;
      intent: AccountMapEditIntent;
      field: string;
      reason: string;
    };

export type ManualRecoveryAction = 'reset-map' | 'archive-location' | 'restore-location' | 'save-draft' | 'apply-map' | 'edit-node' | 'connection-prerequisite' | 'cancel-setup' | 'edit-transfer' | 'remove-transfer';
export type ManualRecoveryTarget = { kind: 'node' | 'link' | 'restorable-link' | 'location' | 'transfer'; id: string };

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
      draft: StoredAccountMapDraft | null;
      step: AccountMapSetupStep;
      resumed: boolean;
      mainChanged: boolean;
      exitRequested: boolean;
      save: SaveState;
      recovery: RecoveryState;
    })
  | (WorkspaceReadyState & {
      mode: 'map';
      applied: AccountMapApplied;
      interaction: MapInteractionState;
      mainConfirmationRequired: boolean;
      save: SaveState;
      recovery: RecoveryState;
    });

export type AccountMapEvent =
  | { type: 'migration-succeeded'; workspace: WorkspaceDocument }
  | { type: 'migration-failed'; reason: AccountMapSaveFailure }
  | { type: 'draft-updated'; draft: StoredAccountMapDraft }
  | { type: 'review-requested' }
  | { type: 'connect-requested' }
  | { type: 'setup-exited' }
  | { type: 'setup-cancelled'; workspace?: WorkspaceDocument }
  | { type: 'apply-succeeded'; applied: AccountMapApplied; workspace?: WorkspaceDocument }
  | { type: 'reset-succeeded'; workspace: WorkspaceDocument }
  | { type: 'node-hovered'; nodeId: string }
  | { type: 'node-blurred'; nodeId: string }
  | { type: 'node-invoked'; nodeId: string }
  | { type: 'node-edit-requested'; nodeId: string }
  | { type: 'map-background-invoked' }
  | { type: 'modal-closed' | 'modal-outside-invoked' | 'escape-invoked' }
  | { type: 'save-requested' | 'retry-requested' }
  | { type: 'save-succeeded'; workspace: WorkspaceDocument }
  | { type: 'transfer-save-succeeded'; workspace: WorkspaceDocument }
  | { type: 'main-confirmation-succeeded'; workspace: WorkspaceDocument }
  | { type: 'save-failed'; reason: AccountMapSaveFailure }
  | { type: 'main-confirmation-failed'; reason: AccountMapSaveFailure }
  | { type: 'save-conflicted'; latest: WorkspaceDocument; intent: AccountMapEditIntent }
  | { type: 'save-manual-conflicted'; latest: WorkspaceDocument; action: ManualRecoveryAction; targets: ManualRecoveryTarget[]; reason: 'compound-edit' | 'removal' }
  | { type: 'transfer-manual-conflicted'; latest: WorkspaceDocument; action: 'edit-transfer' | 'remove-transfer'; transferId: string; reason: 'compound-edit' | 'removal' }
  | { type: 'reapply-requested' }
  | { type: 'reapply-collided'; field: string; reason: string; latest?: WorkspaceDocument }
  | { type: 'recovery-latest-updated'; latest: WorkspaceDocument }
  | { type: 'reapply-succeeded'; workspace: WorkspaceDocument }
  | { type: 'review-latest' }
  | { type: 'latest-kept' }
  | { type: 'external-workspace-refreshed'; workspace: WorkspaceDocument };

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

  if (event.type === 'external-workspace-refreshed') {
    if (state.mode === 'setup' || state.mode === 'map') return adoptRecoveryWorkspace(state, event.workspace);
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
  if (event.workspace.main.applied === null) return { mode: 'main-required' };
  const main = structuredClone(event.workspace.main.applied);
  const applied = legacyAppliedForCurrentUi(event.workspace.accountMap.applied);
  if (applied !== null) {
    return {
      mode: 'map', workspace: event.workspace, main,
      applied: structuredClone(applied), interaction: emptyInteraction(), save: { status: 'idle' },
      mainConfirmationRequired: needsMainConfirmation(event.workspace, main),
      recovery: { status: 'none' },
    };
  }
  const draft = guidedDraftForCurrentUi(event.workspace.accountMap.draft);
  return {
    mode: 'setup', workspace: event.workspace, main,
    draft: draft === null ? null : structuredClone(draft),
    step: draft?.step ?? 'basis', resumed: draft !== null,
    mainChanged: draft !== null && draft.sourceMainUpdatedAt !== main.updatedAt,
    exitRequested: false, save: { status: 'idle' }, recovery: { status: 'none' },
  };
}

function reduceSetup(
  state: Extract<AccountMapState, { mode: 'setup' }>,
  event: AccountMapEvent,
): AccountMapState {
  const recovered = reduceRecovery(state, event);
  if (recovered !== null) return recovered;
  switch (event.type) {
    case 'draft-updated': {
      const draft = projectAccountMapDraftForView(event.draft);
      return { ...state, draft: structuredClone(draft), step: draft.step, resumed: true };
    }
    case 'review-requested':
      return { ...state, step: 'review', draft: withDraftStep(state, 'review') };
    case 'connect-requested':
      return { ...state, step: 'locations', draft: withDraftStep(state, 'locations') };
    case 'setup-exited':
      return { ...state, exitRequested: true };
    case 'setup-cancelled':
      return {
        ...state,
        workspace: event.workspace ?? {
          ...state.workspace,
          accountMap: { ...state.workspace.accountMap, draft: null },
        },
        draft: null, step: 'basis', resumed: false,
        mainChanged: false, exitRequested: false, save: { status: 'idle' }, recovery: { status: 'none' },
      };
    case 'apply-succeeded': {
      const workspace = event.workspace ?? {
        ...state.workspace,
        accountMap: { ...state.workspace.accountMap, applied: event.applied, draft: null },
      };
      return {
        mode: 'map', workspace, main: state.main, applied: structuredClone(event.applied),
        interaction: emptyInteraction(), save: { status: 'idle' }, recovery: { status: 'none' },
        mainConfirmationRequired: needsMainConfirmation(workspace, state.main),
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
  const recovered = reduceRecovery(state, event);
  if (recovered !== null) return recovered;
  switch (event.type) {
    case 'reset-succeeded':
      return {
        mode: 'setup', workspace: event.workspace, main: state.main,
        draft: null, step: 'basis', resumed: false, mainChanged: false,
        exitRequested: false, save: { status: 'idle' }, recovery: { status: 'none' },
      };
    case 'node-hovered':
      return { ...state, interaction: { ...state.interaction, transientNodeId: event.nodeId } };
    case 'node-blurred':
      return state.interaction.transientNodeId !== event.nodeId
        ? state
        : { ...state, interaction: { ...state.interaction, transientNodeId: null } };
    case 'node-invoked':
      return {
        ...state,
        interaction: { transientNodeId: null, pinnedNodeId: event.nodeId, modalNodeId: null },
      };
    case 'node-edit-requested':
      return {
        ...state,
        interaction: { transientNodeId: null, pinnedNodeId: event.nodeId, modalNodeId: event.nodeId },
      };
    case 'map-background-invoked':
      return { ...state, interaction: emptyInteraction() };
    case 'modal-closed':
    case 'modal-outside-invoked':
      return { ...state, interaction: { ...state.interaction, modalNodeId: null }, recovery: { status: 'none' } };
    case 'escape-invoked':
      return state.interaction.modalNodeId !== null
        ? { ...state, interaction: { ...state.interaction, modalNodeId: null } }
        : { ...state, interaction: emptyInteraction() };
    case 'save-requested':
      return { ...state, save: { status: 'pending' } };
    case 'save-succeeded':
    case 'transfer-save-succeeded':
    case 'main-confirmation-succeeded':
      return {
        ...state,
        workspace: event.workspace,
        applied: legacyAppliedForCurrentUi(event.workspace.accountMap.applied) ?? state.applied,
        main: event.workspace.main.applied === null ? state.main : structuredClone(event.workspace.main.applied),
        mainConfirmationRequired: needsMainConfirmation(event.workspace, event.workspace.main.applied ?? state.main),
        save: { status: 'idle' },
      };
    case 'save-failed':
    case 'main-confirmation-failed':
      return { ...state, save: { status: 'failed', reason: event.reason } };
    default:
      return state;
  }
}

function reduceRecovery<State extends Extract<AccountMapState, { mode: 'setup' | 'map' }>>(
  state: State,
  event: AccountMapEvent,
): AccountMapState | null {
  switch (event.type) {
    case 'save-conflicted':
      if (event.latest.main.applied === null) return { mode: 'main-required' };
      return {
        ...state,
        save: { status: 'idle' },
        recovery: {
          status: 'stale',
          latest: structuredClone(event.latest),
          intent: structuredClone(event.intent),
        },
      };
    case 'save-manual-conflicted':
      if (event.latest.main.applied === null) return { mode: 'main-required' };
      return {
        ...state,
        save: { status: 'idle' },
        recovery: {
          status: 'manual',
          latest: structuredClone(event.latest),
          action: event.action,
          targets: structuredClone(event.targets),
          reason: event.reason,
        },
      };
    case 'transfer-manual-conflicted':
      if (event.latest.main.applied === null) return { mode: 'main-required' };
      return {
        ...state,
        save: { status: 'idle' },
        recovery: {
          status: 'manual', latest: structuredClone(event.latest), action: event.action,
          targets: [{ kind: 'transfer', id: event.transferId }], reason: event.reason,
        },
      };
    case 'reapply-requested':
      return state.recovery.status === 'none'
        ? state
        : { ...state, save: { status: 'pending' } };
    case 'reapply-collided':
      return state.recovery.status === 'none' || state.recovery.status === 'manual'
        ? state
        : {
            ...state,
            save: { status: 'idle' },
            recovery: {
              status: 'collision',
              latest: structuredClone(event.latest ?? state.recovery.latest),
              intent: state.recovery.intent,
              field: event.field,
              reason: event.reason,
            },
          };
    case 'recovery-latest-updated':
      return state.recovery.status === 'none'
        ? state
        : { ...state, recovery: { ...state.recovery, latest: structuredClone(event.latest) } };
    case 'reapply-succeeded':
      return adoptRecoveryWorkspace(state, event.workspace);
    case 'review-latest':
      return state.recovery.status !== 'manual'
        ? state
        : adoptRecoveryWorkspaceForReview(state, state.recovery.latest);
    case 'latest-kept':
      return state.recovery.status === 'none'
        ? state
        : adoptRecoveryWorkspace(state, state.recovery.latest);
    default:
      return null;
  }
}

function adoptRecoveryWorkspaceForReview<State extends Extract<AccountMapState, { mode: 'setup' | 'map' }>>(
  state: State,
  workspace: WorkspaceDocument,
): AccountMapState {
  const recovery = state.recovery;
  if (recovery.status !== 'manual') return state;
  if (workspace.main.applied === null) return { mode: 'main-required' };
  const main = structuredClone(workspace.main.applied);
  const applied = legacyAppliedForCurrentUi(workspace.accountMap.applied);
  if (state.mode === 'setup' && applied !== null) {
    return { ...state, save: { status: 'idle' }, recovery: { ...recovery, reason: 'target-missing' } };
  }
  if (state.mode === 'map' && applied !== null) {
    if (!recovery.targets.every((target) => workspaceContainsManualTarget(workspace, recovery.action, target))) {
      return {
        ...state,
        save: { status: 'idle' },
        recovery: { ...recovery, reason: 'target-missing' },
      };
    }
    return {
      ...state,
      workspace,
      main,
      applied: structuredClone(applied),
      mainConfirmationRequired: needsMainConfirmation(workspace, main),
      save: { status: 'idle' },
      recovery: { status: 'none' },
    };
  }
  if (state.mode === 'map' && applied === null) {
    return {
      ...state,
      save: { status: 'idle' },
      recovery: { ...recovery, reason: 'target-missing' },
    };
  }
  if (state.mode === 'setup' && applied === null) {
    const draft = guidedDraftForCurrentUi(workspace.accountMap.draft);
    return {
      ...state,
      workspace,
      main,
      draft: draft === null ? null : structuredClone(draft),
      step: draft?.step ?? 'basis',
      resumed: draft !== null,
      mainChanged: draft !== null && draft.sourceMainUpdatedAt !== main.updatedAt,
      save: { status: 'idle' },
      recovery: { status: 'none' },
    };
  }
  return adoptRecoveryWorkspace(state, workspace);
}

function workspaceContainsManualTarget(workspace: WorkspaceDocument, action: ManualRecoveryAction, target: ManualRecoveryTarget): boolean {
  if (target.kind === 'transfer') {
    const transfer = workspace.accountMap.applied?.schemaVersion === 3
      ? workspace.accountMap.applied.transfers.find(({ id }) => id === target.id)
      : undefined;
    return transfer !== undefined;
  }
  if (target.kind === 'link' || target.kind === 'restorable-link') {
    const link = workspace.accountMap.applied?.links.find(({ id }) => id === target.id);
    if (link === undefined) return false;
    return workspace.locations.some(({ id, archivedAt }) => id === link.locationId && (target.kind === 'restorable-link' ? archivedAt !== undefined : archivedAt === undefined));
  }
  if (target.kind === 'location' || target.id.startsWith('location:')) {
    const id = target.id.replace(/^location:/u, '');
    const location = workspace.locations.find((candidate) => candidate.id === id);
    return location !== undefined && (action === 'restore-location' ? location.archivedAt !== undefined : location.archivedAt === undefined);
  }
  if (target.id.startsWith('custom:')) return workspace.accountMap.applied?.customPurposes.some(({ id, archivedAt }) => id === target.id && archivedAt === undefined) === true;
  return workspace.accountMap.applied !== null;
}

function adoptRecoveryWorkspace<State extends Extract<AccountMapState, { mode: 'setup' | 'map' }>>(
  state: State,
  workspace: WorkspaceDocument,
): AccountMapState {
  if (workspace.main.applied === null) return { mode: 'main-required' };
  const applied = legacyAppliedForCurrentUi(workspace.accountMap.applied);
  const main = structuredClone(workspace.main.applied);
  if (applied !== null) {
    return {
      mode: 'map',
      workspace,
      main,
      applied: structuredClone(applied),
      interaction: emptyInteraction(),
      mainConfirmationRequired: needsMainConfirmation(workspace, main),
      save: { status: 'idle' },
      recovery: { status: 'none' },
    };
  }
  const draft = guidedDraftForCurrentUi(workspace.accountMap.draft);
  return {
    mode: 'setup',
    workspace,
    main,
    draft,
    step: draft?.step ?? 'basis',
    resumed: draft !== null,
    mainChanged: draft !== null && draft.sourceMainUpdatedAt !== main.updatedAt,
    exitRequested: false,
    save: { status: 'idle' },
    recovery: { status: 'none' },
  };
}

function withDraftStep(
  state: Extract<AccountMapState, { mode: 'setup' }>,
  step: AccountMapSetupStep,
): AccountMapDraftV2 | null {
  return state.draft === null ? null : { ...projectAccountMapDraftForView(state.draft), step };
}

function needsMainConfirmation(workspace: WorkspaceDocument, main: MainData): boolean {
  const applied = workspace.accountMap.applied;
  return applied !== null && mapNeedsMainConfirmation(projectAccountMapAppliedForView(applied), main);
}

function legacyAppliedForCurrentUi(
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

function legacyDraftForCurrentUi(
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

function guidedDraftForCurrentUi(
  value: StoredAccountMapDraft | null,
): AccountMapDraftV2 | null {
  return value === null ? null : projectAccountMapDraftForView(value);
}
