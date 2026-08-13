import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { AccountMapCommand } from './commands';
import {
  SYSTEM_PURPOSE_IDS,
  type CustomPurpose,
  type PurposeId,
  type PurposeLocationLink,
} from './model';

export interface FieldEdit<T> {
  base: T;
  next: T;
}

export type EditableLinkFields = Pick<
  PurposeLocationLink,
  'monthlyAmountWon' | 'status' | 'remainder'
>;
export type EditablePurposeFields = Pick<
  CustomPurpose,
  'name' | 'targetMonthlyWon' | 'archivedAt'
>;
export type EditableLocationFields = Pick<FinancialLocation, 'shortName' | 'institution'>;

export type AccountMapEditIntent =
  | { kind: 'link'; id: string; edit: FieldEdit<EditableLinkFields> }
  | {
      kind: 'add-link';
      surface: 'draft' | 'applied';
      purposeId: PurposeId;
      locationId: string;
      base: null;
      monthlyAmountWon?: number;
    }
  | { kind: 'purpose'; id: CustomPurpose['id']; edit: FieldEdit<EditablePurposeFields> }
  | { kind: 'location'; id: string; edit: FieldEdit<EditableLocationFields> };

export type AccountMapIntentRebaseResult =
  | { ok: true; command: AccountMapCommand }
  | { ok: false; reason: 'target-missing' | 'duplicate-link' }
  | { ok: false; reason: 'field-conflict'; field: string };

export function rebaseAccountMapIntent(
  latest: WorkspaceDocument,
  intent: AccountMapEditIntent,
): AccountMapIntentRebaseResult {
  switch (intent.kind) {
    case 'link':
      return rebaseLinkIntent(latest, intent);
    case 'add-link':
      return rebaseAddLinkIntent(latest, intent);
    case 'purpose':
      return rebasePurposeIntent(latest, intent);
    case 'location':
      return rebaseLocationIntent(latest, intent);
  }
}

function rebaseLinkIntent(
  latest: WorkspaceDocument,
  intent: Extract<AccountMapEditIntent, { kind: 'link' }>,
): AccountMapIntentRebaseResult {
  const applied = latest.accountMap.applied;
  const current = applied?.links.find(({ id }) => id === intent.id);
  if (applied === null || current === undefined) return { ok: false, reason: 'target-missing' };
  const changed = changedFields(
    intent.edit.base,
    intent.edit.next,
    ['monthlyAmountWon', 'status', 'remainder'],
  );
  const conflict = conflictingField(
    current,
    intent.edit.base,
    changed,
  );
  if (conflict !== null) return { ok: false, reason: 'field-conflict', field: conflict };

  const fields: Extract<AccountMapCommand, { type: 'edit-link' }>['fields'] = {};
  if (changed.includes('monthlyAmountWon')) fields.monthlyAmountWon = intent.edit.next.monthlyAmountWon;
  if (changed.includes('status')) fields.status = intent.edit.next.status;
  if (changed.includes('remainder')) fields.remainder = intent.edit.next.remainder;
  return {
    ok: true,
    command: {
      type: 'edit-link',
      linkId: current.id,
      fields,
    },
  };
}

function rebaseAddLinkIntent(
  latest: WorkspaceDocument,
  intent: Extract<AccountMapEditIntent, { kind: 'add-link' }>,
): AccountMapIntentRebaseResult {
  const state = latest.accountMap[intent.surface];
  const location = latest.locations.find(({ id }) => id === intent.locationId);
  if (state === null
    || location === undefined
    || location.archivedAt !== undefined
    || !purposeExists(intent.purposeId, state.customPurposes)) {
    return { ok: false, reason: 'target-missing' };
  }
  if (state.links.some(({ purposeId, locationId }) => (
    purposeId === intent.purposeId && locationId === intent.locationId
  ))) return { ok: false, reason: 'duplicate-link' };
  return {
    ok: true,
    command: {
      type: 'connect-location',
      surface: intent.surface,
      purposeId: intent.purposeId,
      locationId: intent.locationId,
      ...(intent.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: intent.monthlyAmountWon }),
    },
  };
}

function rebasePurposeIntent(
  latest: WorkspaceDocument,
  intent: Extract<AccountMapEditIntent, { kind: 'purpose' }>,
): AccountMapIntentRebaseResult {
  const applied = latest.accountMap.applied;
  const current = applied?.customPurposes.find(({ id }) => id === intent.id);
  if (applied === null || current === undefined) return { ok: false, reason: 'target-missing' };
  const changed = changedFields(
    intent.edit.base,
    intent.edit.next,
    ['name', 'targetMonthlyWon', 'archivedAt'],
  );
  const conflict = conflictingField(
    current,
    intent.edit.base,
    changed,
  );
  if (conflict !== null) return { ok: false, reason: 'field-conflict', field: conflict };
  const fields: Extract<AccountMapCommand, { type: 'edit-custom-purpose' }>['fields'] = {};
  if (changed.includes('name')) fields.name = intent.edit.next.name;
  if (changed.includes('targetMonthlyWon')) {
    fields.targetMonthlyWon = intent.edit.next.targetMonthlyWon;
  }
  if (changed.includes('archivedAt')) {
    fields.lifecycle = intent.edit.next.archivedAt === undefined ? 'restore' : 'archive';
  }
  return {
    ok: true,
    command: {
      type: 'edit-custom-purpose',
      purposeId: current.id,
      fields,
    },
  };
}

function rebaseLocationIntent(
  latest: WorkspaceDocument,
  intent: Extract<AccountMapEditIntent, { kind: 'location' }>,
): AccountMapIntentRebaseResult {
  const current = latest.locations.find(({ id }) => id === intent.id);
  if (current === undefined) return { ok: false, reason: 'target-missing' };
  const changed = changedFields(intent.edit.base, intent.edit.next, ['shortName', 'institution']);
  const conflict = conflictingField(current, intent.edit.base, changed);
  if (conflict !== null) return { ok: false, reason: 'field-conflict', field: conflict };
  return {
    ok: true,
    command: {
      type: 'update-location',
      locationId: current.id,
      shortName: changed.includes('shortName') ? intent.edit.next.shortName : current.shortName,
      addRoles: [],
      ...(changed.includes('institution')
        ? { institution: intent.edit.next.institution }
        : {}),
    },
  };
}

function conflictingField<Current extends object, Base extends object>(
  current: Current,
  base: Base,
  fields: readonly (keyof Base & string)[],
): string | null {
  for (const field of fields) {
    if (!fieldValueEqual(current[field as unknown as keyof Current], base[field])) {
      return field;
    }
  }
  return null;
}

function changedFields<Base extends object, Next extends Base>(
  base: Base,
  next: Next,
  fields: readonly (keyof Base & string)[],
): (keyof Base & string)[] {
  return fields.filter((field) => !fieldValueEqual(base[field], next[field]));
}

function fieldValueEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function purposeExists(purposeId: PurposeId, customPurposes: readonly CustomPurpose[]): boolean {
  return (SYSTEM_PURPOSE_IDS as readonly PurposeId[]).includes(purposeId)
    || customPurposes.some(({ id, archivedAt }) => id === purposeId && archivedAt === undefined);
}
