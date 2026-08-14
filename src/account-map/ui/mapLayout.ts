import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountMapApplied, PurposeId, SystemPurposeId } from '../domain/model';
import { mainPurposeReferences, overallMainState, reconcilePurpose } from '../domain/reconciliation';

export type MapZoom = 'overview' | 'default' | 'detail';
export type MapLayout = 'purpose' | 'account';

export interface GraphNode {
  id: string;
  kind: 'purpose' | 'location' | 'status';
  label: string;
  secondary?: string;
  amountWon?: number;
  allocationTargetWon?: number;
  connectionCount: number;
  status: 'resolved' | 'unassigned' | 'excess' | 'suspended' | 'surplus' | 'deficit';
}

export interface GraphEdge {
  id: string;
  purposeId: string;
  locationId: string;
  amountWon: number;
  status: 'active' | 'suspended';
}

export interface AccountMapGraph { nodes: GraphNode[]; edges: GraphEdge[] }
export interface PositionedNode extends GraphNode { x: number; y: number; width: number; height: number }
export interface PositionedGraph {
  direction: 'left-to-right' | 'top-to-bottom';
  nodes: PositionedNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function buildAccountMapGraph(
  applied: AccountMapApplied,
  locations: readonly FinancialLocation[],
  main: MainData,
  zoom: MapZoom,
): AccountMapGraph {
  const activeCustom = applied.customPurposes.filter(({ archivedAt }) => archivedAt === undefined);
  const references = mainPurposeReferences(main);
  const purposeIds: PurposeId[] = [
    'system:income', 'system:housing', 'system:living', 'system:saving', 'system:investing',
    ...(zoom === 'overview' ? [] : activeCustom.map(({ id }) => id)),
  ];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const activeLinks = applied.links.filter(({ status }) => status === 'active');
  const eligibleLinks = applied.links.filter((link) => zoom === 'detail' || link.status === 'active');
  const links = zoom !== 'overview' ? eligibleLinks : purposeIds.flatMap((purposeId) => {
    const candidates = eligibleLinks.filter((link) => link.purposeId === purposeId && link.status === 'active');
    return candidates.slice(0, 1);
  });
  const visibleLocationIds = new Set(links.map(({ locationId }) => locationId));
  const purposeNodes: GraphNode[] = purposeIds.map((purposeId) => {
    const result = reconcilePurpose(purposeId, applied, locations, main);
    const count = activeLinks.filter((link) => link.purposeId === purposeId).length;
    return {
      id: purposeId,
      kind: 'purpose',
      label: purposeLabel(purposeId, applied),
      ...(zoom === 'overview' && count > 1 ? { secondary: `대표 계좌 · 외 ${count - 1}개` } : {}),
      amountWon: purposeId.startsWith('system:')
        ? references[purposeId as SystemPurposeId]
        : result.targetWon,
      allocationTargetWon: result.targetWon,
      connectionCount: count,
      status: result.excessWon > 0 ? 'excess' : result.unassignedWon > 0 ? 'unassigned' : 'resolved',
    };
  });
  const locationNodes: GraphNode[] = locations
    .filter((location) => zoom === 'overview'
      ? location.archivedAt === undefined && visibleLocationIds.has(location.id)
      : location.archivedAt === undefined || visibleLocationIds.has(location.id))
    .map((location) => {
      const connections = activeLinks.filter(({ locationId }) => locationId === location.id);
      return {
        id: locationNodeId(location.id),
        kind: 'location',
        label: location.shortName,
        ...(location.institution === undefined ? {} : { secondary: location.institution.name }),
        amountWon: connections.reduce((sum, { monthlyAmountWon }) => sum + monthlyAmountWon, 0),
        connectionCount: connections.length,
        status: location.archivedAt === undefined ? 'resolved' : 'suspended',
      };
    });
  const overall = overallMainState(main);
  const statusNodes: GraphNode[] = overall.remainingWon === 0 ? [] : [{
    id: 'status:overall',
    kind: 'status',
    label: overall.kind === 'deficit' ? '부족함' : '미배정',
    amountWon: overall.remainingWon,
    connectionCount: 0,
    status: overall.kind === 'deficit' ? 'deficit' : 'surplus',
  }];
  return {
    nodes: [...purposeNodes, ...locationNodes, ...statusNodes],
    edges: links.map((link) => ({
      id: link.id,
      purposeId: link.purposeId,
      locationId: locationNodeId(link.locationId),
      amountWon: link.monthlyAmountWon,
      status: link.status,
    })),
  };
}

export function layoutAccountMap(
  graph: AccountMapGraph,
  layout: MapLayout,
  viewport: { width: number; height: number },
  _zoom: MapZoom,
): PositionedGraph {
  const width = Math.max(280, viewport.width);
  const minimumHeight = Math.max(360, viewport.height);
  const direction = width <= 768 ? 'top-to-bottom' : 'left-to-right';
  const margin = width <= 480 ? 16 : 28;
  const nodeHeight = 78;
  const nodeWidth = direction === 'top-to-bottom'
    ? Math.min(184, (width - margin * 2 - 12) / (width < 540 ? 2 : 3))
    : Math.min(210, (width - margin * 3) / 2);
  const ordered = [...graph.nodes].sort((left, right) => {
    const leftRank = nodeRank(left, layout);
    const rightRank = nodeRank(right, layout);
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
  const height = direction === 'top-to-bottom'
    ? mobileContentHeight(ordered.length, width, margin, nodeWidth, nodeHeight, minimumHeight)
    : desktopContentHeight(ordered, layout, margin, nodeHeight, minimumHeight);
  const positioned = direction === 'top-to-bottom'
    ? placeGrid(ordered, width, height, margin, nodeWidth, nodeHeight)
    : placeColumns(ordered, layout, width, height, margin, nodeWidth, nodeHeight);
  return { direction, nodes: positioned, edges: [...graph.edges], width, height };
}

function mobileContentHeight(nodeCount: number, width: number, margin: number, nodeWidth: number, nodeHeight: number, minimumHeight: number): number {
  const columns = Math.max(1, Math.floor((width - margin * 2 + 12) / (nodeWidth + 12)));
  const rows = Math.ceil(nodeCount / columns);
  return Math.max(minimumHeight, margin * 2 + rows * nodeHeight + Math.max(0, rows - 1) * 12);
}

function desktopContentHeight(nodes: GraphNode[], layout: MapLayout, margin: number, nodeHeight: number, minimumHeight: number): number {
  const leftKind = layout === 'purpose' ? 'purpose' : 'location';
  const sideCount = Math.max(
    nodes.filter(({ kind }) => kind === leftKind).length,
    nodes.filter(({ kind }) => kind !== leftKind && kind !== 'status').length,
  );
  return Math.max(minimumHeight, margin * 2 + sideCount * nodeHeight + Math.max(0, sideCount - 1) * 12);
}

function placeGrid(nodes: GraphNode[], width: number, height: number, margin: number, nodeWidth: number, nodeHeight: number): PositionedNode[] {
  const columns = Math.max(1, Math.floor((width - margin * 2 + 12) / (nodeWidth + 12)));
  const rows = Math.ceil(nodes.length / columns);
  const availableHeight = height - margin * 2;
  const actualHeight = rows <= 1 ? nodeHeight : Math.max(44, Math.min(nodeHeight, (availableHeight - (rows - 1) * 4) / rows));
  const stepY = rows <= 1 ? 0 : (availableHeight - actualHeight) / (rows - 1);
  const contentWidth = columns * nodeWidth + (columns - 1) * 12;
  const startX = Math.max(margin, (width - contentWidth) / 2);
  return nodes.map((node, index) => ({
    ...node,
    x: startX + (index % columns) * (nodeWidth + 12),
    y: margin + Math.floor(index / columns) * stepY,
    width: nodeWidth,
    height: actualHeight,
  }));
}

function placeColumns(nodes: GraphNode[], layout: MapLayout, width: number, height: number, margin: number, nodeWidth: number, nodeHeight: number): PositionedNode[] {
  const status = nodes.filter(({ kind }) => kind === 'status');
  const leftKind = layout === 'purpose' ? 'purpose' : 'location';
  const left = nodes.filter(({ kind }) => kind === leftKind);
  const right = nodes.filter(({ kind }) => kind !== leftKind && kind !== 'status');
  return [
    ...placeSide(left, margin, height, margin, nodeWidth, nodeHeight),
    ...placeSide(right, width - margin - nodeWidth, height, margin, nodeWidth, nodeHeight),
    ...status.map((node, index) => ({ ...node, x: (width - nodeWidth) / 2, y: margin + index * (nodeHeight + 8), width: nodeWidth, height: nodeHeight })),
  ];
}

function placeSide(nodes: GraphNode[], x: number, height: number, margin: number, nodeWidth: number, nodeHeight: number): PositionedNode[] {
  const availableHeight = height - margin * 2;
  const actualHeight = nodes.length <= 1 ? nodeHeight : Math.max(44, Math.min(nodeHeight, (availableHeight - (nodes.length - 1) * 4) / nodes.length));
  const step = nodes.length <= 1 ? 0 : (availableHeight - actualHeight) / (nodes.length - 1);
  return nodes.map((node, index) => ({ ...node, x, y: margin + index * step, width: nodeWidth, height: actualHeight }));
}

function nodeRank(node: GraphNode, layout: MapLayout): number {
  if (node.kind === 'status') return 2;
  if (layout === 'purpose') return node.kind === 'purpose' ? 0 : 1;
  return node.kind === 'location' ? 0 : 1;
}

function purposeLabel(id: PurposeId, applied: AccountMapApplied): string {
  if (id.startsWith('custom:')) return applied.customPurposes.find(({ id: candidate }) => candidate === id)?.name ?? '세부 목적';
  return { 'system:income': '수입', 'system:housing': '주거', 'system:living': '생활비', 'system:saving': '저축', 'system:investing': '투자' }[id as SystemPurposeId];
}

function locationNodeId(locationId: string): string { return `location:${locationId}`; }
