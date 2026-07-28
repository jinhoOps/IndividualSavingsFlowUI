import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { SummaryDashboard, type SummaryDashboardProps } from '../../../src/main/ui/dashboard/SummaryDashboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

function CrossSectionValidationHarness() {
  const [issues, setIssues] = useState<SummaryDashboardProps['issues']>([]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIssues([{ path: 'expenses.living.accountId', code: 'account_missing' }])}
      >
        생활비 검증 오류 표시
      </button>
      <SummaryDashboard
        applied={appliedData}
        draft={appliedData}
        dirty={false}
        issues={issues}
        saveStatus="idle"
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        onRestart={vi.fn()}
      />
    </>
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

  it('contains the editor and apply controls in one mobile modal, traps focus, and hides dashboard controls', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DashboardHarness mobile />);
    const opener = screen.getByRole('button', { name: '수입 편집' });
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: '수입 편집' });
    const dialogScope = within(dialog);
    const close = dialogScope.getByRole('button', { name: '편집기 닫기' });
    const apply = dialogScope.getByRole('button', { name: '적용' });

    expect(dialogScope.getByLabelText('급여 월 금액')).toBeVisible();
    expect(apply).toBeInTheDocument();
    expect(dialogScope.getByRole('heading', { name: '수입 편집' })).toHaveFocus();
    expect(screen.getByTestId('dashboard-controls')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('dashboard-controls')).toHaveAttribute('inert');

    fireEvent.change(dialogScope.getByLabelText('급여 월 금액'), { target: { value: '5000000' } });
    apply.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(apply).toHaveFocus();

    fireEvent.click(close);
    expect(opener).toHaveFocus();
  });

  it('asks before discarding a dirty mobile editor from Escape or its backdrop', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DashboardHarness mobile />);
    const opener = screen.getByRole('button', { name: '수입 편집' });
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('급여 월 금액'), { target: { value: '5000000' } });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: '수입 편집' })).toBeVisible();

    fireEvent.click(screen.getByTestId('editor-backdrop'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog', { name: '수입 편집' })).toBeVisible();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('editor-backdrop'));
    expect(screen.queryByRole('dialog', { name: '수입 편집' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
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

  it('confirms a dirty draft before starting over and only restarts after discard is accepted', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCancel = vi.fn();
    const onRestart = vi.fn();
    render(
      <SummaryDashboard
        applied={appliedData}
        draft={{ ...appliedData, incomes: [{ ...appliedData.incomes[0], amountWon: 5_000_000 }] }}
        dirty
        issues={[]}
        saveStatus="idle"
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
        onRestart={onRestart}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 설정' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 설정' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('opens the section containing the first validation issue and focuses its exact field', () => {
    render(<CrossSectionValidationHarness />);
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '생활비 검증 오류 표시' }));

    expect(screen.getByRole('complementary', { name: '생활비 편집' })).toBeVisible();
    expect(screen.getByLabelText('생활비 계좌')).toHaveFocus();
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
