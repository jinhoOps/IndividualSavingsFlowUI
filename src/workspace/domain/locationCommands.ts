import {
  countDisplayCharacters,
  normalizeLocationName,
  parseFinancialLocation,
  PURPOSE_CAPACITY,
  type FinancialLocation,
  type FinancialLocationKind,
  type FinancialRole,
  type InstitutionRef,
} from './financialLocation';
import type { WorkspaceDocument } from './model';
import { parseWorkspaceDocument } from './validation';

export type LocationCommandError =
  | 'duplicate-name'
  | 'name-required'
  | 'name-too-long'
  | 'purpose-capacity'
  | 'location-not-found'
  | 'invalid-input';

export type LocationCommandResult =
  | { ok: true; workspace: WorkspaceDocument; location: FinancialLocation }
  | { ok: false; reason: LocationCommandError };

export interface LocationCommandDependencies {
  createId(): string;
  now(): number;
}

export interface CreateLocationInput {
  shortName: string;
  institution?: InstitutionRef;
  kind: FinancialLocationKind;
  roles: FinancialRole[];
}

export function createLocation(
  workspace: WorkspaceDocument,
  input: CreateLocationInput,
  dependencies: Partial<LocationCommandDependencies> = {},
): LocationCommandResult {
  const currentWorkspace = parseWorkspaceDocument(workspace);
  if (currentWorkspace === null) return invalidInput();
  const parsedInput = parseCreateInput(input);
  if ('ok' in parsedInput) return parsedInput;
  const parsedDependencies = parseDependencies(dependencies);
  if (parsedDependencies === null) return invalidInput();
  if (hasActiveDuplicate(currentWorkspace.locations, parsedInput.shortName)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const timestamp = (parsedDependencies.now ?? Date.now)();
  const id = (parsedDependencies.createId ?? defaultCreateId)();
  const parsedLocation = parseFinancialLocation({
    id,
    shortName: parsedInput.shortName,
    ...(parsedInput.institution === undefined
      ? {}
      : { institution: parsedInput.institution }),
    kind: parsedInput.kind,
    roles: parsedInput.roles,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  if (parsedLocation === null) return invalidInput();

  const locations = [...currentWorkspace.locations, parsedLocation];
  if (exceedsPurposeCapacity(locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }
  return parseSuccess({ ...currentWorkspace, updatedAt: timestamp, locations }, id);
}

export function renameLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  shortName: string,
  now: number = Date.now(),
): LocationCommandResult {
  const currentWorkspace = parseWorkspaceDocument(workspace);
  if (currentWorkspace === null || !isLocationId(locationId) || !isTimestamp(now)) {
    return invalidInput();
  }
  const name = validateDisplayName(shortName);
  if (typeof name !== 'string') return name;
  const current = currentWorkspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };
  if (current.archivedAt === undefined
    && hasActiveDuplicate(currentWorkspace.locations, name, locationId)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const next = parseFinancialLocation({ ...current, shortName: name, updatedAt: now });
  if (next === null) return invalidInput();
  const locations = replaceLocation(currentWorkspace.locations, next);
  return parseSuccess({ ...currentWorkspace, updatedAt: now, locations }, locationId);
}

export function setLocationRoles(
  workspace: WorkspaceDocument,
  locationId: string,
  roles: FinancialRole[],
  now: number = Date.now(),
): LocationCommandResult {
  const currentWorkspace = parseWorkspaceDocument(workspace);
  const parsedRoles = parseRoles(roles);
  if (currentWorkspace === null
    || !isLocationId(locationId)
    || !isTimestamp(now)
    || 'ok' in parsedRoles) return invalidInput();

  const current = currentWorkspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };
  const next = parseFinancialLocation({ ...current, roles: parsedRoles, updatedAt: now });
  if (next === null) return invalidInput();
  const locations = replaceLocation(currentWorkspace.locations, next);
  if (exceedsPurposeCapacity(locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }

  return parseSuccess({ ...currentWorkspace, updatedAt: now, locations }, locationId);
}

export function archiveLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  now: number = Date.now(),
): LocationCommandResult {
  const currentWorkspace = parseWorkspaceDocument(workspace);
  if (currentWorkspace === null
    || !isLocationId(locationId)
    || !isTimestamp(now)) return invalidInput();

  const current = currentWorkspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };

  const next = parseFinancialLocation({ ...current, archivedAt: now, updatedAt: now });
  if (next === null) return invalidInput();
  const locations = replaceLocation(currentWorkspace.locations, next);
  return parseSuccess({ ...currentWorkspace, updatedAt: now, locations }, locationId);
}

export function restoreLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  now: number = Date.now(),
): LocationCommandResult {
  const currentWorkspace = parseWorkspaceDocument(workspace);
  if (currentWorkspace === null || !isLocationId(locationId) || !isTimestamp(now)) {
    return invalidInput();
  }

  const current = currentWorkspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };
  if (hasActiveDuplicate(currentWorkspace.locations, current.shortName, locationId)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const { archivedAt: _archivedAt, ...active } = current;
  const next = parseFinancialLocation({ ...active, updatedAt: now });
  if (next === null) return invalidInput();
  const locations = replaceLocation(currentWorkspace.locations, next);
  if (exceedsPurposeCapacity(locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }
  return parseSuccess({ ...currentWorkspace, updatedAt: now, locations }, locationId);
}

type LocationCommandFailure = Extract<LocationCommandResult, { ok: false }>;

function parseCreateInput(input: unknown): CreateLocationInput | LocationCommandFailure {
  if (!isRecord(input)) return invalidInput();
  const shortName = validateDisplayName(input.shortName);
  if (typeof shortName !== 'string') return shortName;
  const parsed = parseFinancialLocation({
    id: 'location-input-validation',
    shortName,
    ...(input.institution === undefined ? {} : { institution: input.institution }),
    kind: input.kind,
    roles: input.roles,
    createdAt: 0,
    updatedAt: 0,
  });
  if (parsed === null) return invalidInput();
  return {
    shortName: parsed.shortName,
    ...(parsed.institution === undefined ? {} : { institution: parsed.institution }),
    kind: parsed.kind,
    roles: parsed.roles,
  };
}

function parseDependencies(value: unknown): Partial<LocationCommandDependencies> | null {
  if (!isRecord(value)
    || (value.createId !== undefined && typeof value.createId !== 'function')
    || (value.now !== undefined && typeof value.now !== 'function')) return null;
  return {
    ...(typeof value.createId === 'function' ? { createId: value.createId as () => string } : {}),
    ...(typeof value.now === 'function' ? { now: value.now as () => number } : {}),
  };
}

function validateDisplayName(shortName: unknown): string | LocationCommandFailure {
  if (typeof shortName !== 'string') return invalidInput();
  const displayName = shortName.trim().replace(/\s+/gu, ' ');
  if (displayName.length === 0) return { ok: false, reason: 'name-required' };
  if (countDisplayCharacters(displayName) > 8) return { ok: false, reason: 'name-too-long' };
  const parsed = parseFinancialLocation({
    id: 'location-name-validation',
    shortName: displayName,
    kind: 'bank',
    roles: ['saving'],
    createdAt: 0,
    updatedAt: 0,
  });
  return parsed?.shortName ?? invalidInput();
}

function parseRoles(roles: unknown): FinancialRole[] | LocationCommandFailure {
  const parsed = parseFinancialLocation({
    id: 'location-role-validation',
    shortName: 'Valid',
    kind: 'bank',
    roles,
    createdAt: 0,
    updatedAt: 0,
  });
  return parsed?.roles ?? invalidInput();
}

function hasActiveDuplicate(
  locations: FinancialLocation[],
  shortName: string,
  excludedId?: string,
): boolean {
  const normalized = normalizeLocationName(shortName);
  return locations.some((location) => location.id !== excludedId
    && location.archivedAt === undefined
    && normalizeLocationName(location.shortName) === normalized);
}

function exceedsPurposeCapacity(locations: FinancialLocation[]): boolean {
  const active = locations.filter(({ archivedAt }) => archivedAt === undefined);
  return (Object.keys(PURPOSE_CAPACITY) as FinancialRole[]).some((role) => {
    const locationCount = active.filter((location) => location.roles.includes(role)).length;
    return locationCount > PURPOSE_CAPACITY[role];
  });
}

function replaceLocation(
  locations: FinancialLocation[],
  next: FinancialLocation,
): FinancialLocation[] {
  return locations.map((location) => location.id === next.id ? next : location);
}

function parseSuccess(
  candidate: WorkspaceDocument,
  locationId: string,
): LocationCommandResult {
  const workspace = parseWorkspaceDocument(candidate);
  const location = workspace?.locations.find(({ id }) => id === locationId);
  if (workspace === null || location === undefined) return invalidInput();
  return { ok: true, workspace, location };
}

function invalidInput(): LocationCommandFailure {
  return { ok: false, reason: 'invalid-input' };
}

function isLocationId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 8_640_000_000_000_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultCreateId(): string {
  return globalThis.crypto.randomUUID();
}
