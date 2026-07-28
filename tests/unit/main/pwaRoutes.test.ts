import { describe, expect, it } from 'vitest';
import { createMpaNavigationCaching } from '../../../src/main/infrastructure/pwaRoutes';

describe('createMpaNavigationCaching', () => {
  it('keeps every app navigation on its own cached HTML route', () => {
    const config = createMpaNavigationCaching('/IndividualSavingsFlowUI/');
    const route = config.runtimeCaching[0];

    expect(config.navigateFallback).toBeNull();
    expect(route.handler).toBe('NetworkFirst');
    expect(route.urlPattern).toBeInstanceOf(RegExp);
    for (const path of ['main', 'simulation', 'portfolio', 'account-map']) {
      expect(route.urlPattern.test(`https://example.com/IndividualSavingsFlowUI/apps/${path}/`)).toBe(true);
      expect(route.urlPattern.test(`https://example.com/IndividualSavingsFlowUI/apps/${path}/index.html`)).toBe(true);
    }
    expect(route.urlPattern.test('https://example.com/IndividualSavingsFlowUI/')).toBe(false);
    expect(route.urlPattern.test('https://example.com/IndividualSavingsFlowUI/assets/main.js')).toBe(false);
  });
});
