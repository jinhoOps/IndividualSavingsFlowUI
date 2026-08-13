import { describe, expect, it } from 'vitest';
import {
  findLocationDuplicate,
  INSTITUTIONS,
  institutionComparisonKey,
  normalizeInstitutionText,
} from '../../../src/account-map/domain/institutions';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

describe('institution rules', () => {
  it('exposes the approved nine quick institutions', () => {
    expect(INSTITUTIONS).toHaveLength(9);
    expect(INSTITUTIONS.map(([id]) => id)).toEqual([
      'kb-kookmin', 'shinhan', 'hana', 'woori', 'nh-nonghyup',
      'ibk', 'kdb', 'toss-bank', 'kakao-bank',
    ]);
  });

  it('uses canonical, custom-name, and institutionless comparison keys', () => {
    expect(institutionComparisonKey(location('known', '급여', { id: 'shinhan', name: '신한은행' })))
      .toBe('institution:shinhan');
    expect(institutionComparisonKey(location('custom', '생활비', { id: 'custom:uuid', name: '  Acme   BANK  ' })))
      .toBe('custom-name:acme bank');
    expect(institutionComparisonKey(location('cash', '현금'))).toBe('institution:none');
  });

  it('normalizes Unicode NFC, spaces, and Latin case', () => {
    expect(normalizeInstitutionText('  CAFE\u0301   Bank  ')).toBe('café bank');
  });

  it('finds an active duplicate only when institution and short name both match', () => {
    const active = location('active', '생활비', { id: 'hana', name: '하나은행' });
    const locations = [active, location('other', '비상금', { id: 'hana', name: '하나은행' })];

    expect(findLocationDuplicate(locations, location('candidate', '  생활비 ', { id: 'hana', name: '하나' })))
      .toEqual({ kind: 'active', location: active });
    expect(findLocationDuplicate(locations, location('candidate', '생활비', { id: 'woori', name: '우리은행' })))
      .toEqual({ kind: 'none' });
  });

  it('proposes restore instead of creating an archived duplicate', () => {
    const archived = { ...location('old', 'Broker AGE', { id: 'custom:old', name: 'A\u0301CME Bank' }), archivedAt: 10 };

    expect(findLocationDuplicate(
      [archived],
      location('candidate', ' broker   age ', { id: 'custom:new', name: 'Ácme   BANK' }),
    )).toEqual({ kind: 'archived', location: archived });
  });
});

function location(
  id: string,
  shortName: string,
  institution?: FinancialLocation['institution'],
): FinancialLocation {
  return {
    id,
    shortName,
    ...(institution === undefined ? {} : { institution }),
    kind: institution === undefined ? 'cash' : 'bank',
    roles: ['spending'],
    createdAt: 1,
    updatedAt: 1,
  };
}
