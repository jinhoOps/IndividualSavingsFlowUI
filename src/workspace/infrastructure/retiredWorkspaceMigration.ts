import type { AccountMapApplied } from '../../account-map/domain/model';
import type { PortfolioDraft, PortfolioPlan } from '../../portfolio/domain/model';
import { parsePortfolioDraft, parsePortfolioPlan } from '../../portfolio/domain/validation';
import type { SimulationDraftMigration } from '../../simulation/domain/model';
import { parseStoredSimulationDraft } from '../../simulation/domain/validation';
import {
  parseConsumerInstrument,
  parseMonthlyFlow,
  type ConsumerInstrument,
  type FlowEndpoint,
  type MonthlyFlow,
} from '../domain/accountMapContract';
import {
  parseFinancialLocation,
  type FinancialLocation,
} from '../domain/financialLocation';
import type { WorkspaceDocument } from '../domain/model';
import { parseWorkspaceDocument, validateWorkspaceDocument } from '../domain/validation';

export type RetiredWorkspaceConversionResult =
  | {
      status: 'converted';
      sourceVersion: 1 | 2;
      workspace: WorkspaceDocument;
      simulationMigration: SimulationDraftMigration | null;
    }
  | { status: 'invalid'; reason: 'schema' | 'reference' };

type RetiredPortfolioScope =
  | { type: 'aggregate' }
  | { type: 'location'; locationId: string };
type RetiredPortfolioPlan = Omit<PortfolioPlan, 'scope'> & { scope: RetiredPortfolioScope };
type RetiredPortfolioDraft = Omit<PortfolioDraft, 'scope'> & { scope: RetiredPortfolioScope };

interface RetiredPortfolioSlice {
  plans: RetiredPortfolioPlan[];
  draft: RetiredPortfolioDraft | null;
}

interface ParsedRetiredAccountMap {
  applied: unknown;
  draft: unknown;
  instruments: ConsumerInstrument[];
  flows: MonthlyFlow[];
}

const maximumTimestamp = 8_640_000_000_000_000;

export function convertRetiredWorkspaceDocument(
  value: unknown,
  migratedAt: number,
): RetiredWorkspaceConversionResult {
  if (!isTimestamp(migratedAt)
    || !hasExactKeys(value, [
      'schemaVersion', 'revision', 'updatedAt', 'main', 'simulation',
      'portfolio', 'locations', 'accountMap',
    ])
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || !isNonnegativeSafeInteger(value.revision)
    || !isTimestamp(value.updatedAt)
    || containsFutureTimestamp(value, migratedAt)) {
    return invalid('schema');
  }

  const simulation = parseRetiredSimulationSlice(value.simulation);
  const portfolio = parseRetiredPortfolioSlice(value.portfolio);
  const locations = parseArray(value.locations, parseFinancialLocation);
  const accountMap = value.schemaVersion === 1
    ? parseRetiredAccountMapV1(value.accountMap)
    : parseRetiredAccountMapV2(value.accountMap);
  if (simulation === null || portfolio === null || locations === null || accountMap === null) {
    return invalid('schema');
  }
  if (!hasValidRetiredPortfolioReferences(portfolio, locations)
    || !hasValidPhaseAReferences(accountMap.instruments, accountMap.flows, locations)) {
    return invalid('reference');
  }

  const aggregatePlans = portfolio.plans
    .filter((plan): plan is RetiredPortfolioPlan & { scope: { type: 'aggregate' } } => (
      plan.scope.type === 'aggregate'
    ))
    .map(toCurrentPlan);
  const retiredDraft = portfolio.draft;
  const aggregateDraft = retiredDraft !== null && retiredDraft.scope.type === 'aggregate'
    ? toCurrentDraft(retiredDraft as RetiredPortfolioDraft & { scope: { type: 'aggregate' } })
    : null;
  const candidate = {
    schemaVersion: 3,
    revision: value.revision,
    updatedAt: migratedAt,
    main: value.main,
    simulation: { draft: simulation.draft },
    portfolio: { plans: aggregatePlans, draft: aggregateDraft },
    locations,
    accountMap: value.schemaVersion === 1
      ? { applied: null, draft: null }
      : { applied: accountMap.applied, draft: accountMap.draft },
  };
  const workspace = parseWorkspaceDocument(candidate);
  if (workspace === null) {
    const current = validateWorkspaceDocument(candidate);
    return invalid(current.status === 'reference' ? 'reference' : 'schema');
  }
  return {
    status: 'converted',
    sourceVersion: value.schemaVersion,
    workspace,
    simulationMigration: simulation.migration,
  };
}

