export function resultCardShareUrl(origin: string, base: string, token: string): string {
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  return new URL(`${normalizedBase}apps/share/#${encodeURIComponent(token)}`, origin).toString();
}
