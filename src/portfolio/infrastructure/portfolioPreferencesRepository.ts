import {
  DEFAULT_PORTFOLIO_VIEW_PREFERENCES,
  type PortfolioViewPreferences,
} from '../domain/model';
import type { PortfolioWriteResult } from './portfolioRepository';

export const PORTFOLIO_VIEW_PREFERENCES_KEY = 'isf-portfolio-view-preferences-v1';

export interface PortfolioPreferencesRepository {
  load(): PortfolioViewPreferences;
  save(value: PortfolioViewPreferences): PortfolioWriteResult;
}

export class BrowserPortfolioPreferencesRepository implements PortfolioPreferencesRepository {
  constructor(private readonly getStorage: () => Storage = () => window.localStorage) {}

  load(): PortfolioViewPreferences {
    try {
      const raw = this.getStorage().getItem(PORTFOLIO_VIEW_PREFERENCES_KEY);
      if (raw === null) return DEFAULT_PORTFOLIO_VIEW_PREFERENCES;
      const preferences = parsePreferences(JSON.parse(raw));
      return preferences ?? DEFAULT_PORTFOLIO_VIEW_PREFERENCES;
    } catch {
      return DEFAULT_PORTFOLIO_VIEW_PREFERENCES;
    }
  }

  save(value: PortfolioViewPreferences): PortfolioWriteResult {
    try {
      this.getStorage().setItem(PORTFOLIO_VIEW_PREFERENCES_KEY, JSON.stringify(value));
      return { status: 'saved' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function parsePreferences(value: unknown): PortfolioViewPreferences | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'showAmounts' || keys[1] !== 'sortMode') return null;
  if (typeof record.showAmounts !== 'boolean') return null;
  if (record.sortMode !== 'ratio' && record.sortMode !== 'input') return null;
  return { showAmounts: record.showAmounts, sortMode: record.sortMode };
}
