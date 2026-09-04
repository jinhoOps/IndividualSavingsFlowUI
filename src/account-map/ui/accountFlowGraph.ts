import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountFlowCalculation, AccountFlowWarning } from '../domain/accountFlowCalculator';
import { mainPurposeReferences } from '../domain/reconciliation';
import type {
  AccountMapApplied,
  AccountMapAppliedV3,
  AccountTransferLink,
  PurposeId,
  PurposeLocationLink,
  SystemPurposeId,
} from '../domain/model';

export type AccountFlowNode =
  | AccountFlowAccountNode
  | AccountFlowPurposeNode
  | AccountFlowExternalIncomeNode
  | AccountFlowWarningNode;

export interface AccountFlowAccountNode {
  id: `account:${string}`;
  kind: 'account';
  locationId: string;
  label: string;
  secondary?: string;
  status: 'planned' | 'unassigned' | 'shortfall';
}

export interface AccountFlowPurposeNode {
  id: `purpose:${PurposeId}`;
  kind: 'purpose';
  purposeId: PurposeId;
  label: string;
  amountWon: number;
  status: 'planned';
}

export interface AccountFlowExternalIncomeNode {
  id: 'income:external';
  kind: 'external-income';
  label: '외부 수입';
  status: 'planned';
}

export interface AccountFlowWarningNode {
  id: `warning:${string}:${AccountFlowWarning['kind']}`;
  kind: 'warning';
  locationId: string;
  warningKind: AccountFlowWarning['kind'];
  label: '계획상 미배정' | '계획상 부족';
  amountWon: number;
  status: 'unassigned' | 'shortfall';
}

export type AccountFlowEdge =
  | AccountFlowExternalIncomeEdge
  | AccountFlowPurposeEdge
  | AccountFlowTransferEdge
  | AccountFlowWarningEdge;

interface AccountFlowEdgeBase {
  id: string;
  sourceId: string;
  targetId: string;
  amountWon: number;
  status: 'active' | 'suspended' | 'warning';
}

export interface AccountFlowExternalIncomeEdge extends AccountFlowEdgeBase {
  id: `income:${string}`;
  kind: 'external-income';
  sourceId: 'income:external';
  targetId: `account:${string}`;
  status: 'active';
  linkId: string;
}

export interface AccountFlowPurposeEdge extends AccountFlowEdgeBase {
  id: `purpose:${string}`;
  kind: 'purpose';
  sourceId: `account:${string}`;
  targetId: `purpose:${PurposeId}`;
  status: 'active';
  linkId: string;
  purposeId: PurposeId;
}

export interface AccountFlowTransferEdge extends AccountFlowEdgeBase {
  id: `transfer:${string}`;
  kind: 'fixed' | 'sweep';
  sourceId: `account:${string}`;
  targetId: `account:${string}`;
  status: AccountTransferLink['status'];
  transferId: string;
  ruleLabel: '고정 금액' | '남은 금액 전부';
}

export interface AccountFlowWarningEdge extends AccountFlowEdgeBase {
  id: `warning:${string}:${AccountFlowWarning['kind']}`;
  kind: 'warning';
  sourceId: `account:${string}`;
  targetId: `warning:${string}:${AccountFlowWarning['kind']}`;
  status: 'warning';
  warningKind: AccountFlowWarning['kind'];
}

export interface AccountFlowGraph {
  nodes: readonly AccountFlowNode[];
  edges: readonly AccountFlowEdge[];
  /** Calculator-owned transfer order; graph construction never re-calculates money. */
  topologicalOrder: readonly string[];
}

type FlowApplied = Pick<AccountMapApplied | AccountMapAppliedV3, 'customPurposes' | 'links'>;

/**
 * Projects the already-calculated plan into visual topology. This deliberately
 * does not calculate balances, transfer estimates, or Main totals; those remain
 * owned by AccountFlowCalculator and Main respectively.
 */
