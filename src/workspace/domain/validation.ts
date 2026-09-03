import type { MainData, SetupStep } from '../../main/domain/model';
import { isMainDataShape, validateMainData, validateMainDraft } from '../../main/domain/validation';
import type { SetupProgress, SetupProgressKind } from '../../main/infrastructure/mainRepository';
import {
  ACCOUNT_MAP_APPLIED_SCHEMA_VERSION,
  SYSTEM_PURPOSE_IDS,
  type AccountMapApplied,
  type AccountMapDraft,
  type CustomPurpose,
  type OutflowPurposeId,
  type PurposeId,
  type PurposeLocationLink,
} from '../../account-map/domain/model';
import {
  institutionComparisonKey,
  normalizeInstitutionText,
} from '../../account-map/domain/institutions';
import { mainPurposeReferences } from '../../account-map/domain/reconciliation';
import type { CompoundSimulationDraft } from '../../simulation/domain/model';
import { parseSimulationDraft } from '../../simulation/domain/validation';
import { scopeKey, type PortfolioDraft, type PortfolioPlan } from '../../portfolio/domain/model';
import { parsePortfolioDraft, parsePortfolioPlan } from '../../portfolio/domain/validation';
import {
  parseFinancialLocation,
  PURPOSE_CAPACITY,
  type FinancialLocation,
  type FinancialRole,
} from './financialLocation';
import {
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceDocument,
} from './model';

const setupSteps = new Set<SetupStep>([
  'welcome',
  'income',
  'housing',
  'living',
  'saving-investment',
  'review',
]);
const systemPurposeIds = new Set<string>(SYSTEM_PURPOSE_IDS);
const outflowPurposeIds = new Set<OutflowPurposeId>([
  'system:housing',
  'system:living',
  'system:saving',
  'system:investing',
]);

export type WorkspaceDocumentValidationResult =
  | { status: 'valid'; workspace: WorkspaceDocument }
  | { status: 'schema' | 'reference' };

export function parseWorkspaceDocument(value: unknown): WorkspaceDocument | null {
  const result = validateWorkspaceDocument(value);
  return result.status === 'valid' ? result.workspace : null;
}

export function validateWorkspaceDocument(value: unknown): WorkspaceDocumentValidationResult {
  const workspace = parseWorkspaceShape(value);
  if (workspace === null) return { status: 'schema' };
  if (!validateWorkspaceReferences(workspace)) return { status: 'reference' };
  return { status: 'valid', workspace };
}

function parseWorkspaceShape(value: unknown): WorkspaceDocument | null {
  if (!hasExactKeys(value, [
    'schemaVersion',
    'revision',
    'updatedAt',
    'main',
    'simulation',
    'portfolio',
    'locations',
    'accountMap',
  ])
    || value.schemaVersion !== WORKSPACE_SCHEMA_VERSION
    || !isNonnegativeSafeInteger(value.revision)
    || !isTimestamp(value.updatedAt)) return null;

  const main = parseMainSlice(value.main);
  const simulation = parseSimulationSlice(value.simulation);
  const portfolio = parsePortfolioSlice(value.portfolio);
  const locations = parseArray(value.locations, parseFinancialLocation);
  const accountMap = parseAccountMapSlice(value.accountMap);
  if (main === null
    || simulation === null
    || portfolio === null
    || locations === null
    || accountMap === null) return null;

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision: value.revision,
    updatedAt: value.updatedAt,
    main,
    simulation,
    portfolio,
    locations,
    accountMap,
  };
}

function parseMainSlice(value: unknown): WorkspaceDocument['main'] | null {
  if (!hasExactKeys(value, ['applied', 'setupProgress'])) return null;
  const applied = value.applied === null ? null : parseAppliedMain(value.applied);
  const setupProgress = value.setupProgress === null ? null : parseSetupProgress(value.setupProgress);
  if ((value.applied !== null && applied === null)
    || (value.setupProgress !== null && setupProgress === null)) return null;
  return { applied, setupProgress };
}

