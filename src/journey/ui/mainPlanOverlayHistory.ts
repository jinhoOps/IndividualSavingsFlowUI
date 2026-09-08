export interface MainPlanOverlayHistoryState {
  isfOverlay: 'main-plan';
  token: string;
}

export function isMainPlanOverlayHistoryState(value: unknown): value is MainPlanOverlayHistoryState {
  return typeof value === 'object'
    && value !== null
    && (value as Record<string, unknown>).isfOverlay === 'main-plan'
    && typeof (value as Record<string, unknown>).token === 'string';
}

export function mainPlanOverlayHistoryToken(value: unknown): string | null {
  return isMainPlanOverlayHistoryState(value) ? value.token : null;
}

/** Pushes at most one same-URL marker for an active Main editor overlay. */
export function ensureMainPlanOverlayHistoryMarker(token = createHistoryToken()): string {
  const existing = mainPlanOverlayHistoryToken(window.history.state);
  if (existing !== null) return existing;
  const base = isPlainRecord(window.history.state) ? window.history.state : {};
  window.history.pushState({ ...base, isfOverlay: 'main-plan', token }, '', sameUrl());
  return token;
}

export function hasCurrentMainPlanOverlayMarker(token: string): boolean {
  return mainPlanOverlayHistoryToken(window.history.state) === token;
}

function createHistoryToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `main-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