export function buildAccountFlowGraph(
  calculation: AccountFlowCalculation,
  applied: FlowApplied,
  locations: readonly FinancialLocation[],
  main: MainData,
): AccountFlowGraph {
  const activeLocations = locations
    .filter((location) => location.archivedAt === undefined)
    .sort(compareLocations);
  const activeLocationIds = new Set(activeLocations.map(({ id }) => id));
  const accountNodes = activeLocations.map((location): AccountFlowAccountNode => {
    const account = calculation.accountsById[location.id];
    return {
      id: accountNodeId(location.id),
      kind: 'account',
      locationId: location.id,
      label: location.shortName,
      ...(location.institution === undefined ? {} : { secondary: location.institution.name }),
      status: account?.shortfallWon && account.shortfallWon > 0
        ? 'shortfall'
        : account?.unassignedWon && account.unassignedWon > 0 ? 'unassigned' : 'planned',
    };
  });
  const purposeNodes = flowPurposeIds(applied).map((purposeId): AccountFlowPurposeNode => ({
    id: purposeNodeId(purposeId),
    kind: 'purpose',
    purposeId,
    label: purposeLabel(purposeId, applied),
    amountWon: purposeAmount(purposeId, applied, main),
    status: 'planned',
  }));
  const incomeEdges = applied.links
    .filter((link) => link.status === 'active'
      && link.purposeId === 'system:income'
      && activeLocationIds.has(link.locationId))
    .map((link): AccountFlowExternalIncomeEdge => ({
      id: `income:${link.id}`,
      kind: 'external-income',
      sourceId: 'income:external',
      targetId: accountNodeId(link.locationId),
      amountWon: link.monthlyAmountWon,
      status: 'active',
      linkId: link.id,
    }));
  const purposeEdges = applied.links
    .filter((link) => link.status === 'active'
      && link.purposeId !== 'system:income'
      && activeLocationIds.has(link.locationId)
      && !isArchivedPurpose(link.purposeId, applied))
    .map((link): AccountFlowPurposeEdge => ({
      id: `purpose:${link.id}`,
      kind: 'purpose',
      sourceId: accountNodeId(link.locationId),
      targetId: purposeNodeId(link.purposeId),
      amountWon: link.monthlyAmountWon,
      status: 'active',
      linkId: link.id,
      purposeId: link.purposeId,
    }));
  const transferEdges = calculation.transfers
    .filter((transfer) => activeLocationIds.has(transfer.sourceLocationId)
      && activeLocationIds.has(transfer.targetLocationId))
    .map((transfer): AccountFlowTransferEdge => ({
      id: `transfer:${transfer.id}`,
      kind: transfer.allocationKind,
      sourceId: accountNodeId(transfer.sourceLocationId),
      targetId: accountNodeId(transfer.targetLocationId),
      amountWon: transfer.amountWon,
      status: transfer.status,
      transferId: transfer.id,
      ruleLabel: transfer.allocationKind === 'sweep' ? '남은 금액 전부' : '고정 금액',
    }));
  const warningNodes = calculation.warnings
    .filter((warning) => activeLocationIds.has(warning.locationId))
    .map((warning): AccountFlowWarningNode => ({
      id: warningNodeId(warning),
      kind: 'warning',
      locationId: warning.locationId,
      warningKind: warning.kind,
      label: warning.kind === 'shortfall' ? '계획상 부족' : '계획상 미배정',
      amountWon: warning.amountWon,
      status: warning.kind === 'shortfall' ? 'shortfall' : 'unassigned',
    }));
  const warningEdges = calculation.warnings
    .filter((warning) => activeLocationIds.has(warning.locationId))
    .map((warning): AccountFlowWarningEdge => ({
      id: warningNodeId(warning),
      kind: 'warning',
      sourceId: accountNodeId(warning.locationId),
      targetId: warningNodeId(warning),
      amountWon: warning.amountWon,
      status: 'warning',
      warningKind: warning.kind,
    }));

  const externalIncomeNode: AccountFlowExternalIncomeNode = {
    id: 'income:external', kind: 'external-income', label: '외부 수입', status: 'planned',
  };
  return {
    nodes: [
      externalIncomeNode,
      ...accountNodes,
      ...purposeNodes,
      ...warningNodes,
    ].sort(compareNodes),
    edges: [...incomeEdges, ...purposeEdges, ...transferEdges, ...warningEdges].sort(compareById),
    topologicalOrder: [...calculation.topologicalOrder],
  };
}

export function accountNodeId(locationId: string): `account:${string}` {
  return `account:${locationId}`;
}

export function purposeNodeId(purposeId: PurposeId): `purpose:${PurposeId}` {
  return `purpose:${purposeId}`;
}

function warningNodeId(warning: AccountFlowWarning): `warning:${string}:${AccountFlowWarning['kind']}` {
  return `warning:${warning.locationId}:${warning.kind}`;
}

function flowPurposeIds(applied: FlowApplied): PurposeId[] {
  const standard: SystemPurposeId[] = ['system:housing', 'system:living', 'system:saving', 'system:investing'];
  return [...standard, ...applied.customPurposes
    .filter((purpose) => purpose.archivedAt === undefined)
    .map((purpose) => purpose.id)]
    .sort((left, right) => left.localeCompare(right));
}

function purposeAmount(purposeId: PurposeId, applied: FlowApplied, main: MainData): number {
  if (!purposeId.startsWith('custom:')) return mainPurposeReferences(main)[purposeId as SystemPurposeId];
  return applied.customPurposes.find(({ id }) => id === purposeId)?.targetMonthlyWon ?? 0;
}

function purposeLabel(purposeId: PurposeId, applied: FlowApplied): string {
  if (purposeId.startsWith('custom:')) return applied.customPurposes.find(({ id }) => id === purposeId)?.name ?? '세부 목적';
  const labels: Record<SystemPurposeId, string> = {
    'system:income': '수입',
    'system:housing': '주거',
    'system:living': '생활비',
    'system:saving': '저축',
    'system:investing': '투자',
  };
  return labels[purposeId as SystemPurposeId];
}

function isArchivedPurpose(purposeId: PurposeId, applied: FlowApplied): boolean {
  return purposeId.startsWith('custom:')
    && applied.customPurposes.some((purpose) => purpose.id === purposeId && purpose.archivedAt !== undefined);
}

function compareLocations(left: FinancialLocation, right: FinancialLocation): number {
  return compareById(left, right);
}

function compareNodes(left: AccountFlowNode, right: AccountFlowNode): number {
  return nodeKindRank(left) - nodeKindRank(right) || compareById(left, right);
}

function nodeKindRank(node: AccountFlowNode): number {
  if (node.kind === 'external-income') return 0;
  if (node.kind === 'account') return 1;
  if (node.kind === 'purpose') return 2;
  return 3;
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}
