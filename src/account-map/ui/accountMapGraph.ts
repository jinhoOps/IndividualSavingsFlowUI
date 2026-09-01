import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountMapApplied, PurposeId, SystemPurposeId } from '../domain/model';
import { mainPurposeReferences, overallMainState, reconcilePurpose } from '../domain/reconciliation';

export type MapZoom = 'overview' | 'default' | 'detail';

const systemPurposeIds: SystemPurposeId[] = [
  'system:income', 'system:housing', 'system:living', 'system:saving', 'system:investing',
];

export interface GraphNode {
  id: string;
  kind: 'purpose' | 'location' | 'status';
  label: string;
  secondary?: string;
  amountWon?: number;
  allocationTargetWon?: number;
  isPrimaryIncome?: boolean;
  purposeOrder?: number;
  customPurposeParentOrder?: number;
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

export interface AccountMapGraphSource {
  primaryIncomeLocationId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AccountMapGraph extends AccountMapGraphSource {}

export function buildAccountMapGraphSource(
  applied: AccountMapApplied,
  locations: readonly FinancialLocation[],
  main: MainData,
): AccountMapGraphSource {
  const activeCustom = applied.customPurposes.filter(({ archivedAt }) => archivedAt === undefined);
  const references = mainPurposeReferences(main);
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const activeLinks = applied.links.filter(({ status }) => status === 'active');
  const primaryIncomeLocationId = selectPrimaryIncomeLocationId(activeLinks, locationById);
  const purposeIds: PurposeId[] = [...systemPurposeIds, ...activeCustom.map(({ id }) => id)];
  const purposeNodes: GraphNode[] = purposeIds.map((purposeId) => {
    const result = reconcilePurpose(purposeId, applied, locations, main);
    const count = activeLinks.filter((link) => link.purposeId === purposeId).length;
    return {
      id: purposeId,
      kind: 'purpose',
      label: purposeLabel(purposeId, applied),
      amountWon: purposeId.startsWith('system:')
        ? references[purposeId as SystemPurposeId]
        : result.targetWon,
      allocationTargetWon: result.targetWon,
      ...(purposeId.startsWith('system:')
        ? { purposeOrder: systemPurposeIds.indexOf(purposeId as SystemPurposeId) }
        : {
          purposeOrder: systemPurposeIds.length,
          customPurposeParentOrder: systemPurposeIds.indexOf(activeCustom.find(({ id }) => id === purposeId)?.parentId ?? 'system:income'),
        }),
      connectionCount: count,
      status: result.excessWon > 0 ? 'excess' : result.unassignedWon > 0 ? 'unassigned' : 'resolved',
    };
  });
  const locationNodes: GraphNode[] = locations.map((location) => {
    const connections = activeLinks.filter(({ locationId }) => locationId === location.id);
    return {
      id: locationNodeId(location.id),
      kind: 'location',
      label: location.shortName,
      ...(location.institution === undefined ? {} : { secondary: location.institution.name }),
      amountWon: connections.reduce((sum, { monthlyAmountWon }) => sum + monthlyAmountWon, 0),
      ...(location.id === primaryIncomeLocationId ? { isPrimaryIncome: true } : {}),
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
    primaryIncomeLocationId,
    nodes: [...locationNodes, ...purposeNodes, ...statusNodes].sort(compareGraphNodes),
    edges: applied.links.map((link) => ({
      id: link.id,
      purposeId: link.purposeId,
      locationId: locationNodeId(link.locationId),
      amountWon: link.monthlyAmountWon,
      status: link.status,
    })),
  };
}

export function projectAccountMapGraph(source: AccountMapGraphSource, zoom: MapZoom): AccountMapGraph {
  const visiblePurposeIds = new Set(
    source.nodes
      .filter((node) => node.kind === 'purpose' && (zoom !== 'overview' || !node.id.startsWith('custom:')))
      .map(({ id }) => id),
  );
  const eligibleEdges = source.edges.filter((edge) => zoom === 'detail' || edge.status === 'active');
  const edges = zoom === 'overview'
    ? representativeOverviewEdges(eligibleEdges, visiblePurposeIds, source.primaryIncomeLocationId)
    : eligibleEdges.filter((edge) => visiblePurposeIds.has(edge.purposeId));
  const visibleLocationIds = new Set(edges.map(({ locationId }) => locationId));
  const nodes = source.nodes
    .filter((node) => {
      if (node.kind === 'purpose') return visiblePurposeIds.has(node.id);
      if (node.kind === 'location') return zoom === 'overview'
        ? node.status !== 'suspended' && visibleLocationIds.has(node.id)
        : node.status !== 'suspended' || visibleLocationIds.has(node.id);
      return true;
    })
    .map((node) => node.kind === 'purpose' && zoom === 'overview' && node.connectionCount > 1
      ? { ...node, secondary: `대표 계좌 · 외 ${node.connectionCount - 1}개` }
      : node)
    .sort(compareGraphNodes);

  return { primaryIncomeLocationId: source.primaryIncomeLocationId, nodes, edges };
}

export function compareGraphNodes(left: GraphNode, right: GraphNode): number {
  const kindRank = graphNodeKindRank(left) - graphNodeKindRank(right);
  if (kindRank !== 0) return kindRank;
  if (left.kind === 'location' && right.kind === 'location') {
    if (left.isPrimaryIncome !== right.isPrimaryIncome) return left.isPrimaryIncome ? -1 : 1;
    return (right.amountWon ?? 0) - (left.amountWon ?? 0)
      || right.connectionCount - left.connectionCount
      || normalizedName(left.label).localeCompare(normalizedName(right.label))
      || left.id.localeCompare(right.id);
  }
  if (left.kind === 'purpose' && right.kind === 'purpose') {
    const systemOrder = (left.purposeOrder ?? 0) - (right.purposeOrder ?? 0);
    if (systemOrder !== 0) return systemOrder;
    if (left.purposeOrder === systemPurposeIds.length && right.purposeOrder === systemPurposeIds.length) {
      return (left.customPurposeParentOrder ?? 0) - (right.customPurposeParentOrder ?? 0)
        || (right.allocationTargetWon ?? 0) - (left.allocationTargetWon ?? 0)
        || normalizedName(left.label).localeCompare(normalizedName(right.label))
        || left.id.localeCompare(right.id);
    }
  }
  return left.id.localeCompare(right.id);
}

function representativeOverviewEdges(
  eligibleEdges: readonly GraphEdge[],
  visiblePurposeIds: ReadonlySet<string>,
  primaryIncomeLocationId: string | null,
): GraphEdge[] {
  return [...visiblePurposeIds].flatMap((purposeId) => {
    const candidates = eligibleEdges.filter((edge) => edge.purposeId === purposeId && edge.status === 'active');
    if (purposeId === 'system:income' && primaryIncomeLocationId !== null) {
      return candidates.filter(({ locationId }) => locationId === locationNodeId(primaryIncomeLocationId)).slice(0, 1);
    }
    return candidates.slice(0, 1);
  });
}

function selectPrimaryIncomeLocationId(
  activeLinks: readonly AccountMapApplied['links'][number][],
  locationById: ReadonlyMap<string, FinancialLocation>,
): string | null {
  const incomeAmounts = new Map<string, number>();
  for (const link of activeLinks) {
    const location = locationById.get(link.locationId);
    if (link.purposeId !== 'system:income' || link.monthlyAmountWon <= 0 || location === undefined || location.archivedAt !== undefined) continue;
    incomeAmounts.set(link.locationId, (incomeAmounts.get(link.locationId) ?? 0) + link.monthlyAmountWon);
  }
  return [...incomeAmounts.keys()].sort((leftId, rightId) => {
    const amountDifference = (incomeAmounts.get(rightId) ?? 0) - (incomeAmounts.get(leftId) ?? 0);
    if (amountDifference !== 0) return amountDifference;
    const nameDifference = normalizedName(locationById.get(leftId)?.shortName ?? '').localeCompare(normalizedName(locationById.get(rightId)?.shortName ?? ''));
    return nameDifference || leftId.localeCompare(rightId);
  })[0] ?? null;
}

function graphNodeKindRank(node: GraphNode): number {
  return node.kind === 'location' ? 0 : node.kind === 'purpose' ? 1 : 2;
}

function normalizedName(name: string): string {
  return name.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
}

function purposeLabel(id: PurposeId, applied: AccountMapApplied): string {
  if (id.startsWith('custom:')) return applied.customPurposes.find(({ id: candidate }) => candidate === id)?.name ?? '세부 목적';
  return { 'system:income': '수입', 'system:housing': '주거', 'system:living': '생활비', 'system:saving': '저축', 'system:investing': '투자' }[id as SystemPurposeId];
}

function locationNodeId(locationId: string): string {
  return `location:${locationId}`;
}
