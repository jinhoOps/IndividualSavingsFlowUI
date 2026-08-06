import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Surface } from '../../components/common/Surface';
import { sortResultItems } from '../domain/allocation';
import type { MaterializedAllocation } from '../domain/model';
import {
  AllocationDonut,
  type AllocationResultItem,
  type AllocationSelection,
} from './AllocationDonut';
import { AllocationTable } from './AllocationTable';
import { formatAllocationPercent, formatPortfolioWon } from './format';
import { clampTooltipPosition } from './tooltipPosition';

export function PortfolioSummary({
  investmentWon,
  allocation,
}: {
  investmentWon: number;
  allocation: MaterializedAllocation;
}) {
  const [active, setActive] = useState<AllocationSelection | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const items = useMemo<AllocationResultItem[]>(() => [
    ...sortResultItems(allocation.items).map((item) => ({ ...item, isCash: false })),
    {
      id: 'cash',
      name: '현금',
      amountWon: allocation.cashAmountWon,
      percentage: allocation.cashPercentage,
      isCash: true,
    },
  ], [allocation]);
  const activeItem = items.find((item) => item.id === active?.id) ?? null;

  useLayoutEffect(() => {
    if (active?.mode !== 'pointer' || tooltipRef.current === null) {
      setTooltipPosition(null);
      return undefined;
    }
    const update = () => {
      const bounds = tooltipRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current;
      if (bounds === undefined || tooltip === null) return;
      setTooltipPosition(clampTooltipPosition(
        active,
        {
          width: tooltip.offsetWidth || bounds.width,
          height: tooltip.offsetHeight || bounds.height,
        },
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };
    update();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resizeObserver?.observe(tooltipRef.current);
    window.addEventListener('resize', update);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active]);

  return (
    <Surface as="section" className="portfolio-summary" aria-labelledby="portfolio-summary-title">
      <div className="portfolio-summary__hero">
        <p>한 달 투자금을 배분합니다</p>
        <h1 id="portfolio-summary-title">투자금 {formatPortfolioWon(investmentWon)}</h1>
      </div>
      <div className="portfolio-summary__content">
        <AllocationDonut items={items} active={active} onActive={setActive} onClear={() => setActive(null)} />
        <AllocationTable
          items={items}
          activeId={active?.id ?? null}
          onActive={(id) => setActive({ id, mode: 'fixed', x: 50, y: 50 })}
          onClear={() => setActive(null)}
        />
      </div>
      {active !== null && activeItem !== null ? (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`portfolio-tooltip portfolio-tooltip--${active.mode}`}
          style={active.mode === 'pointer'
            ? tooltipPosition ?? { left: active.x + 12, top: active.y + 12, visibility: 'hidden' }
            : undefined}
        >
          <strong>{activeItem.name}</strong>
          <span>{formatPortfolioWon(activeItem.amountWon)}</span>
          <span>{formatAllocationPercent(activeItem.percentage)}</span>
        </div>
      ) : null}
    </Surface>
  );
}
