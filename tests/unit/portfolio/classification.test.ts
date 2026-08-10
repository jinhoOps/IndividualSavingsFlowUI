import { describe, expect, it } from 'vitest';
import {
  recommendClassification,
  stableShareUnits,
} from '../../../src/portfolio/domain/classification';

const item = (classification: 'growth' | 'stable', shareUnits: number) => ({
  id: `${classification}-${shareUnits}`,
  name: classification,
  shareUnits,
  order: 0,
  classification,
  classificationOrigin: 'automatic' as const,
});

describe('Portfolio classification', () => {
  it.each([
    ['금현물', 'stable'], ['KODEX 골드 ETF', 'stable'], ['미국 국채 ETF', 'stable'],
    ['KODEX 금선물 ETF', 'stable'], ['회사채', 'stable'], ['global bond', 'stable'], ['ETF', 'growth'],
    ['금융주 ETF', 'growth'], ['예금 대안', 'growth'], ['', 'growth'],
  ] as const)('recommends %s as %s', (name, expected) => {
    expect(recommendClassification(name)).toBe(expected);
  });

  it.each([
    'KODEX골드선물(H)',
    'KODEX금현물',
    'TIGER금선물',
  ])('recognizes an embedded explicit gold product token in %s', (name) => {
    expect(recommendClassification(name)).toBe('stable');
  });

  it('adds stable items and cash using integer share units', () => {
    expect(stableShareUnits({
      items: [item('growth', 500_000), item('stable', 250_000)],
      cashShareUnits: 250_000,
    })).toBe(500_000);
  });
});
