import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateMainData, type ValidationResult } from '../../../src/main/domain/validation';
import type { MainData } from '../../../src/main/domain/model';
import { ApplyBar } from '../../../src/main/ui/editor/ApplyBar';
import { FinancialEditor } from '../../../src/main/ui/editor/FinancialEditor';

afterEach(cleanup);

const original: MainData = {
  schemaVersion: 1,
  updatedAt: 1,
  incomes: [
    { id: 'salary', name: '급여', amountWon: 4_200_000, allocations: [{ accountId: 'salary-account', amountWon: 4_200_000 }] },
    { id: 'side-job', name: '부수입', amountWon: 300_000, allocations: [] },
  ],
  expenses: [{ id: 'living', name: '생활비', amountWon: 1_800_000 }],
  savings: [],
  investments: [],
  accounts: [{ id: 'salary-account', name: '급여통장', kind: 'income' }],
};

function clone(data: MainData): MainData {
  return structuredClone(data);
}

function EditorHarness() {
  const [draft, setDraft] = useState(() => clone(original));
  const [issues, setIssues] = useState<ValidationResult['issues']>([]);
  const [saved, setSaved] = useState(false);

  function apply() {
    const result = validateMainData(draft);
    setIssues(result.issues);
    if (result.valid) setSaved(true);
  }

  return (
    <>
      <FinancialEditor
        section="income"
        draft={draft}
        issues={issues}
        onChange={setDraft}
      />
      <ApplyBar dirty saveStatus="idle" onApply={apply} onCancel={() => setDraft(clone(original))} />
      <output aria-label="저장 결과">{saved ? '저장됨' : '저장 안 됨'}</output>
    </>
  );
}

function AllocationHarness({ onChange }: { onChange: (data: MainData) => void }) {
  const [draft, setDraft] = useState<MainData>({
    ...original,
    incomes: [{ ...original.incomes[0], allocations: [] }],
  });

  return (
    <FinancialEditor
      section="income"
      draft={draft}
      issues={[]}
      onChange={(next) => {
        onChange(next);
        setDraft(next);
      }}
    />
  );
}

function AccountHarness({ onChange }: { onChange: (data: MainData) => void }) {
  const [draft, setDraft] = useState<MainData>({
    ...original,
    accounts: [
      { id: 'account-1', name: '첫 계좌', kind: 'income' },
      { id: 'account-2', name: '둘째 계좌', kind: 'other' },
    ],
  });

  return (
    <FinancialEditor
      section="income"
      draft={draft}
      issues={[]}
      onChange={(next) => {
        onChange(next);
        setDraft(next);
      }}
    />
  );
}

function LastIncomeHarness() {
  const [draft, setDraft] = useState<MainData>({ ...original, incomes: [original.incomes[0]] });
  const [issues, setIssues] = useState<ValidationResult['issues']>([]);

  return (
    <>
      <FinancialEditor section="income" draft={draft} issues={issues} onChange={setDraft} />
      <ApplyBar
        dirty
        saveStatus="idle"
        onApply={() => setIssues(validateMainData(draft).issues)}
        onCancel={vi.fn()}
      />
    </>
  );
}

function RepeatInvalidFocusHarness() {
  const [focusAttempt, setFocusAttempt] = useState(1);
  const issues: ValidationResult['issues'] = [{ path: 'incomes.salary.name', code: 'name_required' }];

  return (
    <>
      <FinancialEditor
        section="income"
        draft={original}
        issues={issues}
        focusAttempt={focusAttempt}
        onChange={vi.fn()}
      />
      <button type="button" onClick={() => setFocusAttempt((attempt) => attempt + 1)}>다시 적용</button>
    </>
  );
}

