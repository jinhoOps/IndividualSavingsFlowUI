import {safeReturnPath} from './auth';

export function isKakaoBrowser(userAgent: string): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

/** Only the current site's app path and validated post/comment targets leave this browser. */
export function externalBrowserLinks(href: string, base: string): {url: string; kakao: string} | null {
  try {
    const current = new URL(href);
    if (!['https:', 'http:'].includes(current.protocol) || current.username || current.password
      || /\/auth\/callback(?:\/|$)/.test(current.pathname)) return null;
    const url = current.origin + safeReturnPath(current.pathname + current.search, base);
    // Kakao's private scheme is best-effort; keep manual opening/copy available.
    return {url, kakao: `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`};
  } catch {return null;}
}
