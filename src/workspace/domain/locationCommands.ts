import { scopeKey } from '../../portfolio/domain/model';
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
  | 'portfolio-reference';

export type LocationCommandResult =
  | { ok: true; workspace: WorkspaceDocument; location: FinancialLocation }
  | { ok: false; reason: LocationCommandError; referencedScopes?: string[] };

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

export type PortfolioReferenceDisposition = 'preserve' | 'delete';

export function createLocation(
  workspace: WorkspaceDocument,
  input: CreateLocationInput,
  dependencies: Partial<LocationCommandDependencies> = {},
): LocationCommandResult {
  const name = validateDisplayName(input.shortName);
  if (typeof name !== 'string') return name;
  if (hasActiveDuplicate(workspace.locations, name)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const timestamp = (dependencies.now ?? Date.now)();
  const id = (dependencies.createId ?? defaultCreateId)();
  const parsedLocation = parseFinancialLocation({
    id,
    shortName: name,
    ...(input.institution === undefined
      ? {}
      : { institution: { ...input.institution } }),
    kind: input.kind,
    roles: [...input.roles],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  if (parsedLocation === null) throw new Error('invalid-location-input');

  const locations = [...workspace.locations, parsedLocation];
  if (exceedsPurposeCapacity(workspace, locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }
  return parseSuccess({ ...workspace, updatedAt: timestamp, locations }, id);
}

export function renameLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  shortName: string,
  now: number = Date.now(),
): LocationCommandResult {
  const current = workspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };

  const name = validateDisplayName(shortName);
  if (typeof name !== 'string') return name;
  if (current.archivedAt === undefined && hasActiveDuplicate(workspace.locations, name, locationId)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const next = parseFinancialLocation({ ...current, shortName: name, updatedAt: now });
  if (next === null) throw new Error('invalid-location-input');
  const locations = replaceLocation(workspace.locations, next);
  return parseSuccess({ ...workspace, updatedAt: now, locations }, locationId);
}

export function setLocationRoles(
  workspace: WorkspaceDocument,
  locationId: string,
  roles: FinancialRole[],
  disposition?: PortfolioReferenceDisposition,
  now: number = Date.now(),
): LocationCommandResult {
  const current = workspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };

  const removesInvesting = current.roles.includes('investing') && !roles.includes('investing');
  const references = referencedPlans(workspace, locationId);
  if (removesInvesting && references.length > 0 && disposition === undefined) {
    return portfolioReferenceError(references);
  }

  const next = parseFinancialLocation({ ...current, roles: [...roles], updatedAt: now });
  if (next === null) throw new Error('invalid-location-input');
  const locations = replaceLocation(workspace.locations, next);
  if (exceedsPurposeCapacity(workspace, locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }

  const portfolio = removesInvesting && disposition === 'delete'
    ? withoutLocationPortfolio(workspace, locationId)
    : workspace.portfolio;
  return parseSuccess({ ...workspace, updatedAt: now, locations, portfolio }, locationId);
}

export function archiveLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  disposition?: PortfolioReferenceDisposition,
  now: number = Date.now(),
): LocationCommandResult {
  const current = workspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };

  const references = referencedPlans(workspace, locationId);
  if (references.length > 0 && disposition === undefined) {
    return portfolioReferenceError(references);
  }

  const next = parseFinancialLocation({ ...current, archivedAt: now, updatedAt: now });
  if (next === null) throw new Error('invalid-location-input');
  const locations = replaceLocation(workspace.locations, next);
  const portfolio = disposition === 'delete'
    ? withoutLocationPortfolio(workspace, locationId)
    : workspace.portfolio;
  return parseSuccess({ ...workspace, updatedAt: now, locations, portfolio }, locationId);
}

export function restoreLocation(
  workspace: WorkspaceDocument,
  locationId: string,
  now: number = Date.now(),
): LocationCommandResult {
  const current = workspace.locations.find(({ id }) => id === locationId);
  if (current === undefined) return { ok: false, reason: 'location-not-found' };
  if (hasActiveDuplicate(workspace.locations, current.shortName, locationId)) {
    return { ok: false, reason: 'duplicate-name' };
  }

  const { archivedAt: _archivedAt, ...active } = current;
  const next = parseFinancialLocation({ ...active, updatedAt: now });
  if (next === null) throw new Error('invalid-location-input');
  const locations = replaceLocation(workspace.locations, next);
  if (exceedsPurposeCapacity(workspace, locations)) {
    return { ok: false, reason: 'purpose-capacity' };
  }
  return parseSuccess({ ...workspace, updatedAt: now, locations }, locationId);
}

function validateDisplayName(shortName: string): string | Extract<LocationCommandResult, { ok: false }> {
  const displayName = shortName.trim().replace(/\s+/gu, ' ');
  if (displayName.length === 0) return { ok: false, reason: 'name-required' };
  if (countDisplayCharacters(displayName) > 8) return { ok: false, reason: 'name-too-long' };
  return displayName;
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

function exceedsPurposeCapacity(
  workspace: WorkspaceDocument,
  locations: FinancialLocation[],
): boolean {
  const active = locations.filter(({ archivedAt }) => archivedAt === undefined);
  const activeInstrumentCount = workspace.accountMap.instruments
    .filter(({ archivedAt }) => archivedAt === undefined).length;
  return (Object.keys(PURPOSE_CAPACITY) as FinancialRole[]).some((role) => {
    const locationCount = active.filter((location) => location.roles.includes(role)).length;
    const count = role === 'spending' ? locationCount + activeInstrumentCount : locationCount;
    return count > PURPOSE_CAPACITY[role];
  });
}

function replaceLocation(
  locations: FinancialLocation[],
  next: FinancialLocation,
): FinancialLocation[] {
  return locations.map((location) => location.id === next.id ? next : location);
}

function referencedPlans(workspace: WorkspaceDocument, locationId: string) {
  return workspace.portfolio.plans.filter(
    ({ scope }) => scope.type === 'location' && scope.locationId === locationId,
  );
}

function portfolioReferenceError(
  references: ReturnType<typeof referencedPlans>,
): LocationCommandResult {
  return {
    ok: false,
    reason: 'portfolio-reference',
    referencedScopes: references.map(({ scope }) => scopeKey(scope)),
  };
}

function withoutLocationPortfolio(
  workspace: WorkspaceDocument,
  locationId: string,
): WorkspaceDocument['portfolio'] {
  const plans = workspace.portfolio.plans.filter(
    ({ scope }) => scope.type !== 'location' || scope.locationId !== locationId,
  );
  const draft = workspace.portfolio.draft?.scope.type === 'location'
    && workspace.portfolio.draft.scope.locationId === locationId
    ? null
    : workspace.portfolio.draft;
  return { plans, draft };
}

function parseSuccess(
  candidate: WorkspaceDocument,
  locationId: string,
): LocationCommandResult {
  const workspace = parseWorkspaceDocument(candidate);
  const location = workspace?.locations.find(({ id }) => id === locationId);
  if (workspace === null || location === undefined) throw new Error('invalid-workspace-candidate');
  return { ok: true, workspace, location };
}

function defaultCreateId(): string {
  return globalThis.crypto.randomUUID();
}
