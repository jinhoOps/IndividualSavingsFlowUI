import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { SimulationApp } from './ui/SimulationApp';
import '../styles/app-foundation.css';
import '../journey/ui/journey.css';
import './ui/simulation.css';
import {AccountWorkspaceGate} from '../auth/AccountWorkspaceGate';
import {simulationRepositories} from '../auth/productRepositories';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

function AccountSimulation({session}: {session: AccountWorkspaceSession}) {
  const props = useMemo(() => simulationRepositories(session), [session]);
  return <SimulationApp {...props} />;
}

const root = document.getElementById('root');
if (root === null) throw new Error('Simulation React root was not found.');

createRoot(root).render(
  <StrictMode>
    <MainErrorBoundary>
      <AccountWorkspaceGate>{session => <AccountSimulation session={session} />}</AccountWorkspaceGate>
    </MainErrorBoundary>
  </StrictMode>,
);

registerSW({ immediate: true });
