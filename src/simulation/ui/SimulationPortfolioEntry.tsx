import { useScrollDiscovery } from '../../journey/ui/useScrollDiscovery';
import { appPath } from '../../journey/routes';
import { isPortfolioSamplePreset, portfolioSampleHref } from '../../journey/portfolioSampleIntent';

export function SimulationPortfolioEntry({ expectedAnnualReturnPercent, blocked }: {
  expectedAnnualReturnPercent: number;
  blocked: boolean;
}) {
  const { root, revealed, reveal } = useScrollDiscovery(!blocked);
  const hasPreset = isPortfolioSamplePreset(expectedAnnualReturnPercent);
  return (
    <section ref={root} className="simulation-portfolio-entry"
      data-revealed={revealed} onFocusCapture={reveal}
      aria-labelledby="simulation-portfolio-entry-title">
      <div className={revealed ? 'simulation-portfolio-entry__content' : 'sr-only'}>
        <h2 id="simulation-portfolio-entry-title">
          {hasPreset
            ? `연 ${expectedAnnualReturnPercent}%를 가정했다면, 이 구성부터 볼까요?`
            : '투자 구성을 살펴볼까요?'}
        </h2>
        <a className="ui-button ui-button--quiet"
          href={hasPreset ? portfolioSampleHref(expectedAnnualReturnPercent) : appPath('portfolio')}
        >포트폴리오 샘플 보기</a>
      </div>
    </section>
  );
}
