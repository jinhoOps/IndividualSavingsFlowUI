import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type {
  AccountMapApplied,
  OutflowPurposeId,
  PurposeId,
  PurposeLocationLink,
  SystemPurposeId,
} from './model';

export interface PurposeReconciliation {
  targetWon: number;
  activeAllocatedWon: number;
  unassignedWon: number;
  excessWon: number;
}

export type OverallMainState = {
  remainingWon: number;
  kind: 'surplus' | 'balanced' | 'deficit';
};

export type RemainderRecalculation =
  | { ok: true; links: PurposeLocationLink[] }
  | { ok: false; reason: 'remainder-link-not-active' }
  | { ok: false; reason: 'fixed-links-exceed-target'; excessWon: number };

export function mainPurposeReferences(main: MainData): Record<SystemPurposeId, number> {
  return {
    'system:income': main.monthlyNetIncomeWon,
    'system:housing': main.monthlyHousingWon,
    'system:living': main.monthlyLivingWon,
    'system:saving': main.monthlySavingWon,
    'system:investing': main.monthlyInvestmentWon,
  };
}

export function reconcilePurpose(
  purposeId: PurposeId,
  state: Pick<AccountMapApplied, 'customPurposes' | 'links'>,
  locations: readonly FinancialLocation[],
  main: MainData,
): PurposeReconciliation {
  const targetWon = purposeTarget(purposeId, state.customPurposes, main);
  const activeLocationIds = new Set(
    locations.filter((location) => location.archivedAt === undefined).map((location) => location.id),
  );
  const activeAllocatedWon = state.links
    .filter((link) => link.purposeId === purposeId
      && link.status === 'active'
      && activeLocationIds.has(link.locationId))
    .reduce((sum, link) => sum + link.monthlyAmountWon, 0);

  return {
    targetWon,
    activeAllocatedWon,
    unassignedWon: Math.max(targetWon - activeAllocatedWon, 0),
    excessWon: Math.max(activeAllocatedWon - targetWon, 0),
  };
}

export function overallMainState(main: MainData): OverallMainState {
  const plannedOutflowWon = main.monthlyHousingWon
    + main.monthlyLivingWon
    + main.monthlySavingWon
    + main.monthlyInvestmentWon;
  const remainingWon = main.monthlyNetIncomeWon - plannedOutflowWon;
  return {
    remainingWon,
    kind: remainingWon > 0 ? 'surplus' : remainingWon < 0 ? 'deficit' : 'balanced',
  };
}

export function customPurposeTargetCapacity(
  parentId: OutflowPurposeId,
  customPurposes: AccountMapApplied['customPurposes'],
  main: MainData,
  excludingPurposeId?: `custom:${string}`,
): number {
  const usedWon = customPurposes
    .filter((purpose) => purpose.parentId === parentId
      && purpose.archivedAt === undefined
      && purpose.id !== excludingPurposeId)
    .reduce((sum, purpose) => sum + purpose.targetMonthlyWon, 0);
  return Math.max(mainPurposeReferences(main)[parentId] - usedWon, 0);
}

export function recalculateRemainder(
  purposeId: PurposeId,
  remainderLinkId: string,
  targetWon: number,
  links: readonly PurposeLocationLink[],
): RemainderRecalculation {
  const selected = links.find((link) => link.id === remainderLinkId
    && link.purposeId === purposeId
    && link.status === 'active');
  if (selected === undefined) return { ok: false, reason: 'remainder-link-not-active' };

  const fixedWon = links
    .filter((link) => link.purposeId === purposeId
      && link.status === 'active'
      && link.id !== remainderLinkId)
    .reduce((sum, link) => sum + link.monthlyAmountWon, 0);
  if (fixedWon > targetWon) {
    return { ok: false, reason: 'fixed-links-exceed-target', excessWon: fixedWon - targetWon };
  }

  return {
    ok: true,
    links: links.map((link) => {
      if (link.purposeId !== purposeId || link.status !== 'active') return { ...link };
      return link.id === remainderLinkId
        ? { ...link, monthlyAmountWon: targetWon - fixedWon, remainder: true }
        : { ...link, remainder: false };
    }),
  };
}

function purposeTarget(
  purposeId: PurposeId,
  customPurposes: AccountMapApplied['customPurposes'],
  main: MainData,
): number {
  if (purposeId.startsWith('custom:')) {
    const purpose = customPurposes.find((candidate) => candidate.id === purposeId
      && candidate.archivedAt === undefined);
    return purpose?.targetMonthlyWon ?? 0;
  }

  return customPurposeTargetCapacity(purposeId as OutflowPurposeId, customPurposes, main);
}
