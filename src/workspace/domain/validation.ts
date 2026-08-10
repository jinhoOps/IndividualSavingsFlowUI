import type { MainData, SetupStep } from '../../main/domain/model';
import { isMainDataShape, validateMainData, validateMainDraft } from '../../main/domain/validation';
import type { SetupProgress, SetupProgressKind } from '../../main/infrastructure/mainRepository';
import { scopeKey, type PortfolioDraft, type PortfolioPlan } from '../../portfolio/domain/model';
import { parsePortfolioDraft, parsePortfolioPlan } from '../../portfolio/domain/validation';
import type { CompoundSimulationDraft } from '../../simulation/domain/model';
import { parseSimulationDraft } from '../../simulation/domain/validation';
import {
  parseConsumerInstrument,
  parseMonthlyFlow,
  type ConsumerInstrument,
  type FlowEndpoint,
  type MonthlyFlow,
} from './accountMapContract';
import {
  normalizeLocationName,
  parseFinancialLocation,
  PURPOSE_CAPACITY,
  type FinancialLocation,
  type FinancialRole,
} from './financialLocation';
import { WORKSPACE_SCHEMA_VERSION, type WorkspaceDocument } from './model';

const setupSteps = new Set<SetupStep>([
  'welcome',
  'income',
  'housing',
  'living',
  'saving-investment',
  'review',
]);

export type WorkspaceDocumentValidationResult =
  | { status: 'valid'; workspace: WorkspaceDocument }
  | { status: 'schema' | 'reference' };

export function parseWorkspaceDocument(value: unknown): WorkspaceDocument | null {
  const result = validateWorkspaceDocument(value);
  return result.status === 'valid' ? result.workspace : null;
}

export function validateWorkspaceDocument(value: unknown): WorkspaceDocumentValidationResult {
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
    || !isTimestamp(value.updatedAt)) return { status: 'schema' };

  const main = parseMainSlice(value.main);
  const simulation = parseSimulationSlice(value.simulation);
  const portfolio = parsePortfolioSlice(value.portfolio);
  const locations = parseArray(value.locations, parseFinancialLocation);
  const accountMap = parseAccountMapSlice(value.accountMap);
  if (main === null
    || simulation === null
    || portfolio === null
    || locations === null
    || accountMap === null) return { status: 'schema' };

  const workspace: WorkspaceDocument = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision: value.revision,
    updatedAt: value.updatedAt,
    main,
    simulation,
    portfolio,
    locations,
    accountMap,
  };
  if (accountMap.instruments.length > 0 || accountMap.flows.length > 0) {
    return { status: 'schema' };
  }
  if (!validateWorkspaceCrossReferences(workspace)) return { status: 'reference' };

  return { status: 'valid', workspace };
}

export function validateWorkspaceCrossReferences(workspace: WorkspaceDocument): boolean {
  return hasUniqueIds(workspace.locations)
    && hasUniqueActiveLocationNames(workspace.locations)
    && withinPurposeCapacities(workspace.locations, workspace.accountMap.instruments)
    && hasValidPortfolioReferences(workspace.portfolio, workspace.locations)
    && hasValidAccountMapReferences(
      workspace.accountMap.instruments,
      workspace.accountMap.flows,
      workspace.locations,
    );
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
  if (!hasOnlyStringOwnKeys(value.draft)
    || !isRecord(value.draft)
    || !hasOnlyStringOwnKeys(value.draft.source)) return null;
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
  if (!hasExactKeys(value, ['applied', 'draft', 'instruments', 'flows'])
    || value.applied !== null
    || value.draft !== null) return null;
  const instruments = parseArray(value.instruments, parseConsumerInstrument);
  const flows = parseArray(value.flows, parseMonthlyFlow);
  if (instruments === null || flows === null) return null;
  return { applied: null, draft: null, instruments, flows };
}

function hasValidPortfolioReferences(
  portfolio: { plans: PortfolioPlan[]; draft: PortfolioDraft | null },
  locations: FinancialLocation[],
): boolean {
  const scopeKeys = portfolio.plans.map(({ scope }) => scopeKey(scope));
  if (new Set(scopeKeys).size !== scopeKeys.length) return false;

  const locationIds = new Set(locations.map((location) => location.id));
  return [...portfolio.plans, ...(portfolio.draft === null ? [] : [portfolio.draft])]
    .every(({ scope }) => scope.type === 'aggregate' || locationIds.has(scope.locationId));
}

function hasValidAccountMapReferences(
  instruments: ConsumerInstrument[],
  flows: MonthlyFlow[],
  locations: FinancialLocation[],
): boolean {
  if (!hasUniqueIds(instruments) || !hasUniqueIds(flows)) return false;
  const locationIds = new Set(locations.map((location) => location.id));
  const instrumentIds = new Set(instruments.map((instrument) => instrument.id));
  if (instruments.some((instrument) => !locationIds.has(instrument.fundingLocationId))) return false;
  return flows.every((flow) => endpointResolves(flow.source, locationIds, instrumentIds)
    && endpointResolves(flow.target, locationIds, instrumentIds));
}

function endpointResolves(
  endpoint: FlowEndpoint,
  locationIds: Set<string>,
  instrumentIds: Set<string>,
): boolean {
  return endpoint.type === 'location'
    ? locationIds.has(endpoint.id)
    : instrumentIds.has(endpoint.id);
}

function hasUniqueActiveLocationNames(locations: FinancialLocation[]): boolean {
  const names = locations
    .filter((location) => location.archivedAt === undefined)
    .map((location) => normalizeLocationName(location.shortName));
  return new Set(names).size === names.length;
}

function withinPurposeCapacities(
  locations: FinancialLocation[],
  instruments: ConsumerInstrument[],
): boolean {
  const activeLocations = locations.filter((location) => location.archivedAt === undefined);
  const activeInstrumentCount = instruments
    .filter((instrument) => instrument.archivedAt === undefined).length;
  return (Object.keys(PURPOSE_CAPACITY) as FinancialRole[]).every((role) => {
    const locationCount = activeLocations.filter((location) => location.roles.includes(role)).length;
    const count = role === 'spending' ? locationCount + activeInstrumentCount : locationCount;
    return count <= PURPOSE_CAPACITY[role];
  });
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
