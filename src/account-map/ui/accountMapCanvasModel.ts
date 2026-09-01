import type { MapInteractionState } from '../application/reducer';
import type { AccountMapApplied } from '../domain/model';
import type { GraphEdge } from './accountMapGraph';
import type { PositionedGraph, PositionedNode } from './accountMapLayout';

export interface AccountMapCanvasModel {
  nodeById: ReadonlyMap<string, PositionedNode>;
  canonicalRows: GraphEdge[];
  connectedIds: ReadonlySet<string>;
  focusedId: string | null;
  focusedNode?: PositionedNode;
  pinnedLocationId: string | null;
}

export interface AccountMapModalRelation {
  label: string;
  amountWon: number;
  status: GraphEdge['status'];
  suspendedReason?: 'location-archived' | 'user';
  linkId: string;
  purposeId: string;
  purposeTargetWon?: number;
  locationId: string;
  remainder: boolean;
  replacementCandidate?: boolean;
}

export function buildAccountMapCanvasModel(
  graph: PositionedGraph,
  interaction: MapInteractionState,
): AccountMapCanvasModel {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodeOrderById = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const canonicalRows = graph.nodes
    .filter((node) => node.kind === 'location')
    .flatMap((location) => graph.edges
      .filter((edge) => edge.locationId === location.id)
      .sort((left, right) => {
        const purposeDifference = (nodeOrderById.get(left.purposeId) ?? Number.MAX_SAFE_INTEGER)
          - (nodeOrderById.get(right.purposeId) ?? Number.MAX_SAFE_INTEGER);
        return purposeDifference || left.id.localeCompare(right.id);
      }));
  const focusedId = interaction.transientNodeId ?? interaction.pinnedNodeId;
  const focusedNode = focusedId === null ? undefined : nodeById.get(focusedId);
  const connectedIds = new Set<string>(focusedId === null ? [] : graph.edges.flatMap((edge) => (
    edge.purposeId === focusedId || edge.locationId === focusedId ? [edge.purposeId, edge.locationId] : []
  )));
  if (focusedId !== null) connectedIds.add(focusedId);
  const pinnedNode = interaction.pinnedNodeId === null ? undefined : nodeById.get(interaction.pinnedNodeId);

  return {
    nodeById,
    canonicalRows,
    connectedIds,
    focusedId,
    focusedNode,
    pinnedLocationId: pinnedNode?.kind === 'location' ? pinnedNode.id : null,
  };
}

export function buildAccountMapModalRelations(
  graph: PositionedGraph,
  applied: AccountMapApplied,
  modalNodeId: string | null,
): AccountMapModalRelation[] {
  if (modalNodeId === null) return [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const modalNode = nodeById.get(modalNodeId);
  if (modalNode === undefined) return [];

  const directRelations = graph.edges
    .filter((edge) => edge.purposeId === modalNode.id || edge.locationId === modalNode.id)
    .map((edge) => {
      const sourceLink = applied.links.find(({ id }) => id === edge.id);
      return {
        label: nodeById.get(edge.purposeId === modalNode.id ? edge.locationId : edge.purposeId)?.label ?? '연결',
        amountWon: edge.amountWon,
        status: edge.status,
        suspendedReason: sourceLink?.status === 'suspended' ? sourceLink.suspendedReason : undefined,
        linkId: edge.id,
        purposeId: edge.purposeId,
        purposeTargetWon: nodeById.get(edge.purposeId)?.allocationTargetWon,
        locationId: edge.locationId.replace(/^location:/u, ''),
        remainder: sourceLink?.remainder ?? false,
      };
    });
  const replacementRelations = modalNode.kind !== 'location' ? [] : [...new Set(
    directRelations.map(({ purposeId }) => purposeId),
  )].flatMap((purposeId) => graph.edges
    .filter((edge) => edge.purposeId === purposeId && edge.locationId !== modalNode.id && edge.status === 'active')
    .map((edge) => ({
      label: nodeById.get(edge.locationId)?.label ?? '다른 계좌',
      amountWon: edge.amountWon,
      status: edge.status,
      linkId: edge.id,
      purposeId: edge.purposeId,
      purposeTargetWon: nodeById.get(edge.purposeId)?.allocationTargetWon,
      locationId: edge.locationId.replace(/^location:/u, ''),
      remainder: false,
      replacementCandidate: true,
    })));

  return [...directRelations, ...replacementRelations];
}

export function withDisplayedPercents<Row extends { percent: number }>(
  rows: readonly Row[],
): Array<Row & { displayPercent: number }> {
  if (rows.length === 0) return [];
  const floors = rows.map(({ percent }) => Math.floor(percent));
  const remaining = 100 - floors.reduce((sum, percent) => sum + percent, 0);
  const indices = rows.map(({ percent }, index) => ({ index, remainder: percent - floors[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) floors[indices[index]?.index ?? 0]! += 1;
  return rows.map((row, index) => ({ ...row, displayPercent: floors[index]! }));
}
