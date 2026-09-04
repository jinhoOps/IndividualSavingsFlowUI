import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureMainPlanOverlayHistoryMarker,
  isMainPlanOverlayHistoryState,
  mainPlanOverlayHistoryToken,
} from '../../../src/journey/ui/mainPlanOverlayHistory';

afterEach(() => window.history.replaceState(null, '', '/account-map'));

describe('mainPlanOverlayHistory', () => {
  it('pushes exactly one same-URL namespaced marker and reuses it for repeated opens', () => {
    window.history.replaceState({ from: 'map' }, '', '/account-map?view=flow#current');
    const initialLength = window.history.length;

    const first = ensureMainPlanOverlayHistoryMarker('editor-token');
    const second = ensureMainPlanOverlayHistoryMarker('ignored-token');

    expect(first).toBe('editor-token');
    expect(second).toBe('editor-token');
    expect(window.history.length).toBe(initialLength + 1);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/account-map?view=flow#current');
    expect(isMainPlanOverlayHistoryState(window.history.state)).toBe(true);
    expect(mainPlanOverlayHistoryToken(window.history.state)).toBe('editor-token');
  });
});
