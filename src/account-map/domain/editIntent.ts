import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { AccountMapCommand } from './commands';
import {
  SYSTEM_PURPOSE_IDS,
  type CustomPurpose,
  type PurposeId,
  type PurposeLocationLink,
} from './model';
import { recalculateRemainder, reconcilePurpose } from './reconciliation';

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

  const next = applyLinkFields(current, intent.edit.next, changed);
  let links = applied.links.map((link) => link.id === intent.id ? next : { ...link });
  if (next.status === 'active' && next.remainder && changed.includes('remainder')) {
    links = links.map((link): PurposeLocationLink => link.purposeId === next.purposeId
      && link.status === 'active'
      ? { ...link, remainder: link.id === next.id }
      : link);
  }
  const remainder = links.find((link) => link.purposeId === next.purposeId
    && link.status === 'active' && link.remainder);
  const main = latest.main.applied;
  if (remainder !== undefined && main !== null
    && changed.some((field) => field === 'monthlyAmountWon' || field === 'status' || field === 'remainder')) {
    const target = reconcilePurpose(next.purposeId, { ...applied, links }, latest.locations, main).targetWon;
    const recalculated = recalculateRemainder(next.purposeId, remainder.id, target, links);
    if (recalculated.ok) links = recalculated.links;
  }
  return {
    ok: true,
    command: {
      type: 'edit-map-node',
      applied: {
        ...applied,
        links,
      },
    },
  };
}

function applyLinkFields(
  current: PurposeLocationLink,
  next: EditableLinkFields,
  changed: readonly (keyof EditableLinkFields)[],
): PurposeLocationLink {
  const monthlyAmountWon = changed.includes('monthlyAmountWon')
    ? next.monthlyAmountWon
    : current.monthlyAmountWon;
  const status = changed.includes('status') ? next.status : current.status;
  const remainder = changed.includes('remainder') ? next.remainder : current.remainder;
  if (status === 'suspended') {
    return {
      ...current,
      monthlyAmountWon,
      status: 'suspended',
      remainder: false,
      suspendedReason: current.status === 'suspended' ? current.suspendedReason : 'user',
    };
  }
  const { suspendedReason: _suspendedReason, ...active } = current.status === 'suspended'
    ? current
    : { ...current, suspendedReason: undefined };
  return {
    ...active,
    monthlyAmountWon,
    status: 'active',
    remainder,
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
  if (changed.includes('archivedAt')) {
    return intent.edit.next.archivedAt === undefined
      ? {
          ok: true,
          command: {
            type: 'restore-custom-purpose',
            purposeId: current.id,
            targetMonthlyWon: changed.includes('targetMonthlyWon')
              ? intent.edit.next.targetMonthlyWon
              : current.targetMonthlyWon,
          },
        }
      : {
          ok: true,
          command: { type: 'archive-custom-purpose', purposeId: current.id },
        };
  }
  const next = applyPurposeFields(current, intent.edit.next, changed);
  return {
    ok: true,
    command: {
      type: 'edit-map-node',
      applied: {
        ...applied,
        customPurposes: applied.customPurposes.map((purpose) => (
          purpose.id === intent.id ? next : { ...purpose }
        )),
      },
    },
  };
}

function applyPurposeFields(
  current: CustomPurpose,
  next: EditablePurposeFields,
  changed: readonly (keyof EditablePurposeFields)[],
): CustomPurpose {
  const candidate: CustomPurpose = { ...current };
  if (changed.includes('name')) candidate.name = next.name;
  if (changed.includes('targetMonthlyWon')) candidate.targetMonthlyWon = next.targetMonthlyWon;
  if (changed.includes('archivedAt')) {
    if (next.archivedAt === undefined) delete candidate.archivedAt;
    else candidate.archivedAt = next.archivedAt;
  }
  return candidate;
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
    if (hasOwn(base, field) && !fieldValueEqual(current[field as unknown as keyof Current], base[field])) {
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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
