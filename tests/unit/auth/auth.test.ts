import {describe, expect, it} from 'vitest';
import {authCallbackUrl, completeAuthCallback, readSupabaseConfig, safeReturnPath} from '../../../src/auth/auth';

describe('static Google auth', () => {
  it('requires public configuration and refuses secret credentials', () => {
    expect(() => readSupabaseConfig({})).toThrow();
    expect(() => readSupabaseConfig({VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_no'})).toThrow();
    expect(readSupabaseConfig({VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public'}).url).toBe('https://example.supabase.co');
  });
  it('builds a callback beneath the static base and allows only product paths', () => {
    expect(authCallbackUrl('https://example.com', '/IndividualSavingsFlowUI/')).toBe('https://example.com/IndividualSavingsFlowUI/apps/auth/callback/');
    expect(safeReturnPath('//evil.com', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(safeReturnPath('/IndividualSavingsFlowUI/apps/portfolio/', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/portfolio/');
  });
  it('removes credentials from the URL before exchanging the code once', async () => {
    const order: string[] = [];
    const result = await completeAuthCallback('https://example.com/IndividualSavingsFlowUI/apps/auth/callback/?code=one&next=https://evil.com',
      url => {order.push(url);}, async code => {order.push(code); return {error: null};});
    expect(order).toEqual(['/IndividualSavingsFlowUI/apps/auth/callback/', 'one']);
    expect(result).toBe(true);
  });
  it('scrubs provider errors and does not exchange an absent code', async () => {
    const calls: string[] = [];
    expect(await completeAuthCallback('https://example.com/callback/?error=denied&error_description=private',
      value => calls.push(value), async code => {calls.push(code); return {error: null};})).toBe(false);
    expect(calls).toEqual(['/callback/']);
  });
});
