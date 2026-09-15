export function createAppPaths(baseUrl: string) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return {
    main: `${base}apps/main/`,
    simulation: `${base}apps/simulation/`,
    portfolio: `${base}apps/portfolio/`,
  } as const;
}

export function mainHref(path = ''): string {
  const route = createAppPaths(import.meta.env.BASE_URL).main;
  return `${route}${path.replace(/^\/+/, '')}`;
}
