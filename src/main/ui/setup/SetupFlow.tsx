import { animate, createTimeline, stagger } from 'animejs';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useDelayedPending } from '../../../components/feedback/useDelayedPending';
import { attemptMotion } from '../../../components/motion/attemptMotion';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { useAnimeScope } from '../../../components/motion/useAnimeScope';
import type { MainData, SetupStep } from '../../domain/model';
import type { ValidationCode } from '../../domain/validation';
import { Button } from '../common/Button';
import { MoneyField } from '../common/MoneyField';
import { Surface } from '../common/Surface';
import { AllocationBar } from './AllocationBar';

export interface ValidationIssue {
  path: string;
  code: ValidationCode;
}

export interface SetupFlowProps {
  draft: MainData;
  step: SetupStep;
  issues: ValidationIssue[];
  validationAttempt?: number;
  saving?: boolean;
  onChange(draft: MainData): void;
  onStepChange(step: SetupStep): void;
  onApply(): void;
  onCancel?: () => void;
  notice?: ReactNode;
  motionPreset: SetupMotionPreset;
}

export type SetupMotionPreset = 'initial-assembly' | 'none';

const steps: SetupStep[] = ['welcome', 'income', 'housing', 'living', 'saving-investment', 'review'];

const stepLabels: Record<SetupStep, string> = {
  welcome: '시작',
  income: '실수령액',
  housing: '주거비',
  living: '생활비',
  'saving-investment': '저축·투자',
  review: '확인',
};

const WELCOME_STAGGER_MS = 40;
const REVIEW_OFFSET_MS = 80;
const MAX_REVIEW_SEGMENT_COUNT = 4;
const WELCOME_MOTION_DEADLINE_MS = MOTION_DURATION.normal
  + (2 * WELCOME_STAGGER_MS)
  + MOTION_DURATION.fast;
const REVIEW_MOTION_DEADLINE_MS = MOTION_DURATION.emphasis
  + REVIEW_OFFSET_MS
  + MOTION_DURATION.normal
  + ((MAX_REVIEW_SEGMENT_COUNT - 1) * WELCOME_STAGGER_MS)
  + MOTION_DURATION.fast;

interface MotionDeadline {
  attachCancel(cancel: () => void): void;
  complete(): void;
  fail(): void;
  dispose(): void;
}

