import {
  accountFlowReadingOrder,
  accountNodeId,
  purposeNodeId,
  type AccountFlowEdge,
  type AccountFlowGraph,
  type AccountFlowNode,
} from './accountFlowGraph';
import type { PurposeId } from '../domain/model';

export type AccountFlowSelection =
  | { type: 'account'; locationId: string }
  | { type: 'purpose'; purposeId: PurposeId }
  | { type: 'transfer'; transferId: string }
  | null;

export interface AccountFlowTableRow {
  sourceLabel: string;
  targetLabel: string;
  kind: 'external-income' | 'purpose' | 'fixed' | 'sweep';
  amountWon: number;
  statusLabel: string;
}

export interface AccountFlowDetailRow {
  id: string;
  label: string;
  kind: AccountFlowTableRow['kind'] | 'warning';
  amountWon: number;
  statusLabel: string;
}

export interface AccountFlowDetailGroup {
  key: 'incoming' | 'local-allocations' | 'outgoing' | 'unassigned' | 'shortfall';
  label: string;
  rows: readonly AccountFlowDetailRow[];
}

export interface AccountFlowViewModel {
  visibleLabels: Readonly<Record<string, string>>;
  dimmedNodeIds: readonly string[];
  dimmedEdgeIds: readonly string[];
  reachableNodeIds: readonly string[];
  reachableEdgeIds: readonly string[];
  visibleEdgeAmountIds: readonly string[];
  detailGroups: readonly AccountFlowDetailGroup[];
  tableRows: readonly AccountFlowTableRow[];
  focusOrder: readonly string[];
}

/**
 * Derives selection presentation from graph topology. It deliberately exposes
 * individual incoming, local, and outgoing rows instead of producing an account
 * total that would mix money entering and leaving the same account.
 */
export function buildAccountFlowViewModel(
  graph: AccountFlowGraph,
  selection: AccountFlowSelection,
): AccountFlowViewModel {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const selectionState = resolveSelection(graph, selection);
  const selectionActive = selection !== null && selectionState.nodeIds.size > 0;
  const relatedNodeIds = sortIds(selectionActive ? selectionState.nodeIds : graph.nodes.map(({ id }) => id));
  const relatedEdgeIds = sortIds(selectionActive ? selectionState.edgeIds : graph.edges.map(({ id }) => id));
  const visibleLabels = Object.fromEntries(graph.nodes.map((node) => [node.id, node.label]));
  const dimmedNodeIds = selectionActive
    ? sortIds(graph.nodes.filter((node) => !selectionState.nodeIds.has(node.id)).map(({ id }) => id))
    : [];
  const dimmedEdgeIds = selectionActive
    ? sortIds(graph.edges.filter((edge) => !selectionState.edgeIds.has(edge.id)).map(({ id }) => id))
    : [];

  return {
    visibleLabels,
    dimmedNodeIds,
    dimmedEdgeIds,
    reachableNodeIds: relatedNodeIds,
    reachableEdgeIds: relatedEdgeIds,
    visibleEdgeAmountIds: selectionActive
      ? sortIds([...selectionState.edgeIds].filter((id) => isFlowAmountEdge(graph, id)))
      : [],
    detailGroups: buildDetailGroups(graph, selection, selectionState, nodeById),
    tableRows: buildCanonicalTableRows(graph, nodeById),
    focusOrder: accountFlowReadingOrder(graph),
  };
}

function resolveSelection(graph: AccountFlowGraph, selection: AccountFlowSelection): Reachability {
  if (selection === null) return emptyReachability();
  if (selection.type === 'account') return accountReachability(graph, accountNodeId(selection.locationId));
  if (selection.type === 'purpose') return purposeReachability(graph, purposeNodeId(selection.purposeId));
  return transferReachability(graph, `transfer:${selection.transferId}`);
}

function accountReachability(graph: AccountFlowGraph, selectedAccountId: string): Reachability {
  if (!graph.nodes.some((node) => node.id === selectedAccountId && node.kind === 'account')) return emptyReachability();
  const transferEdges = graph.edges.filter(isActiveTransfer);
  const upstream = traverse(selectedAccountId, transferEdges, 'upstream');
  const downstream = traverse(selectedAccountId, transferEdges, 'downstream');
  const nodeIds = new Set([...upstream.nodeIds, ...downstream.nodeIds]);
  const edgeIds = new Set([...upstream.edgeIds, ...downstream.edgeIds]);
  const terminalAccountIds = new Set([selectedAccountId, ...downstream.nodeIds]);

  for (const edge of graph.edges) {
    if (edge.kind === 'external-income' && nodeIds.has(edge.targetId)) {
      nodeIds.add(edge.sourceId);
      edgeIds.add(edge.id);
    }
    if ((edge.kind === 'purpose' || edge.kind === 'warning') && terminalAccountIds.has(edge.sourceId)) {
      nodeIds.add(edge.targetId);
      edgeIds.add(edge.id);
    }
  }
  return { nodeIds, edgeIds };
}

