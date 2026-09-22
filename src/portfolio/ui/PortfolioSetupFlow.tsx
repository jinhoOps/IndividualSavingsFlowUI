import { useEffect, useRef, useState } from 'react';
import { useAnimatedProgress } from '../../components/motion/useAnimatedProgress';
import { createProductSpring } from '../../components/motion/tokens';
import { Button } from '../../components/common/Button';
import { ResponsiveDialog, useResponsiveDialogClose } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { Surface } from '../../components/common/Surface';
import type {
  PortfolioAction,
  PortfolioSetupStep,
} from '../application/portfolioReducer';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import type { PortfolioSampleSelection } from '../domain/samplePreset';
import { validateApplicableDraft } from '../domain/validation';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioExamplePicker, type PortfolioExampleNavigation } from './PortfolioExamplePicker';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export interface PortfolioSetupFlowProps {
  step: PortfolioSetupStep;
  draft: PortfolioDraft;
  investmentWon: number;
  saveError: boolean;
  applying: boolean;
  showSaving: boolean;
  fieldError: string | null;
  onAction(action: PortfolioAction): void;
  onPrevious(): void;
  onNext(): void;
  onApply(): void;
  now(): number;
  initialSample?: PortfolioSampleSelection;
  openExamples?: boolean;
  onSampleIntentOpened?(): void;
}

const steps: PortfolioSetupStep[] = ['welcome', 'allocation', 'review'];

export function PortfolioSetupFlow(props: PortfolioSetupFlowProps) {
  const [cashError, setCashError] = useState<string | null>(null);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
  const [exampleVisited, setExampleVisited] = useState(false);
  const [discardExample, setDiscardExample] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [itemEditing, setItemEditing] = useState(false);
  const pickerRef = useRef<PortfolioExampleNavigation>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);
  const discardTriggerRef = useRef<HTMLElement | null>(null);
  const sampleIntentOpenedRef = useRef(false);
  const activeFieldError = cashError ?? props.fieldError;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = steps.indexOf(props.step);
  const progress = ((index + 1) / steps.length) * 100;
  const choosingExample = props.step === 'allocation' && examplePickerOpen;
  const progressRef = useAnimatedProgress<HTMLSpanElement>(progress, createProductSpring('value'));

  useEffect(() => {
    headingRef.current?.focus();
  }, [props.step]);

  useEffect(() => {
    if (props.step !== 'allocation' || !props.openExamples || examplePickerOpen || sampleIntentOpenedRef.current) return;
    sampleIntentOpenedRef.current = true;
    setExampleVisited(true);
    setExamplePickerOpen(true);
    props.onSampleIntentOpened?.();
  }, [examplePickerOpen, props.openExamples, props.onSampleIntentOpened, props.step]);

  return (
    <Surface
      as="section"
      className="portfolio-setup"
      aria-busy={props.applying ? 'true' : undefined}
      aria-labelledby="portfolio-setup-title"
    >
      <div className="portfolio-setup__progress" aria-hidden="true">
        <span ref={progressRef} style={{ width: `${progress}%` }} />
      </div>
      <p className="portfolio-setup__status" role="status">
        {index + 1} / {steps.length} · {setupLabel(props.step)}
      </p>
      {props.saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
      {props.showSaving ? <p role="status">저장 중</p> : null}

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
          <Button ref={sampleTriggerRef} type="button" variant="secondary" disabled={itemEditing || props.applying} onClick={() => {
            setExampleVisited(true);
            setExamplePickerOpen(true);
          }}>샘플로 구성하기</Button>
          <AllocationEditor
            key={editorGeneration}
            draft={props.draft}
            investmentWon={props.investmentWon}
            onAction={props.onAction}
            now={props.now}
            fieldError={props.fieldError}
            onCashErrorChange={setCashError}
            onItemEditingChange={setItemEditing}
            presentation="setup"
          />
          {exampleVisited ? <ResponsiveDialog open={examplePickerOpen}
            className="portfolio-edit-surface portfolio-edit-surface--examples" labelledBy="portfolio-example-picker-title"
            size="wide" mobileHeight="full" mobileEntranceMotion returnFocusRef={sampleTriggerRef}
            onRequestClose={() => {
              if (pickerRef.current?.hasChanges) {
                discardTriggerRef.current = document.activeElement as HTMLElement;
                setDiscardExample(true);
                return false;
              }
              return true;
            }}
            onClosed={() => setExamplePickerOpen(false)}>
            <ResponsiveDialogLayout title="샘플로 구성하기" titleId="portfolio-example-picker-title"
              eyebrow="포트폴리오 샘플" layout="edit" onBack={() => pickerRef.current?.back()} onClose={() => undefined}>
              <PortfolioExamplePicker embedded draft={props.draft} investmentWon={props.investmentWon}
              now={props.now} onAction={(action) => {
                props.onAction(action);
                if (action.type === 'draft-replaced') {
                  setCashError(null);
                  setEditorGeneration((generation) => generation + 1);
                }
              }} active={examplePickerOpen} navigationRef={pickerRef}
              onClose={() => setExamplePickerOpen(false)} initialSample={props.initialSample} />
            </ResponsiveDialogLayout>
          </ResponsiveDialog> : null}
          {discardExample ? <ResponsiveDialog open labelledBy="portfolio-example-discard-title" returnFocusRef={discardTriggerRef}
            size="compact" onRequestClose={() => true} onClosed={() => setDiscardExample(false)}>
            <ResponsiveDialogLayout title="선택한 구성을 버릴까요?" titleId="portfolio-example-discard-title" layout="confirm"
              onClose={() => setDiscardExample(false)} closeInitialFocus={false}
              footer={<PortfolioExampleDiscardActions onContinue={() => setDiscardExample(false)} onDiscard={() => {
                setDiscardExample(false); setExamplePickerOpen(false); setExampleVisited(false);
              }} />}>
              <p>선택한 구성을 버리고 배분 설정으로 돌아갑니다.</p>
            </ResponsiveDialogLayout>
          </ResponsiveDialog> : null}
        </div>
      ) : null}

      {props.step === 'review' ? (
        <PortfolioSetupReview
          draft={props.draft}
          investmentWon={props.investmentWon}
          headingRef={headingRef}
        />
      ) : null}

      {props.step === 'review' && activeFieldError ? <p role="alert">입력 오류를 수정한 뒤 적용해 주세요.</p> : null}
      {choosingExample ? null : (
        <nav className="portfolio-setup__actions" aria-label="설정 이동">
          {props.step !== 'welcome' ? (
            <Button type="button" variant="secondary" disabled={props.applying || itemEditing} onClick={props.onPrevious}>이전</Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={props.applying || itemEditing || (props.step !== 'welcome' && (activeFieldError !== null || !validateApplicableDraft(props.draft)))}
            onClick={props.step === 'review' ? props.onApply : props.onNext}
          >
            {props.step === 'welcome' ? '배분 시작하기' : props.step === 'review' ? '이대로 시작' : '배분 확인'}
          </Button>
        </nav>
      )}
    </Surface>
  );
}

function PortfolioExampleDiscardActions({ onContinue, onDiscard }: { onContinue(): void; onDiscard(): void }) {
  const requestDialogClose = useResponsiveDialogClose();
  return <div className="portfolio-item-sheet__discard-actions">
    <Button type="button" variant="secondary" data-dialog-initial-focus onClick={() => {
      onContinue();
      requestDialogClose?.('button');
    }}>계속 살펴보기</Button>
    <Button type="button" variant="primary" onClick={onDiscard}>구성 버리기</Button>
  </div>;
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
