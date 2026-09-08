import {createContext, useContext, type ReactNode} from 'react';
import type {AppManagementItem} from '../journey/ui/AppManagementMenu';

export const AccountManagementContext = createContext<{
  items: readonly AppManagementItem[];
  readOnly: boolean;
} | null>(null);

/** Keep navigation/account actions available while offline financial inputs are locked. */
export function AccountProductBoundary({children}: {children: ReactNode}) {
  const account = useContext(AccountManagementContext);
  return account === null ? <>{children}</> : (
    <fieldset className="account-product" disabled={account.readOnly}>{children}</fieldset>
  );
}
