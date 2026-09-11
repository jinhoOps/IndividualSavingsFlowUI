import {afterEach, describe, expect, it, vi} from 'vitest';
import {consumeLoginLoading, markLoginLoading, shouldShowAppEntry} from '../../../src/auth/loginLoadingIntent';
afterEach(() => {sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();});
describe('OAuth loading intent', () => {
  it('is consumed once without storing an account or financial value', () => {
    markLoginLoading();
    expect(consumeLoginLoading()).toBe(true);
    expect(consumeLoginLoading()).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
  it.each(['0', 'bad', String(Date.now() + 120_000)])('ignores expired or malformed %s', value => {
    sessionStorage.setItem('isf-login-loading-once', value);
    expect(consumeLoginLoading()).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
  it('falls back safely when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('blocked');});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {throw new Error('blocked');});
    expect(() => markLoginLoading()).not.toThrow();
    expect(consumeLoginLoading()).toBe(false);
  });
});

describe('application entry policy', () => {
  it('shows only on a new claimed tab and retains the decision across effect replay', () => {
    expect(shouldShowAppEntry('first-tab')).toBe(true);
    expect(shouldShowAppEntry('first-tab')).toBe(true);
    expect(sessionStorage.getItem('isf-brand-entry-tab')).toBe('first-tab');
  });
  it('omits branding in an already entered tab, including reload and internal navigation', () => {
    sessionStorage.setItem('isf-brand-entry-tab', 'entered-tab');
    expect(shouldShowAppEntry('entered-tab')).toBe(false);
  });
  it('shows a landing in a new tab whose storage was cloned from another tab', () => {
    sessionStorage.setItem('isf-brand-entry-tab', 'original-tab');
    expect(shouldShowAppEntry('cloned-new-tab')).toBe(true);
  });
  it('does not treat an OAuth return as another launch', () => {
    markLoginLoading();
    expect(shouldShowAppEntry('oauth-return-tab')).toBe(false);
    expect(sessionStorage.getItem('isf-login-loading-once')).toBeNull();
  });
});

describe('document navigation overrides cache identity', () => {
  it.each(['reload', 'back_forward'])('never replays on %s even without a marker', type => {
    vi.stubGlobal('performance', {getEntriesByType: () => [{type}]});
    expect(shouldShowAppEntry(type + '-rotated-id')).toBe(false);
  });
  it('does not replay on internal navigation when a cache ID changes', () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue(location.origin + '/apps/main/');
    vi.spyOn(history, 'length', 'get').mockReturnValue(2);
    expect(shouldShowAppEntry('internal-rotated-id')).toBe(false);
  });
});
