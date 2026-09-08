import {BrowserMainRepository} from '../main/infrastructure/mainRepository';
import {BrowserSimulationRepository} from '../simulation/infrastructure/simulationRepository';
import {BrowserMainSourceRepository} from '../simulation/infrastructure/mainSourceRepository';
import {BrowserPortfolioRepository} from '../portfolio/infrastructure/portfolioRepository';
import {BrowserPortfolioMainSourceRepository} from '../portfolio/infrastructure/mainSourceRepository';
import {BrowserAccountMapRepository} from '../account-map/infrastructure/accountMapRepository';
import {BrowserAccountMapMainSourceRepository} from '../account-map/infrastructure/mainSourceRepository';
import type {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';

export function mainRepositories(session: AccountWorkspaceSession) {
  return {repository: new BrowserMainRepository(session.scope('main')), workspaceRepository: session.scope('restore')};
}
export function simulationRepositories(session: AccountWorkspaceSession) {
  return {repository: new BrowserSimulationRepository(session.scope('simulation')), mainSourceRepository: new BrowserMainSourceRepository(session.scope('simulation'))};
}
export function portfolioRepositories(session: AccountWorkspaceSession) {
  return {repository: new BrowserPortfolioRepository(session.scope('portfolio')), mainSourceRepository: new BrowserPortfolioMainSourceRepository(session.scope('portfolio'))};
}
export function accountMapRepositories(session: AccountWorkspaceSession) {
  return {repositories: {accountMap: new BrowserAccountMapRepository(session.scope('account-map')), main: new BrowserAccountMapMainSourceRepository(session.scope('account-map'))}};
}
export function accountMapJourneyRepositories(session: AccountWorkspaceSession) {
  return {
    ...accountMapRepositories(session),
    mainRepository: new BrowserMainRepository(session.scope('main')),
  };
}
