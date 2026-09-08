import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { AccountTransferAllocation, AccountTransferLink } from './model';
import type { AccountFlowCommand, AccountFlowSurface } from './accountFlowCommands';
import { validateAccountTransfers } from './accountFlowValidation';

export interface AccountFlowFieldEdit<T> {
  base: T;
  next: T;
}

export type EditableTransferFields = Pick<
  AccountTransferLink,
  'sourceLocationId' | 'targetLocationId' | 'allocation' | 'status'
>;

export type AccountFlowEditIntent =
  | {
      kind: 'transfer';
      surface: AccountFlowSurface;
      id: string;
      edit: AccountFlowFieldEdit<EditableTransferFields>;
    }
  | {
      kind: 'remove-transfer';
      surface: AccountFlowSurface;
      id: string;
      base: EditableTransferFields;
    };

export type AccountFlowIntentRebaseResult =
  | { ok: true; command: Extract<AccountFlowCommand, { type: 'edit-transfer' }> }
  | { ok: false; reason: 'target-missing' }
  | { ok: false; reason: 'field-conflict'; field: keyof EditableTransferFields }
  | { ok: false; reason: 'manual-recovery'; action: 'edit-transfer' | 'remove-transfer' };

/**
 * Only a one-field fixed amount or status change is safely replayable. Graph
 * topology and the allocation rule change how all downstream rows are read,
 * so they deliberately stop at an explicit latest-state review boundary.
 */
export function rebaseAccountFlowEditIntent(
  latest: WorkspaceDocument,
  intent: AccountFlowEditIntent,
): AccountFlowIntentRebaseResult {
  if (intent.kind === 'remove-transfer') {
    return { ok: false, reason: 'manual-recovery', action: 'remove-transfer' };
  }
  const current = intent.surface === 'applied'
    ? latest.accountMap.applied?.schemaVersion === 3
      ? latest.accountMap.applied.transfers.find(({ id }) => id === intent.id)
      : undefined
    : latest.accountMap.draft?.schemaVersion === 2
      ? latest.accountMap.draft.transfers.find(({ id }) => id === intent.id)
      : undefined;
  if (current === undefined) return { ok: false, reason: 'target-missing' };

  const changed = changedFields(intent.edit.base, intent.edit.next);
  if (changed.length !== 1) return { ok: false, reason: 'manual-recovery', action: 'edit-transfer' };
  if (changed.some((field) => field === 'sourceLocationId' || field === 'targetLocationId')) {
    return { ok: false, reason: 'manual-recovery', action: 'edit-transfer' };
  }
  if (changed.includes('allocation') && !sameAllocationKind(intent.edit.base.allocation, intent.edit.next.allocation)) {
    return { ok: false, reason: 'manual-recovery', action: 'edit-transfer' };
  }
  if (changed.includes('allocation') && intent.edit.next.allocation.kind !== 'fixed') {
    return { ok: false, reason: 'manual-recovery', action: 'edit-transfer' };
  }
  for (const field of changed) {
    if (!equal(current[field], intent.edit.base[field])) {
      return { ok: false, reason: 'field-conflict', field };
    }
  }
  if (changed.includes('status') && intent.edit.next.status === 'active') {
    const transfers = transfersForSurface(latest, intent.surface);
    const candidate = transfers.map((transfer) => transfer.id === current.id
      ? { ...transfer, status: 'active' as const }
      : transfer);
    if (!validateAccountTransfers(candidate, latest.locations).valid) {
      return { ok: false, reason: 'manual-recovery', action: 'edit-transfer' };
    }
  }
  const fields: Extract<AccountFlowCommand, { type: 'edit-transfer' }>['fields'] = {};
  if (changed.includes('allocation')) fields.allocation = structuredClone(intent.edit.next.allocation);
  if (changed.includes('status')) fields.status = intent.edit.next.status;
  return {
    ok: true,
    command: { type: 'edit-transfer', surface: intent.surface, transferId: current.id, fields },
  };
}

function transfersForSurface(workspace: WorkspaceDocument, surface: AccountFlowSurface): AccountTransferLink[] {
  if (surface === 'applied') {
    return workspace.accountMap.applied?.schemaVersion === 3
      ? workspace.accountMap.applied.transfers
      : [];
  }
  return workspace.accountMap.draft?.schemaVersion === 2
    ? workspace.accountMap.draft.transfers
    : [];
}

function changedFields(base: EditableTransferFields, next: EditableTransferFields): (keyof EditableTransferFields)[] {
  return (['sourceLocationId', 'targetLocationId', 'allocation', 'status'] as const)
    .filter((field) => !equal(base[field], next[field]));
}

function sameAllocationKind(left: AccountTransferAllocation, right: AccountTransferAllocation): boolean {
  return left.kind === right.kind;
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
