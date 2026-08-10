import { useMemo, type CSSProperties } from 'react';
import { Surface } from '../../components/common/Surface';
import { largestResultItem, orderedResultItems } from '../domain/allocation';
import { stableShareUnits } from '../domain/classification';
import type {
  AllocationResultItem,
  MaterializedAllocation,
  PortfolioViewPreferences,
} from '../domain/model';
import { formatAllocationPercent, formatPortfolioWon } from './format';

interface DisplayResultItem extends AllocationResultItem {
  amountWon: number;
  percentage: number;
}

export function PortfolioSummary({
  investmentWon,
  allocation,
  preferences,
  onEdit,
}: {
  investmentWon: number;
  allocation: MaterializedAllocation;
  preferences: PortfolioViewPreferences;
  onEdit?: () => void;
}) {
  const cashShareUnits = Math.round(allocation.cashPercentage * 10_000);
  const items = useMemo<DisplayResultItem[]>(() => orderedResultItems(
    allocation.items,
    cashShareUnits,
    preferences.sortMode,
  ).map((item) => {
    if (item.isCash) {
      return {
        ...item,
        amountWon: allocation.cashAmountWon,
        percentage: allocation.cashPercentage,
      };
    }
    const materialized = allocation.items.find((candidate) => candidate.id === item.id);
    return {
      ...item,
      amountWon: materialized?.amountWon ?? 0,
      percentage: materialized?.percentage ?? 0,
    };
  }), [allocation, cashShareUnits, preferences.sortMode]);
  const largestResult = largestResultItem(items);
  const largest = items.find((item) => item.id === largestResult?.id) ?? items[0];
  const stablePercent = formatAllocationPercent(stableShareUnits({
    items: allocation.items,
    cashShareUnits,
  }) / 10_000);

  return (
    <Surface as="section" className="portfolio-summary" aria-labelledby="portfolio-summary-title">
      <header className="portfolio-summary__hero">
        <p className="portfolio-summary__eyebrow">이번 달 투자금</p>
        <div className="portfolio-summary__headline">
          <h1 id="portfolio-summary-title">
            {preferences.showAmounts
              ? `이번 달 투자금 ${formatPortfolioWon(investmentWon)}`
              : `안정 ${stablePercent}`}
          </h1>
          {onEdit === undefined ? null : (
            <button
              type="button"
              className="portfolio-summary__edit"
              aria-label="배분 수정"
              onClick={onEdit}
            >
              <img
                src={`${import.meta.env.BASE_URL}icons/portfolio-edit.svg`}
                alt=""
                aria-hidden="true"
              />
            </button>
          )}
        </div>
        {preferences.showAmounts ? <p className="portfolio-summary__stable">안정 {stablePercent}</p> : null}
        {largest === undefined ? null : (
          <p className="portfolio-summary__largest">
            {largest.name}에 {formatAllocationPercent(largest.percentage)}를 배분해요
          </p>
        )}
      </header>

      <ul className="portfolio-allocation-list" aria-label="투자 배분 비율">
        {items.map((item, index) => {
          const style = {
            '--allocation-width': `${Math.max(0, Math.min(100, item.percentage))}%`,
            '--allocation-color': item.isCash
              ? 'var(--portfolio-cash)'
              : `var(--portfolio-color-${index % 10})`,
          } as CSSProperties;
          return (
            <li key={item.id} className="portfolio-allocation-row" style={style}>
              <h2 className="portfolio-allocation-row__name">
                <span className="portfolio-allocation-row__marker" aria-hidden="true" />
                {item.name}
              </h2>
              <strong className="portfolio-allocation-row__ratio">
                {formatAllocationPercent(item.percentage)}
              </strong>
              {preferences.showAmounts ? (
                <span className="portfolio-allocation-row__amount">{formatPortfolioWon(item.amountWon)}</span>
              ) : null}
              <span className="portfolio-allocation-row__track" aria-hidden="true">
                <span className="portfolio-allocation-row__fill" />
              </span>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
