import { animate } from 'animejs';
import { useRef } from 'react';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { createProductSpring, MOTION_DURATION } from '../../components/motion/tokens';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import { formatAllocationPercent, formatPortfolioWon } from './format';

type PortfolioEditorSummaryProps = {
  draft: PortfolioDraft;
  investmentWon: number;
};

export function PortfolioEditorSummary({ draft, investmentWon }: PortfolioEditorSummaryProps) {
  const allocation = materializeAllocation(draft, investmentWon);
  const stablePercentage = allocation.cashPercentage + allocation.items
    .filter((item) => item.classification === 'stable')
    .reduce((sum, item) => sum + item.percentage, 0);
  const growthPercentage = allocation.items
    .filter((item) => item.classification === 'growth')
    .reduce((sum, item) => sum + item.percentage, 0);
  const unallocatedWon = investmentWon - allocation.totalAmountWon;

  const previous = useRef([growthPercentage, stablePercentage]);
  const barRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    const next = [growthPercentage, stablePercentage];
    const before = previous.current;
    previous.current = next;
    const bars = Array.from(root.children) as HTMLElement[];
    const finish = () => bars.forEach((bar, index) => { bar.style.width = `${next[index]}%`; });
    finish();
    if (!reducedMotion) {
      try {
        bars.forEach((bar, index) => {
          if (before[index] !== next[index]) animate(bar, {
            width: [`${before[index]}%`, `${next[index]}%`],
            duration: MOTION_DURATION.emphasis, ease: createProductSpring('value'),
          });
        });
      } catch { finish(); }
    }
  }, [growthPercentage, stablePercentage]);

  return (
    <section className="portfolio-setup-summary" aria-label="현재 배분 요약">
      <p>월 투자금 <strong>{formatPortfolioWon(investmentWon)}</strong> <small>Main 기준</small></p>
      <div ref={barRef} className="portfolio-setup-summary__bar" aria-hidden="true">
        <span className="portfolio-setup-summary__growth" style={{ width: `${growthPercentage}%` }} />
        <span className="portfolio-setup-summary__stable" style={{ width: `${stablePercentage}%` }} />
      </div>
      <div className="portfolio-setup-summary__legend">
        <span>성장 <strong>{formatAllocationPercent(growthPercentage)}</strong></span>
        <span>안정 <strong>{formatAllocationPercent(stablePercentage)}</strong></span>
      </div>
      <p className="portfolio-setup-summary__note">편집 중인 배분</p>
      {unallocatedWon > 0 ? <p className="portfolio-setup-summary__note" role="status">
        아직 배분하지 않은 금액 {formatPortfolioWon(unallocatedWon)}. 투자금을 모두 배분하면 적용할 수 있어요.
      </p> : null}
    </section>
  );
}
