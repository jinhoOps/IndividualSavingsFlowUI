interface OverflowOptions {
  itemWidth?: number;
  gap?: number;
  fallbackVisibleCount?: number;
}

export function partitionAppNavigation<T extends { id: string }>(
  items: readonly T[],
  currentId: string,
  availableWidth: number | undefined,
  options: OverflowOptions = {},
): { visible: T[]; overflow: T[] } {
  const itemWidth = options.itemWidth ?? 44;
  const gap = options.gap ?? 4;
  const fallbackVisibleCount = options.fallbackVisibleCount ?? 4;
  const allFitWidth = items.length * itemWidth + Math.max(0, items.length - 1) * gap;

  if (availableWidth !== undefined && availableWidth >= allFitWidth) {
    return { visible: [...items], overflow: [] };
  }

  const measuredCapacity = availableWidth === undefined
    ? fallbackVisibleCount
    : Math.floor((Math.max(0, availableWidth) - itemWidth) / (itemWidth + gap));
  const visibleCount = Math.max(0, Math.min(items.length, measuredCapacity));
  const current = items.find(({ id }) => id === currentId);

  if (visibleCount === 0) {
    return current === undefined
      ? { visible: [], overflow: [...items] }
      : { visible: [current], overflow: items.filter(({ id }) => id !== currentId) };
  }

  const initialVisible = items.slice(0, visibleCount);
  const visible = current === undefined || initialVisible.some(({ id }) => id === currentId)
    ? initialVisible
    : [...initialVisible.slice(0, -1), current];
  const visibleIds = new Set(visible.map(({ id }) => id));

  return {
    visible,
    overflow: items.filter(({ id }) => !visibleIds.has(id)),
  };
}
