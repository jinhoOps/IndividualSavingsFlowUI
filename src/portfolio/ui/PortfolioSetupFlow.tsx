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
        <div>
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
          {props.step === 'welcome' ? '배분 시작하기' : props.step === 'review' ? '배분 시작' : '다음'}
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
  return (
    <div className="portfolio-setup__review">
      <h1 id="portfolio-setup-title" ref={headingRef} tabIndex={-1}>이 배분으로 시작할까요?</h1>
      <dl>
        <div><dt>투자 대상</dt><dd>{draft.items.length}개</dd></div>
        <div><dt>투자금</dt><dd>{formatPortfolioWon(investmentWon)}</dd></div>
        <div><dt>현금</dt><dd>{formatAllocationPercent(allocation.cashPercentage)}</dd></div>
      </dl>
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
