const tokenPattern = /^[A-Za-z0-9_-]{32,}$/;

export function sharedResultToken(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : '';
  try {
    const token = decodeURIComponent(raw);
    return tokenPattern.test(token) ? token : null;
  } catch { return null; }
}
