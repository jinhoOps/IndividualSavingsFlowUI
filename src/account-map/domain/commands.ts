import type { MainData } from '../../main/domain/model';
import type { FinancialLocation, FinancialRole, InstitutionRef } from '../../workspace/domain/financialLocation';
import { parseFinancialLocation, PURPOSE_CAPACITY } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { parseWorkspaceDocument } from '../../workspace/domain/validation';
import { findLocationDuplicate } from './institutions';
import {
  SYSTEM_PURPOSE_IDS,
  type AccountMapApplied,
  type AccountMapDraft,
  type CustomPurpose,
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
      type: 'connect-location';
      surface: 'draft' | 'applied';
      purposeId: PurposeId;
      locationId: string;
      monthlyAmountWon?: number;
    }
  | {
      type: 'create-and-connect-location';
      surface: 'draft' | 'applied';
      purposeId: PurposeId;
      location: FinancialLocation;
      monthlyAmountWon?: number;
    }
  | {
      type: 'restore-and-connect-location';
      surface: 'draft' | 'applied';
      purposeId: PurposeId;
      locationId: string;
      monthlyAmountWon?: number;
    }
  | {
      type: 'edit-link';
      linkId: string;
      fields: {
        monthlyAmountWon?: number;
        status?: PurposeLocationLink['status'];
        remainder?: boolean;
      };
    }
  | {
      type: 'edit-custom-purpose';
      purposeId: CustomPurpose['id'];
      fields: {
        name?: string;
        targetMonthlyWon?: number;
        lifecycle?: 'archive' | 'restore';
      };
    }
  | { type: 'archive-custom-purpose'; purposeId: CustomPurpose['id'] }
  | {
      type: 'restore-custom-purpose';
      purposeId: CustomPurpose['id'];
      targetMonthlyWon: number;
    }
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
  | 'duplicate-link'
  | 'target-missing'
  | 'field-conflict'
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
  if (source.main.applied === null) return failure('invalid-input');

  let changed: AccountMapCommandResult;
  switch (command.type) {
    case 'save-draft': {
      if (!customTargetsWithinWritableCapacity(command.draft, source.accountMap.draft, source)) {
        changed = failure('custom-target-capacity');
        break;
      }
      const main = source.main.applied;
      if (main === null) {
        changed = failure('invalid-input');
        break;
      }
      const draft = withCurrentMainSource(command.draft, source.accountMap.draft, main);
      changed = successCandidate(source, {
        ...source,
        accountMap: { ...source.accountMap, draft: structuredClone(draft) },
      });
      break;
    }
    case 'apply-map':
      changed = validateAppliedMap(command.applied, source);
      if (!changed.ok) break;
      changed = successCandidate(source, {
        ...source,
        accountMap: {
          ...source.accountMap,
          applied: structuredClone(withCurrentMainSource(
            command.applied,
            source.accountMap.applied,
            source.main.applied!,
          )),
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
    case 'connect-location':
      changed = connectLocation(source, command, now);
      break;
    case 'create-and-connect-location':
      changed = createAndConnectLocation(source, command, now);
      break;
    case 'restore-and-connect-location':
      changed = restoreAndConnectLocation(source, command, now);
      break;
    case 'edit-link':
      changed = editLink(source, command, now);
      break;
    case 'edit-custom-purpose':
      changed = editCustomPurpose(source, command, now);
      break;
    case 'archive-custom-purpose':
      changed = archiveCustomPurpose(source, command, now);
      break;
    case 'restore-custom-purpose':
      changed = restoreCustomPurpose(source, command, now);
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
    accountMap: {
      ...candidate.accountMap,
      applied: structuredClone(withCurrentMainSource(
        command.applied,
        source.accountMap.applied,
        source.main.applied!,
      )),
      draft: null,
    },
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

function withCurrentMainSource<T extends AccountMapApplied | AccountMapDraft>(
  candidate: T,
  current: T | null,
  main: MainData,
): T {
  const references = mainPurposeReferences(main);
  const parentIds = ['system:housing', 'system:living', 'system:saving', 'system:investing'] as const;
  const fitsCurrentMain = parentIds.every((parentId) => candidate.customPurposes
    .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
    .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0) <= references[parentId]);
  return {
    ...candidate,
    sourceMainUpdatedAt: fitsCurrentMain
      ? main.updatedAt
      : current?.sourceMainUpdatedAt ?? candidate.sourceMainUpdatedAt,
  };
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

function connectLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'connect-location' }>,
  now: number,
): AccountMapCommandResult {
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return failure('location-not-found');
  if (current.archivedAt !== undefined) return failure('invalid-input');
  const state = connectionState(source, command.surface, now);
  if (state === null) return failure('invalid-input');
  const role = requiredRole(command.purposeId, state.customPurposes);
  if (role === null) return failure('invalid-input');
  if (state.links.some(({ purposeId, locationId }) => (
    purposeId === command.purposeId && locationId === command.locationId
  ))) return failure('duplicate-link');

  const location = parseFinancialLocation({
    ...current,
    roles: [...new Set([...current.roles, role])],
    updatedAt: now,
  });
  if (location === null) return failure('invalid-input');
  const locations = replaceLocation(source.locations, location);
  if (exceedsRoleCapacity(locations)) return failure('purpose-capacity');

  const nextState = appendConnection(state, command.purposeId, command.locationId, command.monthlyAmountWon, locations, source, now);
  if (isFailure(nextState)) return nextState;
  return successCandidate(source, {
    ...source,
    locations,
    accountMap: { ...source.accountMap, [command.surface]: nextState },
  });
}

function createAndConnectLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'create-and-connect-location' }>,
  now: number,
): AccountMapCommandResult {
  const state = connectionState(source, command.surface, now);
  if (state === null) return failure('invalid-input');
  const role = requiredRole(command.purposeId, state.customPurposes);
  if (role === null) return failure('invalid-input');
  const { archivedAt: _archivedAt, ...activeInput } = command.location;
  const location = parseFinancialLocation({
    ...activeInput,
    roles: [...new Set([...command.location.roles, role])],
    updatedAt: now,
  });
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

  const nextState = appendConnection(state, command.purposeId, location.id, command.monthlyAmountWon, locations, source, now);
  if (isFailure(nextState)) return nextState;
  return successCandidate(source, {
    ...source,
    locations,
    accountMap: { ...source.accountMap, [command.surface]: nextState },
  });
}

