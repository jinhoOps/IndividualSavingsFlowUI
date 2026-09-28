import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {appPath, type JourneyApp} from '../journey/routes';
import type {SupabaseConfig} from './config';
export {readSupabaseConfig, type SupabaseConfig} from './config';

export const RETURN_PATH_KEY = 'isf-auth-return-path';
export function authCallbackUrl(origin: string, base: string): string {
  return `${origin}${appPath('main', base).replace('apps/main/', 'apps/auth/callback/')}`;
}
export function safeReturnPath(path: string | null, base: string): string {
  const paths = (['main', 'simulation', 'portfolio', 'lounge'] as JourneyApp[]).map(app => appPath(app, base));
  if (!path || !path.startsWith('/') || path.startsWith('//')) return paths[0];
  const url = new URL(path, 'https://isf.invalid');
  const normalized = url.pathname.replace(/index\.html$/, '');
  if (url.origin !== 'https://isf.invalid' || !paths.includes(normalized)) return paths[0];
  const key = normalized === appPath('lounge', base) ? 'post' : normalized === appPath('portfolio', base) ? 'publication' : null;
  const id = key ? url.searchParams.get(key) : null;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!key || !id || !uuid.test(id))return normalized;
  const params=new URLSearchParams({[key]:id});
  const comment=key==='post'?url.searchParams.get('comment'):null;
  if(comment && uuid.test(comment))params.set('comment',comment);
  return `${normalized}?${params}`;
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