function parseAppliedMain(value: unknown): MainData | null {
  if (!hasOnlyStringOwnKeys(value)
    || !isMainDataShape(value)
    || !validateMainData(value).valid) return null;
  return { ...value };
}

function parseSetupProgress(value: unknown): SetupProgress | null {
  if (!hasExactKeys(value, ['kind', 'step', 'draft', 'savedAt'])
    || !isSetupProgressKind(value.kind)
    || typeof value.step !== 'string'
    || !setupSteps.has(value.step as SetupStep)
    || !hasOnlyStringOwnKeys(value.draft)
    || !isMainDataShape(value.draft)
    || !validateMainDraft(value.draft).valid
    || !isTimestamp(value.savedAt)) return null;
  return {
    kind: value.kind,
    step: value.step as SetupStep,
    draft: { ...value.draft },
    savedAt: value.savedAt,
  };
}

function parseSimulationSlice(value: unknown): WorkspaceDocument['simulation'] | null {
  if (!hasExactKeys(value, ['draft'])) return null;
  if (value.draft === null) return { draft: null };
  const draft = parseSimulationDraft(value.draft);
  return draft === null ? null : { draft };
}

function parsePortfolioSlice(value: unknown): WorkspaceDocument['portfolio'] | null {
  if (!hasExactKeys(value, ['plans', 'draft'])) return null;
  const plans = parseArray(value.plans, parsePortfolioPlan);
  const draft = value.draft === null ? null : parsePortfolioDraft(value.draft);
  if (plans === null || (value.draft !== null && draft === null)) return null;
  return { plans, draft };
}

function parseAccountMapSlice(value: unknown): WorkspaceDocument['accountMap'] | null {
  if (!hasExactKeys(value, ['applied', 'draft'])) return null;
  const applied = value.applied === null ? null : parseAccountMapApplied(value.applied);
  const draft = value.draft === null ? null : parseAccountMapDraft(value.draft);
  if ((value.applied !== null && applied === null)
    || (value.draft !== null && draft === null)) return null;
  return { applied, draft };
}

