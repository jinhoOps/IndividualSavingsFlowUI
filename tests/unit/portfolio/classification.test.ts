import { describe, expect, it } from 'vitest';
import {
  assetClassAllocation,
  assetClassForName,
  recommendClassification,
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


});


describe('asset-class display grouping', () => {
  it.each([
    ['SCHD', 'equity'], ['JEPQ', 'equity'], ['VOO', 'equity'], ['QQQM', 'equity'], ['QLD', 'equity'],
    ['S&P 500', 'equity'], ['나스닥', 'equity'], ['코스피', 'equity'], ['글로벌 인덱스', 'equity'],
    ['BTC', 'spot'], ['비트코인', 'spot'], ['금(GOLD)', 'spot'], ['금 현물', 'spot'], ['KODEX금현물', 'spot'],
    ['미국 국채', 'bond'], ['미국 주식·채권 혼합', 'other'], ['global bond', 'bond'],
    ['현금', 'cash'], ['알 수 없는 ETF', 'other'], ['예금 대안', 'other'],
    ['BTC / SCHD', 'other'], ['gold stocks', 'other'], ['주식 채권', 'other'], ['금융', 'other'], ['금선물', 'other'], ['BTC futures', 'other'], ['GOLD mining', 'other'],
  ] as const)('groups %s as %s', (name, expected) => {
    expect(assetClassForName(name)).toBe(expected);
  });

  it('adds gold and BTC together without treating their risk tags as asset classes', () => {
    const value = {
      items: [
        { ...item('stable', 250_000), name: 'SCHD' },
        { ...item('growth', 200_000), name: 'BTC' },
        { ...item('stable', 150_000), name: '금' },
        { ...item('growth', 100_000), name: '채권' },
        { ...item('stable', 175_000), name: '내 투자 대상' },
      ], cashShareUnits: 125_000,
    };
    const before = structuredClone(value);
    const groups = assetClassAllocation(value);
    expect(groups.map(({label, percentage}) => [label, percentage])).toEqual([
      ['주식', 25], ['현물', 35], ['채권', 10], ['현금', 12.5], ['기타', 17.5],
    ]);
    expect(groups.reduce((sum, group) => sum + group.percentage, 0)).toBe(100);
    expect(value).toEqual(before);
    expect(assetClassAllocation({items: [], cashShareUnits: 1_000_000}).map(group => group.label)).toEqual(['현금']);
  });
});
