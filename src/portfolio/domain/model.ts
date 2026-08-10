export const PORTFOLIO_SCHEMA_VERSION = 2 as const;
export const SHARE_SCALE = 1_000_000 as const;

export type CashMode = 'automatic' | 'manual';
export type InputMode = 'amount' | 'percentage';
export type Classification = 'growth' | 'stable';
export type ClassificationOrigin = 'automatic' | 'user';
export type PortfolioSortMode = 'ratio' | 'input';

export interface PortfolioViewPreferences {
  showAmounts: boolean;
  sortMode: PortfolioSortMode;
}

export const DEFAULT_PORTFOLIO_VIEW_PREFERENCES = {
  showAmounts: false,
  sortMode: 'ratio',
} as const satisfies PortfolioViewPreferences;

export interface PortfolioItem {
  id: string;
  name: string;
  shareUnits: number;
  order: number;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
}

export interface PortfolioDraft {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  items: PortfolioItem[];
  cashShareUnits: number;
  cashMode: CashMode;
  inputMode: InputMode;
  syncedInvestmentWon: number;
  updatedAt: number;
  isApplicable: boolean;
}

export interface PortfolioPlan {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  items: PortfolioItem[];
  cashShareUnits: number;
  cashMode: CashMode;
  syncedInvestmentWon: number;
  appliedAt: number;
  updatedAt: number;
}

export interface MaterializedItem extends PortfolioItem {
  amountWon: number;
  percentage: number;
}

export interface MaterializedAllocation {
  items: MaterializedItem[];
  cashAmountWon: number;
  cashPercentage: number;
  totalAmountWon: number;
}

export interface AllocationResultItem {
  id: string;
  name: string;
  shareUnits: number;
  order: number;
  isCash: boolean;
}

export interface PortfolioItemIdentity {
  id: string;
  name: string;
  order: number;
}
