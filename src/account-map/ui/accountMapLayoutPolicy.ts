export interface AccountMapLayoutPolicy {
  direction: 'left-to-right' | 'top-to-bottom';
  width: number;
  minimumHeight: number;
  margin: number;
  nodeWidth: number;
  nodeHeight: number;
  columns: number;
}

export function createAccountMapLayoutPolicy(
  viewport: { width: number; height: number },
): AccountMapLayoutPolicy {
  const width = Math.max(280, viewport.width);
  const minimumHeight = Math.max(360, viewport.height);
  const direction = width <= 768 ? 'top-to-bottom' : 'left-to-right';
  const margin = direction === 'top-to-bottom' ? 16 : 28;
  const nodeHeight = 78;
  const nodeWidth = direction === 'top-to-bottom'
    ? Math.min(184, (width - margin * 2 - 12) / (width < 540 ? 2 : 3))
    : Math.min(210, (width - margin * 3) / 2);
  const columns = direction === 'top-to-bottom'
    ? Math.max(1, Math.floor((width - margin * 2 + 12) / (nodeWidth + 12)))
    : 2;

  return { direction, width, minimumHeight, margin, nodeWidth, nodeHeight, columns };
}
