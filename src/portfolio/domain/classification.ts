import type { Classification, PortfolioPlan } from './model';

export function normalizePortfolioName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function recommendClassification(name: string): Classification {
  const normalized = normalizePortfolioName(name);
  const gold = /(^|[\s_\-/])(금(현물|선물)?|골드|gold)(?=$|[\s_\-/])/.test(normalized);
  const bond = /채권|국채|회사채|(^|[\s_\-/])bond(?=$|[\s_\-/])/.test(normalized);
  return gold || bond ? 'stable' : 'growth';
}

export function stableShareUnits(value: Pick<PortfolioPlan, 'items' | 'cashShareUnits'>): number {
  return value.items
    .filter((item) => item.classification === 'stable')
    .reduce((sum, item) => sum + item.shareUnits, value.cashShareUnits);
}
