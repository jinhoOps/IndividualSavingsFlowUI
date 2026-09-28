import {describe, expect, it} from 'vitest';
import {authCallbackUrl, completeAuthCallback, readSupabaseConfig, safeReturnPath} from '../../../src/auth/auth';
it('keeps a validated community comment target with its post and removes credentials',()=>{
  const post='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',comment='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const base='/IndividualSavingsFlowUI/';
  expect(safeReturnPath(`${base}apps/lounge/?post=${post}&comment=${comment}&access_token=secret#refresh_token=private`,base))
    .toBe(`${base}apps/lounge/?post=${post}&comment=${comment}`);
  expect(safeReturnPath(`${base}apps/lounge/?comment=${comment}`,base)).toBe(`${base}apps/lounge/`);
  expect(safeReturnPath(`${base}apps/portfolio/?comment=${comment}`,base)).toBe(`${base}apps/portfolio/`);
});

describe('static Google auth', () => {
  it('requires public configuration and refuses secret credentials', () => {
    expect(() => readSupabaseConfig({})).toThrow();
    expect(() => readSupabaseConfig({VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_no'})).toThrow();
    expect(readSupabaseConfig({VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public'}).url).toBe('https://example.supabase.co');
  });
  it('builds a callback beneath the static base and allows only product paths', () => {
    expect(authCallbackUrl('https://example.com', '/IndividualSavingsFlowUI/')).toBe('https://example.com/IndividualSavingsFlowUI/apps/auth/callback/');
    expect(safeReturnPath('/IndividualSavingsFlowUI/apps/account-map/', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(safeReturnPath('/IndividualSavingsFlowUI/apps/account-map/index.html', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/main/');
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