export function SetupFlow({
  draft,
  step,
  issues,
  validationAttempt = 0,
  saving = false,
  onChange,
  onStepChange,
  onApply,
  onCancel,
  notice,
  motionPreset,
}: SetupFlowProps) {
  const [incomeSubmittedEmpty, setIncomeSubmittedEmpty] = useState(false);
  const delayedSaving = useDelayedPending(saving, 600);
  const assemblyPlayedRef = useRef(false);
  const assemblyRootRef = useRef<HTMLElement | null>(null);
  const welcomePlayedRef = useRef(false);
  const welcomeElementRef = useRef<HTMLElement | null>(null);
  const stepIndex = steps.indexOf(step);
  const previousStep = steps[stepIndex - 1];
  const nextStep = steps[stepIndex + 1];
  const setupSurfaceClassName = step === 'review'
    ? 'setup-flow-surface shadow-float app-wide-visual'
    : 'setup-flow-surface shadow-float';
  const incomeError = findIssue(issues, 'monthlyNetIncomeWon')
    ?? (incomeSubmittedEmpty ? issueMessage('income_required') : undefined);
  const stepMotionRef = useAnimeScope<HTMLFormElement>(({ root, reducedMotion }) => {
    const stepContent = root.querySelectorAll<HTMLElement>('[data-setup-step-content]');
    if (step === 'review') {
      setRevealFinalStyles(stepContent);
      return;
    }

    const elements = step === 'welcome'
      ? root.querySelectorAll<HTMLElement>('[data-welcome-motion]')
      : root.querySelectorAll<HTMLElement>('[data-step-motion]');
    if (elements.length === 0) return;

    const isWelcomeStrictModeReplay = step === 'welcome'
      && welcomePlayedRef.current
      && welcomeElementRef.current === elements[0];
    if (
      motionPreset === 'none'
      || reducedMotion
      || (step === 'welcome' && welcomePlayedRef.current && !isWelcomeStrictModeReplay)
    ) {
      setRevealFinalStyles(elements);
      return;
    }

    if (step === 'welcome') {
      welcomePlayedRef.current = true;
      welcomeElementRef.current = elements[0];
    }
    setRevealInitialStyles(elements);
    if (step !== 'welcome') {
      if (!attemptMotion(() => {
        animate(elements, {
          opacity: [0, 1],
          y: [MOTION_DISTANCE_PX.reveal, 0],
          duration: MOTION_DURATION.normal,
          delay: 0,
          ease: MOTION_EASE.enter,
        });
      })) setRevealFinalStyles(elements);
      return;
    }

    const recovery = startMotionDeadline(
      WELCOME_MOTION_DEADLINE_MS,
      () => setRevealFinalStyles(elements),
    );
    const started = attemptMotion(() => {
      const animation = animate(elements, {
        opacity: [0, 1],
        y: [MOTION_DISTANCE_PX.reveal, 0],
        duration: MOTION_DURATION.normal,
        delay: stagger(WELCOME_STAGGER_MS),
        ease: MOTION_EASE.enter,
        onComplete: recovery.complete,
      });
      recovery.attachCancel(() => animation.cancel());
    });
    if (!started) recovery.fail();
    return recovery.dispose;
  }, [motionPreset, step]);
  const reviewMotionRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    if (step !== 'review') return;

    const track = root.querySelector<HTMLElement>('.allocation-bar__visual-track');
    const segmentElements = root.querySelectorAll<HTMLElement>('.allocation-bar__visual-segment');
    if (track === null) return;

    track.style.transformOrigin = 'left center';
    const isStrictModeReplay = assemblyPlayedRef.current && assemblyRootRef.current === root;
    if (
      motionPreset === 'none'
      || reducedMotion
      || (assemblyPlayedRef.current && !isStrictModeReplay)
    ) {
      setAssemblyFinalStyles(track, segmentElements);
      return;
    }

    assemblyPlayedRef.current = true;
    assemblyRootRef.current = root;
    setAssemblyInitialStyles(track, segmentElements);
    const recovery = startMotionDeadline(
      REVIEW_MOTION_DEADLINE_MS,
      () => setAssemblyFinalStyles(track, segmentElements),
    );
    const started = attemptMotion(() => {
      const timeline = createTimeline({
        defaults: { ease: MOTION_EASE.enter },
        onComplete: recovery.complete,
      });
      recovery.attachCancel(() => timeline.cancel());
      timeline
        .add(track, { scaleX: [0, 1], duration: MOTION_DURATION.emphasis })
        .add(segmentElements, {
          opacity: [0, 1],
          duration: MOTION_DURATION.normal,
          delay: stagger(WELCOME_STAGGER_MS),
        }, '<+=80');
    });
    if (!started) recovery.fail();
    return recovery.dispose;
  }, [motionPreset, step]);

  useEffect(() => {
    document.querySelector<HTMLElement>('[data-setup-heading]')?.focus();
  }, [step]);

  useEffect(() => {
    const firstIssue = issues[0];
    if (firstIssue === undefined) return;
    const target = document.querySelector<HTMLElement>(validationPathSelector(firstIssue.path))
      ?? document.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? document.querySelector<HTMLElement>('[data-setup-heading]');
    target?.focus();
  }, [issues, step, validationAttempt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (step === 'income' && draft.monthlyNetIncomeWon <= 0) {
      setIncomeSubmittedEmpty(true);
      document.querySelector<HTMLElement>(validationPathSelector('monthlyNetIncomeWon'))?.focus();
      return;
    }

    if (step === 'review') {
      onApply();
      return;
    }

    if (nextStep) onStepChange(nextStep);
  }

  return (
    <Surface as="section" className={setupSurfaceClassName} aria-labelledby="setup-flow-title">
      <div className="mx-6 mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 sm:mx-10">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>
      <div className="mx-6 mt-5 flex items-center justify-between gap-4 sm:mx-10">
        <p className="m-0 text-sm font-black tracking-wide text-accent" id="setup-flow-title" role="status">
          {stepIndex + 1} / {steps.length} · {stepLabels[step]}
        </p>
        {onCancel ? (
          <Button
            className="rounded-full bg-white text-sm text-slate-700 shadow-sm"
            type="button"
            variant="secondary"
            aria-label="설정 취소"
            disabled={saving}
            onClick={onCancel}
          >
            취소
          </Button>
        ) : null}
      </div>
      {notice ? <div className="mx-6 mt-4 sm:mx-10">{notice}</div> : null}
      <form
        className="grid min-h-[31rem] content-start gap-6 px-6 pb-6 pt-5 sm:px-10 sm:pb-10"
        aria-busy={saving ? 'true' : undefined}
        aria-label="설정 단계"
        onSubmit={submit}
        ref={stepMotionRef}
      >
        <fieldset className="contents" disabled={saving}>
          <div
            className="grid gap-6"
            data-setup-step-content
            data-step-motion={step === 'welcome' || step === 'review' ? undefined : ''}
          >
            {step === 'welcome' ? <WelcomeStep /> : null}
            {step === 'income' ? (
              <IncomeStep
                draft={draft}
                error={incomeError}
                onChange={(monthlyNetIncomeWon) => {
                  setIncomeSubmittedEmpty(false);
                  onChange({ ...draft, monthlyNetIncomeWon });
                }}
              />
            ) : null}
            {step === 'housing' ? <HousingStep draft={draft} issues={issues} onChange={onChange} /> : null}
            {step === 'living' ? <LivingStep draft={draft} issues={issues} onChange={onChange} /> : null}
            {step === 'saving-investment' ? <SavingInvestmentStep draft={draft} issues={issues} onChange={onChange} /> : null}
            {step === 'review' ? <ReviewStep draft={draft} reviewRef={reviewMotionRef} /> : null}
          </div>

          <nav className="mt-auto flex justify-end gap-3 pt-6" aria-label="설정 이동">
            {previousStep ? (
              <Button
                className="px-5 py-3"
                type="button"
                variant="secondary"
                onClick={() => onStepChange(previousStep)}
              >
                이전
              </Button>
            ) : null}
            <Button
              className="px-6 py-3 shadow-lg shadow-primary/10"
              type="submit"
              variant="primary"
            >
              {step === 'review' ? delayedSaving ? '저장 중' : '계획 적용' : '다음'}
            </Button>
          </nav>
        </fieldset>
      </form>
    </Surface>
  );
}

