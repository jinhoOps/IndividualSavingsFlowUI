import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { SummaryDashboard } from '../../../src/main/ui/dashboard/SummaryDashboard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const appliedData: MainData = {
  schemaVersion: 1,
  updatedAt: 1,
  incomes: [{ id: 'salary', name: '급여', amountWon: 4_200_000, allocations: [{ accountId: 'salary-account', amountWon: 4_200_000 }] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 1_800_000, accountId: 'spending-account' }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 700_000 }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 500_000 }],
  accounts: [
    { id: 'salary-account', name: '급여통장', kind: 'income' },
    { id: 'spending-account', name: '생활비통장', kind: 'spending' },
  ],
};

function clone(data: MainData): MainData {
  return structuredClone(data);
}

function DashboardHarness({ mobile = false }: { mobile?: boolean }) {
  const [draft, setDraft] = useState(() => clone(appliedData));
  const [dirty, setDirty] = useState(false);

  if (mobile) {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  }

  return (
    <SummaryDashboard
      applied={appliedData}
      draft={draft}
      dirty={dirty}
      issues={[]}
      saveStatus="saved"
      onDraftChange={(next) => {
        setDraft(next);
        setDirty(true);
      }}
      onApply={vi.fn()}
      onCancel={() => {
        setDraft(clone(appliedData));
        setDirty(false);
      }}
      onRestart={vi.fn()}
    />
  );
}

describe('SummaryDashboard', () => {
  it('prioritizes income, planned outflow and remaining cash while keeping all five required values available', () => {
    render(<DashboardHarness />);

    expect(screen.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('저장됨');
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('수입');
    expect(screen.getByRole('button', { name: '생활비 편집' })).toHaveTextContent('생활비');
    expect(screen.getByRole('button', { name: '저축 편집' })).toHaveTextContent('저축');
    expect(screen.getByRole('button', { name: '투자 편집' })).toHaveTextContent('투자');
    expect(screen.getByText('계획 유출')).toBeVisible();
    expect(screen.getByText('투자 가능액')).toBeVisible();
    expect(screen.getByRole('img', { name: '월간 현금흐름 Sankey 그래프' })).toBeVisible();
  });

  it('opens the income editor from the income summary card', () => {
    render(<DashboardHarness />);

    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));

    expect(screen.getByRole('complementary', { name: '수입 편집' })).toBeVisible();
    expect(screen.getByLabelText('급여 월 금액')).toHaveValue('4,200,000');
  });

  it('keeps the dashboard on the applied value and restores the draft on cancel', () => {
    render(<DashboardHarness />);
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));

    fireEvent.change(screen.getByLabelText('급여 월 금액'), { target: { value: '5000000' } });

    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('420만 원');
    expect(screen.getByLabelText('급여 월 금액')).toHaveValue('5,000,000');

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('급여 월 금액')).toHaveValue('4,200,000');
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('420만 원');
  });

  it('uses a modal dialog on mobile while retaining the same editor fields', () => {
    render(<DashboardHarness mobile />);
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));

    expect(screen.getByRole('dialog', { name: '수입 편집' })).toBeVisible();
    expect(screen.getByLabelText('급여 월 금액')).toBeVisible();
  });

  it('discards a dirty draft after confirming that the editor should close', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DashboardHarness />);
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));
    fireEvent.change(screen.getByLabelText('급여 월 금액'), { target: { value: '5000000' } });

    fireEvent.click(screen.getByRole('button', { name: '편집기 닫기' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary', { name: '수입 편집' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));
    expect(screen.getByLabelText('급여 월 금액')).toHaveValue('4,200,000');
  });

  it('only warns on browser exit when the draft is dirty', () => {
    const { rerender } = render(
      <SummaryDashboard
        applied={appliedData}
        draft={appliedData}
        dirty={false}
        issues={[]}
        saveStatus="idle"
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const cleanExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanExit);
    expect(cleanExit.defaultPrevented).toBe(false);

    rerender(
      <SummaryDashboard
        applied={appliedData}
        draft={appliedData}
        dirty
        issues={[]}
        saveStatus="idle"
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const dirtyExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyExit);
    expect(dirtyExit.defaultPrevented).toBe(true);
  });
});
