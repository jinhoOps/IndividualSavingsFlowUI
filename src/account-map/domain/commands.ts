import type { FinancialLocation, FinancialRole, InstitutionRef } from '../../workspace/domain/financialLocation';
import { parseFinancialLocation, PURPOSE_CAPACITY } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { parseWorkspaceDocument } from '../../workspace/domain/validation';
import { findLocationDuplicate } from './institutions';
import {
  SYSTEM_PURPOSE_IDS,
  type AccountMapApplied,
  type AccountMapDraft,
  type PurposeId,
  type PurposeLocationLink,
} from './model';
import { mainPurposeReferences, recalculateRemainder, reconcilePurpose } from './reconciliation';

export type AccountMapCommand =
  | { type: 'save-draft'; draft: AccountMapDraft }
  | { type: 'apply-map'; applied: AccountMapApplied }
  | {
      type: 'edit-map-node';
      applied: AccountMapApplied;
      location?: {
        locationId: string;
        institution?: InstitutionRef;
        shortName: string;
      };
    }
  | { type: 'create-location'; location: FinancialLocation }
  | {
      type: 'update-location';
      locationId: string;
      institution?: InstitutionRef;
      shortName: string;
      addRoles: FinancialRole[];
    }
  | {
      type: 'archive-location';
      locationId: string;
      replacementRemainderByPurpose: Record<string, string | null>;
    }
  | {
      type: 'restore-location';
      locationId: string;
      restoreLinkIds: string[];
      remainderByPurpose: Record<string, string | null>;
    }
  | { type: 'reset-map' };

export type AccountMapCommandError =
  | 'invalid-input'
  | 'location-not-found'
  | 'duplicate-location-active'
  | 'duplicate-location-archived'
  | 'purpose-capacity'
  | 'replacement-remainder-required'
  | 'invalid-remainder-selection'
  | 'fixed-links-exceed-target'
  | 'income-connection-required'
  | 'purpose-excess'
  | 'custom-target-capacity'
  | 'protected-slice-changed';

export type AccountMapCommandResult =
  | { ok: true; workspace: WorkspaceDocument }
  | { ok: false; reason: AccountMapCommandError; locationId?: string };

export function applyAccountMapCommand(
  workspace: WorkspaceDocument,
  command: AccountMapCommand,
  now: number = Date.now(),
): AccountMapCommandResult {
  const source = parseWorkspaceDocument(workspace);
  if (source === null || !validTimestamp(now)) return failure('invalid-input');

  let changed: AccountMapCommandResult;
  switch (command.type) {
    case 'save-draft':
      if (!customTargetsWithinWritableCapacity(command.draft, source.accountMap.draft, source)) {
        changed = failure('custom-target-capacity');
        break;
      }
      changed = successCandidate(source, {
        ...source,
        accountMap: { ...source.accountMap, draft: structuredClone(command.draft) },
      });
      break;
    case 'apply-map':
      changed = validateAppliedMap(command.applied, source);
      if (!changed.ok) break;
      changed = successCandidate(source, {
        ...source,
        accountMap: {
          ...source.accountMap,
          applied: structuredClone(command.applied),
          draft: null,
        },
      });
      break;
    case 'edit-map-node':
      changed = editMapNode(source, command, now);
      break;
    case 'create-location':
      changed = createLocation(source, command.location, now);
      break;
    case 'update-location':
      changed = updateLocation(source, command, now);
      break;
    case 'archive-location':
      changed = archiveLocation(source, command, now);
      break;
    case 'restore-location':
      changed = restoreLocation(source, command, now);
      break;
    case 'reset-map':
      changed = successCandidate(source, {
        ...source,
        accountMap: { ...source.accountMap, applied: null, draft: null },
      });
  }

  if (!changed.ok) return changed;
  if (!protectedSlicesEqual(source, changed.workspace)) return failure('protected-slice-changed');
  return changed;
}

