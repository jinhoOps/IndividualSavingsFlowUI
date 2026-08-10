import { describe, expect, it } from 'vitest';
import {
  countDisplayCharacters,
  normalizeLocationName,
  parseFinancialLocation,
  PURPOSE_CAPACITY,
} from '../../../src/workspace/domain/financialLocation';

const validLocation = {
  id: 'location-1',
  shortName: '토스 ISA',
  institution: { id: 'toss', name: '토스뱅크' },
  kind: 'brokerage',
  roles: ['saving', 'investing'],
  createdAt: 100,
  updatedAt: 200,
};

describe('Financial location domain', () => {
  it('normalizes names for duplicate comparison without changing display semantics', () => {
    expect(normalizeLocationName('  토스   ISA  ')).toBe('토스 isa');
    expect(normalizeLocationName('ISA')).toBe(normalizeLocationName('isa'));
  });

  it('counts Unicode code points rather than UTF-16 code units', () => {
    expect(countDisplayCharacters('해외직투')).toBe(4);
  });

  it('defines the capacity for every financial purpose', () => {
    expect(PURPOSE_CAPACITY).toEqual({ income: 10, spending: 10, saving: 10, investing: 10 });
  });

  it.each(['ISA', '토스 ISA', '12345678'])('parses an allowed short name: %s', (shortName) => {
    expect(parseFinancialLocation({ ...validLocation, shortName })).toEqual({
      ...validLocation,
      shortName,
    });
  });

  it('trims and collapses display whitespace while retaining casing', () => {
    expect(parseFinancialLocation({ ...validLocation, shortName: '  Toss   ISA  ' }))
      .toMatchObject({ shortName: 'Toss ISA' });
  });

  it.each(['토스!', '은행🙂', '東京', 'A_1'])('rejects unsupported display characters: %s', (shortName) => {
    expect(parseFinancialLocation({ ...validLocation, shortName })).toBeNull();
  });

  it.each([
    ['empty name', { shortName: '   ' }],
    ['nine-code-point name', { shortName: '123456789' }],
    ['duplicate role', { roles: ['saving', 'saving'] }],
    ['unknown kind', { kind: 'card' }],
    ['unknown role', { roles: ['retirement'] }],
    ['negative timestamp', { createdAt: -1 }],
    ['extra location key', { extra: true }],
  ])('rejects a location with %s', (_description, changes) => {
    expect(parseFinancialLocation({ ...validLocation, ...changes })).toBeNull();
  });

  it('accepts only exact optional institution shapes', () => {
    expect(parseFinancialLocation({ ...validLocation, institution: { name: '토스뱅크' } }))
      .toMatchObject({ institution: { name: '토스뱅크' } });
    expect(parseFinancialLocation(validLocation)).toMatchObject({
      institution: { id: 'toss', name: '토스뱅크' },
    });
    expect(parseFinancialLocation({ ...validLocation, institution: { id: 'toss' } })).toBeNull();
    expect(parseFinancialLocation({ ...validLocation, institution: { name: '토스뱅크', code: '092' } }))
      .toBeNull();
  });

  it('does not materialize an inherited institution id', () => {
    const institution = Object.create({ id: 'inherited-id' }) as { name: string };
    institution.name = '토스뱅크';

    expect(parseFinancialLocation({ ...validLocation, institution })).toEqual({
      ...validLocation,
      institution: { name: '토스뱅크' },
    });
  });

  it('accepts an optional non-negative safe archived timestamp only', () => {
    expect(parseFinancialLocation({ ...validLocation, archivedAt: 300 }))
      .toMatchObject({ archivedAt: 300 });
    expect(parseFinancialLocation({ ...validLocation, archivedAt: -1 })).toBeNull();
    expect(parseFinancialLocation({ ...validLocation, archivedAt: Number.MAX_SAFE_INTEGER + 1 }))
      .toBeNull();
  });

  it('rejects optional keys that are present without valid values', () => {
    expect(parseFinancialLocation({ ...validLocation, institution: undefined })).toBeNull();
    expect(parseFinancialLocation({ ...validLocation, archivedAt: undefined })).toBeNull();
  });

  it('rejects non-string extra own keys', () => {
    const extraKey = Symbol('extra');
    expect(parseFinancialLocation({ ...validLocation, [extraKey]: true })).toBeNull();
  });

  it('returns independent arrays and institution objects', () => {
    const parsed = parseFinancialLocation(validLocation);

    expect(parsed).not.toBeNull();
    expect(parsed?.roles).not.toBe(validLocation.roles);
    expect(parsed?.institution).not.toBe(validLocation.institution);
  });
});
