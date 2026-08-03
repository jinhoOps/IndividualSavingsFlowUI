import { useMemo, useState } from 'react';
import { sortResultItems } from '../domain/allocation';
import type { MaterializedAllocation } from '../domain/model';
import {
  AllocationDonut,
  type AllocationResultItem,
  type AllocationSelection,
} from './AllocationDonut';
import { AllocationTable } from './AllocationTable';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export function PortfolioSummary({
  investmentWon,
  allocation,
}: {
  investmentWon: number;
  allocation: MaterializedAllocation;
}) {
  const [active, setActive] = useState<AllocationSelection | null>(null);
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

  return (
    <section className="portfolio-summary" aria-labelledby="portfolio-summary-title">
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
          role="tooltip"
          className={`portfolio-tooltip portfolio-tooltip--${active.mode}`}
          style={active.mode === 'pointer' ? { left: active.x + 12, top: active.y + 12 } : undefined}
        >
          <strong>{activeItem.name}</strong>
          <span>{formatPortfolioWon(activeItem.amountWon)}</span>
          <span>{formatAllocationPercent(activeItem.percentage)}</span>
        </div>
      ) : null}
    </section>
  );
}