function parseAccountMapApplied(value: unknown): AccountMapApplied | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links',
    'setupCompletedAt', 'updatedAt',
  ])
    || value.schemaVersion !== ACCOUNT_MAP_APPLIED_SCHEMA_VERSION
    || !isTimestamp(value.sourceMainUpdatedAt)
    || !isTimestamp(value.setupCompletedAt)
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(value.customPurposes, value.links);
  return common === null ? null : {
    schemaVersion: ACCOUNT_MAP_APPLIED_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

function parseAccountMapDraft(value: unknown): AccountMapDraft | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'step', 'updatedAt',
  ])
    || value.schemaVersion !== 1
    || !isTimestamp(value.sourceMainUpdatedAt)
    || (value.step !== 'connect' && value.step !== 'review')
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(value.customPurposes, value.links);
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
): Pick<AccountMapApplied, 'customPurposes' | 'links'> | null {
  const customPurposes = parseArray(customValue, parseCustomPurpose);
  const links = parseArray(linkValue, parsePurposeLink);
  return customPurposes === null || links === null ? null : { customPurposes, links };
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

function validateWorkspaceReferences(workspace: WorkspaceDocument): boolean {
  return hasUniqueIds(workspace.locations)
    && hasUniqueActiveLocationNames(workspace.locations)
    && withinLocationCapacities(workspace.locations)
    && hasUniquePortfolioScopes(workspace.portfolio.plans)
    && validatePurposeState(workspace.accountMap.applied, workspace)
    && validatePurposeState(workspace.accountMap.draft, workspace);
}

function validatePurposeState(
  state: AccountMapApplied | AccountMapDraft | null,
  workspace: WorkspaceDocument,
): boolean {
  if (state === null) return true;
  const main = workspace.main.applied;
  if (main === null
    || state.sourceMainUpdatedAt > main.updatedAt
    || !hasUniqueIds(state.customPurposes)
    || !hasUniqueIds(state.links)) return false;

  const pairKeys = state.links.map((link) => `${link.purposeId}\u0000${link.locationId}`);
  if (new Set(pairKeys).size !== pairKeys.length) return false;

  const activeCustom = state.customPurposes.filter(({ archivedAt }) => archivedAt === undefined);
  for (const parentId of outflowPurposeIds) {
    const children = activeCustom.filter((purpose) => purpose.parentId === parentId);
    const target = children.reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0);
    const names = children.map(({ name }) => normalizeName(name).toLocaleLowerCase('en-US'));
    if (children.length > 10
      || !Number.isSafeInteger(target)
      || new Set(names).size !== names.length) return false;
  }
  if (state.sourceMainUpdatedAt === main.updatedAt && !customTargetsWithinMain(state, main)) {
    return false;
  }

  const purposeIds = new Set<string>([
    ...SYSTEM_PURPOSE_IDS,
    ...state.customPurposes.map(({ id }) => id),
  ]);
  const locationById = new Map(workspace.locations.map((location) => [location.id, location]));
  for (const link of state.links) {
    if (!purposeIds.has(link.purposeId)) return false;
    const location = locationById.get(link.locationId);
    const custom = state.customPurposes.find(({ id }) => id === link.purposeId);
    if (location === undefined) return false;
    if (link.status === 'active') {
      if (location.archivedAt !== undefined || custom?.archivedAt !== undefined) return false;
      if (!location.roles.includes(requiredRole(link.purposeId, state.customPurposes))) return false;
    }
  }
  for (const purposeId of purposeIds) {
    const active = state.links.filter((link) => (
      link.purposeId === purposeId && link.status === 'active'
    ));
    if (active.length > 10 || active.filter(({ remainder }) => remainder).length > 1) return false;
  }
  return true;
}

function customTargetsWithinMain(
  state: Pick<AccountMapApplied, 'customPurposes'>,
  main: MainData,
): boolean {
  const references = mainPurposeReferences(main);
  return [...outflowPurposeIds].every((parentId) => state.customPurposes
    .filter((purpose) => purpose.parentId === parentId && purpose.archivedAt === undefined)
    .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0) <= references[parentId]);
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

function hasUniquePortfolioScopes(plans: PortfolioPlan[]): boolean {
  const scopeKeys = plans.map(({ scope }) => scopeKey(scope));
  return new Set(scopeKeys).size === scopeKeys.length;
}

function hasUniqueActiveLocationNames(locations: FinancialLocation[]): boolean {
  const names = locations
    .filter((location) => location.archivedAt === undefined)
    .map((location) => (
      `${institutionComparisonKey(location)}\u0000${normalizeInstitutionText(location.shortName)}`
    ));
  return new Set(names).size === names.length;
}

function withinLocationCapacities(locations: FinancialLocation[]): boolean {
  const activeLocations = locations.filter((location) => location.archivedAt === undefined);
  return (Object.keys(PURPOSE_CAPACITY) as FinancialRole[]).every((role) => (
    activeLocations.filter((location) => location.roles.includes(role)).length <= PURPOSE_CAPACITY[role]
  ));
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parser);
  return parsed.some((item) => item === null) ? null : parsed as T[];
}

function hasUniqueIds(values: { id: string }[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

function isPurposeId(value: string): value is PurposeId {
  return systemPurposeIds.has(value) || (value.startsWith('custom:') && value.length > 7);
}

function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  const expected = new Set<string>(keys);
  return actual.length === expected.size
    && actual.every((key) => typeof key === 'string' && expected.has(key));
}

function hasOnlyStringOwnKeys(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && Reflect.ownKeys(value).every((key) => typeof key === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSetupProgressKind(value: unknown): value is SetupProgressKind {
  return value === 'initial' || value === 'restart';
}

function isTimestamp(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= 8_640_000_000_000_000;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
