import { isMainDataShape } from '../../main/infrastructure/mainRepository';

export const MAIN_STORAGE_KEY = 'isf-main-v2';

export interface PortfolioMainSource {
  monthlyInvestmentWon: number;
  mainUpdatedAt: number;
}

export type PortfolioMainSourceLoadResult =
  | { status: 'found'; source: PortfolioMainSource }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface PortfolioMainSourceRepository {
  load(): PortfolioMainSourceLoadResult;
}

export class BrowserPortfolioMainSourceRepository implements PortfolioMainSourceRepository {
  constructor(private readonly getStorage: () => Storage = () => window.localStorage) {}

  load(): PortfolioMainSourceLoadResult {
    try {
      const raw = this.getStorage().getItem(MAIN_STORAGE_KEY);
      if (raw === null) return { status: 'empty' };
      const value: unknown = JSON.parse(raw);
      if (!isMainDataShape(value)) return { status: 'invalid' };
      return {
        status: 'found',
        source: {
          monthlyInvestmentWon: value.monthlyInvestmentWon,
          mainUpdatedAt: value.updatedAt,
        },
      };
    } catch (error) {
      return error instanceof SyntaxError ? { status: 'invalid' } : { status: 'unavailable' };
    }
  }
}
