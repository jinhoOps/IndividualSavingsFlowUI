import { AssetClassBreakdown } from './AssetClassBreakdown';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import { formatPortfolioWon } from './format';

type PortfolioEditorSummaryProps = {
  draft: PortfolioDraft;
  investmentWon: number;
};

export function PortfolioEditorSummary({ draft, investmentWon }: PortfolioEditorSummaryProps) {
  const allocation = materializeAllocation(draft, investmentWon);
  const unallocatedWon = investmentWon - allocation.totalAmountWon;

  return (
    <section className="portfolio-setup-summary" aria-label="현재 배분 요약">
      <p>월 투자금 <strong>{formatPortfolioWon(investmentWon)}</strong> <small>Main 기준</small></p>
      <AssetClassBreakdown allocation={draft} withBar />
      <p className="portfolio-setup-summary__note">편집 중인 배분</p>
      {unallocatedWon > 0 ? <p className="portfolio-setup-summary__note" role="status">
        아직 배분하지 않은 금액 {formatPortfolioWon(unallocatedWon)}. 투자금을 모두 배분하면 적용할 수 있어요.
      </p> : null}
    </section>
  );
}
