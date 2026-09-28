import { animate } from 'animejs';
import { useRef } from 'react';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { createProductSpring, MOTION_DURATION } from '../../components/motion/tokens';
import { assetClassAllocation } from '../domain/classification';
import type { PortfolioPlan } from '../domain/model';
import { formatAllocationPercent } from './format';

export function AssetClassBreakdown({ allocation, withBar = false }: {
  allocation: Pick<PortfolioPlan, 'items' | 'cashShareUnits'>;
  withBar?: boolean;
}) {
  const groups = assetClassAllocation(allocation);
  const key = JSON.stringify(groups);
  const previous = useRef(new Map<string, number>());
  const barRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    for (const bar of root.querySelectorAll<HTMLElement>('[data-asset-class]')) {
      const id = bar.dataset.assetClass!;
      const next = Number(bar.dataset.percentage);
      const before = previous.current.get(id) ?? next;
      bar.style.width = `${next}%`;
      if (!reducedMotion && before !== next) {
        try {
          animate(bar, { width: [`${before}%`, `${next}%`], duration: MOTION_DURATION.emphasis, ease: createProductSpring('value') });
        } catch { bar.style.width = `${next}%`; }
      }
    }
    previous.current = new Map(groups.map(group => [group.id, group.percentage]));
  }, [key]);

  return <div className="portfolio-asset-classes">
    {withBar ? <div ref={barRef} className="portfolio-asset-classes__bar" aria-hidden="true">
      {groups.map(group => <span key={group.id} data-asset-class={group.id} data-percentage={group.percentage}
        style={{ width: `${group.percentage}%`, background: group.color }} />)}
    </div> : null}
    <dl className="portfolio-asset-classes__values" aria-label="자산군별 비중">
      {groups.map(group => <div key={group.id}>
        <dt>{group.label}</dt><dd>{formatAllocationPercent(group.percentage)}</dd>
      </div>)}
    </dl>
    {groups.some(group => group.id === 'other') ? <p className="portfolio-asset-classes__note">기타: 이름으로 분류되지 않은 대상</p> : null}
  </div>;
}