function restoreAndConnectLocation(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'restore-and-connect-location' }>,
  now: number,
): AccountMapCommandResult {
  const current = source.locations.find(({ id }) => id === command.locationId);
  if (current === undefined) return failure('location-not-found');
  if (current.archivedAt === undefined) return failure('invalid-input');
  const state = connectionState(source, command.surface, now);
  if (state === null) return failure('invalid-input');
  const role = requiredRole(command.purposeId, state.customPurposes);
  if (role === null) return failure('invalid-input');
  const pair = state.links.find(({ purposeId, locationId }) => (
    purposeId === command.purposeId && locationId === command.locationId
  ));
  if (pair !== undefined && (pair.status !== 'suspended'
    || pair.suspendedReason !== 'location-archived')) return failure('duplicate-link');

  const { archivedAt: _archivedAt, ...withoutArchive } = current;
  const location = parseFinancialLocation({
    ...withoutArchive,
    roles: [...new Set([...current.roles, role])],
    updatedAt: now,
  });
  if (location === null) return failure('invalid-input');
  const duplicate = findLocationDuplicate(source.locations, location);
  if (duplicate.kind === 'active') {
    return { ok: false, reason: 'duplicate-location-active', locationId: duplicate.location.id };
  }
  const locations = replaceLocation(source.locations, location);
  if (exceedsRoleCapacity(locations)) return failure('purpose-capacity');

  const nextState = appendConnection(
    state,
    command.purposeId,
    command.locationId,
    command.monthlyAmountWon,
    locations,
    source,
    now,
    pair,
  );
  if (isFailure(nextState)) return nextState;
  return successCandidate(source, {
    ...source,
    locations,
    accountMap: { ...source.accountMap, [command.surface]: nextState },
  });
}