function parseRetiredSimulationSlice(value: unknown): {
  draft: WorkspaceDocument['simulation']['draft'];
  migration: SimulationDraftMigration | null;
} | null {
  if (!hasExactKeys(value, ['draft'])) return null;
  if (value.draft === null) return { draft: null, migration: null };
  const parsed = parseStoredSimulationDraft(value.draft);
  return parsed === null ? null : parsed;
}

function parseRetiredPortfolioSlice(value: unknown): RetiredPortfolioSlice | null {
  if (!hasExactKeys(value, ['plans', 'draft'])) return null;
  const plans = parseArray(value.plans, parseRetiredPortfolioPlan);
  const draft = value.draft === null ? null : parseRetiredPortfolioDraft(value.draft);
  if (plans === null || (value.draft !== null && draft === null)) return null;
  return { plans, draft };
}

function parseRetiredPortfolioPlan(value: unknown): RetiredPortfolioPlan | null {
  if (!isRecord(value)) return null;
  const scope = parseRetiredPortfolioScope(value.scope);
  if (scope === null) return null;
  const current = parsePortfolioPlan({ ...value, scope: { type: 'aggregate' } });
  return current === null ? null : { ...current, scope };
}

function parseRetiredPortfolioDraft(value: unknown): RetiredPortfolioDraft | null {
  if (!isRecord(value)) return null;
  const scope = parseRetiredPortfolioScope(value.scope);
  if (scope === null) return null;
  const current = parsePortfolioDraft({ ...value, scope: { type: 'aggregate' } });
  return current === null ? null : { ...current, scope };
}

function parseRetiredPortfolioScope(value: unknown): RetiredPortfolioScope | null {
  if (hasExactKeys(value, ['type']) && value.type === 'aggregate') {
    return { type: 'aggregate' };
  }
  if (hasExactKeys(value, ['type', 'locationId'])
    && value.type === 'location'
    && typeof value.locationId === 'string'
    && value.locationId.length > 0) {
    return { type: 'location', locationId: value.locationId };
  }
  return null;
}

function toCurrentPlan(
  plan: RetiredPortfolioPlan & { scope: { type: 'aggregate' } },
): PortfolioPlan {
  return {
    schemaVersion: plan.schemaVersion,
    scope: { type: 'aggregate' },
    items: plan.items.map((item) => ({ ...item })),
    cashShareUnits: plan.cashShareUnits,
    cashMode: plan.cashMode,
    syncedInvestmentWon: plan.syncedInvestmentWon,
    appliedAt: plan.appliedAt,
    updatedAt: plan.updatedAt,
  };
}

function toCurrentDraft(
  draft: RetiredPortfolioDraft & { scope: { type: 'aggregate' } },
): PortfolioDraft {
  return {
    schemaVersion: draft.schemaVersion,
    scope: { type: 'aggregate' },
    items: draft.items.map((item) => ({ ...item })),
    cashShareUnits: draft.cashShareUnits,
    cashMode: draft.cashMode,
    inputMode: draft.inputMode,
    syncedInvestmentWon: draft.syncedInvestmentWon,
    updatedAt: draft.updatedAt,
    isApplicable: draft.isApplicable,
  };
}

