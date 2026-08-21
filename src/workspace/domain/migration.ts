import {
  SYSTEM_PURPOSE_IDS,
  type AccountMapApplied,
  type AccountMapDraft,
  type CustomPurpose,
  type OutflowPurposeId,
  type PurposeId,
  type PurposeLocationLink,
} from '../../account-map/domain/model';
import { mainPurposeReferences } from '../../account-map/domain/reconciliation';
import type { SimulationDraftMigration } from '../../simulation/domain/model';
import { parseStoredSimulationDraft } from '../../simulation/domain/validation';
import {
  parseConsumerInstrument,
  parseMonthlyFlow,
  type ConsumerInstrument,
  type FlowEndpoint,
  type MonthlyFlow,
} from './accountMapContract';
import type { FinancialLocation, FinancialRole } from './financialLocation';
import type { WorkspaceDocumentV1, WorkspaceDocumentV2 } from './model';
import { parseWorkspaceDocumentV1 } from './validation';

export type VersionedWorkspaceParse =
  | {
    version: 1;
    workspace: WorkspaceDocumentV1;
    simulationMigration: SimulationDraftMigration | null;
  }
  | {
    version: 2;
    workspace: WorkspaceDocumentV2;
    simulationMigration: SimulationDraftMigration | null;
  };

const maximumTimestamp = 8_640_000_000_000_000;
const systemPurposeIds = new Set<string>(SYSTEM_PURPOSE_IDS);
const outflowPurposeIds = new Set<OutflowPurposeId>([
  'system:housing',
  'system:living',
  'system:saving',
  'system:investing',
]);

export function migrateWorkspaceV1(
  legacy: WorkspaceDocumentV1,
  now: number,
): WorkspaceDocumentV2 {
  if (!isTimestamp(now)) throw new Error('workspace-migration-timestamp');
  return {
    schemaVersion: 2,
    revision: legacy.revision,
    updatedAt: now,
    main: structuredClone(legacy.main),
    simulation: structuredClone(legacy.simulation),
    portfolio: structuredClone(legacy.portfolio),
    locations: structuredClone(legacy.locations),
    accountMap: {
      applied: null,
      draft: null,
      legacyPhaseA: {
        instruments: structuredClone(legacy.accountMap.instruments),
        flows: structuredClone(legacy.accountMap.flows),
      },
    },
  };
}

export function parseWorkspaceDocumentVersioned(value: unknown): VersionedWorkspaceParse | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion === 1) {
    const parsed = parseLegacyWorkspace(value);
    return parsed === null ? null : { version: 1, ...parsed };
  }
  if (value.schemaVersion === 2) {
    const parsed = parseCurrentWorkspace(value);
    return parsed === null ? null : { version: 2, ...parsed };
  }
  return null;
}

function parseLegacyWorkspace(value: Record<string, unknown>): {
  workspace: WorkspaceDocumentV1;
  simulationMigration: SimulationDraftMigration | null;
} | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'revision', 'updatedAt', 'main', 'simulation',
    'portfolio', 'locations', 'accountMap',
  ]) || !isRecord(value.accountMap)
    || !hasExactKeys(value.accountMap, ['applied', 'draft', 'instruments', 'flows'])
    || value.accountMap.applied !== null
    || value.accountMap.draft !== null) return null;

  const instruments = parseArray(value.accountMap.instruments, parseConsumerInstrument);
  const flows = parseArray(value.accountMap.flows, parseMonthlyFlow);
  if (instruments === null || flows === null) return null;

  const shared = parseWorkspaceDocumentV1({
    ...value,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  });
  if (shared === null || !validLegacyReferences(instruments, flows, shared.locations)) return null;
  const preserved = structuredClone(value) as unknown as WorkspaceDocumentV1;
  return {
    workspace: {
      ...preserved,
      simulation: shared.simulation,
      accountMap: { applied: null, draft: null, instruments, flows },
    },
    simulationMigration: parseSimulationMigration(value.simulation),
  };
}

function parseCurrentWorkspace(value: Record<string, unknown>): {
  workspace: WorkspaceDocumentV2;
  simulationMigration: SimulationDraftMigration | null;
} | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'revision', 'updatedAt', 'main', 'simulation',
    'portfolio', 'locations', 'accountMap',
  ]) || !isRecord(value.accountMap)
    || !hasExactKeys(value.accountMap, ['applied', 'draft', 'legacyPhaseA'])
    || !isRecord(value.accountMap.legacyPhaseA)
    || !hasExactKeys(value.accountMap.legacyPhaseA, ['instruments', 'flows'])) return null;

  const instruments = parseArray(
    value.accountMap.legacyPhaseA.instruments,
    parseConsumerInstrument,
  );
  const flows = parseArray(value.accountMap.legacyPhaseA.flows, parseMonthlyFlow);
  if (instruments === null || flows === null) return null;

  const shared = parseWorkspaceDocumentV1({
    ...value,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  });
  if (shared === null || !validLegacyReferences(instruments, flows, shared.locations)) return null;

  const applied = value.accountMap.applied === null
    ? null
    : parseApplied(value.accountMap.applied, shared.locations, shared.main.applied);
  const draft = value.accountMap.draft === null
    ? null
    : parseDraft(value.accountMap.draft, shared.locations, shared.main.applied);
  if ((value.accountMap.applied !== null && applied === null)
    || (value.accountMap.draft !== null && draft === null)) return null;

  const preserved = structuredClone(value) as unknown as WorkspaceDocumentV2;
  return {
    workspace: {
      schemaVersion: 2,
      revision: preserved.revision,
      updatedAt: preserved.updatedAt,
      main: preserved.main,
      simulation: shared.simulation,
      portfolio: preserved.portfolio,
      locations: preserved.locations,
      accountMap: { applied, draft, legacyPhaseA: { instruments, flows } },
    },
    simulationMigration: parseSimulationMigration(value.simulation),
  };
}