function editMapNode(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'edit-map-node' }>,
  now: number,
): AccountMapCommandResult {
  let candidate = source;
  if (command.location !== undefined) {
    const current = source.locations.find(({ id }) => id === command.location!.locationId);
    if (current === undefined) return failure('location-not-found');
    const updated = updateLocation(source, {
      type: 'update-location',
      locationId: current.id,
      ...(command.location.institution === undefined ? {} : { institution: command.location.institution }),
      shortName: command.location.shortName,
      addRoles: [],
    }, now);
    if (!updated.ok) return updated;
    candidate = updated.workspace;
  }
  const validated = validateEditedMap(command.applied, candidate);
  if (!validated.ok) return validated;
  const sourceLinks = source.accountMap.applied?.links ?? [];
  const lostRemainderPurposes = new Set(sourceLinks.filter((link) => link.status === 'active' && link.remainder).filter((previous) => !command.applied.links.some((next) => next.id === previous.id && next.status === 'active' && next.remainder)).map(({ purposeId }) => purposeId));
  for (const purposeId of lostRemainderPurposes) {
    const active = command.applied.links.filter((link) => link.purposeId === purposeId && link.status === 'active');
    if (active.length > 0 && !active.some(({ remainder }) => remainder)) return failure('replacement-remainder-required');
  }
  return successCandidate(source, {
    ...candidate,
    accountMap: { ...candidate.accountMap, applied: structuredClone(command.applied), draft: null },
  });
}

function validateEditedMap(applied: AccountMapApplied, source: WorkspaceDocument): AccountMapCommandResult {
  const main = source.main.applied;
  const current = source.accountMap.applied;
  if (main === null || current === null) return failure('invalid-input');
  if (!applied.links.some((link) => link.purposeId === 'system:income' && link.status === 'active')) {
    return failure('income-connection-required');
  }
  if (!customTargetsWithinWritableCapacity(applied, current, source)) {
    return failure('custom-target-capacity');
  }
  const purposeIds = new Set<PurposeId>([
    ...SYSTEM_PURPOSE_IDS,
    ...current.customPurposes.map(({ id }) => id),
    ...applied.customPurposes.map(({ id }) => id),
  ]);
  for (const purposeId of purposeIds) {
    const before = reconcilePurpose(purposeId, current, source.locations, main).excessWon;
    const after = reconcilePurpose(purposeId, applied, source.locations, main).excessWon;
    if (after > before) return failure('purpose-excess');
  }
  return { ok: true, workspace: source };
}

function validateAppliedMap(
  applied: AccountMapApplied,
  source: WorkspaceDocument,
): AccountMapCommandResult {
  const main = source.main.applied;
  if (main === null) return failure('invalid-input');
  const income = reconcilePurpose('system:income', applied, source.locations, main);
  const hasIncomeLink = applied.links.some((link) => link.purposeId === 'system:income'
    && link.status === 'active');
  if (!hasIncomeLink || income.activeAllocatedWon !== income.targetWon) {
    return failure('income-connection-required');
  }
  const purposeIds: PurposeId[] = [
    ...SYSTEM_PURPOSE_IDS,
    ...applied.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id }) => id),
  ];
  if (purposeIds.some((purposeId) => (
    reconcilePurpose(purposeId, applied, source.locations, main).excessWon > 0
  ))) return failure('purpose-excess');
  if (!customTargetsWithinWritableCapacity(applied, null, source)) {
    return failure('custom-target-capacity');
  }
  return { ok: true, workspace: source };
}

function customTargetsWithinWritableCapacity(
  candidate: Pick<AccountMapApplied, 'customPurposes'>,
  current: Pick<AccountMapDraft, 'customPurposes'> | null,
  source: WorkspaceDocument,
): boolean {
  const main = source.main.applied;
  if (main === null) return false;
  const references = mainPurposeReferences(main);
  const parentIds = ['system:housing', 'system:living', 'system:saving', 'system:investing'] as const;
  return parentIds.every((parentId) => {
    const nextTotal = candidate.customPurposes
      .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
      .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0);
    if (nextTotal <= references[parentId]) return true;
    if (current === null) return false;
    const currentTotal = current.customPurposes
      .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
      .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0);
    return nextTotal <= currentTotal;
  });
}

function createLocation(
  source: WorkspaceDocument,
  input: FinancialLocation,
  now: number,
): AccountMapCommandResult {
  const { archivedAt: _archivedAt, ...activeInput } = input;
  const location = parseFinancialLocation({ ...activeInput, updatedAt: now });
  if (location === null || source.locations.some(({ id }) => id === location.id)) {
    return failure('invalid-input');
  }
  const duplicate = findLocationDuplicate(source.locations, location);
  if (duplicate.kind === 'active') {
    return { ok: false, reason: 'duplicate-location-active', locationId: duplicate.location.id };
  }
  if (duplicate.kind === 'archived') {
    return { ok: false, reason: 'duplicate-location-archived', locationId: duplicate.location.id };
  }
  const locations = [...source.locations, location];
  if (exceedsRoleCapacity(locations)) return failure('purpose-capacity');
  return successCandidate(source, { ...source, locations });
}

function updateLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'update-location' }>,
  now: number,
): AccountMapCommandResult {
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return failure('location-not-found');
  if (current.archivedAt !== undefined) return failure('invalid-input');
  const roles = [...new Set([...current.roles, ...command.addRoles])];
  const institution = command.institution ?? current.institution;
  const next = parseFinancialLocation({
    ...current,
    ...(institution === undefined ? {} : { institution }),
    shortName: command.shortName,
    roles,
    updatedAt: now,
  });
  if (next === null) return failure('invalid-input');
  if (next.archivedAt === undefined) {
    const duplicate = findLocationDuplicate(source.locations, next);
    if (duplicate.kind === 'active') {
      return { ok: false, reason: 'duplicate-location-active', locationId: duplicate.location.id };
    }
  }
  const locations = replaceLocation(source.locations, next);
  if (exceedsRoleCapacity(locations)) return failure('purpose-capacity');
  return successCandidate(source, { ...source, locations });
}

function archiveLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'archive-location' }>,
  now: number,
): AccountMapCommandResult {
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return failure('location-not-found');
  if (current.archivedAt !== undefined) return failure('invalid-input');
  const archived = parseFinancialLocation({ ...current, archivedAt: now, updatedAt: now });
  if (archived === null) return failure('invalid-input');
  const locations = replaceLocation(source.locations, archived);
  const applied = source.accountMap.applied === null
    ? null
    : archiveInState(source.accountMap.applied, command, locations, source, now);
  if (isFailure(applied)) return applied;
  const draft = source.accountMap.draft === null
    ? null
    : archiveInState(source.accountMap.draft, command, locations, source, now);
  if (isFailure(draft)) return draft;
  return successCandidate(source, {
    ...source,
    locations,
    accountMap: { ...source.accountMap, applied, draft },
  });
}

function archiveInState<T extends AccountMapApplied | AccountMapDraft>(
  state: T,
  command: Extract<AccountMapCommand, { type: 'archive-location' }>,
  locations: FinancialLocation[],
  source: WorkspaceDocument,
  now: number,
): T | Extract<AccountMapCommandResult, { ok: false }> {
  const affectedPurposes = new Set(
    state.links.filter((link) => link.locationId === command.locationId).map(({ purposeId }) => purposeId),
  );
  let links = state.links.map((link): PurposeLocationLink => link.locationId === command.locationId
    ? { ...link, remainder: false, status: 'suspended', suspendedReason: 'location-archived', updatedAt: now }
    : { ...link });
  for (const purposeId of affectedPurposes) {
    const remaining = links.filter((link) => link.purposeId === purposeId && link.status === 'active');
    const hadRemainder = state.links.some((link) => link.purposeId === purposeId
      && link.locationId === command.locationId && link.status === 'active' && link.remainder);
    if (!hadRemainder || remaining.length === 0) continue;
    const selectedId = command.replacementRemainderByPurpose[purposeId];
    if (selectedId === undefined || selectedId === null) return failure('replacement-remainder-required');
    if (!remaining.some(({ id }) => id === selectedId)) return failure('invalid-remainder-selection');
    const target = reconcilePurpose(purposeId, { ...state, links }, locations, source.main.applied!).targetWon;
    const recalculated = recalculateRemainder(purposeId, selectedId, target, links);
    if (!recalculated.ok) return failure(recalculated.reason === 'fixed-links-exceed-target'
      ? 'fixed-links-exceed-target' : 'invalid-remainder-selection');
    links = recalculated.links.map((link) => link.purposeId === purposeId && link.status === 'active'
      ? { ...link, updatedAt: now }
      : link);
  }
  return { ...state, links, updatedAt: now };
}

function restoreLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'restore-location' }>,
  now: number,
): AccountMapCommandResult {
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return failure('location-not-found');
  if (current.archivedAt === undefined) return failure('invalid-input');
  const { archivedAt: _archivedAt, ...withoutArchive } = current;
  const restored = parseFinancialLocation({ ...withoutArchive, updatedAt: now });
  if (restored === null) return failure('invalid-input');
  const duplicate = findLocationDuplicate(source.locations, restored);
  if (duplicate.kind === 'active') {
    return { ok: false, reason: 'duplicate-location-active', locationId: duplicate.location.id };
  }
  const locations = replaceLocation(source.locations, restored);
  if (exceedsRoleCapacity(locations)) return failure('purpose-capacity');
  const selected = new Set(command.restoreLinkIds);
  const eligibleAcrossStates = new Set([
    ...(source.accountMap.applied?.links ?? []),
    ...(source.accountMap.draft?.links ?? []),
  ].filter((link) => link.locationId === command.locationId
    && link.status === 'suspended'
    && link.suspendedReason === 'location-archived').map(({ id }) => id));
  if ([...selected].some((id) => !eligibleAcrossStates.has(id))) return failure('invalid-input');
  const applied = source.accountMap.applied === null
    ? null
    : restoreInState(source.accountMap.applied, command, selected, locations, source, now);
  if (isFailure(applied)) return applied;
  const draft = source.accountMap.draft === null
    ? null
    : restoreInState(source.accountMap.draft, command, selected, locations, source, now);
  if (isFailure(draft)) return draft;
  return successCandidate(source, {
    ...source,
    locations,
    accountMap: { ...source.accountMap, applied, draft },
  });
}

