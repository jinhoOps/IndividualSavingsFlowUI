import type { MainData } from '../../main/domain/model';
import type { SetupProgress } from '../../main/infrastructure/mainRepository';
import type { PortfolioDraft, PortfolioPlan } from '../../portfolio/domain/model';
import type { CompoundSimulationDraft } from '../../simulation/domain/model';
import type { AccountMapApplied, AccountMapDraft } from '../../account-map/domain/model';
import type { ConsumerInstrument, MonthlyFlow } from './accountMapContract';
import type { FinancialLocation } from './financialLocation';

export const WORKSPACE_SCHEMA_VERSION = 2 as const;
export const LEGACY_WORKSPACE_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_STORAGE_KEY = 'isf-workspace-v1';

interface WorkspaceSlices {
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

export interface WorkspaceDocumentV1 extends WorkspaceSlices {
  schemaVersion: typeof LEGACY_WORKSPACE_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  accountMap: {
    applied: null;
    draft: null;
    instruments: ConsumerInstrument[];
    flows: MonthlyFlow[];
  };
}

export interface WorkspaceDocumentV2 extends WorkspaceSlices {
  schemaVersion: 2;
  revision: number;
  updatedAt: number;
  accountMap: {
    applied: AccountMapApplied | null;
    draft: AccountMapDraft | null;
    legacyPhaseA: {
      instruments: ConsumerInstrument[];
      flows: MonthlyFlow[];
    };
  };
}

export type WorkspaceDocument = WorkspaceDocumentV2;

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
      legacyPhaseA: { instruments: [], flows: [] },
    },
  };
}
