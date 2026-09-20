import { describe, expect, it } from 'vitest';
import {
  parsePortfolioSampleIntent,
  portfolioSampleHref,
} from '../../../src/journey/portfolioSampleIntent';

describe('portfolio sample intent', () => {
  it('creates a portfolio destination for each supported simulation preset', () => {
    expect(portfolioSampleHref(5, '/IndividualSavingsFlowUI/'))
      .toBe('/IndividualSavingsFlowUI/apps/portfolio/?samplePreset=5');
    expect(portfolioSampleHref(13, '/'))
      .toBe('/apps/portfolio/?samplePreset=13');
  });

  it('parses one exact preset and the all-samples fallback', () => {
    expect(parsePortfolioSampleIntent('?samplePreset=9')).toEqual({ preset: 9 });
    expect(parsePortfolioSampleIntent('?samples=all')).toEqual({ preset: null });
    expect(parsePortfolioSampleIntent('')).toBeNull();
    expect(parsePortfolioSampleIntent('?samplePreset=8')).toBeNull();
    expect(parsePortfolioSampleIntent('?samplePreset=5&samplePreset=9')).toBeNull();
  });
});