function purposeReachability(graph: AccountFlowGraph, purposeId: string): Reachability {
  const purposeEdges = graph.edges.filter((edge) => edge.kind === 'purpose' && edge.targetId === purposeId);
  const nodeIds = new Set<string>([purposeId]);
  const edgeIds = new Set<string>(purposeEdges.map(({ id }) => id));
  for (const edge of purposeEdges) {
    const upstream = traverse(edge.sourceId, graph.edges.filter(isActiveTransfer), 'upstream');
    for (const id of upstream.nodeIds) nodeIds.add(id);
    for (const id of upstream.edgeIds) edgeIds.add(id);
    for (const income of graph.edges.filter((candidate) => candidate.kind === 'external-income'
      && upstream.nodeIds.has(candidate.targetId))) {
      nodeIds.add(income.sourceId);
      edgeIds.add(income.id);
    }
  }
  return { nodeIds, edgeIds };
}

function transferReachability(graph: AccountFlowGraph, transferId: string): Reachability {
  const selected = graph.edges.find((edge) => edge.id === transferId && isActiveTransfer(edge));
  if (selected === undefined) return emptyReachability();
  const transferEdges = graph.edges.filter(isActiveTransfer);
  const upstream = traverse(selected.sourceId, transferEdges, 'upstream');
  const downstream = traverse(selected.targetId, transferEdges, 'downstream');
  const nodeIds = new Set([...upstream.nodeIds, ...downstream.nodeIds]);
  const edgeIds = new Set([...upstream.edgeIds, ...downstream.edgeIds, selected.id]);
  for (const income of graph.edges.filter((edge) => edge.kind === 'external-income'
    && nodeIds.has(edge.targetId))) {
    nodeIds.add(income.sourceId);
    edgeIds.add(income.id);
  }
  return { nodeIds, edgeIds };
}

function traverse(
  startId: string,
  edges: readonly Extract<AccountFlowEdge, { kind: 'fixed' | 'sweep' }>[],
  direction: 'upstream' | 'downstream',
): Reachability {
  const nodeIds = new Set<string>([startId]);
  const edgeIds = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      const matches = direction === 'upstream' ? edge.targetId === current : edge.sourceId === current;
      if (!matches) continue;
      edgeIds.add(edge.id);
      const next = direction === 'upstream' ? edge.sourceId : edge.targetId;
      if (!nodeIds.has(next)) {
        nodeIds.add(next);
        queue.push(next);
      }
    }
  }
  return { nodeIds, edgeIds };
}

function buildDetailGroups(
  graph: AccountFlowGraph,
  selection: AccountFlowSelection,
  related: Reachability,
  nodeById: ReadonlyMap<string, AccountFlowNode>,
): AccountFlowDetailGroup[] {
  const accountId = selectedAccountId(selection, graph);
  if (accountId === null) return [];
  const rowsFor = (filter: (edge: AccountFlowEdge) => boolean) => graph.edges
    .filter(filter)
    .filter((edge) => related.edgeIds.has(edge.id))
    .map((edge) => detailRow(edge, nodeById, accountId));
  const groups: AccountFlowDetailGroup[] = [
    group('incoming', rowsFor((edge) => (edge.kind === 'external-income' || isActiveTransfer(edge)) && edge.targetId === accountId)),
    group('local-allocations', rowsFor((edge) => edge.kind === 'purpose' && edge.sourceId === accountId)),
    group('outgoing', rowsFor((edge) => isActiveTransfer(edge) && edge.sourceId === accountId)),
    group('unassigned', rowsFor((edge) => edge.kind === 'warning' && edge.warningKind === 'unassigned' && edge.sourceId === accountId)),
    group('shortfall', rowsFor((edge) => edge.kind === 'warning' && edge.warningKind === 'shortfall' && edge.sourceId === accountId)),
  ];
  return groups.filter((candidate) => candidate.rows.length > 0);
}