describe('FinancialEditor', () => {
  it('updates only the draft item being edited and keeps its single full allocation in sync', () => {
    const onChange = vi.fn();
    render(
      <FinancialEditor
        section="income"
        draft={original}
        issues={[]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('급여 월 금액'), { target: { value: '5000000' } });

    const next = onChange.mock.lastCall?.[0] as MainData;
    expect(next.incomes[0]).toMatchObject({ id: 'salary', amountWon: 5_000_000 });
    expect(next.incomes[0].allocations).toEqual([{ accountId: 'salary-account', amountWon: 5_000_000 }]);
    expect(next.incomes[1]).toStrictEqual(original.incomes[1]);
    expect(original.incomes[0].amountWon).toBe(4_200_000);
  });

  it('blocks an invalid apply and focuses the first invalid field', () => {
    render(<EditorHarness />);
    const name = screen.getByLabelText('급여 이름');

    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));

    expect(screen.getByRole('alert')).toHaveTextContent('이름을 입력해주세요.');
    expect(name).toHaveFocus();
    expect(screen.getByLabelText('저장 결과')).toHaveTextContent('저장 안 됨');
  });

  it('focuses the field identified by the first validation issue instead of render order', () => {
    render(
      <FinancialEditor
        section="income"
        draft={original}
        issues={[
          { path: 'accounts.salary-account.name', code: 'name_required' },
          { path: 'incomes.salary.name', code: 'name_required' },
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('계좌 1 이름')).toHaveFocus();
  });

  it('refocuses the same unresolved first issue for every validation attempt', () => {
    render(<RepeatInvalidFocusHarness />);
    const name = screen.getByLabelText('급여 이름');

    expect(name).toHaveFocus();
    const retry = screen.getByRole('button', { name: '다시 적용' });
    retry.focus();
    fireEvent.click(retry);

    expect(name).toHaveFocus();
  });

  it('connects account name and item account errors to stable descriptions', () => {
    render(
      <FinancialEditor
        section="income"
        draft={original}
        issues={[
          { path: 'incomes.salary.accountId', code: 'account_missing' },
          { path: 'accounts.salary-account.name', code: 'name_required' },
        ]}
        onChange={vi.fn()}
      />,
    );

    const itemAccount = screen.getByLabelText('급여 계좌');
    const accountName = screen.getByLabelText('계좌 1 이름');

    expect(itemAccount).toHaveAttribute('aria-invalid', 'true');
    expect(itemAccount).toHaveAttribute('aria-describedby', 'salary-account-error');
    expect(document.getElementById('salary-account-error')).toHaveTextContent('연결한 계좌를 확인해주세요.');
    expect(accountName).toHaveAttribute('aria-invalid', 'true');
    expect(accountName).toHaveAttribute('aria-describedby', 'salary-account-name-error');
    expect(screen.getByText('이름을 입력해주세요.')).toHaveAttribute('id', 'salary-account-name-error');
  });

  it('focuses income add when the final income is deleted and apply is blocked', () => {
    render(<LastIncomeHarness />);

    fireEvent.click(screen.getByRole('button', { name: '급여 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));

    expect(screen.getByRole('alert')).toHaveTextContent('수입을 하나 이상 입력해주세요.');
    expect(screen.getByRole('button', { name: '수입 추가' })).toHaveFocus();
  });

  it('adds and removes an income allocation through labelled controls', () => {
    const onChange = vi.fn();
    render(<AllocationHarness onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '급여 배분 추가' }));
    const withAllocation = onChange.mock.lastCall?.[0] as MainData;
    expect(withAllocation.incomes[0].allocations).toEqual([{ accountId: 'salary-account', amountWon: 0 }]);

    fireEvent.click(screen.getByRole('button', { name: '급여 배분 삭제' }));
    const withoutAllocation = onChange.mock.lastCall?.[0] as MainData;
    expect(withoutAllocation.incomes[0].allocations).toEqual([]);
  });

  it('creates a distinct account id after an account is deleted', () => {
    const onChange = vi.fn();
    render(<AccountHarness onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '계좌 1 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '계좌 추가' }));

    const next = onChange.mock.lastCall?.[0] as MainData;
    expect(next.accounts.map((account) => account.id)).toEqual(['account-2', 'account-3']);
  });
});
