import {StrictMode, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import {MainErrorBoundary} from '../main/ui/common/AppErrorBoundary';
import {AccountWorkspaceGate} from '../auth/AccountWorkspaceGate';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';
import {browserLoungeRepository} from './infrastructure/loungeRepository';
import {assetBandFromWon} from './domain/assetBand';
import {LoungeEntry} from './ui/LoungeEntry';
import '../styles/app-foundation.css';
import './ui/lounge.css';
function AccountLounge({session}: {session: AccountWorkspaceSession}) {
  const repository = useMemo(() => browserLoungeRepository(), [session]);
  return <LoungeEntry key={session.snapshot === null ? 'empty' : 'ready'} repository={repository} plan={session.snapshot?.portfolio.plans[0] ?? null} suggestedAssetBand={assetBandFromWon(session.snapshot?.simulation.draft?.initialInvestmentWon ?? null)} />;
}
const root = document.getElementById('root');
if (!root) throw new Error('Lounge root was not found');
createRoot(root).render(<StrictMode><MainErrorBoundary><AccountWorkspaceGate allowEmptyWorkspace>{session => <AccountLounge session={session} />}</AccountWorkspaceGate></MainErrorBoundary></StrictMode>);
registerSW({immediate:true});
