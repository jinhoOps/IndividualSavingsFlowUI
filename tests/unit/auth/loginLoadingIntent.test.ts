import {afterEach, describe, expect, it, vi} from 'vitest';
import {consumeLoginLoading, markLoginLoading} from '../../../src/auth/loginLoadingIntent';
afterEach(() => {sessionStorage.clear(); vi.restoreAllMocks();});
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
