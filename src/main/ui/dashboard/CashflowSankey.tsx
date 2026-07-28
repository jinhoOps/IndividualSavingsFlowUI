import type { CSSProperties } from 'react';
import type { SankeyGraph, SankeyNode } from '../../domain/sankey';

interface CashflowSankeyProps {
  graph: SankeyGraph;
}

interface PositionedNode extends SankeyNode {
  x: number;
  y: number;
}

const nodeWidth = 24;
const colors: Record<SankeyNode['kind'], string> = {
  income: '#0f766e',
  aggregate: '#0f172a',
  expense: '#dc2626',
  saving: '#2563eb',
  investment: '#7c3aed',
  available: '#64748b',
  deficit: '#f97316',
};

const outputY: Record<Extract<SankeyNode['kind'], 'expense' | 'saving' | 'investment' | 'available'>, number> = {
  expense: 92,
  saving: 198,
  investment: 278,
  available: 350,
};

function positionNodes(nodes: SankeyNode[]): PositionedNode[] {
  const inputNodes = nodes.filter((node) => node.kind === 'income' || node.kind === 'deficit');
  const inputSpacing = 320 / (inputNodes.length + 1);

  return nodes.map((node) => {
    if (node.kind === 'income' || node.kind === 'deficit') {
      return { ...node, x: 80, y: 50 + inputSpacing * (inputNodes.indexOf(node) + 1) };
    }
    if (node.kind === 'aggregate') return { ...node, x: 420, y: 210 };
    return { ...node, x: 760, y: outputY[node.kind] };
  });
}

function linkPath(source: PositionedNode, target: PositionedNode): string {
  const startX = source.x + nodeWidth;
  const endX = target.x;
  const middleX = (startX + endX) / 2;
  return `M ${startX} ${source.y} C ${middleX} ${source.y}, ${middleX} ${target.y}, ${endX} ${target.y}`;
}

function linkStyle(valueWon: number, largestLinkValue: number): CSSProperties {
  const width = largestLinkValue > 0 ? 8 + (valueWon / largestLinkValue) * 34 : 8;
  return { strokeWidth: width, strokeLinecap: 'round' };
}

export function CashflowSankey({ graph }: CashflowSankeyProps) {
  if (graph.nodes.length === 0 || graph.links.length === 0) {
    return <p role="status">표시할 현금흐름이 없습니다</p>;
  }

  const nodes = positionNodes(graph.nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const largestLinkValue = Math.max(...graph.links.map((link) => link.valueWon));

  return (
    <svg
      aria-label="월간 현금흐름 Sankey 그래프"
      className="cashflow-sankey"
      role="img"
      viewBox="0 0 960 420"
      width="100%"
    >
      <title>월간 현금흐름</title>
      <text fill="#64748b" fontSize="15" fontWeight="700" x="80" y="28">수입</text>
      <text fill="#64748b" fontSize="15" fontWeight="700" textAnchor="middle" x="432" y="28">집계</text>
      <text fill="#64748b" fontSize="15" fontWeight="700" x="760" y="28">지출 · 저축 · 투자</text>

      {graph.links.map((link) => {
        const source = nodesById.get(link.source);
        const target = nodesById.get(link.target);
        if (!source || !target) {
          throw new Error(`Sankey link references an unknown node: ${link.source} → ${link.target}`);
        }

        return (
          <path
            aria-hidden="true"
            d={linkPath(source, target)}
            fill="none"
            key={`${link.source}-${link.target}`}
            stroke={colors[target.kind]}
            strokeOpacity={target.kind === 'expense' ? 0.52 : 0.28}
            style={linkStyle(link.valueWon, largestLinkValue)}
          />
        );
      })}

      {nodes.map((node) => (
        <g key={node.id} transform={`translate(${node.x} ${node.y - 22})`}>
          <rect fill={colors[node.kind]} height="44" rx="7" width={nodeWidth} />
          <text fill="#0f172a" fontSize="15" fontWeight={node.kind === 'aggregate' || node.kind === 'expense' ? '700' : '500'} x="34" y="27">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
