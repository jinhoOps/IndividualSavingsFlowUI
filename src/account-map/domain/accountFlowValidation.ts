import type { AccountTransferLink } from './model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';

export type AccountFlowValidationCode =
  | 'self-transfer'
  | 'duplicate-transfer'
  | 'cycle'
  | 'multiple-sweeps'
  | 'endpoint-not-found'
  | 'endpoint-archived'
  | 'invalid-amount';

export interface AccountFlowValidationIssue {
  code: AccountFlowValidationCode;
  transferIds?: string[];
}

export type AccountFlowValidationResult =
  | { valid: true }
  | { valid: false; issues: AccountFlowValidationIssue[] };

export function validateAccountTransfers(
  transfers: readonly AccountTransferLink[],
  locations: readonly FinancialLocation[],
): AccountFlowValidationResult {
  const issues: AccountFlowValidationIssue[] = [];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const ids = new Map<string, string>();
  const pairs = new Map<string, string>();
  const activeBySource = new Map<string, AccountTransferLink[]>();
  const activeEdges: AccountTransferLink[] = [];

  for (const transfer of transfers) {
    const previousId = ids.get(transfer.id);
    if (previousId !== undefined) {
      issues.push({ code: 'duplicate-transfer', transferIds: [previousId, transfer.id] });
    } else {
      ids.set(transfer.id, transfer.id);
    }

    const source = locationById.get(transfer.sourceLocationId);
    const target = locationById.get(transfer.targetLocationId);
    if (source === undefined || target === undefined) {
      issues.push({ code: 'endpoint-not-found', transferIds: [transfer.id] });
    } else if (transfer.status === 'active'
      && (source.archivedAt !== undefined || target.archivedAt !== undefined)) {
      issues.push({ code: 'endpoint-archived', transferIds: [transfer.id] });
    }
    if (transfer.sourceLocationId === transfer.targetLocationId) {
      issues.push({ code: 'self-transfer', transferIds: [transfer.id] });
    }
    if (transfer.allocation.kind === 'fixed'
      && (!Number.isSafeInteger(transfer.allocation.monthlyAmountWon)
        || transfer.allocation.monthlyAmountWon < 0)) {
      issues.push({ code: 'invalid-amount', transferIds: [transfer.id] });
    }
    if (transfer.status !== 'active') continue;

    const pair = `${transfer.sourceLocationId}\u0000${transfer.targetLocationId}`;
    const previousPair = pairs.get(pair);
    if (previousPair !== undefined) {
      issues.push({ code: 'duplicate-transfer', transferIds: [previousPair, transfer.id] });
    } else {
      pairs.set(pair, transfer.id);
    }
    const sourceTransfers = activeBySource.get(transfer.sourceLocationId) ?? [];
    sourceTransfers.push(transfer);
    activeBySource.set(transfer.sourceLocationId, sourceTransfers);
    activeEdges.push(transfer);
  }

  for (const sourceTransfers of activeBySource.values()) {
    const sweeps = sourceTransfers.filter(({ allocation }) => allocation.kind === 'sweep');
    if (sweeps.length > 1) {
      issues.push({ code: 'multiple-sweeps', transferIds: sweeps.map(({ id }) => id) });
    }
  }

  if (hasCycle(activeEdges)) issues.push({ code: 'cycle' });
  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}

function hasCycle(transfers: readonly AccountTransferLink[]): boolean {
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const transfer of transfers) {
    if (!outgoing.has(transfer.sourceLocationId)) outgoing.set(transfer.sourceLocationId, []);
    outgoing.get(transfer.sourceLocationId)!.push(transfer.targetLocationId);
    indegree.set(transfer.sourceLocationId, indegree.get(transfer.sourceLocationId) ?? 0);
    indegree.set(transfer.targetLocationId, (indegree.get(transfer.targetLocationId) ?? 0) + 1);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const next = indegree.get(target)! - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return visited !== indegree.size;
}
