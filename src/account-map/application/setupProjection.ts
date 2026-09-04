import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import { calculateAccountFlow, type AccountFlowCalculation } from '../domain/accountFlowCalculator';
import { suggestAccountTransfers, type AccountTransferSuggestion } from '../domain/accountFlowSuggestion';
import { projectAccountMapDraftForView } from '../domain/accountMapVersioning';
import type { AccountMapDraftV2, PurposeId, StoredAccountMapDraft } from '../domain/model';
import { reconcilePurpose } from '../domain/reconciliation';

export interface AccountMapSetupProjection {
  draft: AccountMapDraftV2;
  calculation: AccountFlowCalculation;
  suggestions: readonly AccountTransferSuggestion[];
  review: AccountMapReviewProjection;
  canApply: boolean;
}

/** Values are prepared at the application boundary so review stays presentational. */
export interface AccountMapReviewProjection {
  accounts: readonly {
    locationId: string;
    availableWon: number;
    localAllocationWon: number;
    sweep: { amountWon: number } | null;
  }[];
  warnings: AccountFlowCalculation['warnings'];
}

/**
 * The setup shell displays this already-derived model. It never recomputes
 * account totals or warnings while rendering a particular step.
 */
export function projectAccountMapSetup(
  main: MainData,
  locations: readonly FinancialLocation[],
  storedDraft: StoredAccountMapDraft | null,
): AccountMapSetupProjection {
  const draft = storedDraft === null ? emptyGuidedDraft(main.updatedAt) : projectAccountMapDraftForView(storedDraft);
  const calculation = calculateAccountFlow({ main, locations, links: draft.links, transfers: draft.transfers });
  const suggestions = suggestAccountTransfers({ main, locations, links: draft.links, transfers: draft.transfers });
  const purposeIds: PurposeId[] = [
    'system:income',
    'system:housing',
    'system:living',
    'system:saving',
    'system:investing',
    ...draft.customPurposes.filter((purpose) => purpose.archivedAt === undefined).map((purpose) => purpose.id),
  ];
  const income = reconcilePurpose('system:income', draft, locations, main);
  const sweepAmountBySource = new Map(calculation.transfers
    .filter((transfer) => transfer.status === 'active' && transfer.allocationKind === 'sweep')
    .map((transfer) => [transfer.sourceLocationId, transfer.amountWon]));

  return {
    draft,
    calculation,
    suggestions,
    review: {
      accounts: calculation.accounts.map((account) => ({
        locationId: account.locationId,
        availableWon: account.availableWon,
        localAllocationWon: account.localAllocationWon,
        sweep: sweepAmountBySource.has(account.locationId)
          ? { amountWon: sweepAmountBySource.get(account.locationId)! }
          : null,
      })),
      warnings: calculation.warnings,
    },
    canApply: income.targetWon > 0
      && income.activeAllocatedWon === income.targetWon
      && !purposeIds.some((purposeId) => reconcilePurpose(purposeId, draft, locations, main).excessWon > 0),
  };
}

function emptyGuidedDraft(sourceMainUpdatedAt: number): AccountMapDraftV2 {
  return {
    schemaVersion: 2,
    sourceMainUpdatedAt,
    customPurposes: [],
    links: [],
    transfers: [],
    step: 'basis',
    updatedAt: Date.now(),
  };
}
