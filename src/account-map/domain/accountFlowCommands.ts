import type { MainData } from '../../main/domain/model';
import { parseFinancialLocation, type FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { parseWorkspaceDocument } from '../../workspace/domain/validation';
import { validateAccountTransfers, type AccountFlowValidationCode } from './accountFlowValidation';
import {
  projectAccountMapAppliedForView,
  projectAccountMapDraftForView,
} from './accountMapVersioning';
import type {
  AccountMapAppliedV3,
  AccountMapDraftV2,
  AccountTransferAllocation,
  AccountTransferLink,
  PurposeId,
  PurposeLocationLink,
  StoredAccountMapApplied,
  StoredAccountMapDraft,
} from './model';
import { recalculateRemainder, reconcilePurpose } from './reconciliation';

export type AccountFlowSurface = 'applied' | 'draft';

export type AccountFlowCommand =
  | {
      type: 'add-transfer';
      surface: AccountFlowSurface;
      transfer: {
        id: string;
        sourceLocationId: string;
        targetLocationId: string;
        allocation: AccountTransferAllocation;
        status?: 'active' | 'suspended';
      };
    }
  | {
      type: 'edit-transfer';
      surface: AccountFlowSurface;
      transferId: string;
      fields: Partial<{
        sourceLocationId: string;
        targetLocationId: string;
        allocation: AccountTransferAllocation;
        status: 'active' | 'suspended';
      }>;
    }
  | { type: 'remove-transfer'; surface: AccountFlowSurface; transferId: string }
  | { type: 'confirm-current-main' };

export type AccountFlowCommandError =
  | AccountFlowValidationCode
  | 'purpose-fixed-excess'
  | 'target-missing'
  | 'invalid-input';

export type AccountFlowCommandResult =
  | { ok: true; workspace: WorkspaceDocument }
  | { ok: false; reason: AccountFlowCommandError };

export type TransferAwareLocationCommand =
  | {
      type: 'archive-location';
      locationId: string;
      replacementRemainderByPurpose: Record<string, string | null>;
    }
  | {
      type: 'restore-location';
      locationId: string;
      restoreLinkIds: string[];
      restoreTransferIds?: string[];
      remainderByPurpose: Record<string, string | null>;
    };

/**
 * The Account Map's transfer-only write boundary. It intentionally has no
 * Main, Simulation, or Portfolio mutation API: every successful candidate is
 * reparsed as a complete workspace before it can reach a repository.
 */
export function applyAccountFlowCommand(
  workspace: WorkspaceDocument,
  command: AccountFlowCommand,
  now: number = Date.now(),
): AccountFlowCommandResult {
  const source = parseWorkspaceDocument(workspace);
  if (source === null || !validTimestamp(now)) return fail('invalid-input');
  if (source.main.applied === null) return fail('invalid-input');
  if (command.type === 'confirm-current-main') return confirmCurrentMain(source, now);

  const state = transferState(source, command.surface);
  if (state === null) return fail('invalid-input');
  switch (command.type) {
    case 'add-transfer':
      return addTransfer(source, command, state, now);
    case 'edit-transfer':
      return editTransfer(source, command, state, now);
    case 'remove-transfer':
      return removeTransfer(source, command, state, now);
  }
}

export function mapNeedsMainConfirmation(
  applied: Pick<AccountMapAppliedV3, 'sourceMainUpdatedAt'>,
  main: Pick<MainData, 'updatedAt'>,
): boolean {
  return applied.sourceMainUpdatedAt !== main.updatedAt;
}

/**
 * Legacy location lifecycle commands are extended here only when a transfer
 * record is already present. This keeps an archive from dropping v3/v2 data,
 * suspends every incident edge, and makes transfer restoration opt-in.
 */
export function applyTransferAwareLocationCommand(
  workspace: WorkspaceDocument,
  command: TransferAwareLocationCommand,
  now: number = Date.now(),
): AccountFlowCommandResult {
  const source = parseWorkspaceDocument(workspace);
  const main = source?.main.applied;
  if (source === null || main === null || main === undefined || !validTimestamp(now)) return fail('invalid-input');
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return fail('endpoint-not-found');

  if (command.type === 'archive-location') {
    if (current.archivedAt !== undefined) return fail('invalid-input');
    const archived = parseFinancialLocation({ ...current, archivedAt: now, updatedAt: now });
    if (archived === null) return fail('invalid-input');
    const locations = source.locations.map((location) => location.id === current.id ? archived : structuredClone(location));
    const applied = archiveLocationState(source.accountMap.applied, command, locations, main, now);
    const draft = archiveLocationState(source.accountMap.draft, command, locations, main, now);
    if ((source.accountMap.applied !== null && applied === null)
      || (source.accountMap.draft !== null && draft === null)) return fail('invalid-input');
    return success(source, { ...source, locations, accountMap: { applied, draft } });
  }

  if (current.archivedAt === undefined) return fail('invalid-input');
  const { archivedAt: _archivedAt, ...activeLocation } = current;
  const restored = parseFinancialLocation({ ...activeLocation, updatedAt: now });
  if (restored === null) return fail('invalid-input');
  const locations = source.locations.map((location) => location.id === current.id ? restored : structuredClone(location));
  const selectedPurposeLinks = new Set(command.restoreLinkIds);
  const selectedTransfers = new Set(command.restoreTransferIds ?? []);
  if (!eligibleSelectionExists(source, current.id, selectedPurposeLinks, selectedTransfers)) return fail('invalid-input');
  const applied = restoreLocationState(source.accountMap.applied, command, selectedPurposeLinks, selectedTransfers, locations, main, now);
  const draft = restoreLocationState(source.accountMap.draft, command, selectedPurposeLinks, selectedTransfers, locations, main, now);
  if ((source.accountMap.applied !== null && applied === null)
    || (source.accountMap.draft !== null && draft === null)) return fail('invalid-input');
  return success(source, { ...source, locations, accountMap: { applied, draft } });
}

type TransferState =
  | { surface: 'applied'; state: AccountMapAppliedV3 }
  | { surface: 'draft'; state: AccountMapDraftV2 };

function transferState(workspace: WorkspaceDocument, surface: AccountFlowSurface): TransferState | null {
  if (surface === 'applied') {
    const current = workspace.accountMap.applied;
    return current === null ? null : { surface, state: projectAccountMapAppliedForView(current) };
  }
  const current = workspace.accountMap.draft;
  return current === null ? null : { surface, state: projectAccountMapDraftForView(current) };
}

function addTransfer(
  source: WorkspaceDocument,
  command: Extract<AccountFlowCommand, { type: 'add-transfer' }>,
  selected: TransferState,
  now: number,
): AccountFlowCommandResult {
  if (!validAllocation(command.transfer.allocation)) return fail('invalid-amount');
  const transfer = createTransfer(command.transfer, now);
  if (transfer === null) return fail('invalid-input');
  return saveTransferState(source, selected, [...selected.state.transfers, transfer], now);
}

function editTransfer(
  source: WorkspaceDocument,
  command: Extract<AccountFlowCommand, { type: 'edit-transfer' }>,
  selected: TransferState,
  now: number,
): AccountFlowCommandResult {
  if (!isNonemptyId(command.transferId) || Object.keys(command.fields).length === 0) {
    return fail('invalid-input');
  }
  if (command.fields.allocation !== undefined && !validAllocation(command.fields.allocation)) {
    return fail('invalid-amount');
  }
  const current = selected.state.transfers.find(({ id }) => id === command.transferId);
  if (current === undefined) return fail('target-missing');
  const next = editTransferRecord(current, command.fields, now);
  if (next === null) return fail('invalid-input');
  return saveTransferState(source, selected, selected.state.transfers.map((transfer) => (
    transfer.id === current.id ? next : structuredClone(transfer)
  )), now);
}

function removeTransfer(
  source: WorkspaceDocument,
  command: Extract<AccountFlowCommand, { type: 'remove-transfer' }>,
  selected: TransferState,
  now: number,
): AccountFlowCommandResult {
  if (!isNonemptyId(command.transferId)) return fail('invalid-input');
  if (!selected.state.transfers.some(({ id }) => id === command.transferId)) return fail('target-missing');
  return saveTransferState(source, selected, selected.state.transfers.filter(({ id }) => id !== command.transferId), now);
}

function saveTransferState(
  source: WorkspaceDocument,
  selected: TransferState,
  transfers: readonly AccountTransferLink[],
  now: number,
): AccountFlowCommandResult {
  const validation = validateAccountTransfers(transfers, source.locations);
  if (!validation.valid) return fail(validation.issues[0]!.code);
  const state = selected.surface === 'applied'
    ? {
        ...selected.state,
        transfers: structuredClone(transfers),
        updatedAt: now,
      }
    : {
        ...selected.state,
        transfers: structuredClone(transfers),
        updatedAt: now,
      };
  const candidate: WorkspaceDocument = {
    ...source,
    accountMap: { ...source.accountMap, [selected.surface]: state },
  };
  return success(source, candidate);
}

function confirmCurrentMain(source: WorkspaceDocument, now: number): AccountFlowCommandResult {
  const main = source.main.applied;
  const current = source.accountMap.applied;
  if (main === null || current === null || current.schemaVersion !== 3) return fail('invalid-input');
  if (!mapNeedsMainConfirmation(current, main)) return success(source, source);

  const links = recalculatePurposeRemainders(current.links, current, source.locations, main, now);
  if (links === null) return fail('purpose-fixed-excess');
  const applied: AccountMapAppliedV3 = {
    ...current,
    sourceMainUpdatedAt: main.updatedAt,
    links,
    // Transfer records are never normalized, recalculated, or timestamped by a
    // Main confirmation; a clone prevents accidental aliasing after save.
    transfers: structuredClone(current.transfers),
    updatedAt: now,
  };
  return success(source, {
    ...source,
    accountMap: { ...source.accountMap, applied },
  });
}

function recalculatePurposeRemainders(
  original: readonly PurposeLocationLink[],
  state: AccountMapAppliedV3,
  locations: readonly FinancialLocation[],
  main: MainData,
  now: number,
): PurposeLocationLink[] | null {
  let links: PurposeLocationLink[] = structuredClone(original) as PurposeLocationLink[];
  const purposes = new Set(links.filter((link) => link.status === 'active')
    .map(({ purposeId }) => purposeId));
  for (const purposeId of purposes) {
    const remainder = links.find((link) => link.purposeId === purposeId
      && link.status === 'active' && link.remainder);
    const target = reconcilePurpose(purposeId as PurposeId, { ...state, links }, locations, main).targetWon;
    if (remainder === undefined) {
      if (reconcilePurpose(purposeId as PurposeId, { ...state, links }, locations, main).excessWon > 0) {
        return null;
      }
      continue;
    }
    const recalculated = recalculateRemainder(purposeId as PurposeId, remainder.id, target, links);
    if (!recalculated.ok) return null;
    links = recalculated.links.map((link) => (
      link.purposeId === purposeId && link.status === 'active'
        ? { ...link, updatedAt: now }
        : link
    )) as PurposeLocationLink[];
  }
  return links;
}

type StoredFlowState = StoredAccountMapApplied | StoredAccountMapDraft;

function archiveLocationState<T extends StoredFlowState>(
  state: T | null,
  command: Extract<TransferAwareLocationCommand, { type: 'archive-location' }>,
  locations: readonly FinancialLocation[],
  main: MainData,
  now: number,
): T | null {
  if (state === null) return null;
  const affectedPurposes = new Set(state.links.filter((link) => link.locationId === command.locationId
    && link.status === 'active').map(({ purposeId }) => purposeId));
  let links = state.links.map((link): PurposeLocationLink => link.locationId === command.locationId
    && link.status === 'active'
    ? { ...link, status: 'suspended', remainder: false, suspendedReason: 'location-archived', updatedAt: now }
    : structuredClone(link));
  for (const purposeId of affectedPurposes) {
    const hadRemainder = state.links.some((link) => link.locationId === command.locationId
      && link.purposeId === purposeId && link.status === 'active' && link.remainder);
    const remaining = links.filter((link) => link.purposeId === purposeId && link.status === 'active');
    if (!hadRemainder || remaining.length === 0) continue;
    const selected = command.replacementRemainderByPurpose[purposeId];
    if (selected === undefined || selected === null || !remaining.some(({ id }) => id === selected)) return null;
    const target = reconcilePurpose(purposeId, { ...state, links }, locations, main).targetWon;
    const recalculated = recalculateRemainder(purposeId, selected, target, links);
    if (!recalculated.ok) return null;
    links = recalculated.links.map((link) => link.purposeId === purposeId && link.status === 'active'
      ? { ...link, updatedAt: now }
      : link);
  }
  return withArchivedTransfers({ ...state, links, updatedAt: now }, command.locationId, now);
}

function restoreLocationState<T extends StoredFlowState>(
  state: T | null,
  command: Extract<TransferAwareLocationCommand, { type: 'restore-location' }>,
  selectedPurposeLinks: ReadonlySet<string>,
  selectedTransfers: ReadonlySet<string>,
  locations: readonly FinancialLocation[],
  main: MainData,
  now: number,
): T | null {
  if (state === null) return null;
  const eligiblePurpose = new Set(state.links.filter((link) => link.locationId === command.locationId
    && link.status === 'suspended' && link.suspendedReason === 'location-archived').map(({ id }) => id));
  let links = state.links.map((link): PurposeLocationLink => {
    if (!selectedPurposeLinks.has(link.id) || !eligiblePurpose.has(link.id)
      || link.status !== 'suspended') return structuredClone(link);
    const { suspendedReason: _reason, ...active } = link;
    return { ...active, status: 'active', remainder: false, updatedAt: now };
  });
  for (const [purpose, selected] of Object.entries(command.remainderByPurpose)) {
    if (selected === null) continue;
    const active = links.find((link) => link.id === selected && link.purposeId === purpose && link.status === 'active');
    if (active === undefined) return null;
    const target = reconcilePurpose(purpose as PurposeId, { ...state, links }, locations, main).targetWon;
    const recalculated = recalculateRemainder(purpose as PurposeId, selected, target, links);
    if (!recalculated.ok) return null;
    links = recalculated.links.map((link) => link.purposeId === purpose && link.status === 'active'
      ? { ...link, updatedAt: now }
      : link);
  }
  const restoredPurposeIds = new Set(state.links.filter((link) => selectedPurposeLinks.has(link.id)).map(({ purposeId }) => purposeId));
  if ([...restoredPurposeIds].some((purposeId) => reconcilePurpose(purposeId, { ...state, links }, locations, main).excessWon > 0)) return null;
  return withRestoredTransfers({ ...state, links, updatedAt: now }, selectedTransfers, now);
}

function withArchivedTransfers<T extends StoredFlowState>(state: T, locationId: string, now: number): T {
  if (!('transfers' in state)) return state;
  return {
    ...state,
    transfers: state.transfers.map((transfer): AccountTransferLink => (
      transfer.status === 'active'
        && (transfer.sourceLocationId === locationId || transfer.targetLocationId === locationId)
        ? { ...transfer, status: 'suspended', suspendedReason: 'location-archived', updatedAt: now }
        : structuredClone(transfer)
    )),
  } as T;
}

function withRestoredTransfers<T extends StoredFlowState>(state: T, selected: ReadonlySet<string>, now: number): T {
  if (!('transfers' in state)) return state;
  return {
    ...state,
    transfers: state.transfers.map((transfer): AccountTransferLink => {
      if (!selected.has(transfer.id)
        || transfer.status !== 'suspended'
        || transfer.suspendedReason !== 'location-archived') return structuredClone(transfer);
      const { suspendedReason: _reason, ...active } = transfer;
      return { ...active, status: 'active', updatedAt: now };
    }),
  } as T;
}

function eligibleSelectionExists(
  workspace: WorkspaceDocument,
  locationId: string,
  purposeIds: ReadonlySet<string>,
  transferIds: ReadonlySet<string>,
): boolean {
  const states = [workspace.accountMap.applied, workspace.accountMap.draft]
    .filter((state): state is StoredFlowState => state !== null);
  const eligiblePurpose = new Set(states.flatMap((state) => state.links.filter((link) => link.locationId === locationId
    && link.status === 'suspended' && link.suspendedReason === 'location-archived').map(({ id }) => id)));
  const eligibleTransfers = new Set(states.flatMap((state) => ('transfers' in state ? state.transfers : [])
    .filter((transfer) => (transfer.sourceLocationId === locationId || transfer.targetLocationId === locationId)
      && transfer.status === 'suspended' && transfer.suspendedReason === 'location-archived')
    .map(({ id }) => id)));
  return [...purposeIds].every((id) => eligiblePurpose.has(id))
    && [...transferIds].every((id) => eligibleTransfers.has(id));
}

function createTransfer(
  value: Extract<AccountFlowCommand, { type: 'add-transfer' }>['transfer'],
  now: number,
): AccountTransferLink | null {
  if (!isNonemptyId(value.id)
    || !isNonemptyId(value.sourceLocationId)
    || !isNonemptyId(value.targetLocationId)
    || !validAllocation(value.allocation)) return null;
  if (value.status === 'suspended') {
    return {
      id: value.id, sourceLocationId: value.sourceLocationId, targetLocationId: value.targetLocationId,
      allocation: structuredClone(value.allocation), status: 'suspended', suspendedReason: 'user',
      createdAt: now, updatedAt: now,
    };
  }
  return {
    id: value.id, sourceLocationId: value.sourceLocationId, targetLocationId: value.targetLocationId,
    allocation: structuredClone(value.allocation), status: 'active', createdAt: now, updatedAt: now,
  };
}

function editTransferRecord(
  current: AccountTransferLink,
  fields: Extract<AccountFlowCommand, { type: 'edit-transfer' }>['fields'],
  now: number,
): AccountTransferLink | null {
  const sourceLocationId = fields.sourceLocationId ?? current.sourceLocationId;
  const targetLocationId = fields.targetLocationId ?? current.targetLocationId;
  const allocation = fields.allocation ?? current.allocation;
  const status = fields.status ?? current.status;
  if (!isNonemptyId(sourceLocationId) || !isNonemptyId(targetLocationId) || !validAllocation(allocation)) return null;
  if (status === 'suspended') {
    return {
      id: current.id, sourceLocationId, targetLocationId, allocation: structuredClone(allocation),
      status: 'suspended', suspendedReason: current.status === 'suspended' ? current.suspendedReason : 'user',
      createdAt: current.createdAt, updatedAt: now,
    };
  }
  return {
    id: current.id, sourceLocationId, targetLocationId, allocation: structuredClone(allocation),
    status: 'active', createdAt: current.createdAt, updatedAt: now,
  };
}

function success(source: WorkspaceDocument, candidate: WorkspaceDocument): AccountFlowCommandResult {
  const parsed = parseWorkspaceDocument(candidate);
  if (parsed === null || !protectedSlicesEqual(source, parsed)) return fail('invalid-input');
  return { ok: true, workspace: parsed };
}

function protectedSlicesEqual(left: WorkspaceDocument, right: WorkspaceDocument): boolean {
  return JSON.stringify(left.main) === JSON.stringify(right.main)
    && JSON.stringify(left.simulation) === JSON.stringify(right.simulation)
    && JSON.stringify(left.portfolio) === JSON.stringify(right.portfolio)
    && left.schemaVersion === right.schemaVersion
    && left.revision === right.revision;
}

function validAllocation(value: AccountTransferAllocation): boolean {
  return value.kind === 'sweep' || (value.kind === 'fixed'
    && Number.isSafeInteger(value.monthlyAmountWon) && value.monthlyAmountWon >= 0);
}

function validTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
}

function isNonemptyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function fail(reason: AccountFlowCommandError): Extract<AccountFlowCommandResult, { ok: false }> {
  return { ok: false, reason };
}
