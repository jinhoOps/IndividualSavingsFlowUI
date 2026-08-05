export const PORTFOLIO_SCHEMA_VERSION = 1 as const;
export const SHARE_SCALE = 1_000_000 as const;

export type CashMode = 'automatic' | 'manual';
export type InputMode = 'amount' | 'percentage';

export interface PortfolioItem {
  id: string;
  name: string;
  shareUnits: number;
  order: number;
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

export interface PortfolioItemIdentity {
  id: string;
  name: string;
  order: number;
}
