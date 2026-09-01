import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountMapApplied } from '../domain/model';
import {
  buildAccountMapGraphSource,
  projectAccountMapGraph,
  type AccountMapGraph,
  type MapZoom,
} from './accountMapGraph';
import { layoutAccountMap } from './accountMapLayout';

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
export { layoutAccountMap, type PositionedGraph, type PositionedNode } from './accountMapLayout';

export function buildAccountMapGraph(
  applied: AccountMapApplied,
  locations: readonly FinancialLocation[],
  main: MainData,
  zoom: MapZoom,
): AccountMapGraph {
  return projectAccountMapGraph(buildAccountMapGraphSource(applied, locations, main), zoom);
}
