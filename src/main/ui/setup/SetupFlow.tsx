import { useEffect, useState, type FormEvent } from 'react';
import type { MainData, SetupStep } from '../../domain/model';
import type { ValidationCode } from '../../domain/validation';
import { Button } from '../common/Button';
import { MoneyField } from '../common/MoneyField';
import { Surface } from '../common/Surface';
import { AllocationBar } from './AllocationBar';
import { FlowContextSummary } from './FlowContextSummary';

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
}

const steps: SetupStep[] = ['welcome', 'income', 'housing', 'living', 'saving-investment', 'review'];

const stepLabels: Record<SetupStep, string> = {
  welcome: '시작',
  income: '실수령액',
  housing: '주거비',
  living: '생활비',
  'saving-investment': '저축·투자',
  review: '확인',
};

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
}: SetupFlowProps) {
  const [incomeSubmittedEmpty, setIncomeSubmittedEmpty] = useState(false);
  const stepIndex = steps.indexOf(step);
  const previousStep = steps[stepIndex - 1];
  const nextStep = steps[stepIndex + 1];
  const showContext = step === 'housing'
    || step === 'living'
    || step === 'saving-investment'
    || step === 'review';
  const incomeError = findIssue(issues, 'monthlyNetIncomeWon')
    ?? (incomeSubmittedEmpty ? issueMessage('income_required') : undefined);

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
    <Surface as="section" className="setup-flow-surface shadow-float" aria-labelledby="setup-flow-title">
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
      <form
        className="grid min-h-[31rem] content-start gap-6 px-6 pb-6 pt-5 sm:px-10 sm:pb-10"
        aria-busy={saving ? 'true' : undefined}
        aria-label="설정 단계"
        onSubmit={submit}
      >
        <fieldset className="contents" disabled={saving}>
          {showContext ? <FlowContextSummary data={draft} /> : null}
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
          {step === 'review' ? <ReviewStep draft={draft} /> : null}

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
            <Button className="px-6 py-3 shadow-lg shadow-primary/10" type="submit" variant="primary">
              {step === 'review' ? '계획 적용' : '다음'}
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
      >
        한 달 돈의 흐름, 2분이면 확인할 수 있어요.
      </h1>
      <p className="m-0 max-w-xl text-lg leading-8 text-slate-600">
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

function ReviewStep({ draft }: Pick<SetupFlowProps, 'draft'>) {
  return (
    <>
      <StepHeading>입력한 월 자금 계획을 확인해주세요</StepHeading>
      <AllocationBar data={draft} />
    </>
  );
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
