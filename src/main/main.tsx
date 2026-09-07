import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainApp } from './ui/MainApp';
import { MainErrorBoundary } from './ui/common/AppErrorBoundary';
import '../styles/app-foundation.css';
import './ui/main.css';
import {AccountWorkspaceGate} from '../auth/AccountWorkspaceGate';
import {mainRepositories} from '../auth/productRepositories';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

function AccountMain({session}: {session: AccountWorkspaceSession}) {
  const props = useMemo(() => mainRepositories(session), [session]);
  return <MainApp {...props} />;
}

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Main React root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <AccountWorkspaceGate>{session => <AccountMain session={session} />}</AccountWorkspaceGate>
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
