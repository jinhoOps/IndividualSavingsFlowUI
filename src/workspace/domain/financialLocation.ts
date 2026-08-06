export type FinancialLocationKind = 'bank' | 'brokerage' | 'cash';
export type FinancialRole = 'income' | 'spending' | 'saving' | 'investing';

export interface InstitutionRef {
  id?: string;
  name: string;
}

export interface FinancialLocation {
  id: string;
  shortName: string;
  institution?: InstitutionRef;
  kind: FinancialLocationKind;
  roles: FinancialRole[];
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const PURPOSE_CAPACITY = {
  income: 10,
  spending: 10,
  saving: 10,
  investing: 10,
} as const;

const locationKeys = [
  'id',
  'shortName',
  'institution',
  'kind',
  'roles',
  'archivedAt',
  'createdAt',
  'updatedAt',
] as const;

const locationKeysWithoutInstitution = locationKeys.filter((key) => key !== 'institution');
const locationKeysWithoutArchivedAt = locationKeys.filter((key) => key !== 'archivedAt');
const requiredLocationKeys = locationKeys.filter((key) => key !== 'institution' && key !== 'archivedAt');

const maximumTimestamp = 8_640_000_000_000_000;
const allowedDisplayNameCharacters = /^[\p{Script=Hangul}\p{Script=Latin}0-9 ]+$/u;

export function countDisplayCharacters(value: string): number {
  return Array.from(value).length;
}

export function normalizeLocationName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export function parseFinancialLocation(value: unknown): FinancialLocation | null {
  const hasInstitution = isRecord(value) && hasOwnKey(value, 'institution');
  const hasArchivedAt = isRecord(value) && hasOwnKey(value, 'archivedAt');
  if (!hasLocationKeys(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.shortName !== 'string'
    || !isFinancialLocationKind(value.kind)
    || !Array.isArray(value.roles)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)) return null;

  let archivedAt: number | undefined;
  if (hasArchivedAt) {
    if (!isTimestamp(value.archivedAt)) return null;
    archivedAt = value.archivedAt;
  }

  const shortName = normalizeDisplayName(value.shortName);
  const roles = value.roles.filter(isFinancialRole);
  if (shortName === null
    || countDisplayCharacters(shortName) > 8
    || !allowedDisplayNameCharacters.test(shortName)
    || roles.length === 0
    || roles.length !== value.roles.length
    || new Set(roles).size !== roles.length) return null;

  const institution = hasInstitution ? parseInstitution(value.institution) : undefined;
  if (institution === null) return null;

  return {
    id: value.id,
    shortName,
    ...(institution === undefined ? {} : { institution }),
    kind: value.kind,
    roles: [...roles],
    ...(archivedAt === undefined ? {} : { archivedAt }),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function hasLocationKeys(value: unknown): value is Record<(typeof locationKeys)[number], unknown> {
  return hasExactKeys(value, requiredLocationKeys)
    || hasExactKeys(value, locationKeysWithoutInstitution)
    || hasExactKeys(value, locationKeysWithoutArchivedAt)
    || hasExactKeys(value, locationKeys);
}

function parseInstitution(value: unknown): InstitutionRef | null {
  if (!hasExactKeys(value, ['name']) && !hasExactKeys(value, ['id', 'name'])) return null;
  if (typeof value.name !== 'string') return null;

  const name = normalizeDisplayName(value.name);
  if (name === null) return null;

  if ('id' in value) {
    if (typeof value.id !== 'string' || value.id.length === 0) return null;
    return { id: value.id, name };
  }

  return { name };
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

function hasOwnKey(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeDisplayName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length === 0 ? null : normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFinancialLocationKind(value: unknown): value is FinancialLocationKind {
  return value === 'bank' || value === 'brokerage' || value === 'cash';
}

function isFinancialRole(value: unknown): value is FinancialRole {
  return value === 'income' || value === 'spending' || value === 'saving' || value === 'investing';
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximumTimestamp;
}
