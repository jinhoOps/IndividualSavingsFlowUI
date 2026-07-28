import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';
import { SetupFlow, type ValidationIssue } from '../../../src/main/ui/setup/SetupFlow';

afterEach(cleanup);

function renderFlow(
  initialStep: SetupStep,
  issues: ValidationIssue[] = [],
  initialDraft: MainData = createEmptyMainData(),
) {
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

  it('moves focus to each stage heading during normal forward and backward navigation', () => {
    renderFlow('welcome');

    expect(screen.getByRole('heading', { name: '내 자금 계획을 시작합니다' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '월 수입을 알려주세요' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('heading', { name: '월 생활비를 알려주세요' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByRole('heading', { name: '월 수입을 알려주세요' })).toHaveFocus();
  });

  it('keeps a single full income allocation synchronized with the edited income amount', () => {
    const draft: MainData = {
      ...createEmptyMainData(),
      incomes: [{
        id: 'salary',
        name: '급여',
        amountWon: 3_000_000,
        accountId: 'salary-account',
        allocations: [{ accountId: 'salary-account', amountWon: 3_000_000 }],
      }],
      accounts: [{ id: 'salary-account', name: '급여통장', kind: 'income' }],
    };
    const { onChange } = renderFlow('income', [], draft);

    fireEvent.change(screen.getByLabelText('월 금액'), { target: { value: '4000000' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      incomes: [expect.objectContaining({
        amountWon: 4_000_000,
        accountId: 'salary-account',
        allocations: [{ accountId: 'salary-account', amountWon: 4_000_000 }],
      })],
    }));
  });

  it('lets a restarted split-income draft repair allocation amounts before apply', () => {
    const draft: MainData = {
      ...createEmptyMainData(),
      incomes: [{
        id: 'salary',
        name: '급여',
        amountWon: 3_000_000,
        accountId: 'salary-account',
        allocations: [
          { accountId: 'salary-account', amountWon: 1_000_000 },
          { accountId: 'living-account', amountWon: 2_000_000 },
        ],
      }],
      accounts: [
        { id: 'salary-account', name: '급여통장', kind: 'income' },
        { id: 'living-account', name: '생활비통장', kind: 'spending' },
      ],
    };
    const { onChange } = renderFlow('income', [], draft);
    fireEvent.change(screen.getByLabelText('월 금액'), { target: { value: '4000000' } });
    for (let step = 0; step < 3; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: '다음' }));
    }

    expect(screen.getByRole('heading', { name: '계좌를 알려주세요' })).toBeVisible();
    expect(screen.getByLabelText('급여 배분 1 금액')).toHaveValue('1,000,000');
    expect(screen.getByLabelText('급여 배분 2 금액')).toHaveValue('2,000,000');
    fireEvent.change(screen.getByLabelText('급여 배분 2 금액'), { target: { value: '3000000' } });

    const next = onChange.mock.lastCall?.[0] as MainData;
    expect(next.incomes[0]).toMatchObject({
      amountWon: 4_000_000,
      allocations: [
        { accountId: 'salary-account', amountWon: 1_000_000 },
        { accountId: 'living-account', amountWon: 3_000_000 },
      ],
    });
  });

  it('lets the account stage select and persist the income destination account', () => {
    const draft: MainData = {
      ...createEmptyMainData(),
      incomes: [{
        id: 'salary',
        name: '급여',
        amountWon: 3_000_000,
        accountId: 'salary-account',
        allocations: [{ accountId: 'salary-account', amountWon: 3_000_000 }],
      }],
      accounts: [
        { id: 'salary-account', name: '급여통장', kind: 'income' },
        { id: 'shared-account', name: '공동통장', kind: 'spending' },
      ],
    };
    const { onChange } = renderFlow('account', [], draft);

    fireEvent.change(screen.getByLabelText('수입 입금 계좌'), { target: { value: 'shared-account' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      incomes: [expect.objectContaining({
        accountId: 'shared-account',
        allocations: [{ accountId: 'shared-account', amountWon: 3_000_000 }],
      })],
    }));
  });

  it('connects a field issue to its matching input', () => {
    renderFlow('income', [{ path: 'incomes.income-1.name', code: 'name_required' }]);

    const incomeName = screen.getByLabelText('수입 이름');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('이름을 입력해주세요.');
    expect(incomeName).toHaveAttribute('aria-invalid', 'true');
    expect(incomeName).toHaveAttribute('aria-describedby', error.id);
    expect(incomeName).toHaveFocus();
  });

  it('applies the plan from the review stage', () => {
    const { onApply } = renderFlow('review');

    expect(screen.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '계획 적용' }));

    expect(onApply).toHaveBeenCalledOnce();
  });

  it('preserves later resumed entries while editing the first entry of every setup collection', () => {
    const draft: MainData = {
      schemaVersion: 1,
      updatedAt: 1,
      incomes: [
        { id: 'income-1', name: '급여', amountWon: 4_000_000, allocations: [] },
        { id: 'income-2', name: '부수입', amountWon: 300_000, allocations: [{ accountId: 'account-2', amountWon: 300_000 }] },
      ],
      expenses: [
        { id: 'expense-1', name: '생활비', amountWon: 1_500_000 },
        { id: 'expense-2', name: '통신비', amountWon: 80_000, group: '고정비', accountId: 'account-2' },
      ],
      savings: [
        { id: 'saving-1', name: '적금', amountWon: 400_000 },
        { id: 'saving-2', name: '비상금', amountWon: 200_000, annualRate: 3.2, maturityMonth: '2027-01' },
      ],
      investments: [
        { id: 'investment-1', name: 'ETF', amountWon: 300_000 },
        { id: 'investment-2', name: '연금', amountWon: 250_000, group: '장기', accountId: 'account-2' },
      ],
      accounts: [
        { id: 'account-1', name: '급여통장', kind: 'income' },
        { id: 'account-2', name: '보조통장', kind: 'other' },
      ],
    };
    const preserved = {
      income: structuredClone(draft.incomes[1]),
      expense: structuredClone(draft.expenses[1]),
      saving: structuredClone(draft.savings[1]),
      investment: structuredClone(draft.investments[1]),
      account: structuredClone(draft.accounts[1]),
    };
    const { onChange } = renderFlow('income', [], draft);

    fireEvent.change(screen.getByLabelText('수입 이름'), { target: { value: '본업 급여' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.change(screen.getByLabelText('생활비 이름'), { target: { value: '월 생활비' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.change(screen.getByLabelText('월 저축 금액'), { target: { value: '500000' } });
    fireEvent.change(screen.getByLabelText('월 투자 금액'), { target: { value: '350000' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.change(screen.getByLabelText('계좌 이름'), { target: { value: '주거래 통장' } });

    const edited = onChange.mock.lastCall?.[0] as MainData;
    expect(edited.incomes[1]).toStrictEqual(preserved.income);
    expect(edited.expenses[1]).toStrictEqual(preserved.expense);
    expect(edited.savings[1]).toStrictEqual(preserved.saving);
    expect(edited.investments[1]).toStrictEqual(preserved.investment);
    expect(edited.accounts[1]).toStrictEqual(preserved.account);
  });
});
