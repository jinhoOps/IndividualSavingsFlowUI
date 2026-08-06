export interface ConsumerInstrument {
  id: string;
  shortName: string;
  type: 'credit' | 'debit';
  fundingLocationId: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type FlowEndpoint =
  | { type: 'location'; id: string }
  | { type: 'instrument'; id: string };

export interface MonthlyFlow {
  id: string;
  source: FlowEndpoint;
  target: FlowEndpoint;
  purpose: 'income' | 'spending' | 'saving' | 'investing';
  monthlyAmountWon: number;
  createdAt: number;
  updatedAt: number;
}

const instrumentKeys = [
  'id',
  'shortName',
  'type',
  'fundingLocationId',
  'archivedAt',
  'createdAt',
  'updatedAt',
] as const;
const instrumentKeysWithoutArchivedAt = instrumentKeys.filter((key) => key !== 'archivedAt');

export function parseConsumerInstrument(value: unknown): ConsumerInstrument | null {
  const hasArchivedAt = hasExactKeys(value, instrumentKeys);
  if ((!hasArchivedAt && !hasExactKeys(value, instrumentKeysWithoutArchivedAt))
    || !isNonemptyString(value.id)
    || !isNonemptyString(value.shortName)
    || (value.type !== 'credit' && value.type !== 'debit')
    || !isNonemptyString(value.fundingLocationId)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) return null;

  if (hasArchivedAt && !isTimestamp(value.archivedAt)) return null;

  return {
    id: value.id,
    shortName: value.shortName,
    type: value.type,
    fundingLocationId: value.fundingLocationId,
    ...(hasArchivedAt ? { archivedAt: value.archivedAt as number } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseMonthlyFlow(value: unknown): MonthlyFlow | null {
  if (!hasExactKeys(value, [
    'id',
    'source',
    'target',
    'purpose',
    'monthlyAmountWon',
    'createdAt',
    'updatedAt',
  ])
    || !isNonemptyString(value.id)
    || !isPurpose(value.purpose)
    || !isNonnegativeSafeInteger(value.monthlyAmountWon)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) return null;

  const source = parseFlowEndpoint(value.source);
  const target = parseFlowEndpoint(value.target);
  if (source === null || target === null) return null;

  return {
    id: value.id,
    source,
    target,
    purpose: value.purpose,
    monthlyAmountWon: value.monthlyAmountWon,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseFlowEndpoint(value: unknown): FlowEndpoint | null {
  if (!hasExactKeys(value, ['type', 'id'])
    || (value.type !== 'location' && value.type !== 'instrument')
    || !isNonemptyString(value.id)) return null;
  return { type: value.type, id: value.id };
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

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPurpose(value: unknown): value is MonthlyFlow['purpose'] {
  return value === 'income' || value === 'spending' || value === 'saving' || value === 'investing';
}

function isTimestamp(value: unknown): value is number {
  return isNonnegativeSafeInteger(value) && value <= 8_640_000_000_000_000;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
