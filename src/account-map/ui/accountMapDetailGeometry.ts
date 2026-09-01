import type { PositionedGraph, PositionedNode } from './accountMapLayout';

export interface ConnectionDetailPosition {
  left: number;
  top: number;
  maxBlockSize: number;
  canvasHeight: number;
}

export interface DetailRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function positionConnectionDetail(
  node: PositionedNode,
  nodes: readonly PositionedNode[],
  canvas: Pick<PositionedGraph, 'width' | 'height'>,
  pan: { x: number; y: number },
): ConnectionDetailPosition {
  const inset = 16;
  const gap = 12;
  const detailWidth = canvas.width <= 600
    ? Math.max(0, canvas.width - inset * 2)
    : Math.max(0, Math.min(312, canvas.width - inset * 2));
  const detailHeight = Math.max(0, Math.min(220, canvas.height - inset * 2));
  const clampLeft = (left: number) => Math.max(inset, Math.min(left, canvas.width - detailWidth - inset));
  const clampTop = (top: number) => Math.max(inset, Math.min(top, canvas.height - detailHeight - inset));
  const target = nodeRectangle(node, pan);
  const nodeRectangles = nodes.map((candidate) => nodeRectangle(candidate, pan));
  const visibleRectangles = nodeRectangles.filter((rectangle) => rectanglesOverlap(rectangle, {
    left: 0, top: 0, right: canvas.width, bottom: canvas.height,
  }));
  const candidates = [
    { left: target.right + gap, top: clampTop(target.top) },
    { left: target.right + gap, top: target.bottom + gap },
    { left: target.left - detailWidth - gap, top: clampTop(target.top) },
    { left: clampLeft(target.left), top: target.bottom + gap },
    { left: clampLeft(target.left), top: target.top - detailHeight - gap },
  ];
  const adjacent = candidates.find(({ left, top }) => {
    const detail = { left, top, right: left + detailWidth, bottom: top + detailHeight };
    return detail.left >= inset && detail.top >= inset
      && detail.right <= canvas.width - inset && detail.bottom <= canvas.height - inset
      && visibleRectangles.every((rectangle) => !rectanglesOverlap(detail, rectangle));
  });
  if (adjacent !== undefined) {
    return { ...adjacent, maxBlockSize: detailHeight, canvasHeight: canvas.height };
  }

  const horizontallyVisible = nodeRectangles.filter(({ left, right }) => right > 0 && left < canvas.width);
  const top = Math.max(canvas.height, ...horizontallyVisible.map(({ bottom }) => bottom)) + inset;
  return {
    left: clampLeft(target.left),
    top,
    maxBlockSize: detailHeight,
    canvasHeight: top + detailHeight + inset,
  };
}

export function nodeRectangle(node: PositionedNode, pan: { x: number; y: number }): DetailRectangle {
  return {
    left: node.x + pan.x,
    top: node.y + pan.y,
    right: node.x + pan.x + node.width,
    bottom: node.y + pan.y + node.height,
  };
}

export function rectanglesOverlap(left: DetailRectangle, right: DetailRectangle): boolean {
  return left.left < right.right && left.right > right.left
    && left.top < right.bottom && left.bottom > right.top;
}
