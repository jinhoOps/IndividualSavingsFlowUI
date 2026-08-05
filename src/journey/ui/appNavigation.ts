import type { JourneyApp } from '../routes';

export interface AppNavigationItem {
  id: JourneyApp;
  accessibleLabel: string;
  shortLabel: string;
  availability: 'available' | 'readiness';
}

export const APP_NAV_ITEMS = [
  { id: 'main', accessibleLabel: '자금 흐름 (Main)', shortLabel: '자금 흐름', availability: 'available' },
  { id: 'simulation', accessibleLabel: '미래 성장 (Simulation)', shortLabel: '미래 성장', availability: 'available' },
  { id: 'portfolio', accessibleLabel: '투자 배분 (Portfolio)', shortLabel: '투자 배분', availability: 'available' },
  { id: 'account-map', accessibleLabel: '계좌 연결 (Account Map)', shortLabel: '계좌 연결', availability: 'readiness' },
] as const satisfies ReadonlyArray<AppNavigationItem>;