function selectedAccountId(selection: AccountFlowSelection, graph: AccountFlowGraph): string | null {
  if (selection?.type === 'account') return accountNodeId(selection.locationId);
  if (selection?.type === 'transfer') {
    const edge = graph.edges.find((candidate) => candidate.id === `transfer:${selection.transferId}`);
    return edge !== undefined && isActiveTransfer(edge) ? edge.sourceId : null;
  }
  if (selection?.type === 'purpose') {
    const edge = graph.edges.find((candidate) => candidate.kind === 'purpose'
      && candidate.targetId === purposeNodeId(selection.purposeId));
    return edge?.sourceId ?? null;
  }
  return null;
}

function group(
  key: AccountFlowDetailGroup['key'],
  rows: readonly AccountFlowDetailRow[],
): AccountFlowDetailGroup {
  return {
    key,
    label: {
      incoming: '들어오는 흐름',
      'local-allocations': '이 계좌에서 쓰거나 남기는 금액',
      outgoing: '다른 계좌로 보내는 흐름',
      unassigned: '계획상 미배정',
      shortfall: '계획상 부족',
    }[key],
    rows,
  };
}

function detailRow(
  edge: AccountFlowEdge,
  nodeById: ReadonlyMap<string, AccountFlowNode>,
  selectedAccountId: string,
): AccountFlowDetailRow {
  const target = nodeById.get(edge.targetId)?.label ?? '연결';
  const source = nodeById.get(edge.sourceId)?.label ?? '연결';
  return {
    id: edge.id,
    label: edge.targetId === selectedAccountId ? source : target,
    kind: edge.kind === 'warning' ? 'warning' : edge.kind,
    amountWon: edge.amountWon,
    statusLabel: statusLabel(edge),
  };
}

function buildCanonicalTableRows(
  graph: AccountFlowGraph,
  nodeById: ReadonlyMap<string, AccountFlowNode>,
): AccountFlowTableRow[] {
  const rankByAccountId = new Map(graph.topologicalOrder.map((locationId, index) => [accountNodeId(locationId), index]));
  return graph.edges
    .filter((edge): edge is Exclude<AccountFlowEdge, { kind: 'warning' }> => edge.kind !== 'warning')
    .slice()
    .sort((left, right) => canonicalEdgeRank(left, rankByAccountId) - canonicalEdgeRank(right, rankByAccountId)
      || compareLabels(nodeById.get(left.sourceId), nodeById.get(right.sourceId))
      || compareLabels(nodeById.get(left.targetId), nodeById.get(right.targetId))
      || left.id.localeCompare(right.id))
    .map((edge) => ({
      sourceLabel: nodeById.get(edge.sourceId)?.label ?? '연결',
      targetLabel: nodeById.get(edge.targetId)?.label ?? '연결',
      kind: edge.kind,
      amountWon: edge.amountWon,
      statusLabel: statusLabel(edge),
    }));
}

function canonicalEdgeRank(
  edge: Exclude<AccountFlowEdge, { kind: 'warning' }>,
  rankByAccountId: ReadonlyMap<string, number>,
): number {
  const accountRank = rankByAccountId.get(edge.sourceId) ?? Number.MAX_SAFE_INTEGER;
  if (edge.kind === 'external-income') return -1_000_000 + (rankByAccountId.get(edge.targetId) ?? 0);
  if (edge.kind === 'fixed' || edge.kind === 'sweep') return accountRank;
  return 1_000_000 + accountRank;
}

function compareLabels(left: AccountFlowNode | undefined, right: AccountFlowNode | undefined): number {
  return (left?.label ?? '').normalize('NFKC').trim().toLocaleLowerCase('ko-KR')
    .localeCompare((right?.label ?? '').normalize('NFKC').trim().toLocaleLowerCase('ko-KR'));
}

function statusLabel(edge: AccountFlowEdge): string {
  if (edge.status === 'suspended') return '중지됨';
  if (edge.kind === 'warning') return edge.warningKind === 'shortfall' ? '확인 필요: 부족' : '확인 필요: 미배정';
  return edge.kind === 'sweep' ? '남은 금액 전부' : '계획됨';
}

function isActiveTransfer(edge: AccountFlowEdge): edge is Extract<AccountFlowEdge, { kind: 'fixed' | 'sweep' }> {
  return (edge.kind === 'fixed' || edge.kind === 'sweep') && edge.status === 'active';
}

function isFlowAmountEdge(graph: AccountFlowGraph, edgeId: string): boolean {
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  return edge !== undefined && (edge.kind === 'fixed' || edge.kind === 'sweep' || edge.kind === 'purpose' || edge.kind === 'external-income');
}

function emptyReachability(): Reachability {
  return { nodeIds: new Set(), edgeIds: new Set() };
}

function sortIds(ids: Iterable<string>): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

interface Reachability {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}
