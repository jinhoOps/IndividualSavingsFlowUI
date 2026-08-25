import type { AccountMapGraph } from './mapLayout';

export interface AccountMapConnectionDetailRow {
  purposeId: string;
  label: string;
  amountWon: number;
  percent: number;
}

export interface AccountMapConnectionDetail {
  totalWon: number;
  rows: readonly AccountMapConnectionDetailRow[];
}

export function summarizeLocationConnectionDetail(
  graph: Pick<AccountMapGraph, 'nodes' | 'edges'>,
  locationId: string,
): AccountMapConnectionDetail | null {
  const location = graph.nodes.find((node) => node.id === locationId);
  if (location?.kind !== 'location') return null;

  const purposeById = new Map(graph.nodes
    .filter((node) => node.kind === 'purpose')
    .map((node, index) => [node.id, { label: node.label, order: index }]));
  const amountsByPurposeId = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.locationId !== locationId || edge.status !== 'active') continue;
    if (!purposeById.has(edge.purposeId)) continue;
    amountsByPurposeId.set(edge.purposeId, (amountsByPurposeId.get(edge.purposeId) ?? 0) + edge.amountWon);
  }

  const totalWon = [...amountsByPurposeId.values()].reduce((sum, amountWon) => sum + amountWon, 0);
  if (totalWon === 0) return { totalWon: 0, rows: [] };

  return {
    totalWon,
    rows: [...amountsByPurposeId.entries()]
      .sort(([leftId], [rightId]) => (purposeById.get(leftId)?.order ?? Number.MAX_SAFE_INTEGER)
        - (purposeById.get(rightId)?.order ?? Number.MAX_SAFE_INTEGER))
      .map(([purposeId, amountWon]) => ({
        purposeId,
        label: purposeById.get(purposeId)?.label ?? '목적',
        amountWon,
        percent: amountWon / totalWon * 100,
      })),
  };
}
