import { accountFlowReadingOrder, type AccountFlowEdge, type AccountFlowGraph, type AccountFlowNode } from './accountFlowGraph';

export type AccountFlowZoom = 'overview' | 'default' | 'detail';

export interface AccountFlowViewport {
  width: number;
  height: number;
}

export type PositionedAccountFlowNode = AccountFlowNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
  lane: number;
};

export type RoutedAccountFlowEdge = AccountFlowEdge & {
  points: readonly { x: number; y: number }[];
  /** Intentionally amount-invariant; amounts are text, never visual weight. */
  strokeWidth: number;
};

export interface AccountFlowLayout {
  direction: 'left-to-right' | 'top-to-bottom';
  zoom: AccountFlowZoom;
  width: number;
  height: number;
  nodes: readonly PositionedAccountFlowNode[];
  edges: readonly RoutedAccountFlowEdge[];
  focusOrder: readonly string[];
}

const nodeHeight = 72;
const desktopNodeWidth = 168;
const mobileNodeWidth = 168;
const gap = 16;
const margin = 24;

/**
 * Places a graph from topology only. Coordinates are a disposable projection:
 * neither zoom nor an amount is allowed to change stored state or edge weight.
 */
export function layoutAccountFlow(
  graph: AccountFlowGraph,
  viewport: AccountFlowViewport,
  zoom: AccountFlowZoom,
): AccountFlowLayout {
  const direction = viewport.width <= 768 ? 'top-to-bottom' : 'left-to-right';
  const ranked = rankNodes(graph);
  const orderedRanks = reduceCrossings(graph, ranked);
  const geometry = direction === 'left-to-right'
    ? placeDesktop(orderedRanks, viewport)
    : placeMobile(orderedRanks, viewport);
  const nodeById = new Map(geometry.nodes.map((node) => [node.id, node]));
  const edges = graph.edges
    .slice()
    .sort(compareById)
    .flatMap((edge) => {
      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);
      return source === undefined || target === undefined ? [] : [routeEdge(edge, source, target, direction)];
    });

  return {
    direction,
    zoom,
    width: geometry.width,
    height: geometry.height,
    nodes: geometry.nodes,
    edges,
    focusOrder: accountFlowReadingOrder(graph),
  };
}

function rankNodes(graph: AccountFlowGraph): Map<number, AccountFlowNode[]> {
  const accounts = graph.nodes.filter((node): node is Extract<AccountFlowNode, { kind: 'account' }> => node.kind === 'account');
  const nodeById: ReadonlyMap<string, AccountFlowNode> = new Map(graph.nodes.map((node) => [node.id, node]));
  const transferEdges: Extract<AccountFlowEdge, { kind: 'fixed' | 'sweep' }>[] = graph.edges.filter(isActiveTransfer);
  const outgoing = new Map<string, typeof transferEdges>();
  const indegree = new Map(accounts.map((account) => [account.id, 0]));
  for (const edge of transferEdges) {
    const list = outgoing.get(edge.sourceId) ?? [];
    list.push(edge);
    outgoing.set(edge.sourceId, list);
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }
  for (const edges of outgoing.values()) edges.sort(compareById);

  const accountRank = new Map<string, number>();
  const queue = [...indegree.entries()]
    .filter(([, value]) => value === 0)
    .map(([id]) => id)
    .sort((left, right) => compareNode(nodeById.get(left), nodeById.get(right)));
  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    const sourceRank = accountRank.get(sourceId) ?? 1;
    accountRank.set(sourceId, sourceRank);
    for (const edge of outgoing.get(sourceId) ?? []) {
      accountRank.set(edge.targetId, Math.max(accountRank.get(edge.targetId) ?? 1, sourceRank + 1));
      const next = (indegree.get(edge.targetId) ?? 0) - 1;
      indegree.set(edge.targetId, next);
      if (next === 0) insertSorted(queue, edge.targetId, (left, right) => compareNode(nodeById.get(left), nodeById.get(right)));
    }
  }
  // Invalid transient cycles cannot be stored. Keep their view deterministic until
  // the command layer presents the structural error.
  for (const account of accounts.sort(compareNode)) {
    if (!accountRank.has(account.id)) accountRank.set(account.id, 1);
  }

  const highestAccountRank = Math.max(1, ...accountRank.values());
  const rankById = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.kind === 'external-income') rankById.set(node.id, 0);
    else if (node.kind === 'account') rankById.set(node.id, accountRank.get(node.id) ?? 1);
  }
  for (const node of graph.nodes) {
    if (node.kind !== 'purpose' && node.kind !== 'warning') continue;
    const incomingRanks = graph.edges
      .filter((edge) => edge.targetId === node.id)
      .map((edge) => rankById.get(edge.sourceId))
      .filter((rank): rank is number => rank !== undefined);
    rankById.set(node.id, (incomingRanks.length === 0 ? highestAccountRank : Math.max(...incomingRanks)) + 1);
  }

  const result = new Map<number, AccountFlowNode[]>();
  for (const node of graph.nodes) {
    const rank = rankById.get(node.id) ?? highestAccountRank + 1;
    const group = result.get(rank) ?? [];
    group.push(node);
    result.set(rank, group);
  }
  for (const group of result.values()) group.sort(compareNode);
  return result;
}

