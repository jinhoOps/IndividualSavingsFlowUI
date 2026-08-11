import { normalizePortfolioName } from './allocation';
import {
  PORTFOLIO_SCHEMA_VERSION,
  SHARE_SCALE,
  type CashMode,
  type Classification,
  type ClassificationOrigin,
  type InputMode,
  type PortfolioDraft,
  type PortfolioItem,
  type PortfolioPlan,
  type PortfolioScope,
} from './model';

export function parsePortfolioPlan(value: unknown): PortfolioPlan | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'scope', 'items', 'cashShareUnits', 'cashMode',
    'syncedInvestmentWon', 'appliedAt', 'updatedAt',
  ])) return null;
  const common = parseV2Common(value);
  if (common === null || !isTimestamp(value.appliedAt)) return null;
  if (sumShares(common.items, common.cashShareUnits) !== SHARE_SCALE) return null;
  return { ...common, appliedAt: value.appliedAt };
}

export function parsePortfolioDraft(value: unknown): PortfolioDraft | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'scope', 'items', 'cashShareUnits', 'cashMode', 'inputMode',
    'syncedInvestmentWon', 'updatedAt', 'isApplicable',
  ])) return null;
  const common = parseV2Common(value);
  if (common === null || !isInputMode(value.inputMode)) return null;
  const total = sumShares(common.items, common.cashShareUnits);
  if (total > SHARE_SCALE || (common.cashMode === 'automatic' && total !== SHARE_SCALE)) return null;
  const isApplicable = common.syncedInvestmentWon > 0 && total === SHARE_SCALE;
  if (typeof value.isApplicable !== 'boolean' || value.isApplicable !== isApplicable) return null;
  return {
    ...common,
    inputMode: value.inputMode,
    isApplicable,
  };
}

export function validateApplicableDraft(draft: PortfolioDraft): boolean {
  return parsePortfolioDraft(draft)?.isApplicable === true;
}

function parseV2Common(value: Record<string, unknown>): Omit<PortfolioPlan, 'appliedAt'> | null {
  const scope = parseScope(value.scope);
  if (value.schemaVersion !== PORTFOLIO_SCHEMA_VERSION
    || scope === null
    || !Array.isArray(value.items)
    || value.items.length > 10
    || !isCashMode(value.cashMode)
    || !isShare(value.cashShareUnits)
    || !isNonnegativeSafeInteger(value.syncedInvestmentWon)
    || !isTimestamp(value.updatedAt)) return null;
  const items = value.items.map(parseItem);
  if (items.some((item) => item === null)) return null;
  const validItems = items as PortfolioItem[];
  const ids = new Set(validItems.map((item) => item.id));
  const names = new Set(validItems.map((item) => normalizePortfolioName(item.name)));
  const orders = validItems.map((item) => item.order).sort((a, b) => a - b);
  if (ids.size !== validItems.length
    || names.size !== validItems.length
    || orders.some((order, index) => order !== index)) return null;
  return {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    scope,
    items: validItems,
    cashShareUnits: value.cashShareUnits,
    cashMode: value.cashMode,
    syncedInvestmentWon: value.syncedInvestmentWon,
    updatedAt: value.updatedAt,
  };
}

function parseScope(value: unknown): PortfolioScope | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'aggregate' && hasExactKeys(value, ['type'])) {
    return { type: 'aggregate' };
  }
  if (value.type === 'location'
    && hasExactKeys(value, ['type', 'locationId'])
    && typeof value.locationId === 'string'
    && value.locationId.length > 0) {
    return { type: 'location', locationId: value.locationId };
  }
  return null;
}

function parseItem(value: unknown): PortfolioItem | null {
  if (!isRecord(value)
    || !hasExactKeys(value, ['id', 'name', 'shareUnits', 'order', 'classification', 'classificationOrigin'])
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.name !== 'string'
    || normalizePortfolioName(value.name).length === 0
    || !isShare(value.shareUnits)
    || !isNonnegativeSafeInteger(value.order)
    || !isClassification(value.classification)
    || !isClassificationOrigin(value.classificationOrigin)) return null;
  return {
    id: value.id,
    name: value.name,
    shareUnits: value.shareUnits,
    order: value.order,
    classification: value.classification,
    classificationOrigin: value.classificationOrigin,
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Reflect.ownKeys(value);
  const expected = new Set(keys);
  return actual.length === expected.size
    && actual.every((key) => typeof key === 'string' && expected.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCashMode(value: unknown): value is CashMode {
  return value === 'automatic' || value === 'manual';
}

function isInputMode(value: unknown): value is InputMode {
  return value === 'amount' || value === 'percentage';
}

function isClassification(value: unknown): value is Classification {
  return value === 'growth' || value === 'stable';
}

function isClassificationOrigin(value: unknown): value is ClassificationOrigin {
  return value === 'automatic' || value === 'user';
}

function isShare(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= SHARE_SCALE;
}

function isTimestamp(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= 8_640_000_000_000_000;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function sumShares(items: PortfolioItem[], cash: number): number {
  return items.reduce((total, item) => total + item.shareUnits, cash);
}
