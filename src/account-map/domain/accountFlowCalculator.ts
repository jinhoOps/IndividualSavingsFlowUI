import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountTransferLink, PurposeId, PurposeLocationLink } from './model';

export interface AccountFlowCalculationInput {
  /** Main remains a read-only source for Account Map flow calculations. */
  main: MainData;
  locations: readonly FinancialLocation[];
  links: readonly PurposeLocationLink[];
  transfers: readonly AccountTransferLink[];
}

export interface AccountFlowPurposeAllocation {
  purposeId: PurposeId;
  amountWon: number;
}

export interface AccountFlowAccount {
  locationId: string;
  externalIncomeWon: number;
  inboundFixedWon: number;
  inboundSweepWon: number;
  inboundTransferWon: number;
  availableWon: number;
  localAllocations: readonly AccountFlowPurposeAllocation[];
  localAllocationWon: number;
  outboundFixedWon: number;
  remainderBeforeSweepWon: number;
  sweepWon: number;
  unassignedWon: number;
  shortfallWon: number;
}

export interface CalculatedAccountTransfer {
  id: string;
  sourceLocationId: string;
  targetLocationId: string;
  allocationKind: AccountTransferLink['allocation']['kind'];
  status: AccountTransferLink['status'];
  amountWon: number;
}

export type AccountFlowWarning =
  | { kind: 'shortfall'; locationId: string; amountWon: number }
  | { kind: 'unassigned'; locationId: string; amountWon: number };

export interface AccountFlowCalculation {
  accounts: readonly AccountFlowAccount[];
  accountsById: Readonly<Record<string, AccountFlowAccount>>;
  transfers: readonly CalculatedAccountTransfer[];
  transfersById: Readonly<Record<string, CalculatedAccountTransfer>>;
  workspaceTotals: { externalIncomeWon: number };
  warnings: readonly AccountFlowWarning[];
  topologicalOrder: readonly string[];
}

/**
 * Calculates planned monthly routing without writing to or deriving a new Main value.
 * Purpose links create external income and local sinks; account transfers only move
 * already-calculated amounts between active locations.
 */
export function calculateAccountFlow(input: AccountFlowCalculationInput): AccountFlowCalculation {
  const activeLocations = input.locations
    .filter(({ archivedAt }) => archivedAt === undefined)
    .sort(compareById);
  const locationIds = new Set(activeLocations.map(({ id }) => id));
  const routableTransfers = input.transfers
    .filter((transfer) => transfer.status === 'active'
      && locationIds.has(transfer.sourceLocationId)
      && locationIds.has(transfer.targetLocationId));
  const topologicalOrder = orderLocations(activeLocations, routableTransfers);

  const externalIncomeByLocation = new Map<string, number>();
  const localAllocationsByLocation = new Map<string, AccountFlowPurposeAllocation[]>();
  for (const link of input.links) {
    if (link.status !== 'active' || !locationIds.has(link.locationId)) continue;
    if (link.purposeId === 'system:income') {
      addWon(externalIncomeByLocation, link.locationId, link.monthlyAmountWon);
      continue;
    }
    const allocations = localAllocationsByLocation.get(link.locationId) ?? [];
    allocations.push({ purposeId: link.purposeId, amountWon: link.monthlyAmountWon });
    localAllocationsByLocation.set(link.locationId, allocations);
  }
  for (const allocations of localAllocationsByLocation.values()) {
    allocations.sort((left, right) => compareIdentifier(left.purposeId, right.purposeId));
  }

  const inboundFixedByLocation = new Map<string, number>();
  const outboundFixedByLocation = new Map<string, number>();
  const sweepBySource = new Map<string, AccountTransferLink>();
  const outgoingBySource = new Map<string, AccountTransferLink[]>();
  for (const transfer of routableTransfers) {
    const outgoing = outgoingBySource.get(transfer.sourceLocationId) ?? [];
    outgoing.push(transfer);
    outgoingBySource.set(transfer.sourceLocationId, outgoing);
    if (transfer.allocation.kind === 'fixed') {
      addWon(outboundFixedByLocation, transfer.sourceLocationId, transfer.allocation.monthlyAmountWon);
      addWon(inboundFixedByLocation, transfer.targetLocationId, transfer.allocation.monthlyAmountWon);
    } else if (!sweepBySource.has(transfer.sourceLocationId)) {
      // Storage validation rejects a second active sweep. Keeping the first rule by
      // ID makes this pure projection deterministic even for an invalid transient graph.
      sweepBySource.set(transfer.sourceLocationId, transfer);
    }
  }
  for (const outgoing of outgoingBySource.values()) outgoing.sort(compareTransfer);
  for (const [sourceLocationId, sweep] of sweepBySource) {
    const firstById = (outgoingBySource.get(sourceLocationId) ?? [])
      .filter(({ allocation }) => allocation.kind === 'sweep')
      .sort(compareTransfer)[0];
    if (firstById !== undefined && firstById.id !== sweep.id) sweepBySource.set(sourceLocationId, firstById);
  }

  const inboundSweepByLocation = new Map<string, number>();
  const calculatedAmountByTransferId = new Map<string, number>();
  for (const transfer of routableTransfers) {
    calculatedAmountByTransferId.set(transfer.id, transfer.allocation.kind === 'fixed'
      ? transfer.allocation.monthlyAmountWon
      : 0);
  }

  const accountsById: Record<string, AccountFlowAccount> = {};
  for (const locationId of topologicalOrder) {
    const externalIncomeWon = externalIncomeByLocation.get(locationId) ?? 0;
    const inboundFixedWon = inboundFixedByLocation.get(locationId) ?? 0;
    const inboundSweepWon = inboundSweepByLocation.get(locationId) ?? 0;
    const inboundTransferWon = inboundFixedWon + inboundSweepWon;
    const availableWon = externalIncomeWon + inboundTransferWon;
    const localAllocations = [...(localAllocationsByLocation.get(locationId) ?? [])];
    const localAllocationWon = localAllocations.reduce((total, allocation) => total + allocation.amountWon, 0);
    const outboundFixedWon = outboundFixedByLocation.get(locationId) ?? 0;
    const remainderBeforeSweepWon = availableWon - localAllocationWon - outboundFixedWon;
    const sweep = sweepBySource.get(locationId);
    const sweepWon = sweep === undefined ? 0 : Math.max(remainderBeforeSweepWon, 0);
    const unassignedWon = sweep === undefined ? Math.max(remainderBeforeSweepWon, 0) : 0;
    const shortfallWon = Math.max(-remainderBeforeSweepWon, 0);

    accountsById[locationId] = {
      locationId,
      externalIncomeWon,
      inboundFixedWon,
      inboundSweepWon,
      inboundTransferWon,
      availableWon,
      localAllocations,
      localAllocationWon,
      outboundFixedWon,
      remainderBeforeSweepWon,
      sweepWon,
      unassignedWon,
      shortfallWon,
    };

    if (sweep !== undefined) {
      calculatedAmountByTransferId.set(sweep.id, sweepWon);
      addWon(inboundSweepByLocation, sweep.targetLocationId, sweepWon);
    }
  }

  const transfers = input.transfers
    .slice()
    .sort(compareTransfer)
    .map((transfer) => ({
      id: transfer.id,
      sourceLocationId: transfer.sourceLocationId,
      targetLocationId: transfer.targetLocationId,
      allocationKind: transfer.allocation.kind,
      status: transfer.status,
      amountWon: calculatedAmountByTransferId.get(transfer.id) ?? 0,
    }));
  const transfersById = Object.fromEntries(transfers.map((transfer) => [transfer.id, transfer]));
  const accounts = topologicalOrder.map((locationId) => accountsById[locationId]!);
  const warnings = accounts.flatMap((account): AccountFlowWarning[] => {
    if (account.shortfallWon > 0) return [{ kind: 'shortfall', locationId: account.locationId, amountWon: account.shortfallWon }];
    if (account.unassignedWon > 0) return [{ kind: 'unassigned', locationId: account.locationId, amountWon: account.unassignedWon }];
    return [];
  });

  return {
    accounts,
    accountsById,
    transfers,
    transfersById,
    workspaceTotals: {
      externalIncomeWon: [...externalIncomeByLocation.values()].reduce((total, amount) => total + amount, 0),
    },
    warnings,
    topologicalOrder,
  };
}

