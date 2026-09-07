import type {SupabaseConfig} from './config';

export function accountCachePrefix(config: SupabaseConfig, userId: string): string {
  return `isf-account-workspace-v1:${config.projectRef}:${userId}`;
}
let tabClaim: Promise<string> | undefined;
export function getAccountTabId(): Promise<string> {
  tabClaim ??= claimTabId(storedTabId());
  return tabClaim;
}
function storedTabId(): string {
  try {
    const key = 'isf-account-tab-id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {return crypto.randomUUID();}
}
function claimTabId(id: string): Promise<string> {
  if (!navigator.locks) return Promise.resolve(id);
  return new Promise((resolve, reject) => {
    void navigator.locks.request(`isf-account-tab:${id}`, {ifAvailable: true}, async lock => {
      if (!lock) {
        const fresh = crypto.randomUUID();
        try {window.sessionStorage.setItem('isf-account-tab-id', fresh);} catch { /* Memory-only identity. */ }
        resolve(await claimTabId(fresh));
        return;
      }
      resolve(id);
      await new Promise<void>(release => {
        window.addEventListener('pagehide', () => {tabClaim = undefined; release();}, {once: true});
      });
    }).catch(reject);
  });
}
// A BFCache document may have released its claim while another tab inherited
// the id. Rehydrate under a fresh claim before resuming that old document.
if (typeof window !== 'undefined') window.addEventListener('pageshow', event => {
  if (event.persisted) window.location.reload();
});
export function accountCacheKeys(storage: Storage, prefix: string): string[] {
  return Object.keys(storage).filter(key => key === prefix || key.startsWith(`${prefix}:`));
}
export function hasAccountRecovery(storage: Storage | undefined, prefix: string): boolean {
  if (!storage) return false;
  try {
    return accountCacheKeys(storage, prefix).some(key => {
      const cache = JSON.parse(storage.getItem(key) ?? '{}');
      return cache.pending != null || Object.keys(cache.recoveryDrafts ?? {}).length > 0;
    });
  } catch {return true;}
}
export function accountRecoveryRecords(storage: Storage | undefined, prefix: string): unknown[] {
  if (!storage) return [];
  try {
    return accountCacheKeys(storage, prefix).flatMap<unknown>(key => {
      const raw = storage.getItem(key);
      try {
        const cache = JSON.parse(raw ?? '{}');
        return cache.pending != null || Object.keys(cache.recoveryDrafts ?? {}).length
          ? [{key, pending: cache.pending, drafts: cache.recoveryDrafts}] : [];
      } catch {return [{key, raw}];}
    });
  } catch {return [];}
}
