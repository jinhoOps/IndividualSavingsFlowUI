import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { AccountMapApp } from '../account-map/ui/AccountMapApp';
import '../styles/app-foundation.css';
import './ui/journey.css';
import {AccountWorkspaceGate} from '../auth/AccountWorkspaceGate';
import {accountMapRepositories} from '../auth/productRepositories';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

function AccountMap({session}: {session: AccountWorkspaceSession}) {
  const props = useMemo(() => accountMapRepositories(session), [session]);
  return <AccountMapApp {...props} />;
}

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Account Map React root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <AccountWorkspaceGate>{session => <AccountMap session={session} />}</AccountWorkspaceGate>
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
