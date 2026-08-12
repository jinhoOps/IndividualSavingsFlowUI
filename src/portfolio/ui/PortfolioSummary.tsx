import { animate } from 'animejs';
import { useMemo, useRef, type CSSProperties, type MouseEvent } from 'react';
import { Surface } from '../../components/common/Surface';
import { animateVisualNumber } from '../../components/motion/animateVisualNumber';
import {
  MOTION_DISTANCE_PX,
  MOTION_DURATION,
  MOTION_EASE,
} from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
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

interface AllocationRowFrame {
  percentage: number;
  rect: DOMRect;
}

interface AllocationMotionSnapshot {
  key: string;
  rows: Map<string, AllocationRowFrame>;
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
  onEdit?: (event: MouseEvent<HTMLButtonElement>) => void;
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
  const motionKey = JSON.stringify(items.map((item) => [item.id, clampedPercentage(item.percentage)]));
  const motionSnapshotRef = useRef<AllocationMotionSnapshot | null>(null);
  const summaryRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const currentRows = captureAllocationRows(root);
    const previous = motionSnapshotRef.current;
    motionSnapshotRef.current = { key: motionKey, rows: currentRows };

    if (previous === null || previous.key === motionKey || reducedMotion) return;

    for (const row of root.querySelectorAll<HTMLElement>('[data-allocation-id]')) {
      const id = row.dataset.allocationId;
      const current = id === undefined ? undefined : currentRows.get(id);
      if (id === undefined || current === undefined) continue;
      const prior = previous.rows.get(id);

      if (prior === undefined) {
        animateSafely(row, {
          opacity: [0, 1],
          translateY: [MOTION_DISTANCE_PX.reveal, 0],
          duration: MOTION_DURATION.normal,
          ease: MOTION_EASE.enter,
        });
      } else {
        const deltaY = prior.rect.top - current.rect.top;
        if (deltaY !== 0) {
          animateSafely(row, {
            translateY: [deltaY, 0],
            duration: MOTION_DURATION.normal,
            ease: MOTION_EASE.update,
          });
        }
      }

      const previousPercentage = prior?.percentage ?? 0;
      if (previousPercentage === current.percentage) continue;

      const fill = row.querySelector<HTMLElement>('.portfolio-allocation-row__fill');
      if (fill !== null) {
        animateSafely(fill, {
          scaleX: [previousPercentage / 100, current.percentage / 100],
          duration: MOTION_DURATION.normal,
          ease: MOTION_EASE.update,
        });
      }

      const visualRatio = row.querySelector<HTMLElement>('[data-allocation-ratio-visual]');
      if (visualRatio !== null) {
        animateVisualNumber(
          visualRatio,
          previousPercentage,
          current.percentage,
          formatAllocationPercent,
          MOTION_DURATION.normal,
        );
      }
    }
  }, [motionKey, preferences.showAmounts]);

  return (
    <Surface
      as="section"
      ref={summaryRef}
      className="portfolio-summary"
      aria-labelledby="portfolio-summary-title"
    >
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
          const percentage = clampedPercentage(item.percentage);
          const style = {
            '--allocation-color': item.isCash
              ? 'var(--portfolio-cash)'
              : `var(--portfolio-color-${index % 10})`,
          } as CSSProperties;
          const fillStyle = {
            '--allocation-scale': String(percentage / 100),
          } as CSSProperties;
          return (
            <li
              key={item.id}
              className="portfolio-allocation-row"
              style={style}
              data-allocation-id={item.id}
              data-allocation-percentage={percentage}
            >
              <h2 className="portfolio-allocation-row__name">
                <span className="portfolio-allocation-row__marker" aria-hidden="true" />
                {item.name}
              </h2>
              <strong
                className="portfolio-allocation-row__ratio"
                aria-label={formatAllocationPercent(item.percentage)}
              >
                <span aria-hidden="true" data-allocation-ratio-visual>
                  {formatAllocationPercent(item.percentage)}
                </span>
              </strong>
              {preferences.showAmounts ? (
                <span className="portfolio-allocation-row__amount">{formatPortfolioWon(item.amountWon)}</span>
              ) : null}
              <span className="portfolio-allocation-row__track" aria-hidden="true">
                <span className="portfolio-allocation-row__fill" style={fillStyle} />
              </span>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function captureAllocationRows(root: HTMLElement): Map<string, AllocationRowFrame> {
  const rows = new Map<string, AllocationRowFrame>();
  for (const row of root.querySelectorAll<HTMLElement>('[data-allocation-id]')) {
    const id = row.dataset.allocationId;
    const percentage = Number(row.dataset.allocationPercentage);
    if (id === undefined || !Number.isFinite(percentage)) continue;
    rows.set(id, { percentage, rect: row.getBoundingClientRect() });
  }
  return rows;
}

function clampedPercentage(percentage: number): number {
  return Math.max(0, Math.min(100, percentage));
}

function animateSafely(
  target: HTMLElement,
  options: Parameters<typeof animate>[1],
): void {
  try {
    animate(target, options);
  } catch {
    target.style.removeProperty('opacity');
    target.style.removeProperty('transform');
  }
}
