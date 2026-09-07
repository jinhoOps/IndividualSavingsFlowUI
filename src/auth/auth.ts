import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {appPath, type JourneyApp} from '../journey/routes';
import type {SupabaseConfig} from './config';
export {readSupabaseConfig, type SupabaseConfig} from './config';

export const RETURN_PATH_KEY = 'isf-auth-return-path';
export function authCallbackUrl(origin: string, base: string): string {
  return `${origin}${appPath('main', base).replace('apps/main/', 'apps/auth/callback/')}`;
}
export function safeReturnPath(path: string | null, base: string): string {
  const paths = (['main', 'simulation', 'portfolio', 'account-map'] as JourneyApp[]).map(app => appPath(app, base));
  const normalized = path?.replace(/index\.html$/, '');
  return normalized && paths.includes(normalized) ? normalized : paths[0];
}
export async function completeAuthCallback(href: string, scrub: (url: string) => void,
  exchange: (code: string) => Promise<{error: unknown}>): Promise<boolean> {
  const url = new URL(href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  scrub(url.pathname);
  if (!code || error) return false;
  try {return !(await exchange(code)).error;} catch {return false;}
}
let browserClient: SupabaseClient | undefined;
export function getBrowserClient(config: SupabaseConfig): SupabaseClient {
  browserClient ??= createClient(config.url, config.publishableKey, {
    auth: {flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true},
    global: {fetch: (input, init) => fetch(input, {...init, signal: init?.signal ?? AbortSignal.timeout(15000)})},
  });
  return browserClient;
}
