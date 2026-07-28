import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';
import { SetupFlow, type ValidationIssue } from '../../../src/main/ui/setup/SetupFlow';

afterEach(cleanup);

function renderFlow(initialStep: SetupStep, issues: ValidationIssue[] = []) {
  const onChange = vi.fn();
  const onStepChange = vi.fn();
  const onApply = vi.fn();

  function Harness() {
    const [draft, setDraft] = useState<MainData>(createEmptyMainData);
    const [step, setStep] = useState<SetupStep>(initialStep);

    return (
      <SetupFlow
        draft={draft}
        step={step}
        issues={issues}
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

describe('SetupFlow', () => {
  it('captures monthly income and advances to the expense step on form submit', () => {
    const { onChange, onStepChange } = renderFlow('income');

    expect(screen.getByRole('heading', { name: '월 수입을 알려주세요' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('수입 이름'), { target: { value: '급여' } });
    fireEvent.change(screen.getByLabelText('월 금액'), { target: { value: '4200000' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      incomes: [expect.objectContaining({ name: '급여', amountWon: 4_200_000 })],
    }));
    expect(onStepChange).toHaveBeenCalledWith('expense');
    expect(screen.getByRole('heading', { name: '월 생활비를 알려주세요' })).toBeVisible();
  });

  it('uses one accessible form per stage and navigates the secondary saving and investment stage', () => {
    const { onStepChange } = renderFlow('saving-investment');

    expect(screen.getByRole('status')).toHaveTextContent('4 / 6');
    expect(screen.getByRole('heading', { name: '저축과 투자를 알려주세요' })).toBeVisible();
    expect(screen.getByLabelText('월 저축 금액')).toBeVisible();
    expect(screen.getByLabelText('월 투자 금액')).toBeVisible();
    expect(screen.getAllByRole('form')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(onStepChange).toHaveBeenCalledWith('expense');
  });

  it('connects a field issue to its matching input', () => {
    renderFlow('income', [{ path: 'incomes.income-1.name', code: 'name_required' }]);

    const incomeName = screen.getByLabelText('수입 이름');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('이름을 입력해주세요.');
    expect(incomeName).toHaveAttribute('aria-invalid', 'true');
    expect(incomeName).toHaveAttribute('aria-describedby', error.id);
  });

  it('applies the plan from the review stage', () => {
    const { onApply } = renderFlow('review');

    expect(screen.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '계획 적용' }));

    expect(onApply).toHaveBeenCalledOnce();
  });
});
