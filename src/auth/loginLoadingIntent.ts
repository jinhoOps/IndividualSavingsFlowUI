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
