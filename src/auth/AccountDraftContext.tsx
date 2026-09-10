import {createContext, useContext, useEffect, useRef} from 'react';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

export const AccountWriteRecoveryContext = createContext<((reapply?: boolean) => Promise<void>) | null>(null);

export const AccountDraftContext = createContext<AccountWorkspaceSession | null>(null);
export function useAccountRecovery(key: string, value: unknown, dirty: boolean, enabled = true): void {
  const session = useContext(AccountDraftContext);
  useEffect(() => {
    if (enabled) session?.recordRecoveryDraft(key, dirty ? value : null);
  }, [session, key, value, dirty, enabled]);
}
export function useInitialRecovery<T>(key: string, parse: (value: unknown) => T | null): T | null {
  const session = useContext(AccountDraftContext);
  const initial = useRef<{value: T | null} | null>(null);
  initial.current ??= {value: parse(session?.readRecoveryDraft(key))};
  return initial.current.value;
}
