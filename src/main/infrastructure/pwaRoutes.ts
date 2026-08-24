export interface MpaNavigationCaching {
  navigateFallback: null;
  runtimeCaching: Array<{
    urlPattern: RegExp;
    handler: 'NetworkFirst';
    options: {
      cacheName: string;
      networkTimeoutSeconds: number;
      expiration: {
        maxEntries: number;
        maxAgeSeconds: number;
      };
    };
  }>;
}

export function createMpaNavigationCaching(
  base: string,
  cacheVersion: string,
): MpaNavigationCaching {
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, '')}/`;
  const escapedBase = normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return {
    navigateFallback: null,
    runtimeCaching: [{
      urlPattern: new RegExp(
        `^https?://[^/]+${escapedBase}apps/(?:main|simulation|portfolio|account-map)/(?:index\\.html)?(?:[?#].*)?$`,
      ),
      handler: 'NetworkFirst',
      options: {
        cacheName: `isf-app-navigation-${cacheVersion}`,
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 8,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    }],
  };
}
