import { animate } from 'animejs';
import { useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Surface } from '../../components/common/Surface';
import {
  animateVisualNumber,
  commitVisualNumber,
} from '../../components/motion/animateVisualNumber';
import {
  MOTION_DISTANCE_PX,
  MOTION_DURATION,
  createProductSpring,
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
  opacity: number;
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
  const summaryId = useId();
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const activeItemId = selectedItemId ?? focusedItemId;
  const motionKey = JSON.stringify(items.map((item) => [item.id, clampedPercentage(item.percentage)]));
  const motionSnapshotRef = useRef<AllocationMotionSnapshot | null>(null);
  const summaryRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const currentRows = captureAllocationRows(root);
    const previous = motionSnapshotRef.current;
    const currentSnapshot = { key: motionKey, rows: currentRows };
    motionSnapshotRef.current = currentSnapshot;

    if (previous === null || reducedMotion) {
      commitFinalVisualRatios(root, currentRows);
      if (reducedMotion) commitFinalRowMotion(root, currentSnapshot);
      return;
    }

    if (previous.key === motionKey) {
      commitFinalVisualRatios(root, currentRows);
      continueInterruptedRowReveals(root, previous, currentSnapshot);
      return;
    }

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
          ease: createProductSpring('surface'),
          onUpdate: () => updateRowFrame(currentSnapshot, id, {
            opacity: visualOpacity(row, 1),
            rect: row.getBoundingClientRect(),
          }),
          onComplete: () => updateRowFrame(currentSnapshot, id, {
            opacity: 1,
            rect: row.getBoundingClientRect(),
          }),
        });
      } else {
        const deltaY = prior.rect.top - current.rect.top;
        const continuesReveal = prior.opacity < 1;
        if (deltaY !== 0 || continuesReveal) {
          animateSafely(row, {
            ...(deltaY === 0 ? {} : { translateY: [deltaY, 0] }),
            ...(continuesReveal ? { opacity: [prior.opacity, 1] } : {}),
            duration: MOTION_DURATION.normal,
            ease: createProductSpring(continuesReveal ? 'surface' : 'value'),
            onUpdate: () => updateRowFrame(currentSnapshot, id, {
              opacity: visualOpacity(row, 1),
              rect: row.getBoundingClientRect(),
            }),
            onComplete: () => updateRowFrame(currentSnapshot, id, {
              opacity: 1,
              rect: row.getBoundingClientRect(),
            }),
          });
        }
      }

      const previousPercentage = prior?.percentage ?? 0;
      if (previousPercentage === current.percentage) {
        commitFinalVisualRatio(row, current.percentage);
        continue;
      }

      const visualRatio = row.querySelector<HTMLElement>('[data-allocation-ratio-visual]');
      if (visualRatio !== null) {
        animateVisualNumber(
          visualRatio,
          previousPercentage,
          current.percentage,
          formatAllocationPercent,
          MOTION_DURATION.normal,
          createProductSpring('value'),
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
        <p className="portfolio-summary__eyebrow">현재 포트폴리오</p>
        <div className="portfolio-summary__headline">
          <h1 id="portfolio-summary-title">안정 {stablePercent}</h1>
        </div>
        {preferences.showAmounts ? (
          <p className="portfolio-summary__stable">이번 달 투자금 {formatPortfolioWon(investmentWon)}</p>
        ) : null}
        {largest === undefined ? null : (
          <p className="portfolio-summary__largest">
            {largest.name}에 {formatAllocationPercent(largest.percentage)}를 배분해요
          </p>
        )}
      </header>

      <div
        className="portfolio-allocation-bar"
        data-testid="portfolio-allocation-bar"
        aria-hidden="true"
      >
        {items.map((item) => {
          const percentage = clampedPercentage(item.percentage);
          const color = allocationColor(item);
          return (
            <span
              key={item.id}
              className={`portfolio-allocation-bar__segment${activeItemId === item.id ? ' is-active' : ''}`}
              style={{
                '--allocation-color': color,
                '--allocation-segment-width': `${percentage}%`,
              } as CSSProperties}
              data-segment-id={item.id}
              data-percent={percentage}
            />
          );
        })}
      </div>

      <ul
        className="portfolio-allocation-list"
        aria-label="투자 배분 비율"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setSelectedItemId(null);
          if (event.key === 'Escape') setFocusedItemId(null);
        }}
      >
        {items.map((item) => {
          const percentage = clampedPercentage(item.percentage);
          const style = {
            '--allocation-color': allocationColor(item),
          } as CSSProperties;
          return (
            <li
              key={item.id}
              className="portfolio-allocation-row"
              style={style}
              data-allocation-id={item.id}
              data-allocation-percentage={percentage}
            >
              <button
                type="button"
                className="portfolio-allocation-row__select"
                aria-label={item.name}
                aria-describedby={`${summaryId}-${item.id}-values`}
                aria-description={onEdit ? '배분 수정 열기' : undefined}
                aria-haspopup={onEdit ? 'dialog' : undefined}
                aria-pressed={onEdit ? undefined : selectedItemId === item.id}
                onFocus={() => setFocusedItemId(item.id)}
                onBlur={() => setFocusedItemId((focused) => focused === item.id ? null : focused)}
                onPointerEnter={() => setFocusedItemId(item.id)}
                onPointerLeave={() => setFocusedItemId((focused) => focused === item.id ? null : focused)}
                onClick={(event) => {
                  if (onEdit) onEdit(event);
                  else setSelectedItemId((selected) => selected === item.id ? null : item.id);
                }}
              >
                <span className="portfolio-allocation-row__name" role="heading" aria-level={2}>
                  <span className="portfolio-allocation-row__marker" aria-hidden="true" />
                  {item.name}
                </span>
                <span className="portfolio-allocation-row__values" id={`${summaryId}-${item.id}-values`}>
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
                </span>
              </button>
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
    rows.set(id, {
      opacity: visualOpacity(row, 1),
      percentage,
      rect: row.getBoundingClientRect(),
    });
  }
  return rows;
}

function clampedPercentage(percentage: number): number {
  return Math.max(0, Math.min(100, percentage));
}

function commitFinalVisualRatios(
  root: HTMLElement,
  rows: Map<string, AllocationRowFrame>,
): void {
  for (const row of root.querySelectorAll<HTMLElement>('[data-allocation-id]')) {
    const id = row.dataset.allocationId;
    const frame = id === undefined ? undefined : rows.get(id);
    if (frame !== undefined) commitFinalVisualRatio(row, frame.percentage);
  }
}

function commitFinalVisualRatio(row: HTMLElement, percentage: number): void {
  const visualRatio = row.querySelector<HTMLElement>('[data-allocation-ratio-visual]');
  if (visualRatio !== null) {
    commitVisualNumber(visualRatio, percentage, formatAllocationPercent);
  }
}

function continueInterruptedRowReveals(
  root: HTMLElement,
  previous: AllocationMotionSnapshot,
  current: AllocationMotionSnapshot,
): void {
  for (const row of root.querySelectorAll<HTMLElement>('[data-allocation-id]')) {
    const id = row.dataset.allocationId;
    const prior = id === undefined ? undefined : previous.rows.get(id);
    if (id === undefined || prior === undefined || prior.opacity >= 1) continue;
    animateSafely(row, {
      opacity: [prior.opacity, 1],
      duration: MOTION_DURATION.normal,
      ease: createProductSpring('surface'),
      onUpdate: () => updateRowFrame(current, id, {
        opacity: visualOpacity(row, 1),
      }),
      onComplete: () => updateRowFrame(current, id, { opacity: 1 }),
    });
  }
}

function commitFinalRowMotion(
  root: HTMLElement,
  snapshot: AllocationMotionSnapshot,
): void {
  for (const row of root.querySelectorAll<HTMLElement>('[data-allocation-id]')) {
    row.style.removeProperty('opacity');
    row.style.removeProperty('transform');
    const id = row.dataset.allocationId;
    if (id !== undefined) updateRowFrame(snapshot, id, { opacity: 1 });
  }
}

function updateRowFrame(
  snapshot: AllocationMotionSnapshot,
  id: string,
  update: Partial<AllocationRowFrame>,
): void {
  const frame = snapshot.rows.get(id);
  if (frame === undefined) return;
  snapshot.rows.set(id, { ...frame, ...update });
}

function allocationColor(item: DisplayResultItem): string {
  if (item.isCash) return 'var(--portfolio-cash)';
  return `var(--portfolio-color-${Math.max(0, item.order) % 10})`;
}

function visualOpacity(row: HTMLElement, fallback: number): number {
  const opacity = row.style.opacity || getComputedStyle(row).opacity;
  if (opacity.trim() === '') return fallback;

  const parsed = Number(opacity);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
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
