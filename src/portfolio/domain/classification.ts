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

export function stableShareUnits(value: Pick<PortfolioPlan, 'items' | 'cashShareUnits'>): number {
  return value.items
    .filter((item) => item.classification === 'stable')
    .reduce((sum, item) => sum + item.shareUnits, value.cashShareUnits);
}
