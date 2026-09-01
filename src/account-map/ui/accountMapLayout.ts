import {
  compareGraphNodes,
  type AccountMapGraph,
  type GraphEdge,
  type GraphNode,
  type MapZoom,
} from './accountMapGraph';
import { createAccountMapLayoutPolicy } from './accountMapLayoutPolicy';

export interface PositionedNode extends GraphNode { x: number; y: number; width: number; height: number }

export interface PositionedGraph {
  direction: 'left-to-right' | 'top-to-bottom';
  nodes: PositionedNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function layoutAccountMap(
  graph: AccountMapGraph,
  viewport: { width: number; height: number },
  _zoom: MapZoom,
): PositionedGraph {
  const policy = createAccountMapLayoutPolicy(viewport);
  const ordered = [...graph.nodes].sort(compareGraphNodes);
  const height = policy.direction === 'top-to-bottom'
    ? mobileContentHeight(ordered.length, policy)
    : desktopContentHeight(ordered, policy);
  const nodes = policy.direction === 'top-to-bottom'
    ? placeGrid(ordered, height, policy)
    : placeColumns(ordered, height, policy);

  return {
    direction: policy.direction,
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
    width: policy.width,
    height,
  };
}

function mobileContentHeight(
  nodeCount: number,
  policy: ReturnType<typeof createAccountMapLayoutPolicy>,
): number {
  const rows = Math.ceil(nodeCount / policy.columns);
  return Math.max(
    policy.minimumHeight,
    policy.margin * 2 + rows * policy.nodeHeight + Math.max(0, rows - 1) * 12,
  );
}

function desktopContentHeight(
  nodes: readonly GraphNode[],
  policy: ReturnType<typeof createAccountMapLayoutPolicy>,
): number {
  const sideCount = Math.max(
    nodes.filter(({ kind }) => kind === 'location').length,
    nodes.filter(({ kind }) => kind === 'purpose').length,
  );
  return Math.max(
    policy.minimumHeight,
    policy.margin * 2 + sideCount * policy.nodeHeight + Math.max(0, sideCount - 1) * 12,
  );
}

function placeGrid(
  nodes: readonly GraphNode[],
  height: number,
  policy: ReturnType<typeof createAccountMapLayoutPolicy>,
): PositionedNode[] {
  const rows = Math.ceil(nodes.length / policy.columns);
  const availableHeight = height - policy.margin * 2;
  const actualHeight = rows <= 1
    ? policy.nodeHeight
    : Math.max(44, Math.min(policy.nodeHeight, (availableHeight - (rows - 1) * 4) / rows));
  const stepY = rows <= 1 ? 0 : (availableHeight - actualHeight) / (rows - 1);
  const contentWidth = policy.columns * policy.nodeWidth + (policy.columns - 1) * 12;
  const startX = Math.max(policy.margin, (policy.width - contentWidth) / 2);

  return nodes.map((node, index) => ({
    ...node,
    x: startX + (index % policy.columns) * (policy.nodeWidth + 12),
    y: policy.margin + Math.floor(index / policy.columns) * stepY,
    width: policy.nodeWidth,
    height: actualHeight,
  }));
}

function placeColumns(
  nodes: readonly GraphNode[],
  height: number,
  policy: ReturnType<typeof createAccountMapLayoutPolicy>,
): PositionedNode[] {
  const status = nodes.filter(({ kind }) => kind === 'status');
  const left = nodes.filter(({ kind }) => kind === 'location');
  const right = nodes.filter(({ kind }) => kind === 'purpose');

  return [
    ...placeSide(left, policy.margin, height, policy),
    ...placeSide(right, policy.width - policy.margin - policy.nodeWidth, height, policy),
    ...status.map((node, index) => ({
      ...node,
      x: (policy.width - policy.nodeWidth) / 2,
      y: policy.margin + index * (policy.nodeHeight + 8),
      width: policy.nodeWidth,
      height: policy.nodeHeight,
    })),
  ];
}

function placeSide(
  nodes: readonly GraphNode[],
  x: number,
  height: number,
  policy: ReturnType<typeof createAccountMapLayoutPolicy>,
): PositionedNode[] {
  const availableHeight = height - policy.margin * 2;
  const actualHeight = nodes.length <= 1
    ? policy.nodeHeight
    : Math.max(44, Math.min(policy.nodeHeight, (availableHeight - (nodes.length - 1) * 4) / nodes.length));
  const step = nodes.length <= 1 ? 0 : (availableHeight - actualHeight) / (nodes.length - 1);

  return nodes.map((node, index) => ({
    ...node,
    x,
    y: policy.margin + index * step,
    width: policy.nodeWidth,
    height: actualHeight,
  }));
}