function parseRetiredAccountMapV1(value: unknown): ParsedRetiredAccountMap | null {
  if (!hasExactKeys(value, ['applied', 'draft', 'instruments', 'flows'])
    || value.applied !== null
    || value.draft !== null) return null;
  const phaseA = parsePhaseA(value.instruments, value.flows);
  return phaseA === null ? null : { applied: null, draft: null, ...phaseA };
}

function parseRetiredAccountMapV2(value: unknown): ParsedRetiredAccountMap | null {
  if (!hasExactKeys(value, ['applied', 'draft', 'legacyPhaseA'])
    || !hasExactKeys(value.legacyPhaseA, ['instruments', 'flows'])) return null;
  const phaseA = parsePhaseA(value.legacyPhaseA.instruments, value.legacyPhaseA.flows);
  if (phaseA === null) return null;
  const applied = value.applied === null ? null : convertRetiredApplied(value.applied);
  if (value.applied !== null && applied === null) return null;
  return { applied, draft: value.draft, ...phaseA };
}

function convertRetiredApplied(value: unknown): AccountMapApplied | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links',
    'layout', 'setupCompletedAt', 'updatedAt',
  ])
    || value.schemaVersion !== 1
    || (value.layout !== 'purpose' && value.layout !== 'account')
    || !isTimestamp(value.sourceMainUpdatedAt)
    || !isTimestamp(value.setupCompletedAt)
    || !isTimestamp(value.updatedAt)) return null;
  return {
    schemaVersion: 2,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: value.customPurposes as AccountMapApplied['customPurposes'],
    links: value.links as AccountMapApplied['links'],
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

function parsePhaseA(instrumentValue: unknown, flowValue: unknown): {
  instruments: ConsumerInstrument[];
  flows: MonthlyFlow[];
} | null {
  const instruments = parseArray(instrumentValue, parseConsumerInstrument);
  const flows = parseArray(flowValue, parseMonthlyFlow);
  return instruments === null || flows === null ? null : { instruments, flows };
}

function hasValidRetiredPortfolioReferences(
  portfolio: RetiredPortfolioSlice,
  locations: FinancialLocation[],
): boolean {
  const scopeKeys = portfolio.plans.map(({ scope }) => retiredScopeKey(scope));
  if (new Set(scopeKeys).size !== scopeKeys.length) return false;
  const locationIds = new Set(locations.map(({ id }) => id));
  return [...portfolio.plans, ...(portfolio.draft === null ? [] : [portfolio.draft])]
    .every(({ scope }) => scope.type === 'aggregate' || locationIds.has(scope.locationId));
}

function hasValidPhaseAReferences(
  instruments: ConsumerInstrument[],
  flows: MonthlyFlow[],
  locations: FinancialLocation[],
): boolean {
  if (!hasUniqueIds(instruments) || !hasUniqueIds(flows)) return false;
  const locationIds = new Set(locations.map(({ id }) => id));
  const instrumentIds = new Set(instruments.map(({ id }) => id));
  if (instruments.some(({ fundingLocationId }) => !locationIds.has(fundingLocationId))) return false;
  return flows.every(({ source, target }) => (
    endpointResolves(source, locationIds, instrumentIds)
      && endpointResolves(target, locationIds, instrumentIds)
  ));
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

function retiredScopeKey(scope: RetiredPortfolioScope): string {
  return scope.type === 'aggregate' ? 'aggregate' : `location:${scope.locationId}`;
}

function containsFutureTimestamp(value: unknown, migratedAt: number): boolean {
  const seen = new WeakSet<object>();
  function visit(current: unknown): boolean {
    if (typeof current !== 'object' || current === null) return false;
    if (seen.has(current)) return false;
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') continue;
      const nested = (current as Record<string, unknown>)[key];
      if (key.endsWith('At') && typeof nested === 'number' && nested > migratedAt) return true;
      if (visit(nested)) return true;
    }
    return false;
  }
  return visit(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= maximumTimestamp;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function invalid(reason: 'schema' | 'reference'): RetiredWorkspaceConversionResult {
  return { status: 'invalid', reason };
}