function appendConnection<T extends AccountMapApplied | AccountMapDraft>(
  state: T,
  purposeId: PurposeId,
  locationId: string,
  monthlyAmountWon: number | undefined,
  locations: FinancialLocation[],
  source: WorkspaceDocument,
  now: number,
  pairToReactivate?: PurposeLocationLink,
): T | Extract<AccountMapCommandResult, { ok: false }> {
  if (monthlyAmountWon !== undefined && (!Number.isSafeInteger(monthlyAmountWon) || monthlyAmountWon < 0)) {
    return failure('invalid-input');
  }
  const activeLinks = state.links.filter((link) => link.purposeId === purposeId && link.status === 'active');
  if (activeLinks.length >= PURPOSE_CAPACITY[requiredRole(purposeId, state.customPurposes)!]) {
    return failure('purpose-capacity');
  }
  const targetWon = reconcilePurpose(purposeId, state, locations, source.main.applied!).targetWon;
  const firstConnection = activeLinks.length === 0;
  const link: PurposeLocationLink = {
    id: pairToReactivate?.id ?? uniqueLinkId(state.links, purposeId, locationId),
    purposeId,
    locationId,
    monthlyAmountWon: firstConnection ? targetWon : monthlyAmountWon ?? 0,
    remainder: firstConnection,
    status: 'active',
    createdAt: pairToReactivate?.createdAt ?? now,
    updatedAt: now,
  };
  let links = pairToReactivate === undefined
    ? [...state.links, link]
    : state.links.map((candidate) => candidate.id === pairToReactivate.id ? link : candidate);
  if (!firstConnection) {
    const remainder = activeLinks.find(({ remainder }) => remainder) ?? activeLinks[0];
    const recalculated = recalculateRemainder(purposeId, remainder!.id, targetWon, links);
    if (!recalculated.ok) {
      return failure(recalculated.reason === 'fixed-links-exceed-target'
        ? 'fixed-links-exceed-target'
        : 'invalid-remainder-selection');
    }
    links = recalculated.links.map((candidate) => candidate.purposeId === purposeId
      && candidate.status === 'active'
      ? { ...candidate, updatedAt: now }
      : candidate);
  }
  const candidate = { ...state, links, updatedAt: now };
  const beforeExcess = reconcilePurpose(purposeId, state, locations, source.main.applied!).excessWon;
  const afterExcess = reconcilePurpose(purposeId, candidate, locations, source.main.applied!).excessWon;
  if (afterExcess > beforeExcess) return failure('purpose-excess');
  return withCurrentMainSource(candidate, state, source.main.applied!);
}

function connectionState(
  source: WorkspaceDocument,
  surface: 'draft' | 'applied',
  now: number,
): AccountMapApplied | AccountMapDraft | null {
  const current = source.accountMap[surface];
  if (current !== null) return current;
  if (surface !== 'draft' || source.accountMap.applied !== null || source.main.applied === null) return null;
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: source.main.applied.updatedAt,
    customPurposes: [],
    links: [],
    step: 'connect',
    updatedAt: now,
  };
}

function requiredRole(
  purposeId: PurposeId,
  customPurposes: readonly CustomPurpose[],
): FinancialRole | null {
  const rootPurposeId = purposeId.startsWith('custom:')
    ? customPurposes.find((purpose) => purpose.id === purposeId && purpose.archivedAt === undefined)?.parentId
    : purposeId;
  if (rootPurposeId === undefined) return null;
  if (rootPurposeId === 'system:income') return 'income';
  if (rootPurposeId === 'system:saving') return 'saving';
  if (rootPurposeId === 'system:investing') return 'investing';
  return rootPurposeId === 'system:housing' || rootPurposeId === 'system:living' ? 'spending' : null;
}

