import { describe, expect, it } from 'vitest';
import { createMpaNavigationCaching } from '../../../src/main/infrastructure/pwaRoutes';

describe('createMpaNavigationCaching', () => {
  it('keeps every app navigation on its own cached HTML route', () => {
    const config = createMpaNavigationCaching('/IndividualSavingsFlowUI/', '0.11.95');
    const route = config.runtimeCaching[0];

    expect(config.navigateFallback).toBeNull();
    expect(route.handler).toBe('NetworkFirst');
    expect(route.options.cacheName).toBe('isf-app-navigation-0.11.95');
    expect(route.urlPattern).toBeInstanceOf(RegExp);
    const routes = [
      ['apps/main/', true],
      ['apps/main/index.html', true],
      ['apps/simulation/', true],
      ['apps/simulation/index.html', true],
      ['apps/portfolio/', true],
      ['apps/portfolio/index.html', true],
      ['apps/account-map/', true],
      ['apps/account-map/index.html', true],
      ['apps/legacy/', false],
      ['apps/legacy/index.html', false],
      ['', false],
      ['assets/main.js', false],
    ] as const;

    for (const [path, expected] of routes) {
      expect(route.urlPattern.test(`https://example.com/IndividualSavingsFlowUI/${path}`)).toBe(expected);
    }
  });
});
