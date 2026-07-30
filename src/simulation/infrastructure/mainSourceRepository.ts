import { isMainDataShape } from '../../main/infrastructure/mainRepository';
import type { SimulationMainSource } from '../domain/model';

export const MAIN_STORAGE_KEY = 'isf-main-v2';

export type MainSourceLoadResult =
  | { status: 'found'; source: SimulationMainSource }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface MainSourceRepository {
  load(): MainSourceLoadResult;
}

export class BrowserMainSourceRepository implements MainSourceRepository {
  constructor(
    private readonly getStorage: () => Storage = () => window.localStorage,
  ) {}

  load(): MainSourceLoadResult {
    try {
      const raw = this.getStorage().getItem(MAIN_STORAGE_KEY);
      if (raw === null) return { status: 'empty' };
      const value: unknown = JSON.parse(raw);
      if (!isMainDataShape(value)) return { status: 'invalid' };

      return {
        status: 'found',
        source: {
          monthlySavingsWon: value.monthlySavingWon,
          monthlyInvestmentWon: value.monthlyInvestmentWon,
          mainUpdatedAt: value.updatedAt,
        },
      };
    } catch (error) {
      return error instanceof SyntaxError
        ? { status: 'invalid' }
        : { status: 'unavailable' };
    }
  }
}
