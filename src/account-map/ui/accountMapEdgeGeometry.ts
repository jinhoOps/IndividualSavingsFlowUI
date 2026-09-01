import type { PositionedNode } from './accountMapLayout';

export interface AccountMapEdgeGeometry {
  path: string;
  amountAnchor: { left: number; top: number };
}

export function buildAccountMapEdgeGeometry(
  purpose: PositionedNode,
  location: PositionedNode,
): AccountMapEdgeGeometry {
  const purposeCenter = {
    x: purpose.x + purpose.width / 2,
    y: purpose.y + purpose.height / 2,
  };
  const locationCenter = {
    x: location.x + location.width / 2,
    y: location.y + location.height / 2,
  };
  const controlX = (purposeCenter.x + locationCenter.x) / 2;

  return {
    path: `M ${purposeCenter.x} ${purposeCenter.y} C ${controlX} ${purposeCenter.y}, ${controlX} ${locationCenter.y}, ${locationCenter.x} ${locationCenter.y}`,
    amountAnchor: {
      left: (purpose.x + location.x + purpose.width) / 2,
      top: (purpose.y + location.y + purpose.height) / 2,
    },
  };
}