function parseSimulationMigration(value: unknown): SimulationDraftMigration | null {
  if (!isRecord(value) || value.draft === null) return null;
  return parseStoredSimulationDraft(value.draft)?.migration ?? null;
}

function parseApplied(
  value: unknown,
  locations: FinancialLocation[],
  main: WorkspaceDocumentV1['main']['applied'],
): AccountMapApplied | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links',
    'layout', 'setupCompletedAt', 'updatedAt',
  ]) || value.schemaVersion !== 1
    || main === null
    || !isTimestamp(value.sourceMainUpdatedAt)
    || (value.layout !== 'purpose' && value.layout !== 'account')
    || !isTimestamp(value.setupCompletedAt)
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(
    value.customPurposes,
    value.links,
    value.sourceMainUpdatedAt,
    locations,
    main,
  );
  return common === null ? null : {
    schemaVersion: 1,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    layout: value.layout,
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

function parseDraft(
  value: unknown,
  locations: FinancialLocation[],
  main: WorkspaceDocumentV1['main']['applied'],
): AccountMapDraft | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'step', 'updatedAt',
  ]) || value.schemaVersion !== 1
    || main === null
    || !isTimestamp(value.sourceMainUpdatedAt)
    || (value.step !== 'connect' && value.step !== 'review')
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(
    value.customPurposes,
    value.links,
    value.sourceMainUpdatedAt,
    locations,
    main,
  );
  return common === null ? null : {
    schemaVersion: 1,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    step: value.step,
    updatedAt: value.updatedAt,
  };
}

function parsePurposeState(
  customValue: unknown,
  linkValue: unknown,
  sourceMainUpdatedAt: number,
  locations: FinancialLocation[],
  main: NonNullable<WorkspaceDocumentV1['main']['applied']>,
): Pick<AccountMapApplied, 'customPurposes' | 'links'> | null {
  if (sourceMainUpdatedAt > main.updatedAt) return null;
  const customPurposes = parseArray(customValue, parseCustomPurpose);
  const links = parseArray(linkValue, parsePurposeLink);
  if (customPurposes === null || links === null
    || !hasUniqueIds(customPurposes)
    || !hasUniqueIds(links)
    || !validPurposeState(customPurposes, links, locations)
    || (sourceMainUpdatedAt === main.updatedAt
      && !customTargetsWithinMainCapacity(customPurposes, main))) return null;
  return { customPurposes, links };
}

function customTargetsWithinMainCapacity(
  customPurposes: CustomPurpose[],
  main: NonNullable<WorkspaceDocumentV1['main']['applied']>,
): boolean {
  const references = mainPurposeReferences(main);
  return [...outflowPurposeIds].every((parentId) => customPurposes
    .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
    .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0) <= references[parentId]);
}

