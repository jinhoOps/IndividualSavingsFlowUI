import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';
import { SetupFlow, type ValidationIssue } from '../../../src/main/ui/setup/SetupFlow';

afterEach(cleanup);

interface RenderFlowOptions {
  issues?: ValidationIssue[];
  initialDraft?: MainData;
  saving?: boolean;
  validationAttempt?: number;
}

function renderFlow(initialStep: SetupStep, options: RenderFlowOptions = {}) {
  const {
    issues = [],
    initialDraft = createEmptyMainData(),
    saving = false,
    validationAttempt = 0,
  } = options;
  const onChange = vi.fn();
  const onStepChange = vi.fn();
  const onApply = vi.fn();

  function Harness() {
    const [draft, setDraft] = useState<MainData>(initialDraft);
    const [step, setStep] = useState<SetupStep>(initialStep);

    return (
      <SetupFlow
        draft={draft}
        step={step}
        issues={issues}
        validationAttempt={validationAttempt}
        saving={saving}
        onChange={(nextDraft) => {
          onChange(nextDraft);
          setDraft(nextDraft);
        }}
        onStepChange={(nextStep) => {
          onStepChange(nextStep);
          setStep(nextStep);
        }}
        onApply={onApply}
      />
    );
  }

  render(<Harness />);
  return { onApply, onChange, onStepChange };
}

function expectOneFormWithoutLegacyControls() {
  expect(screen.getAllByRole('form')).toHaveLength(1);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: /이름/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('수입 이름')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('생활비 이름')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('계좌 이름')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('수입 입금 계좌')).not.toBeInTheDocument();
}