function uniqueLinkId(
  links: readonly PurposeLocationLink[],
  purposeId: PurposeId,
  locationId: string,
): string {
  const base = `link:${purposeId}:${locationId}`;
  const ids = new Set(links.map(({ id }) => id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}:${suffix}`)) suffix += 1;
  return `${base}:${suffix}`;
}

function editLink(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'edit-link' }>,
  now: number,
): AccountMapCommandResult {
  const applied = source.accountMap.applied;
  const current = applied?.links.find(({ id }) => id === command.linkId);
  if (applied === null || current === undefined) return failure('invalid-input');
  if (Object.keys(command.fields).length === 0) return failure('invalid-input');
  const monthlyAmountWon = command.fields.monthlyAmountWon ?? current.monthlyAmountWon;
  const status = command.fields.status ?? current.status;
  const remainder = command.fields.remainder ?? current.remainder;
  let next: PurposeLocationLink;
  if (status === 'suspended') {
    next = {
      ...current,
      monthlyAmountWon,
      status: 'suspended',
      remainder: false,
      suspendedReason: current.status === 'suspended' ? current.suspendedReason : 'user',
      updatedAt: now,
    };
  } else {
    const { suspendedReason: _suspendedReason, ...active } = current.status === 'suspended'
      ? current
      : { ...current, suspendedReason: undefined };
    next = {
      ...active,
      monthlyAmountWon,
      status: 'active',
      remainder,
      updatedAt: now,
    };
  }

  let links = applied.links.map((link) => link.id === current.id ? next : { ...link });
  if (next.status === 'active' && next.remainder && command.fields.remainder === true) {
    links = links.map((link): PurposeLocationLink => link.purposeId === next.purposeId
      && link.status === 'active'
      ? { ...link, remainder: link.id === next.id, updatedAt: now }
      : link);
  }
  const selectedRemainder = links.find((link) => link.purposeId === next.purposeId
    && link.status === 'active' && link.remainder);
  if (selectedRemainder !== undefined) {
    const target = reconcilePurpose(
      next.purposeId,
      { ...applied, links },
      source.locations,
      source.main.applied!,
    ).targetWon;
    const recalculated = recalculateRemainder(next.purposeId, selectedRemainder.id, target, links);
    if (!recalculated.ok) {
      if (recalculated.reason !== 'fixed-links-exceed-target') {
        return failure('invalid-remainder-selection');
      }
      const beforeExcess = reconcilePurpose(
        next.purposeId,
        applied,
        source.locations,
        source.main.applied!,
      ).excessWon;
      const afterExcess = reconcilePurpose(
        next.purposeId,
        { ...applied, links },
        source.locations,
        source.main.applied!,
      ).excessWon;
      if (afterExcess >= beforeExcess) return failure('fixed-links-exceed-target');
    } else {
      links = recalculated.links.map((link) => link.purposeId === next.purposeId
        && link.status === 'active'
        ? { ...link, updatedAt: now }
        : link);
    }
  }
  const candidate = { ...applied, links, updatedAt: now };
  const validated = validateEditedMap(candidate, source);
  if (!validated.ok) return validated;
  const lostRemainder = current.status === 'active' && current.remainder
    && !links.some((link) => link.id === current.id && link.status === 'active' && link.remainder);
  const activeForPurpose = links.filter((link) => link.purposeId === current.purposeId
    && link.status === 'active');
  if (lostRemainder && activeForPurpose.length > 0
    && !activeForPurpose.some(({ remainder: isRemainder }) => isRemainder)) {
    return failure('replacement-remainder-required');
  }
  return successCandidate(source, {
    ...source,
    accountMap: {
      ...source.accountMap,
      applied: withCurrentMainAndExcessSource(candidate, applied, source),
    },
  });
}

function withCurrentMainAndExcessSource(
  candidate: AccountMapApplied,
  current: AccountMapApplied,
  source: WorkspaceDocument,
): AccountMapApplied {
  const main = source.main.applied!;
  const normalized = withCurrentMainSource(candidate, current, main);
  const purposeIds: PurposeId[] = [
    ...SYSTEM_PURPOSE_IDS,
    ...candidate.customPurposes
      .filter(({ archivedAt }) => archivedAt === undefined)
      .map(({ id }) => id),
  ];
  return purposeIds.some((purposeId) => (
    reconcilePurpose(purposeId, candidate, source.locations, main).excessWon > 0
  ))
    ? { ...normalized, sourceMainUpdatedAt: current.sourceMainUpdatedAt }
    : normalized;
}

function editCustomPurpose(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'edit-custom-purpose' }>,
  now: number,
): AccountMapCommandResult {
  const applied = source.accountMap.applied;
  const current = applied?.customPurposes.find(({ id }) => id === command.purposeId);
  if (applied === null || current === undefined || Object.keys(command.fields).length === 0) {
    return failure('invalid-input');
  }
  if (command.fields.lifecycle === 'archive' && current.archivedAt !== undefined) {
    return failure('invalid-input');
  }
  if (command.fields.lifecycle === 'restore' && current.archivedAt === undefined) {
    return failure('invalid-input');
  }
  const purpose: CustomPurpose = {
    ...current,
    ...(command.fields.name === undefined ? {} : { name: command.fields.name }),
    ...(command.fields.targetMonthlyWon === undefined
      ? {}
      : { targetMonthlyWon: command.fields.targetMonthlyWon }),
    updatedAt: now,
  };
  if (command.fields.lifecycle === 'archive') purpose.archivedAt = now;
  if (command.fields.lifecycle === 'restore') delete purpose.archivedAt;
  const customPurposes = applied.customPurposes.map((candidate) => (
    candidate.id === purpose.id ? purpose : { ...candidate }
  ));
  const links = command.fields.lifecycle === 'archive'
    ? applied.links.map((link): PurposeLocationLink => link.purposeId === purpose.id
      && link.status === 'active'
      ? {
          ...link,
          status: 'suspended',
          suspendedReason: 'user',
          remainder: false,
          updatedAt: now,
        }
      : { ...link })
    : applied.links.map((link) => ({ ...link }));
  const candidate = { ...applied, customPurposes, links, updatedAt: now };
  if (command.fields.lifecycle === 'restore' && !customTargetsFitCurrentCapacity(customPurposes, source)) {
    return failure('custom-target-capacity');
  }
  const validated = validateEditedMap(candidate, source);
  if (!validated.ok) return validated;
  return successCandidate(source, {
    ...source,
    accountMap: {
      ...source.accountMap,
      applied: withCurrentMainSource(candidate, applied, source.main.applied!),
    },
  });
}

function archiveCustomPurpose(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'archive-custom-purpose' }>,
  now: number,
): AccountMapCommandResult {
  const states = [source.accountMap.applied, source.accountMap.draft].filter(
    (state): state is AccountMapApplied | AccountMapDraft => state !== null,
  );
  const matching = states.flatMap((state) => state.customPurposes.filter(({ id }) => id === command.purposeId));
  if (matching.length === 0 || matching.some(({ archivedAt }) => archivedAt !== undefined)) {
    return failure('invalid-input');
  }
  const applied = source.accountMap.applied === null
    ? null
    : archivePurposeInState(source.accountMap.applied, command.purposeId, source, now);
  const draft = source.accountMap.draft === null
    ? null
    : archivePurposeInState(source.accountMap.draft, command.purposeId, source, now);
  return successCandidate(source, {
    ...source,
    accountMap: { ...source.accountMap, applied, draft },
  });
}

function archivePurposeInState<T extends AccountMapApplied | AccountMapDraft>(
  state: T,
  purposeId: CustomPurpose['id'],
  source: WorkspaceDocument,
  now: number,
): T {
  if (!state.customPurposes.some(({ id }) => id === purposeId)) return state;
  const customPurposes = state.customPurposes.map((purpose) => purpose.id === purposeId
    ? { ...purpose, archivedAt: now, updatedAt: now }
    : { ...purpose });
  const links = state.links.map((link): PurposeLocationLink => {
    if (link.purposeId !== purposeId || link.status !== 'active') return { ...link };
    return {
      ...link,
      status: 'suspended',
      suspendedReason: 'user',
      remainder: false,
      updatedAt: now,
    };
  });
  return withCurrentMainSource(
    { ...state, customPurposes, links, updatedAt: now },
    state,
    source.main.applied!,
  );
}

function restoreCustomPurpose(
  source: WorkspaceDocument,
  command: Extract<AccountMapCommand, { type: 'restore-custom-purpose' }>,
  now: number,
): AccountMapCommandResult {
  if (!Number.isSafeInteger(command.targetMonthlyWon) || command.targetMonthlyWon < 0) {
    return failure('invalid-input');
  }
  const states = [source.accountMap.applied, source.accountMap.draft].filter(
    (state): state is AccountMapApplied | AccountMapDraft => state !== null,
  );
  const matching = states.flatMap((state) => state.customPurposes.filter(({ id }) => id === command.purposeId));
  if (matching.length === 0 || matching.some(({ archivedAt }) => archivedAt === undefined)) {
    return failure('invalid-input');
  }
  const applied = source.accountMap.applied === null
    ? null
    : restorePurposeInState(source.accountMap.applied, command, source, now);
  if (isFailure(applied)) return applied;
  const draft = source.accountMap.draft === null
    ? null
    : restorePurposeInState(source.accountMap.draft, command, source, now);
  if (isFailure(draft)) return draft;
  return successCandidate(source, {
    ...source,
    accountMap: { ...source.accountMap, applied, draft },
  });
}

function restorePurposeInState<T extends AccountMapApplied | AccountMapDraft>(
  state: T,
  command: Extract<AccountMapCommand, { type: 'restore-custom-purpose' }>,
  source: WorkspaceDocument,
  now: number,
): T | Extract<AccountMapCommandResult, { ok: false }> {
  const current = state.customPurposes.find(({ id }) => id === command.purposeId);
  if (current === undefined || current.archivedAt === undefined) return state;
  const customPurposes = state.customPurposes.map((purpose): CustomPurpose => {
    if (purpose.id !== command.purposeId) return { ...purpose };
    const { archivedAt: _archivedAt, ...active } = purpose;
    return { ...active, targetMonthlyWon: command.targetMonthlyWon, updatedAt: now };
  });
  if (!customTargetsFitCurrentCapacity(customPurposes, source)) {
    return failure('custom-target-capacity');
  }
  return withCurrentMainSource(
    { ...state, customPurposes, updatedAt: now },
    state,
    source.main.applied!,
  );
}

function customTargetsFitCurrentCapacity(
  customPurposes: readonly CustomPurpose[],
  source: WorkspaceDocument,
): boolean {
  const main = source.main.applied;
  if (main === null) return false;
  const references = mainPurposeReferences(main);
  const parentIds = ['system:housing', 'system:living', 'system:saving', 'system:investing'] as const;
  return parentIds.every((parentId) => customPurposes
    .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
    .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0) <= references[parentId]);
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
  const locationInput: FinancialLocation = {
    ...current,
    shortName: command.shortName,
    roles,
    updatedAt: now,
  };
  if (Object.prototype.hasOwnProperty.call(command, 'institution')) {
    if (command.institution === undefined) delete locationInput.institution;
    else locationInput.institution = command.institution;
  }
  const next = parseFinancialLocation(locationInput);
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
  return withCurrentMainSource(
    { ...state, links, updatedAt: now },
    state,
    source.main.applied!,
  );
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
  return withCurrentMainSource(
    { ...state, links, updatedAt: now },
    state,
    source.main.applied!,
  );
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
