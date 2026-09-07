import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MainErrorBoundary } from '../main/ui/common/AppErrorBoundary';
import { PortfolioApp } from './ui/PortfolioApp';
import '../styles/app-foundation.css';
import './ui/portfolio.css';
import {AccountWorkspaceGate} from '../auth/AccountWorkspaceGate';
import {portfolioRepositories} from '../auth/productRepositories';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

function AccountPortfolio({session}: {session: AccountWorkspaceSession}) {
  const props = useMemo(() => portfolioRepositories(session), [session]);
  return <PortfolioApp {...props} />;
}

const root = document.getElementById('root');
if (root === null) throw new Error('Portfolio React root was not found.');

createRoot(root).render(
  <StrictMode><MainErrorBoundary><AccountWorkspaceGate>{session => <AccountPortfolio session={session} />}</AccountWorkspaceGate></MainErrorBoundary></StrictMode>,
);
registerSW({ immediate: true });
