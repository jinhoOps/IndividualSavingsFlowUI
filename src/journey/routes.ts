export type JourneyApp = 'main' | 'simulation' | 'portfolio' | 'account-map';

function normalizeBase(base: string): string {
  const path = `/${base.replace(/^\/+|\/+$/g, '')}`;
  return path === '/' ? path : `${path}/`;
}

export function appPath(app: JourneyApp, base = import.meta.env.BASE_URL): string {
  return `${normalizeBase(base)}apps/${app}/`;
}
