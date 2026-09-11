const LOGIN_LOADING_KEY = 'isf-login-loading-once';
const MAX_AGE_MS = 60_000;

/** OAuth crosses a document boundary; retain only a short-lived visual intent. */
export function markLoginLoading(): void {
  try { window.sessionStorage.setItem(LOGIN_LOADING_KEY, String(Date.now())); } catch { /* Static loading remains usable. */ }
}

export function consumeLoginLoading(): boolean {
  try {
    const value = window.sessionStorage.getItem(LOGIN_LOADING_KEY);
    window.sessionStorage.removeItem(LOGIN_LOADING_KEY);
    const age = Date.now() - Number(value);
    return value !== null && Number.isFinite(age) && age >= 0 && age < MAX_AGE_MS;
  } catch { return false; }
}

const APP_ENTRY_KEY = 'isf-brand-entry-tab';
const entryDecisions = new Map<string, boolean>();

/** One landing per claimed browser/PWA tab, including StrictMode and reloads. */
export function shouldShowAppEntry(tabId: string): boolean {
  const decided = entryDecisions.get(tabId);
  if (decided !== undefined) return decided;
  let show = true;
  try {
    show = window.sessionStorage.getItem(APP_ENTRY_KEY) !== tabId;
    window.sessionStorage.setItem(APP_ENTRY_KEY, tabId);
  } catch {
    // When storage is blocked, an internal same-origin referrer avoids repeated branding.
    try { show = new URL(document.referrer).origin !== location.origin; } catch { /* External entry. */ }
  }
  // The OAuth callback continues the existing launch; it is not a second landing.
  if (consumeLoginLoading()) show = false;
  entryDecisions.set(tabId, show);
  return show;
}