function reduceCrossings(
  graph: AccountFlowGraph,
  ranks: ReadonlyMap<number, readonly AccountFlowNode[]>,
): Map<number, AccountFlowNode[]> {
  const ordered = new Map<number, AccountFlowNode[]>([...ranks.entries()].map(([rank, nodes]) => [rank, [...nodes]]));
  const rankKeys = [...ordered.keys()].sort((left, right) => left - right);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const direction of ['forward', 'backward'] as const) {
      const keys = direction === 'forward' ? rankKeys : [...rankKeys].reverse();
      for (const rank of keys) {
        const nodes = ordered.get(rank)!;
        const neighbourRank = direction === 'forward' ? rank - 1 : rank + 1;
        const neighbours = ordered.get(neighbourRank);
        if (neighbours === undefined) continue;
        const positionById = new Map(neighbours.map((node, index) => [node.id, index]));
        nodes.sort((left, right) => barycenter(graph, left.id, positionById) - barycenter(graph, right.id, positionById)
          || compareNode(left, right));
      }
    }
  }
  return ordered;
}

function barycenter(
  graph: AccountFlowGraph,
  nodeId: string,
  neighbourPositionById: ReadonlyMap<string, number>,
): number {
  const positions = graph.edges.flatMap((edge) => {
    if (edge.sourceId === nodeId) {
      const position = neighbourPositionById.get(edge.targetId);
      return position === undefined ? [] : [position];
    }
    if (edge.targetId === nodeId) {
      const position = neighbourPositionById.get(edge.sourceId);
      return position === undefined ? [] : [position];
    }
    return [];
  });
  return positions.length === 0
    ? Number.MAX_SAFE_INTEGER
    : positions.reduce((sum, position) => sum + position, 0) / positions.length;
}

function placeDesktop(ranks: ReadonlyMap<number, readonly AccountFlowNode[]>, viewport: AccountFlowViewport): Geometry {
  const rankKeys = [...ranks.keys()].sort((left, right) => left - right);
  const rankCount = rankKeys.length;
  const availableWidth = Math.max(1, viewport.width - margin * 2);
  const columnCount = Math.max(1, Math.min(
    Math.max(1, rankCount),
    Math.floor((availableWidth + gap) / (desktopNodeWidth + gap)),
  ));
  const nodeWidth = Math.min(
    desktopNodeWidth,
    Math.max(44, (availableWidth - gap * (columnCount - 1)) / columnCount),
  );
  const width = viewport.width;
  const stepX = columnCount <= 1
    ? 0
    : (width - margin * 2 - nodeWidth) / (columnCount - 1);
  const lanes = chunkRanks(rankKeys, columnCount, ranks);
  const height = Math.max(
    viewport.height,
    margin * 2 + lanes.reduce((total, lane) => total + lane.height, 0) + Math.max(0, lanes.length - 1) * gap,
  );
  let laneY = margin;
  const nodes: PositionedAccountFlowNode[] = [];
  for (const [laneIndex, lane] of lanes.entries()) {
    for (const [rankIndex, rank] of lane.ranks.entries()) {
      const column = rankIndex;
      for (const [index, node] of (ranks.get(rank) ?? []).entries()) {
        nodes.push({
          ...node,
          x: margin + column * stepX,
          y: laneY + index * (nodeHeight + gap),
          width: nodeWidth,
          height: nodeHeight,
          rank,
          lane: laneIndex,
        });
      }
    }
    laneY += lane.height + gap;
  }
  return { width, height, nodes };
}

