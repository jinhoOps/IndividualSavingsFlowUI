import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { AccountMapJourney } from './ui/AccountMapJourney';
import { AccountWorkspaceGate } from '../auth/AccountWorkspaceGate';
import { accountMapJourneyRepositories } from '../auth/productRepositories';
import type { AccountWorkspaceSession } from '../workspace/infrastructure/accountWorkspaceSession';
import '../styles/app-foundation.css';
import './ui/journey.css';

const root = document.getElementById('root');

function AccountMapAccount({session}: {session: AccountWorkspaceSession}) {
  const repositories = useMemo(() => accountMapJourneyRepositories(session), [session]);
  return <AccountMapJourney
    {...repositories}
    mainAvailable={session.snapshot?.main.applied !== null}
  />;
}

if (root === null) {
  throw new Error('Account Map React root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <AccountWorkspaceGate>{session => <AccountMapAccount session={session} />}</AccountWorkspaceGate>
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
