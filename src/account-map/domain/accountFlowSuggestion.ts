import type { PurposeId } from './model';
import type { AccountFlowCalculationInput } from './accountFlowCalculator';

export interface AccountTransferSuggestion {
  sourceLocationId: string;
  targetLocationId: string;
  allocation: { kind: 'fixed'; monthlyAmountWon: number };
  contributingPurposeIds: PurposeId[];
}

/**
 * Returns reviewable, ephemeral fixed-transfer suggestions only for the single
 * unambiguous income-entry case. It deliberately neither creates sweep rules nor
 * persists a choice.
 */
export function suggestAccountTransfers(input: AccountFlowCalculationInput): readonly AccountTransferSuggestion[] {
  if (input.transfers.length > 0 || input.main.monthlyNetIncomeWon <= 0) return [];

  const activeLocations = new Set(
    input.locations
      .filter(({ archivedAt }) => archivedAt === undefined)
      .map(({ id }) => id),
  );
  const activeIncomeLinks = input.links.filter((link) => link.status === 'active' && link.purposeId === 'system:income');
  if (activeIncomeLinks.some((link) => !activeLocations.has(link.locationId))) return [];
  if (activeIncomeLinks.length !== 1) return [];

  const [incomeLink] = activeIncomeLinks;
  if (incomeLink.monthlyAmountWon !== input.main.monthlyNetIncomeWon) return [];

  const activeOutflowLinks = input.links.filter((link) => link.status === 'active'
    && link.purposeId !== 'system:income');
  if (activeOutflowLinks.some((link) => !activeLocations.has(link.locationId))) return [];

  const byDestination = new Map<string, { monthlyAmountWon: number; purposeIds: Set<PurposeId> }>();
  for (const link of activeOutflowLinks) {
    if (link.locationId === incomeLink.locationId) continue;
    const entry = byDestination.get(link.locationId) ?? { monthlyAmountWon: 0, purposeIds: new Set<PurposeId>() };
    entry.monthlyAmountWon += link.monthlyAmountWon;
    entry.purposeIds.add(link.purposeId);
    byDestination.set(link.locationId, entry);
  }

  return [...byDestination.entries()]
    .sort(([left], [right]) => compareIdentifier(left, right))
    .map(([targetLocationId, value]) => ({
      sourceLocationId: incomeLink.locationId,
      targetLocationId,
      allocation: { kind: 'fixed' as const, monthlyAmountWon: value.monthlyAmountWon },
      contributingPurposeIds: [...value.purposeIds].sort(compareIdentifier),
    }));
}

function compareIdentifier(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