function placeMobile(ranks: ReadonlyMap<number, readonly AccountFlowNode[]>, viewport: AccountFlowViewport): Geometry {
  const width = Math.max(280, viewport.width);
  const rankKeys = [...ranks.keys()].sort((left, right) => left - right);
  const maximumColumns = Math.max(1, Math.floor((width - margin * 2 + gap) / (96 + gap)));
  const blocks = rankKeys.map((rank) => {
    const nodes = ranks.get(rank) ?? [];
    const columns = Math.max(1, Math.min(maximumColumns, nodes.length));
    const nodeWidth = Math.min(mobileNodeWidth, (width - margin * 2 - gap * (columns - 1)) / columns);
    const rows = Math.max(1, Math.ceil(nodes.length / columns));
    return { rank, nodes, columns, nodeWidth, rows };
  });
  const contentHeight = margin * 2 + blocks.reduce((total, block) => total + block.rows * nodeHeight
    + Math.max(0, block.rows - 1) * gap, 0) + Math.max(0, blocks.length - 1) * gap * 2;
  const height = Math.max(viewport.height, contentHeight);
  let y = margin;
  const nodes: PositionedAccountFlowNode[] = [];
  for (const [lane, block] of blocks.entries()) {
    const contentWidth = block.columns * block.nodeWidth + (block.columns - 1) * gap;
    const xStart = Math.max(margin, (width - contentWidth) / 2);
    for (const [index, node] of block.nodes.entries()) {
      const column = index % block.columns;
      const row = Math.floor(index / block.columns);
      nodes.push({
        ...node,
        x: xStart + column * (block.nodeWidth + gap),
        y: y + row * (nodeHeight + gap),
        width: block.nodeWidth,
        height: nodeHeight,
        rank: block.rank,
        lane,
      });
    }
    y += block.rows * nodeHeight + Math.max(0, block.rows - 1) * gap + gap * 2;
  }
  return {
    width,
    height,
    nodes,
  };
}

function routeEdge(
  edge: AccountFlowEdge,
  source: PositionedAccountFlowNode,
  target: PositionedAccountFlowNode,
  direction: AccountFlowLayout['direction'],
): RoutedAccountFlowEdge {
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterY = target.y + target.height / 2;
  if (direction === 'left-to-right') {
    if (target.lane > source.lane) {
      const sourceY = source.y + source.height;
      const targetY = target.y;
      const middleY = (sourceY + targetY) / 2;
      return { ...edge, points: [{ x: sourceCenterX, y: sourceY }, { x: sourceCenterX, y: middleY }, { x: targetCenterX, y: middleY }, { x: targetCenterX, y: targetY }], strokeWidth: 2 };
    }
    if (target.x < source.x) {
      const sourceX = source.x;
      const targetX = target.x + target.width;
      const middleX = (sourceX + targetX) / 2;
      return { ...edge, points: [{ x: sourceX, y: sourceCenterY }, { x: middleX, y: sourceCenterY }, { x: middleX, y: targetCenterY }, { x: targetX, y: targetCenterY }], strokeWidth: 2 };
    }
    const sourceX = source.x + source.width;
    const targetX = target.x;
    const sourceY = sourceCenterY;
    const targetY = targetCenterY;
    const middleX = (sourceX + targetX) / 2;
    return { ...edge, points: [{ x: sourceX, y: sourceY }, { x: middleX, y: sourceY }, { x: middleX, y: targetY }, { x: targetX, y: targetY }], strokeWidth: 2 };
  }
  const sourceX = source.x + source.width / 2;
  const targetX = target.x + target.width / 2;
  const sourceY = source.y + source.height;
  const targetY = target.y;
  const middleY = (sourceY + targetY) / 2;
  return { ...edge, points: [{ x: sourceX, y: sourceY }, { x: sourceX, y: middleY }, { x: targetX, y: middleY }, { x: targetX, y: targetY }], strokeWidth: 2 };
}

function isActiveTransfer(edge: AccountFlowEdge): edge is Extract<AccountFlowEdge, { kind: 'fixed' | 'sweep' }> {
  return (edge.kind === 'fixed' || edge.kind === 'sweep') && edge.status === 'active';
}

function insertSorted(values: string[], value: string, compare: (left: string, right: string) => number): void {
  const index = values.findIndex((candidate) => compare(candidate, value) > 0);
  if (index === -1) values.push(value);
  else values.splice(index, 0, value);
}

function compareNode(left: AccountFlowNode | undefined, right: AccountFlowNode | undefined): number {
  const leftLabel = (left?.label ?? '').normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
  const rightLabel = (right?.label ?? '').normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
  return leftLabel.localeCompare(rightLabel) || (left?.id ?? '').localeCompare(right?.id ?? '');
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function chunkRanks(
  rankKeys: readonly number[],
  columnCount: number,
  ranks: ReadonlyMap<number, readonly AccountFlowNode[]>,
): Array<{ ranks: readonly number[]; height: number }> {
  const result: Array<{ ranks: readonly number[]; height: number }> = [];
  for (let start = 0; start < rankKeys.length; start += columnCount) {
    const laneRanks = rankKeys.slice(start, start + columnCount);
    const maximumNodes = Math.max(1, ...laneRanks.map((rank) => (ranks.get(rank) ?? []).length));
    result.push({
      ranks: laneRanks,
      height: maximumNodes * nodeHeight + Math.max(0, maximumNodes - 1) * gap,
    });
  }
  return result;
}

interface Geometry {
  width: number;
  height: number;
  nodes: PositionedAccountFlowNode[];
}
