import type { Classification, PortfolioPlan } from './model';

export function normalizePortfolioName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function recommendClassification(name: string): Classification {
  const normalized = normalizePortfolioName(name);
  const explicitGold = /금현물|금선물|골드/.test(normalized);
  const boundaryGold = /(^|[\s_\-/])(금|gold)(?=$|[\s_\-/])/.test(normalized);
  const bond = /채권|국채|회사채|(^|[\s_\-/])bond(?=$|[\s_\-/])/.test(normalized);
  return explicitGold || boundaryGold || bond ? 'stable' : 'growth';
}

const assetClasses = [
  { id: 'equity', label: '주식', color: '#587bb6' },
  { id: 'spot', label: '현물', color: '#cc9027' },
  { id: 'bond', label: '채권', color: '#247f79' },
  { id: 'cash', label: '현금', color: '#8dbab4' },
  { id: 'other', label: '기타', color: '#7f6856' },
] as const;

type AssetClass = typeof assetClasses[number]['id'];

/** Name-based display grouping only; never rewrites the saved risk classification. */
export function assetClassForName(name: string): AssetClass {
  const normalized = normalizePortfolioName(name);
  // ponytail: use the app's sample/quick-name vocabulary; unknown products stay Other
  // until there is an explicit asset catalogue or a persisted user-selected asset class.
  if (/혼합|혼성|mixed|multi.asset|선물|인버스|futures?|inverse|광산|채굴|mining/.test(normalized)) return 'other';
  const matches: AssetClass[] = [];
  if (/채권|국채|회사채|\bbonds?\b/.test(normalized)) matches.push('bond');
  if (/^(현금|cash)$/.test(normalized)) return 'cash';
  if (/비트코인|금\s*현물|골드|\b(btc|bitcoin|gold)\b|(^|[\s(])금($|[\s)])/.test(normalized)) matches.push('spot');
  if (/주식|인덱스|나스닥|코스피|코스닥|\b(schd|jepq|voo|qqqm|qqq|qld|s&p\s*500|nasdaq|kospi|kosdaq|stocks?|equity)\b/.test(normalized)) matches.push('equity');
  return matches.length === 1 ? matches[0] : 'other';
}

export function assetClassAllocation(value: Pick<PortfolioPlan, 'items' | 'cashShareUnits'>) {
  const totals: Record<AssetClass, number> = { equity: 0, spot: 0, bond: 0, cash: value.cashShareUnits, other: 0 };
  for (const item of value.items) totals[assetClassForName(item.name)] += item.shareUnits;
  return assetClasses.map(group => ({ ...group, percentage: totals[group.id] / 10_000 }))
    .filter(group => group.percentage > 0);
}