function orderLocations(
  locations: readonly FinancialLocation[],
  transfers: readonly AccountTransferLink[],
): string[] {
  const outgoing = new Map<string, AccountTransferLink[]>();
  const indegree = new Map(locations.map(({ id }) => [id, 0]));
  for (const transfer of transfers) {
    const next = outgoing.get(transfer.sourceLocationId) ?? [];
    next.push(transfer);
    outgoing.set(transfer.sourceLocationId, next);
    indegree.set(transfer.targetLocationId, (indegree.get(transfer.targetLocationId) ?? 0) + 1);
  }
  for (const entries of outgoing.values()) entries.sort(compareTransfer);

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([locationId]) => locationId)
    .sort(compareIdentifier);
  const order: string[] = [];
  while (queue.length > 0) {
    const locationId = queue.shift()!;
    order.push(locationId);
    for (const transfer of outgoing.get(locationId) ?? []) {
      const nextDegree = indegree.get(transfer.targetLocationId)! - 1;
      indegree.set(transfer.targetLocationId, nextDegree);
      if (nextDegree === 0) insertSorted(queue, transfer.targetLocationId);
    }
  }

  // Cycles cannot be persisted, but this keeps a view-only transient projection
  // deterministic until the command layer reports its structural error.
  const remaining = [...indegree.entries()]
    .filter(([, degree]) => degree > 0)
    .map(([locationId]) => locationId)
    .sort(compareIdentifier);
  return [...order, ...remaining];
}

function addWon(values: Map<string, number>, locationId: string, amountWon: number): void {
  values.set(locationId, (values.get(locationId) ?? 0) + amountWon);
}

function insertSorted(values: string[], value: string): void {
  const index = values.findIndex((candidate) => compareIdentifier(candidate, value) > 0);
  if (index === -1) values.push(value);
  else values.splice(index, 0, value);
}

function compareById(left: FinancialLocation, right: FinancialLocation): number {
  return compareIdentifier(left.id, right.id);
}

function compareTransfer(left: AccountTransferLink, right: AccountTransferLink): number {
  return compareIdentifier(left.id, right.id);
}

function compareIdentifier(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
