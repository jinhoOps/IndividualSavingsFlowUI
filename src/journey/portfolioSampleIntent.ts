import { appPath } from './routes';

export const PORTFOLIO_SAMPLE_PRESETS = [5, 9, 13] as const;
export type PortfolioSamplePreset = typeof PORTFOLIO_SAMPLE_PRESETS[number];

export interface PortfolioSampleIntent {
  preset: PortfolioSamplePreset | null;
}

export function portfolioSampleHref(rate: number, base?: string): string {
  const params = new URLSearchParams();
  if (isPortfolioSamplePreset(rate)) params.set('samplePreset', String(rate));
  else params.set('samples', 'all');
  return `${appPath('portfolio', base)}?${params.toString()}`;
}

export function parsePortfolioSampleIntent(search: string): PortfolioSampleIntent | null {
  const params = new URLSearchParams(search);
  const presetValues = params.getAll('samplePreset');
  const sampleValues = params.getAll('samples');
  if (presetValues.length === 0 && sampleValues.length === 0) return null;
  if (presetValues.length > 0 && sampleValues.length > 0) return null;
  if (presetValues.length === 1) {
    const preset = Number(presetValues[0]);
    return isPortfolioSamplePreset(preset) ? { preset } : null;
  }
  return sampleValues.length === 1 && sampleValues[0] === 'all' ? { preset: null } : null;
}

export function isPortfolioSamplePreset(value: number): value is PortfolioSamplePreset {
  return PORTFOLIO_SAMPLE_PRESETS.includes(value as PortfolioSamplePreset);
}