function WelcomeStep() {
  return (
    <>
      <p className="m-0 text-sm font-black tracking-[0.18em] text-primary">MONTHLY FLOW</p>
      <h1
        className="m-0 max-w-xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl"
        data-setup-heading
        tabIndex={-1}
        data-welcome-motion
      >
        한 달 돈의 흐름, 2분이면 확인할 수 있어요.
      </h1>
      <p className="m-0 max-w-xl text-lg leading-8 text-slate-600" data-welcome-motion>
        수입과 지출 규모를 간단히 입력하면 매달 남는 돈을 바로 확인할 수 있어요.
      </p>
    </>
  );
}

interface IncomeStepProps {
  draft: MainData;
  error?: string;
  onChange(amountWon: number): void;
}

function IncomeStep({ draft, error, onChange }: IncomeStepProps) {
  return (
    <>
      <StepHeading>한 달에 실제로 들어오는 돈은 얼마인가요?</StepHeading>
      <MoneyField
        id="monthly-net-income"
        label="월 실수령액"
        valueWon={draft.monthlyNetIncomeWon}
        error={error}
        validationPath="monthlyNetIncomeWon"
        onChange={onChange}
      />
    </>
  );
}

function HousingStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  return (
    <>
      <StepHeading>주거비로 매달 얼마가 나가나요?</StepHeading>
      <p className="m-0 text-slate-600">월세 또는 전세대출 이자, 관리비, 공과금을 합친 금액</p>
      <MoneyField
        id="monthly-housing"
        label="월 주거 고정비"
        valueWon={draft.monthlyHousingWon}
        error={findIssue(issues, 'monthlyHousingWon')}
        validationPath="monthlyHousingWon"
        onChange={(amountWon) => onChange({ ...draft, monthlyHousingWon: amountWon })}
      />
    </>
  );
}

function LivingStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  return (
    <>
      <StepHeading>그 밖의 생활비는 보통 얼마인가요?</StepHeading>
      <p className="m-0 text-slate-600">식비, 교통비, 경조사비 등 최근 몇 달의 평균</p>
      <MoneyField
        id="monthly-living"
        label="월평균 생활비"
        valueWon={draft.monthlyLivingWon}
        error={findIssue(issues, 'monthlyLivingWon')}
        validationPath="monthlyLivingWon"
        onChange={(amountWon) => onChange({ ...draft, monthlyLivingWon: amountWon })}
      />
    </>
  );
}