describe('SetupFlow', () => {
  it('uses the shared surface, button variants, and compact flow meter', () => {
    renderFlow('housing', {
      initialDraft: { ...createEmptyMainData(), monthlyNetIncomeWon: 3_200_000 },
    });

    expect(screen.getByLabelText('설정 단계').closest('.ui-surface')).not.toBeNull();
    expect(screen.getByRole('button', { name: '다음' })).toHaveClass('ui-button--primary');
    expect(screen.getByRole('button', { name: '이전' })).toHaveClass('ui-button--secondary');
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveClass('flow-bar');
    expect(screen.queryByText(/^월 수입 /)).not.toBeInTheDocument();
  });

  it('completes the approved scalar setup journey with live cashflow context', () => {
    const { onApply, onChange, onStepChange } = renderFlow('welcome');

    expect(screen.getByRole('status')).toHaveTextContent('1 / 6 · 시작');
    expect(screen.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toHaveFocus();
    expectOneFormWithoutLegacyControls();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '한 달에 실제로 들어오는 돈은 얼마인가요?' })).toBeVisible();
    expect(screen.queryByLabelText('월 실수령액')).toHaveValue('');
    expectOneFormWithoutLegacyControls();

    fireEvent.change(screen.getByLabelText('월 실수령액'), { target: { value: '3200000' } });
    expect(screen.getByLabelText('월 실수령액')).toHaveValue('3,200,000');
    expect(onChange).toHaveBeenLastCalledWith({
      ...createEmptyMainData(),
      monthlyNetIncomeWon: 3_200_000,
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' })).toBeVisible();
    expect(screen.getByLabelText('월 주거 고정비')).toHaveValue('');
    expect(screen.getByText('월세 또는 전세대출 이자, 관리비, 공과금을 합친 금액')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 0원 · 수입의 0.0%');
    expect(screen.queryByText(/^월 수입 /)).not.toBeInTheDocument();
    expectOneFormWithoutLegacyControls();

    fireEvent.change(screen.getByLabelText('월 주거 고정비'), { target: { value: '800000' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ monthlyHousingWon: 800_000 }));
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '그 밖의 생활비는 보통 얼마인가요?' })).toBeVisible();
    expect(screen.getByLabelText('월평균 생활비')).toHaveValue('');
    expect(screen.getByText('식비, 교통비, 경조사비 등 최근 몇 달의 평균')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
    expectOneFormWithoutLegacyControls();

    fireEvent.change(screen.getByLabelText('월평균 생활비'), { target: { value: '1000000' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ monthlyLivingWon: 1_000_000 }));
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 180만 원 · 수입의 56.3%');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '매달 저축과 투자는 얼마나 하나요?' })).toBeVisible();
    expect(screen.getByText('정해둔 금액이 없다면 건너뛰어도 돼요.')).toBeVisible();
    expect(screen.getByLabelText('월 저축액')).toHaveValue('');
    expect(screen.getByLabelText('월 투자액')).toHaveValue('');
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 180만 원 · 수입의 56.3%');
    expectOneFormWithoutLegacyControls();

    fireEvent.change(screen.getByLabelText('월 저축액'), { target: { value: '300000' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ monthlySavingWon: 300_000 }));
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 210만 원 · 수입의 65.6%');
    fireEvent.change(screen.getByLabelText('월 투자액'), { target: { value: '200000' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ monthlyInvestmentWon: 200_000 }));
    expect(screen.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 230만 원 · 수입의 71.9%');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
    expect(screen.queryByRole('progressbar', { name: '수입 대비 현재 계획' })).not.toBeInTheDocument();
    expect(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요')).toBeVisible();
    expect(screen.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
    expect(document.querySelector('.setup-review-transition')).not.toBeNull();
    expect(document.querySelector('.setup-review-transition__track')).not.toBeNull();
    fireEvent.animationEnd(document.querySelector('.setup-review-transition__track')!);
    expect(document.querySelector('.setup-review-transition')).not.toBeNull();
    fireEvent.animationEnd(document.querySelector('.setup-review-transition')!);
    expect(document.querySelector('.setup-review-transition')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(document.querySelector('.setup-review-transition')).not.toBeNull();
    expect(screen.queryByText(/배분/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '소비 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '저축 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투자 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '남는 돈 상세 정보' })).toBeVisible();
    expectOneFormWithoutLegacyControls();

    fireEvent.click(screen.getByRole('button', { name: '계획 적용' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onStepChange.mock.calls.map(([nextStep]) => nextStep)).toEqual([
      'income',
      'housing',
      'living',
      'saving-investment',
      'review',
      'saving-investment',
      'review',
    ]);
  });

  it('blocks zero income, explains the requirement, and focuses the exact field', () => {
    const { onStepChange } = renderFlow('income');

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    const income = screen.getByLabelText('월 실수령액');
    const error = screen.getByRole('alert');
    expect(onStepChange).not.toHaveBeenCalled();
    expect(error).toHaveTextContent('수입을 먼저 입력해주세요.');
    expect(income).toHaveAttribute('aria-invalid', 'true');
    expect(income).toHaveAttribute('aria-describedby', error.id);
    expect(income).toHaveFocus();
  });

  it('allows every non-income amount to stay at zero while moving forward', () => {
    const draft = { ...createEmptyMainData(), monthlyNetIncomeWon: 3_200_000 };
    const { onStepChange } = renderFlow('housing', { initialDraft: draft });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '그 밖의 생활비는 보통 얼마인가요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '매달 저축과 투자는 얼마나 하나요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
    expect(onStepChange.mock.calls.map(([nextStep]) => nextStep)).toEqual([
      'living',
      'saving-investment',
      'review',
    ]);
  });

  it('moves focus to stage headings during forward and previous navigation', () => {
    renderFlow('housing', {
      initialDraft: { ...createEmptyMainData(), monthlyNetIncomeWon: 3_200_000 },
    });

    expect(screen.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '그 밖의 생활비는 보통 얼마인가요?' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' })).toHaveFocus();
  });

  it('connects an apply validation issue to the exact scalar field and focuses it', () => {
    renderFlow('income', {
      issues: [{ path: 'monthlyNetIncomeWon', code: 'income_required' }],
      validationAttempt: 1,
    });

    const income = screen.getByLabelText('월 실수령액');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('수입을 먼저 입력해주세요.');
    expect(income).toHaveAttribute('aria-invalid', 'true');
    expect(income).toHaveAttribute('aria-describedby', error.id);
    expect(income).toHaveFocus();
  });

  it('keeps every form control disabled while the plan is saving', () => {
    const { onApply, onStepChange } = renderFlow('review', {
      initialDraft: { ...createEmptyMainData(), monthlyNetIncomeWon: 3_200_000 },
      saving: true,
    });

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-busy', 'true');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    fireEvent.click(screen.getByRole('button', { name: '계획 적용' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
  });
});