function restoreInState<T extends AccountMapApplied | AccountMapDraft>(
  state: T,
  command: Extract<AccountMapCommand, { type: 'restore-location' }>,
  selected: Set<string>,
  locations: FinancialLocation[],
  source: WorkspaceDocument,
  now: number,
): T | Extract<AccountMapCommandResult, { ok: false }> {
  const eligible = new Set(state.links.filter((link) => link.locationId === command.locationId
    && link.status === 'suspended'
    && link.suspendedReason === 'location-archived').map(({ id }) => id));
  let links = state.links.map((link): PurposeLocationLink => {
    if (!selected.has(link.id) || !eligible.has(link.id) || link.status !== 'suspended') return { ...link };
    const { suspendedReason: _reason, ...active } = link;
    return { ...active, status: 'active', remainder: false, updatedAt: now };
  });
  for (const [purposeId, selectedId] of Object.entries(command.remainderByPurpose)) {
    if (selectedId === null) continue;
    const active = links.find((link) => link.id === selectedId
      && link.purposeId === purposeId && link.status === 'active');
    if (active === undefined) return failure('invalid-remainder-selection');
    const target = reconcilePurpose(purposeId as PurposeId, { ...state, links }, locations, source.main.applied!).targetWon;
    const recalculated = recalculateRemainder(purposeId as PurposeId, selectedId, target, links);
    if (!recalculated.ok) return failure(recalculated.reason === 'fixed-links-exceed-target'
      ? 'fixed-links-exceed-target' : 'invalid-remainder-selection');
    links = recalculated.links.map((link) => link.purposeId === purposeId && link.status === 'active'
      ? { ...link, updatedAt: now }
      : link);
  }
  const restoredPurposeIds = new Set(state.links.filter((link) => selected.has(link.id)).map(({ purposeId }) => purposeId));
  for (const purposeId of restoredPurposeIds) {
    if (reconcilePurpose(purposeId, { ...state, links }, locations, source.main.applied!).excessWon > 0) {
      return failure('fixed-links-exceed-target');
    }
  }
  return { ...state, links, updatedAt: now };
}

function successCandidate(
  source: WorkspaceDocument,
  candidate: WorkspaceDocument,
): AccountMapCommandResult {
  const parsed = parseWorkspaceDocument(candidate);
  if (parsed === null) return failure('invalid-input');
  if (!protectedSlicesEqual(source, parsed)) return failure('protected-slice-changed');
  return { ok: true, workspace: parsed };
}

function protectedSlicesEqual(left: WorkspaceDocument, right: WorkspaceDocument): boolean {
  return JSON.stringify(left.main) === JSON.stringify(right.main)
    && JSON.stringify(left.simulation) === JSON.stringify(right.simulation)
    && JSON.stringify(left.portfolio) === JSON.stringify(right.portfolio)
    && JSON.stringify(left.accountMap.legacyPhaseA) === JSON.stringify(right.accountMap.legacyPhaseA)
    && left.schemaVersion === right.schemaVersion
    && left.revision === right.revision;
}

function exceedsRoleCapacity(locations: FinancialLocation[]): boolean {
  const active = locations.filter(({ archivedAt }) => archivedAt === undefined);
  return (Object.keys(PURPOSE_CAPACITY) as FinancialRole[]).some((role) => (
    active.filter((location) => location.roles.includes(role)).length > PURPOSE_CAPACITY[role]
  ));
}

function replaceLocation(locations: FinancialLocation[], next: FinancialLocation): FinancialLocation[] {
  return locations.map((location) => location.id === next.id ? next : location);
}

function validTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
}

function failure(reason: AccountMapCommandError): Extract<AccountMapCommandResult, { ok: false }> {
  return { ok: false, reason };
}

function isFailure<T>(
  value: T | Extract<AccountMapCommandResult, { ok: false }>,
): value is Extract<AccountMapCommandResult, { ok: false }> {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}
