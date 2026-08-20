import type { FinancialLocation } from '../../workspace/domain/financialLocation';

export const INSTITUTIONS = [
  ['kb-kookmin', 'KB국민은행'],
  ['shinhan', '신한은행'],
  ['hana', '하나은행'],
  ['woori', '우리은행'],
  ['nh-nonghyup', 'NH농협은행'],
  ['ibk', 'IBK기업은행'],
  ['kdb', 'KDB산업은행'],
  ['toss-bank', '토스뱅크'],
  ['kakao-bank', '카카오뱅크'],
] as const;

export type InstitutionId = (typeof INSTITUTIONS)[number][0];

export type LocationDuplicateResult =
  | { kind: 'none' }
  | { kind: 'active'; location: FinancialLocation }
  | { kind: 'archived'; location: FinancialLocation };

export function normalizeInstitutionText(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US');
}

export function institutionComparisonKey(location: FinancialLocation): string {
  const institution = location.institution;
  if (institution === undefined) return 'institution:none';
  if (institution.id?.startsWith('custom:') === true) {
    return `custom-name:${normalizeInstitutionText(institution.name)}`;
  }
  if (institution.id !== undefined) return `institution:${institution.id}`;
  return `custom-name:${normalizeInstitutionText(institution.name)}`;
}

export function findLocationDuplicate(
  locations: readonly FinancialLocation[],
  candidate: FinancialLocation,
): LocationDuplicateResult {
  const institutionKey = institutionComparisonKey(candidate);
  const shortNameKey = normalizeInstitutionText(candidate.shortName);
  const matches = locations.filter((location) => location.id !== candidate.id
    && institutionComparisonKey(location) === institutionKey
    && normalizeInstitutionText(location.shortName) === shortNameKey);
  const active = matches.find((location) => location.archivedAt === undefined);
  if (active !== undefined) return { kind: 'active', location: active };
  const archived = matches.find((location) => location.archivedAt !== undefined);
  return archived === undefined ? { kind: 'none' } : { kind: 'archived', location: archived };
}
