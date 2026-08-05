import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export interface AllocationResultItem {
  id: string;
  name: string;
  amountWon: number;
  percentage: number;
  isCash: boolean;
}

export interface AllocationSelection {
  id: string;
  mode: 'pointer' | 'fixed';
  x: number;
  y: number;
}

export function AllocationDonut({
  items,
  active,
  onActive,
  onClear,
}: {
  items: AllocationResultItem[];
  active: AllocationSelection | null;
  onActive: (selection: AllocationSelection) => void;
  onClear: () => void;
}) {
  const circumference = 2 * Math.PI * 40;
  let offset = 0;

  function moveSelection(event: KeyboardEvent<SVGCircleElement>, index: number): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClear();
      return;
    }
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = items[(index + direction + items.length) % items.length];
    onActive({ id: next.id, mode: 'fixed', x: 50, y: 50 });
  }

  function selectFromPointer(event: PointerEvent<SVGCircleElement>, id: string): void {
    onActive({
      id,
      mode: event.pointerType === 'touch' ? 'fixed' : 'pointer',
      x: event.clientX,
      y: event.clientY,
    });
  }

  return (
    <div className="portfolio-donut-wrap">
      <svg
        className="portfolio-donut"
        viewBox="0 0 100 100"
        aria-label="투자 배분 도넛"
        onPointerLeave={onClear}
      >
        <circle className="portfolio-donut__track" cx="50" cy="50" r="40" />
        {items.map((item, index) => {
          const length = circumference * item.percentage / 100;
          const currentOffset = offset;
          offset += length;
          const style = {
            '--segment-offset': `${-currentOffset}`,
            '--segment-color': item.isCash ? 'var(--portfolio-cash)' : `var(--portfolio-color-${index % 10})`,
          } as CSSProperties;
          const label = `${item.name} ${formatPortfolioWon(item.amountWon)} ${formatAllocationPercent(item.percentage)}`;
          return (
            <circle
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={label}
              data-active={active?.id === item.id ? 'true' : 'false'}
              className="portfolio-donut__segment"
              cx="50"
              cy="50"
              r="40"
              pathLength={circumference}
              strokeDasharray={`${Math.max(0, length - 1)} ${circumference}`}
              strokeDashoffset={-currentOffset}
              style={style}
              onPointerEnter={(event) => selectFromPointer(event, item.id)}
              onPointerMove={(event) => active?.id === item.id && selectFromPointer(event, item.id)}
              onPointerDown={(event) => selectFromPointer(event, item.id)}
              onFocus={() => onActive({ id: item.id, mode: 'fixed', x: 50, y: 50 })}
              onKeyDown={(event) => moveSelection(event, index)}
            />
          );
        })}
      </svg>
      <div className="portfolio-donut__center" aria-hidden="true">
        <span>투자금</span>
      </div>
    </div>
  );
}
