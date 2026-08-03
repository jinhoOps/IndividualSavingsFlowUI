export const MAIN_STORAGE_KEY = 'isf-main-v2';
const mainKeys = new Set([
  'schemaVersion', 'updatedAt', 'monthlyNetIncomeWon', 'monthlyHousingWon',
  'monthlyLivingWon', 'monthlySavingWon', 'monthlyInvestmentWon',
]);

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
      if (!isCurrentMainData(value)) return { status: 'invalid' };
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

interface CurrentMainProjectionSource {
  schemaVersion: 2;
  updatedAt: number;
  monthlyNetIncomeWon: number;
  monthlyHousingWon: number;
  monthlyLivingWon: number;
  monthlySavingWon: number;
  monthlyInvestmentWon: number;
}

function isCurrentMainData(value: unknown): value is CurrentMainProjectionSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === mainKeys.size
    && Object.keys(record).every((key) => mainKeys.has(key))
    && record.schemaVersion === 2
    && ['updatedAt', 'monthlyNetIncomeWon', 'monthlyHousingWon', 'monthlyLivingWon', 'monthlySavingWon', 'monthlyInvestmentWon']
      .every((key) => typeof record[key] === 'number' && Number.isSafeInteger(record[key]) && record[key] >= 0);
}
