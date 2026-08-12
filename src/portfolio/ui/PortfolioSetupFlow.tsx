import { useEffect, useRef } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import type {
  PortfolioAction,
  PortfolioSetupStep,
} from '../application/portfolioReducer';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import { validateApplicableDraft } from '../domain/validation';
import { AllocationEditor } from './AllocationEditor';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export interface PortfolioSetupFlowProps {
  step: PortfolioSetupStep;
  draft: PortfolioDraft;
  investmentWon: number;
  saveError: boolean;
  fieldError: string | null;
  onAction(action: PortfolioAction): void;
  onPrevious(): void;
  onNext(): void;
  onApply(): void;
  now(): number;
}

const steps: PortfolioSetupStep[] = ['welcome', 'allocation', 'review'];

export function PortfolioSetupFlow(props: PortfolioSetupFlowProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = steps.indexOf(props.step);

  useEffect(() => {
    headingRef.current?.focus();
  }, [props.step]);

  return (
    <Surface as="section" className="portfolio-setup" aria-labelledby="portfolio-setup-title">
      <div className="portfolio-setup__progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="portfolio-setup__status" role="status">
        {index + 1} / {steps.length} · {setupLabel(props.step)}
      </p>
      {props.saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}

      {props.step === 'welcome' ? (
        <div className="portfolio-setup__welcome">
          <p>PORTFOLIO</p>
          <h1 id="portfolio-setup-title" ref={headingRef} tabIndex={-1}>
            매달 {formatPortfolioWon(props.investmentWon)}을 어디에 투자할까요?
          </h1>
          <p>투자 대상을 정하면 남은 금액은 현금으로 자동 배분해요.</p>
        </div>
      ) : null}

      {props.step === 'allocation' ? (
        <div className="portfolio-setup__allocation">
          <h1 id="portfolio-setup-title" ref={headingRef} tabIndex={-1}>투자 배분 설정</h1>
          <AllocationEditor
            draft={props.draft}
            investmentWon={props.investmentWon}
            onAction={props.onAction}
            now={props.now}
            fieldError={props.fieldError}
            presentation="setup"
          />
        </div>
      ) : null}

      {props.step === 'review' ? (
        <PortfolioSetupReview
          draft={props.draft}
          investmentWon={props.investmentWon}
          headingRef={headingRef}
        />
      ) : null}

      <nav className="portfolio-setup__actions" aria-label="설정 이동">
        {props.step !== 'welcome' ? (
          <Button type="button" variant="secondary" onClick={props.onPrevious}>이전</Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          disabled={props.step !== 'welcome' && !validateApplicableDraft(props.draft)}
          onClick={props.step === 'review' ? props.onApply : props.onNext}
        >
          {props.step === 'welcome' ? '배분 시작하기' : props.step === 'review' ? '이대로 시작' : '배분 확인'}
        </Button>
      </nav>
    </Surface>
  );
}

function PortfolioSetupReview({
  draft,
  investmentWon,
  headingRef,
}: {
  draft: PortfolioDraft;
  investmentWon: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const allocation = materializeAllocation(draft, investmentWon);
  const stablePercentage = allocation.cashPercentage + allocation.items
    .filter((item) => item.classification === 'stable')
    .reduce((sum, item) => sum + item.percentage, 0);
  const growthPercentage = Math.max(0, 100 - stablePercentage);
  return (
    <div className="portfolio-setup__review" role="region" aria-label="배분 검토">
      <h1 id="portfolio-setup-title" ref={headingRef} tabIndex={-1}>
        성장에 {formatAllocationPercent(growthPercentage)}, 안정에 {formatAllocationPercent(stablePercentage)} 배분해요
      </h1>
      <p className="portfolio-setup__review-meta">매달 {formatPortfolioWon(investmentWon)}</p>
      <section className="portfolio-setup__strategy" aria-label="성장 안정 구성">
        <div className="portfolio-setup-summary__bar" aria-hidden="true">
          <span className="portfolio-setup-summary__growth" style={{ width: `${growthPercentage}%` }} />
          <span className="portfolio-setup-summary__stable" style={{ width: `${stablePercentage}%` }} />
        </div>
        <div className="portfolio-setup-summary__legend">
          <span>성장 <strong>{formatAllocationPercent(growthPercentage)}</strong></span>
          <span>안정 <strong>{formatAllocationPercent(stablePercentage)}</strong></span>
        </div>
      </section>
      <ul className="portfolio-setup-review__list">
        {allocation.items.map((item) => {
          return (
            <li
              className="portfolio-setup-review__item"
              key={item.id}
              aria-label={`${item.name} ${formatPortfolioWon(item.amountWon)} ${formatAllocationPercent(item.percentage)}`}
            >
              <div><strong>{item.name}</strong></div>
              <div><strong>{formatPortfolioWon(item.amountWon)}</strong><span>{formatAllocationPercent(item.percentage)}</span></div>
            </li>
          );
        })}
        <li
          className="portfolio-setup-review__item"
          aria-label={`현금 ${formatPortfolioWon(allocation.cashAmountWon)} ${formatAllocationPercent(allocation.cashPercentage)}`}
        >
          <div><strong>현금</strong></div>
          <div><strong>{formatPortfolioWon(allocation.cashAmountWon)}</strong><span>{formatAllocationPercent(allocation.cashPercentage)}</span></div>
        </li>
      </ul>
    </div>
  );
}

function setupLabel(step: PortfolioSetupStep): string {
  switch (step) {
    case 'welcome': return '시작';
    case 'allocation': return '배분';
    case 'review': return '검토';
  }
}