function parseCustomPurpose(value: unknown): CustomPurpose | null {
  const hasArchivedAt = isRecord(value) && Object.hasOwn(value, 'archivedAt');
  const keys = hasArchivedAt
    ? ['id', 'parentId', 'name', 'targetMonthlyWon', 'archivedAt', 'createdAt', 'updatedAt'] as const
    : ['id', 'parentId', 'name', 'targetMonthlyWon', 'createdAt', 'updatedAt'] as const;
  if (!hasExactKeys(value, keys)
    || typeof value.id !== 'string'
    || !value.id.startsWith('custom:')
    || value.id.length === 'custom:'.length
    || typeof value.parentId !== 'string'
    || !outflowPurposeIds.has(value.parentId as OutflowPurposeId)
    || typeof value.name !== 'string'
    || normalizeName(value.name).length < 1
    || Array.from(normalizeName(value.name)).length > 24
    || !isNonnegativeSafeInteger(value.targetMonthlyWon)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || (hasArchivedAt && !isTimestamp(value.archivedAt))) return null;
  return {
    id: value.id as CustomPurpose['id'],
    parentId: value.parentId as OutflowPurposeId,
    name: normalizeName(value.name),
    targetMonthlyWon: value.targetMonthlyWon,
    ...(hasArchivedAt ? { archivedAt: value.archivedAt as number } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parsePurposeLink(value: unknown): PurposeLocationLink | null {
  const active = hasExactKeys(value, [
    'id', 'purposeId', 'locationId', 'monthlyAmountWon', 'remainder',
    'status', 'createdAt', 'updatedAt',
  ]);
  const suspended = hasExactKeys(value, [
    'id', 'purposeId', 'locationId', 'monthlyAmountWon', 'remainder',
    'status', 'suspendedReason', 'createdAt', 'updatedAt',
  ]);
  if ((!active && !suspended)
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.purposeId !== 'string' || !isPurposeId(value.purposeId)
    || typeof value.locationId !== 'string' || value.locationId.length === 0
    || !isNonnegativeSafeInteger(value.monthlyAmountWon)
    || typeof value.remainder !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) return null;
  if (active && value.status === 'active') {
    return {
      id: value.id,
      purposeId: value.purposeId,
      locationId: value.locationId,
      monthlyAmountWon: value.monthlyAmountWon,
      remainder: value.remainder,
      status: 'active',
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }
  if (suspended && value.status === 'suspended'
    && value.remainder === false
    && (value.suspendedReason === 'location-archived' || value.suspendedReason === 'user')) {
    return {
      id: value.id,
      purposeId: value.purposeId,
      locationId: value.locationId,
      monthlyAmountWon: value.monthlyAmountWon,
      remainder: false,
      status: 'suspended',
      suspendedReason: value.suspendedReason,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }
  return null;
}

function validPurposeState(
  customPurposes: CustomPurpose[],
  links: PurposeLocationLink[],
  locations: FinancialLocation[],
): boolean {
  const purposeIds = new Set<string>([...SYSTEM_PURPOSE_IDS, ...customPurposes.map(({ id }) => id)]);
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const pairKeys = links.map((link) => `${link.purposeId}\u0000${link.locationId}`);
  if (new Set(pairKeys).size !== pairKeys.length) return false;

  const activeCustom = customPurposes.filter(({ archivedAt }) => archivedAt === undefined);
  for (const parentId of outflowPurposeIds) {
    const children = activeCustom.filter((purpose) => purpose.parentId === parentId);
    if (children.length > 10) return false;
    const target = children.reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0);
    if (!Number.isSafeInteger(target)) return false;
    const names = children.map(({ name }) => normalizeName(name).toLocaleLowerCase('en-US'));
    if (new Set(names).size !== names.length) return false;
  }

  for (const link of links) {
    if (!purposeIds.has(link.purposeId)) return false;
    const location = locationById.get(link.locationId);
    const custom = customPurposes.find(({ id }) => id === link.purposeId);
    if (location === undefined) return false;
    if (link.status === 'active') {
      if (location.archivedAt !== undefined || custom?.archivedAt !== undefined) return false;
      if (!location.roles.includes(requiredRole(link.purposeId, customPurposes))) return false;
    }
  }

  for (const purposeId of purposeIds) {
    const active = links.filter((link) => link.purposeId === purposeId && link.status === 'active');
    if (active.length > 10 || active.filter(({ remainder }) => remainder).length > 1) return false;
  }
  return true;
}

function requiredRole(purposeId: PurposeId, customPurposes: CustomPurpose[]): FinancialRole {
  const root = systemPurposeIds.has(purposeId)
    ? purposeId as typeof SYSTEM_PURPOSE_IDS[number]
    : customPurposes.find(({ id }) => id === purposeId)?.parentId;
  if (root === 'system:income') return 'income';
  if (root === 'system:saving') return 'saving';
  if (root === 'system:investing') return 'investing';
  return 'spending';
}

function validLegacyReferences(
  instruments: ConsumerInstrument[],
  flows: MonthlyFlow[],
  locations: FinancialLocation[],
): boolean {
  if (!hasUniqueIds(instruments) || !hasUniqueIds(flows)) return false;
  const locationIds = new Set(locations.map(({ id }) => id));
  const instrumentIds = new Set(instruments.map(({ id }) => id));
  if (instruments.some(({ fundingLocationId }) => !locationIds.has(fundingLocationId))) return false;
  return flows.every(({ source, target }) => endpointResolves(source, locationIds, instrumentIds)
    && endpointResolves(target, locationIds, instrumentIds));
}

function endpointResolves(
  endpoint: FlowEndpoint,
  locations: Set<string>,
  instruments: Set<string>,
): boolean {
  return endpoint.type === 'location' ? locations.has(endpoint.id) : instruments.has(endpoint.id);
}

function isPurposeId(value: string): value is PurposeId {
  return systemPurposeIds.has(value) || (value.startsWith('custom:') && value.length > 7);
}

function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parser);
  return parsed.some((item) => item === null) ? null : parsed as T[];
}

function hasUniqueIds(values: { id: string }[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isRecord(value)) return false;
  const expected = new Set<string>(keys);
  const actual = Reflect.ownKeys(value);
  return actual.length === expected.size
    && actual.every((key) => typeof key === 'string' && expected.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= maximumTimestamp;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
