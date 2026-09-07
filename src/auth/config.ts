export interface SupabaseConfig {url: string; publishableKey: string; projectRef: string}
export function readSupabaseConfig(env: Record<string, unknown>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error('계정 저장 연결 설정이 필요합니다.');
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('계정 저장 주소가 올바르지 않습니다.');
  }
  return {url: parsed.origin, publishableKey, projectRef: parsed.hostname};
}
