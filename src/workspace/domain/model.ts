import type { MainData } from '../../main/domain/model';
import type { SetupProgress } from '../../main/infrastructure/mainRepository';
import type { PortfolioDraft, PortfolioPlan } from '../../portfolio/domain/model';
import type { CompoundSimulationDraft } from '../../simulation/domain/model';
import type { AccountMapApplied, AccountMapDraft } from '../../account-map/domain/model';
import type { FinancialLocation } from './financialLocation';

export const WORKSPACE_SCHEMA_VERSION = 3 as const;
export const WORKSPACE_STORAGE_KEY = 'isf-workspace-v3';
export const RETIRED_WORKSPACE_STORAGE_KEY = 'isf-workspace-v1';

export interface WorkspaceSlices {
  main: {
    applied: MainData | null;
    setupProgress: SetupProgress | null;
  };
  simulation: {
    draft: CompoundSimulationDraft | null;
  };
  portfolio: {
    plans: PortfolioPlan[];
    draft: PortfolioDraft | null;
  };
  locations: FinancialLocation[];
}

export interface WorkspaceDocument extends WorkspaceSlices {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  accountMap: {
    applied: AccountMapApplied | null;
    draft: AccountMapDraft | null;
  };
}

export function createEmptyWorkspace(now: number = Date.now()): WorkspaceDocument {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: now,
    main: { applied: null, setupProgress: null },
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [],
    accountMap: {
      applied: null,
      draft: null,
    },
  };
}
