import {
  ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION,
  ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION,
  SYSTEM_PURPOSE_IDS,
  type AccountMapApplied,
  type AccountMapAppliedV3,
  type AccountMapDraft,
  type AccountMapDraftV2,
  type AccountMapSetupStep,
  type AccountTransferLink,
  type CustomPurpose,
  type PurposeLocationLink,
  type StoredAccountMapApplied,
  type StoredAccountMapDraft,
} from './model';
import { validateAccountTransfers } from './accountFlowValidation';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';

const systemPurposeIds = new Set<string>(SYSTEM_PURPOSE_IDS);
const outflowPurposeIds = new Set(['system:housing', 'system:living', 'system:saving', 'system:investing']);

export function parseStoredAccountMapApplied(
  value: unknown,
  locations?: readonly FinancialLocation[],
): StoredAccountMapApplied | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion === 2) return parseAppliedV2(value);
  if (value.schemaVersion === 3) return parseAppliedV3(value, locations);
  return null;
}

export function parseStoredAccountMapDraft(
  value: unknown,
  locations?: readonly FinancialLocation[],
): StoredAccountMapDraft | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion === 1) return parseDraftV1(value);
  if (value.schemaVersion === 2) return parseDraftV2(value, locations);
  return null;
}

export function projectAccountMapAppliedForView(value: StoredAccountMapApplied): AccountMapAppliedV3 {
  if (value.schemaVersion === 3) return cloneAppliedV3(value);
  return {
    schemaVersion: ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    transfers: [],
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

export function projectAccountMapDraftForView(value: StoredAccountMapDraft): AccountMapDraftV2 {
  if (value.schemaVersion === 2) return cloneDraftV2(value);
  return {
    schemaVersion: ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    transfers: [],
    step: value.step === 'review' ? 'review' : 'locations',
    updatedAt: value.updatedAt,
  };
}

export function upgradeAccountMapAppliedForTransferSave(
  value: AccountMapApplied,
  transfers: readonly AccountTransferLink[],
): AccountMapAppliedV3 {
  return {
    schemaVersion: ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    transfers: transfers.map((transfer) => structuredClone(transfer)),
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

export function upgradeAccountMapDraftForTransferSave(
  value: AccountMapDraft,
  transfers: readonly AccountTransferLink[],
  step: AccountMapSetupStep = value.step === 'review' ? 'review' : 'locations',
): AccountMapDraftV2 {
  return {
    schemaVersion: ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    customPurposes: structuredClone(value.customPurposes),
    links: structuredClone(value.links),
    transfers: transfers.map((transfer) => structuredClone(transfer)),
    step,
    updatedAt: value.updatedAt,
  };
}

function parseAppliedV2(value: Record<string, unknown>): AccountMapApplied | null {
  if (!hasExactKeys(value, ['schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'setupCompletedAt', 'updatedAt'])
    || !isTimestamp(value.sourceMainUpdatedAt)
    || !isTimestamp(value.setupCompletedAt)
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(value.customPurposes, value.links);
  return common === null ? null : {
    schemaVersion: 2,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

function parseAppliedV3(value: Record<string, unknown>, locations?: readonly FinancialLocation[]): AccountMapAppliedV3 | null {
  if (!hasExactKeys(value, ['schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'transfers', 'setupCompletedAt', 'updatedAt'])
    || !isTimestamp(value.sourceMainUpdatedAt)
    || !isTimestamp(value.setupCompletedAt)
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(value.customPurposes, value.links);
  const transfers = parseTransfers(value.transfers, locations);
  return common === null || transfers === null ? null : {
    schemaVersion: ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    transfers,
    setupCompletedAt: value.setupCompletedAt,
    updatedAt: value.updatedAt,
  };
}

function parseDraftV1(value: Record<string, unknown>): AccountMapDraft | null {
  if (!hasExactKeys(value, ['schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'step', 'updatedAt'])
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

function parseDraftV2(value: Record<string, unknown>, locations?: readonly FinancialLocation[]): AccountMapDraftV2 | null {
  if (!hasExactKeys(value, ['schemaVersion', 'sourceMainUpdatedAt', 'customPurposes', 'links', 'transfers', 'step', 'updatedAt'])
    || !isTimestamp(value.sourceMainUpdatedAt)
    || !isAccountMapSetupStep(value.step)
    || !isTimestamp(value.updatedAt)) return null;
  const common = parsePurposeState(value.customPurposes, value.links);
  const transfers = parseTransfers(value.transfers, locations);
  return common === null || transfers === null ? null : {
    schemaVersion: ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION,
    sourceMainUpdatedAt: value.sourceMainUpdatedAt,
    ...common,
    transfers,
    step: value.step,
    updatedAt: value.updatedAt,
  };
}

function parsePurposeState(customValue: unknown, linkValue: unknown): { customPurposes: CustomPurpose[]; links: PurposeLocationLink[] } | null {
  if (!Array.isArray(customValue) || !Array.isArray(linkValue)) return null;
  const customPurposes = customValue.map(parseCustomPurpose);
  const links = linkValue.map(parsePurposeLink);
  if (customPurposes.some((item) => item === null) || links.some((item) => item === null)) return null;
  const parsedPurposes = customPurposes as CustomPurpose[];
  const parsedLinks = links as PurposeLocationLink[];
  if (!uniqueIds(parsedPurposes) || !uniqueIds(parsedLinks)) return null;
  const purposeIds = new Set([...systemPurposeIds, ...parsedPurposes.map(({ id }) => id)]);
  if (parsedLinks.some(({ purposeId }) => !purposeIds.has(purposeId))) return null;
  const pairs = parsedLinks.map(({ purposeId, locationId }) => `${purposeId}\u0000${locationId}`);
  return new Set(pairs).size === pairs.length ? { customPurposes: parsedPurposes, links: parsedLinks } : null;
}

function parseTransfers(value: unknown, locations?: readonly FinancialLocation[]): AccountTransferLink[] | null {
  if (!Array.isArray(value)) return null;
  const transfers = value.map(parseTransfer);
  if (transfers.some((item) => item === null)) return null;
  const parsed = transfers as AccountTransferLink[];
  if (locations !== undefined && !validateAccountTransfers(parsed, locations).valid) return null;
  const structural = validateAccountTransfers(parsed, locations ?? parsedLocations(parsed));
  return structural.valid ? parsed : null;
}

function parsedLocations(transfers: readonly AccountTransferLink[]): FinancialLocation[] {
  const ids = new Set(transfers.flatMap(({ sourceLocationId, targetLocationId }) => [sourceLocationId, targetLocationId]));
  return [...ids].map((id) => ({ id, shortName: id, kind: 'cash', roles: ['spending'], createdAt: 0, updatedAt: 0 }));
}

function parseTransfer(value: unknown): AccountTransferLink | null {
  if (!isRecord(value)) return null;
  const active = hasExactKeys(value, ['id', 'sourceLocationId', 'targetLocationId', 'allocation', 'status', 'createdAt', 'updatedAt']);
  const suspended = hasExactKeys(value, ['id', 'sourceLocationId', 'targetLocationId', 'allocation', 'status', 'suspendedReason', 'createdAt', 'updatedAt']);
  if ((!active && !suspended)
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.sourceLocationId !== 'string' || value.sourceLocationId.length === 0
    || typeof value.targetLocationId !== 'string' || value.targetLocationId.length === 0
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return null;
  const allocation = parseAllocation(value.allocation);
  if (allocation === null) return null;
  if (active && value.status === 'active') {
    return { id: value.id, sourceLocationId: value.sourceLocationId, targetLocationId: value.targetLocationId, allocation, status: 'active', createdAt: value.createdAt, updatedAt: value.updatedAt };
  }
  if (suspended && value.status === 'suspended'
    && (value.suspendedReason === 'location-archived' || value.suspendedReason === 'user')) {
    return { id: value.id, sourceLocationId: value.sourceLocationId, targetLocationId: value.targetLocationId, allocation, status: 'suspended', suspendedReason: value.suspendedReason, createdAt: value.createdAt, updatedAt: value.updatedAt };
  }
  return null;
}

function parseAllocation(value: unknown): AccountTransferLink['allocation'] | null {
  if (!isRecord(value)) return null;
  if (hasExactKeys(value, ['kind']) && value.kind === 'sweep') return { kind: 'sweep' };
  if (hasExactKeys(value, ['kind', 'monthlyAmountWon']) && value.kind === 'fixed'
    && isNonnegativeSafeInteger(value.monthlyAmountWon)) {
    return { kind: 'fixed', monthlyAmountWon: value.monthlyAmountWon };
  }
  return null;
}

function parseCustomPurpose(value: unknown): CustomPurpose | null {
  if (!isRecord(value)) return null;
  const archived = Object.hasOwn(value, 'archivedAt');
  const keys = archived
    ? ['id', 'parentId', 'name', 'targetMonthlyWon', 'archivedAt', 'createdAt', 'updatedAt']
    : ['id', 'parentId', 'name', 'targetMonthlyWon', 'createdAt', 'updatedAt'];
  if (!hasExactKeys(value, keys)
    || typeof value.id !== 'string' || !value.id.startsWith('custom:') || value.id.length <= 7
    || typeof value.parentId !== 'string' || !outflowPurposeIds.has(value.parentId)
    || typeof value.name !== 'string' || normalizeName(value.name).length === 0
    || Array.from(normalizeName(value.name)).length > 24
    || !isNonnegativeSafeInteger(value.targetMonthlyWon)
    || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)
    || (archived && !isTimestamp(value.archivedAt))) return null;
  return {
    id: value.id as CustomPurpose['id'], parentId: value.parentId as CustomPurpose['parentId'],
    name: normalizeName(value.name), targetMonthlyWon: value.targetMonthlyWon,
    ...(archived ? { archivedAt: value.archivedAt as number } : {}),
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  };
}

function parsePurposeLink(value: unknown): PurposeLocationLink | null {
  if (!isRecord(value)) return null;
  const active = hasExactKeys(value, ['id', 'purposeId', 'locationId', 'monthlyAmountWon', 'remainder', 'status', 'createdAt', 'updatedAt']);
  const suspended = hasExactKeys(value, ['id', 'purposeId', 'locationId', 'monthlyAmountWon', 'remainder', 'status', 'suspendedReason', 'createdAt', 'updatedAt']);
  if ((!active && !suspended)
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.purposeId !== 'string' || !isPurposeId(value.purposeId)
    || typeof value.locationId !== 'string' || value.locationId.length === 0
    || !isNonnegativeSafeInteger(value.monthlyAmountWon)
    || typeof value.remainder !== 'boolean' || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return null;
  if (active && value.status === 'active') return { id: value.id, purposeId: value.purposeId as PurposeLocationLink['purposeId'], locationId: value.locationId, monthlyAmountWon: value.monthlyAmountWon, remainder: value.remainder, status: 'active', createdAt: value.createdAt, updatedAt: value.updatedAt };
  if (suspended && value.status === 'suspended' && value.remainder === false && (value.suspendedReason === 'location-archived' || value.suspendedReason === 'user')) return { id: value.id, purposeId: value.purposeId as PurposeLocationLink['purposeId'], locationId: value.locationId, monthlyAmountWon: value.monthlyAmountWon, remainder: false, status: 'suspended', suspendedReason: value.suspendedReason, createdAt: value.createdAt, updatedAt: value.updatedAt };
  return null;
}

function cloneAppliedV3(value: AccountMapAppliedV3): AccountMapAppliedV3 { return structuredClone(value); }
function cloneDraftV2(value: AccountMapDraftV2): AccountMapDraftV2 { return structuredClone(value); }
function uniqueIds(values: readonly { id: string }[]): boolean { return new Set(values.map(({ id }) => id)).size === values.length; }
function isPurposeId(value: string): boolean { return systemPurposeIds.has(value) || value.startsWith('custom:'); }
function isAccountMapSetupStep(value: unknown): value is AccountMapSetupStep { return value === 'basis' || value === 'locations' || value === 'transfers' || value === 'review'; }
function isTimestamp(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 8_640_000_000_000_000; }
function isNonnegativeSafeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function normalizeName(value: string): string { return value.trim().replace(/\s+/gu, ' '); }
function hasExactKeys<const Keys extends readonly string[]>(value: unknown, keys: Keys): value is Record<Keys[number], unknown> {
  if (!isRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  const expected = new Set(keys);
  return actual.length === expected.size && actual.every((key) => typeof key === 'string' && expected.has(key));
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
