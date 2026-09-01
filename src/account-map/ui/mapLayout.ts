import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountMapApplied } from '../domain/model';
import {
  buildAccountMapGraphSource,
  compareGraphNodes,
  projectAccountMapGraph,
  type AccountMapGraph,
  type GraphEdge,
  type GraphNode,
  type MapZoom,
} from './accountMapGraph';

export {
  buildAccountMapGraphSource,
  compareGraphNodes,
  projectAccountMapGraph,
  type AccountMapGraph,
  type AccountMapGraphSource,
  type GraphEdge,
  type GraphNode,
  type MapZoom,
} from './accountMapGraph';

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
  return projectAccountMapGraph(buildAccountMapGraphSource(applied, locations, main), zoom);
}

export function layoutAccountMap(
  graph: AccountMapGraph,
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
  const ordered = [...graph.nodes].sort(compareGraphNodes);
  const height = direction === 'top-to-bottom'
    ? mobileContentHeight(ordered.length, width, margin, nodeWidth, nodeHeight, minimumHeight)
    : desktopContentHeight(ordered, margin, nodeHeight, minimumHeight);
  const positioned = direction === 'top-to-bottom'
    ? placeGrid(ordered, width, height, margin, nodeWidth, nodeHeight)
    : placeColumns(ordered, width, height, margin, nodeWidth, nodeHeight);
  return { direction, nodes: positioned, edges: [...graph.edges], width, height };
}

function mobileContentHeight(nodeCount: number, width: number, margin: number, nodeWidth: number, nodeHeight: number, minimumHeight: number): number {
  const columns = Math.max(1, Math.floor((width - margin * 2 + 12) / (nodeWidth + 12)));
  const rows = Math.ceil(nodeCount / columns);
  return Math.max(minimumHeight, margin * 2 + rows * nodeHeight + Math.max(0, rows - 1) * 12);
}

function desktopContentHeight(nodes: GraphNode[], margin: number, nodeHeight: number, minimumHeight: number): number {
  const sideCount = Math.max(
    nodes.filter(({ kind }) => kind === 'location').length,
    nodes.filter(({ kind }) => kind === 'purpose').length,
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

function placeColumns(nodes: GraphNode[], width: number, height: number, margin: number, nodeWidth: number, nodeHeight: number): PositionedNode[] {
  const status = nodes.filter(({ kind }) => kind === 'status');
  const left = nodes.filter(({ kind }) => kind === 'location');
  const right = nodes.filter(({ kind }) => kind === 'purpose');
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