function SavingInvestmentStep({
  draft,
  issues,
  onChange,
}: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  return (
    <>
      <StepHeading>매달 저축과 투자는 얼마나 하나요?</StepHeading>
      <p className="m-0 text-slate-600">정해둔 금액이 없다면 건너뛰어도 돼요.</p>
      <MoneyField
        id="monthly-saving"
        label="월 저축액"
        valueWon={draft.monthlySavingWon}
        error={findIssue(issues, 'monthlySavingWon')}
        validationPath="monthlySavingWon"
        onChange={(amountWon) => onChange({ ...draft, monthlySavingWon: amountWon })}
      />
      <MoneyField
        id="monthly-investment"
        label="월 투자액"
        valueWon={draft.monthlyInvestmentWon}
        error={findIssue(issues, 'monthlyInvestmentWon')}
        validationPath="monthlyInvestmentWon"
        onChange={(amountWon) => onChange({ ...draft, monthlyInvestmentWon: amountWon })}
      />
    </>
  );
}

function ReviewStep({
  draft,
  reviewRef,
}: Pick<SetupFlowProps, 'draft'> & { reviewRef: RefObject<HTMLElement | null> }) {
  return (
    <section className="grid gap-6" ref={reviewRef}>
      <div data-assembly-content>
        <StepHeading>입력한 월 자금 계획을 확인해주세요</StepHeading>
      </div>
      <AllocationBar data={draft} presentation="assembly" />
    </section>
  );
}

function startMotionDeadline(
  timeoutMs: number,
  applyFinalStyles: () => void,
): MotionDeadline {
  let settled = false;
  let cancelMotion: (() => void) | undefined;
  let timer: number | undefined = window.setTimeout(() => {
    timer = undefined;
    if (settled) return;
    settled = true;
    if (cancelMotion !== undefined) attemptMotion(cancelMotion);
    applyFinalStyles();
  }, timeoutMs);

  const clear = () => {
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timer = undefined;
  };
  const recover = () => {
    if (settled) return;
    settled = true;
    clear();
    if (cancelMotion !== undefined) attemptMotion(cancelMotion);
    applyFinalStyles();
  };

  return {
    attachCancel(cancel) {
      cancelMotion = cancel;
    },
    complete() {
      if (settled) return;
      settled = true;
      clear();
      applyFinalStyles();
    },
    fail: recover,
    dispose() {
      if (settled) return;
      settled = true;
      clear();
    },
  };
}

function setRevealFinalStyles(elements: NodeListOf<HTMLElement>): void {
  for (const element of elements) {
    element.style.opacity = '1';
    element.style.transform = 'translateY(0px)';
  }
}

function setRevealInitialStyles(elements: NodeListOf<HTMLElement>): void {
  for (const element of elements) {
    element.style.opacity = '0';
    element.style.transform = `translateY(${MOTION_DISTANCE_PX.reveal}px)`;
  }
}

function setAssemblyFinalStyles(
  track: HTMLElement,
  segments: NodeListOf<HTMLElement>,
): void {
  track.style.transform = 'scaleX(1)';
  for (const segment of segments) segment.style.opacity = '1';
}

function setAssemblyInitialStyles(
  track: HTMLElement,
  segments: NodeListOf<HTMLElement>,
): void {
  track.style.transform = 'scaleX(0)';
  for (const segment of segments) segment.style.opacity = '0';
}

function StepHeading({ children }: { children: string }) {
  return (
    <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-950" data-setup-heading tabIndex={-1}>
      {children}
    </h1>
  );
}

function findIssue(issues: ValidationIssue[], path: string): string | undefined {
  const issue = issues.find((candidate) => candidate.path === path);
  return issue ? issueMessage(issue.code) : undefined;
}

function validationPathSelector(path: string): string {
  return `[data-validation-path="${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function issueMessage(code: ValidationCode): string {
  switch (code) {
    case 'income_required':
      return '수입을 먼저 입력해주세요.';
    case 'amount_negative':
      return '금액은 0원 이상으로 입력해주세요.';
    case 'amount_not_safe_integer':
      return '입력할 수 있는 금액 범위를 확인해주세요.';
  }
}
