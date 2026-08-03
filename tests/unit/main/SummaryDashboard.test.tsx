import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { SummaryDashboard, type SummaryDashboardProps } from '../../../src/main/ui/dashboard/SummaryDashboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const appliedData: MainData = {
  schemaVersion: 2,
  updatedAt: 1,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

function clone(data: MainData): MainData {
  return { ...data };
}

function stubMobileViewport() {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

function DashboardHarness({ mobile = false }: { mobile?: boolean }) {
  const [draft, setDraft] = useState(() => clone(appliedData));
  const [dirty, setDirty] = useState(false);

  if (mobile) stubMobileViewport();

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

function ValidationHarness({ mobile = false }: { mobile?: boolean }) {
  const [issues, setIssues] = useState<SummaryDashboardProps['issues']>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);

  if (mobile) stubMobileViewport();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIssues([{ path: 'monthlyLivingWon', code: 'amount_negative' }]);
          setValidationAttempt((attempt) => attempt + 1);
        }}
      >
        생활비 검증 오류 표시
      </button>
      <SummaryDashboard
        applied={appliedData}
        draft={appliedData}
        dirty={false}
        issues={issues}
        validationAttempt={validationAttempt}
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
  it('renders the supplied journey entry after the applied Main summary', () => {
    const journeyEntry: ReactNode = <button type="button">Simulation으로 이어가기</button>;
    render(
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
        journeyEntry={journeyEntry}
      />,
    );

    const summary = screen.getByRole('button', { name: '월 실수령액 편집' });
    const journey = screen.getByRole('button', { name: 'Simulation으로 이어가기' });
    expect(journey).toBeVisible();
    expect(summary.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('uses the shared surface and button variants across the dashboard editor', () => {
    render(<DashboardHarness />);

    expect(screen.getByRole('region', { name: '월 자금 구성' })).toHaveClass('ui-surface');
    const opener = screen.getByRole('button', { name: '월 실수령액 편집' });
    expect(opener).toHaveClass('ui-button--quiet');
    fireEvent.click(opener);
    expect(screen.getByRole('button', { name: '편집기 닫기' })).toHaveClass('ui-button--quiet');
    expect(screen.getByRole('button', { name: '적용' })).toHaveClass('ui-button--primary');
    expect(screen.getByRole('button', { name: '취소' })).toHaveClass('ui-button--secondary');
  });

  it('prioritizes scalar cashflow and has no legacy account, allocation, or Sankey UI', () => {
    render(<DashboardHarness />);

    expect(screen.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('저장됨');
    expect(screen.getByText('월 실수령액')).toBeVisible();
    expect(screen.getByText('월 소비')).toBeVisible();
    expect(screen.getByRole('button', { name: '남는 돈 편집' })).toHaveTextContent('남는 돈');
    expect(screen.getByText('월 저축')).toBeVisible();
    expect(screen.getByText('월 투자')).toBeVisible();
    expect(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요')).toBeVisible();
    expect(screen.getByRole('button', { name: '소비 상세 정보' })).toBeVisible();
    expect(screen.queryByText(/계좌|배분|Sankey/)).not.toBeInTheDocument();
  });

  it('describes the applied primary values and consumption breakdown accessibly', () => {
    render(<DashboardHarness />);

    expect(screen.getByRole('button', { name: '월 실수령액 편집' }))
      .toHaveAccessibleDescription(expect.stringMatching(/320만 원/));
    expect(screen.getByRole('button', { name: '월 소비 편집' }))
      .toHaveAccessibleDescription(expect.stringMatching(/180만 원.*주거 80만 원.*생활 100만 원/));
    expect(screen.getByRole('button', { name: '남는 돈 편집' }))
      .toHaveAccessibleDescription(expect.stringMatching(/90만 원/));
  });

  it('opens one desktop scalar editor containing the five canonical fields', () => {
    render(<DashboardHarness />);
    const opener = screen.getByRole('button', { name: '월 실수령액 편집' });

    fireEvent.click(opener);

    const editor = screen.getByRole('complementary', { name: '월 자금 계획 편집' });
    expect(editor).toBeVisible();
    expect(within(editor).getByRole('heading', { name: '월 자금 계획 편집' })).toBeVisible();
    expect(within(editor).getByLabelText('월 실수령액')).toHaveValue('3,200,000');
    expect(within(editor).getByLabelText('월 주거 고정비')).toHaveValue('800,000');
    expect(within(editor).getByLabelText('월평균 생활비')).toHaveValue('1,000,000');
    expect(within(editor).getByLabelText('월 저축액')).toHaveValue('300,000');
    expect(within(editor).getByLabelText('월 투자액')).toHaveValue('200,000');

    fireEvent.click(within(editor).getByRole('button', { name: '편집기 닫기' }));
    expect(opener).toHaveFocus();
  });

  it('keeps applied dashboard values visible while editing and restores the draft on cancel', () => {
    render(<DashboardHarness />);
    fireEvent.click(screen.getByRole('button', { name: '월 실수령액 편집' }));

    fireEvent.change(screen.getByLabelText('월 실수령액'), { target: { value: '4000000' } });

    expect(screen.getByRole('button', { name: '월 실수령액 편집' })).toHaveTextContent('320만 원');
    expect(screen.getByLabelText('월 실수령액')).toHaveValue('4,000,000');

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('월 실수령액')).toHaveValue('3,200,000');
    expect(screen.getByRole('button', { name: '월 실수령액 편집' })).toHaveTextContent('320만 원');
  });

  it('uses a modal dialog on mobile with the same five scalar fields', () => {
    render(<DashboardHarness mobile />);
    fireEvent.click(screen.getByRole('button', { name: '월 소비 편집' }));

    const dialog = screen.getByRole('dialog', { name: '월 자금 계획 편집' });
    expect(within(dialog).getByLabelText('월 실수령액')).toBeVisible();
    expect(within(dialog).getByLabelText('월 주거 고정비')).toBeVisible();
    expect(within(dialog).getByLabelText('월평균 생활비')).toBeVisible();
    expect(within(dialog).getByLabelText('월 저축액')).toBeVisible();
    expect(within(dialog).getByLabelText('월 투자액')).toBeVisible();
  });

  it('contains edit and apply controls in one mobile modal, traps focus, and hides dashboard controls', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DashboardHarness mobile />);
    const opener = screen.getByRole('button', { name: '월 실수령액 편집' });
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: '월 자금 계획 편집' });
    const dialogScope = within(dialog);
    const close = dialogScope.getByRole('button', { name: '편집기 닫기' });
    const cancel = dialogScope.getByRole('button', { name: '취소' });
    const apply = dialogScope.getByRole('button', { name: '적용' });

    expect(close).toHaveFocus();
    expect(apply).toBeDisabled();
    expect(screen.getByTestId('dashboard-controls')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('dashboard-controls')).toHaveAttribute('inert');

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();

    fireEvent.change(dialogScope.getByLabelText('월 실수령액'), { target: { value: '4000000' } });
    apply.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(apply).toHaveFocus();

    fireEvent.click(close);
    expect(opener).toHaveFocus();
  });

  it('announces a mobile save failure inside the dialog and exposes a retry action', () => {
    stubMobileViewport();
    const onApply = vi.fn();
    render(
      <SummaryDashboard
        applied={appliedData}
        draft={{ ...appliedData, monthlyNetIncomeWon: 4_000_000 }}
        dirty
        issues={[]}
        saveStatus="error"
        onDraftChange={vi.fn()}
        onApply={onApply}
        onCancel={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '월 실수령액 편집' }));

    const dialog = screen.getByRole('dialog', { name: '월 자금 계획 편집' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 시도' }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('asks before discarding a dirty mobile editor from Escape or its backdrop', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DashboardHarness mobile />);
    const opener = screen.getByRole('button', { name: '월 실수령액 편집' });
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('월 실수령액'), { target: { value: '4000000' } });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: '월 자금 계획 편집' })).toBeVisible();

    fireEvent.click(screen.getByTestId('editor-backdrop'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog', { name: '월 자금 계획 편집' })).toBeVisible();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('editor-backdrop'));
    expect(screen.queryByRole('dialog', { name: '월 자금 계획 편집' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('discards a dirty draft after confirming that the desktop editor should close', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DashboardHarness />);
    fireEvent.click(screen.getByRole('button', { name: '월 실수령액 편집' }));
    fireEvent.change(screen.getByLabelText('월 실수령액'), { target: { value: '4000000' } });

    fireEvent.click(screen.getByRole('button', { name: '편집기 닫기' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary', { name: '월 자금 계획 편집' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '월 실수령액 편집' }));
    expect(screen.getByLabelText('월 실수령액')).toHaveValue('3,200,000');
  });

  it('confirms a dirty draft before starting over and only restarts after discard is accepted', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCancel = vi.fn();
    const onRestart = vi.fn();
    render(
      <SummaryDashboard
        applied={appliedData}
        draft={{ ...appliedData, monthlyNetIncomeWon: 4_000_000 }}
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

  it('opens the scalar editor and focuses the exact invalid field', () => {
    render(<ValidationHarness />);
    fireEvent.click(screen.getByRole('button', { name: '생활비 검증 오류 표시' }));

    expect(screen.getByRole('complementary', { name: '월 자금 계획 편집' })).toBeVisible();
    expect(screen.getByLabelText('월평균 생활비')).toHaveFocus();
  });

  it('keeps the exact invalid field focused when mobile validation opens the dialog', () => {
    render(<ValidationHarness mobile />);
    fireEvent.click(screen.getByRole('button', { name: '생활비 검증 오류 표시' }));

    expect(screen.getByRole('dialog', { name: '월 자금 계획 편집' })).toBeVisible();
    expect(screen.getByLabelText('월평균 생활비')).toHaveFocus();
  });

  it('retains backup export and import controls', () => {
    const onExport = vi.fn();
    const onImportFile = vi.fn();
    const backup = new File(['{"schemaVersion":2}'], 'backup.json', { type: 'application/json' });
    render(
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
        onExport={onExport}
        onImportFile={onImportFile}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '백업 내보내기' }));
    expect(onExport).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText('백업 가져오기'), { target: { files: [backup] } });
    expect(onImportFile).toHaveBeenCalledWith(backup);
  });

  it('uses the shared secondary import action and exposes its saving disabled state', () => {
    const props = {
      applied: appliedData,
      draft: appliedData,
      dirty: false,
      issues: [],
      onDraftChange: vi.fn(),
      onApply: vi.fn(),
      onCancel: vi.fn(),
      onRestart: vi.fn(),
      onImportFile: vi.fn(),
    };
    const { rerender } = render(<SummaryDashboard {...props} saveStatus="idle" />);
    const importLabel = screen.getByText('백업 가져오기').closest('label');
    const fileInput = screen.getByLabelText('백업 가져오기');

    expect(importLabel).toHaveClass('ui-button', 'ui-button--secondary', 'backup-import-action');
    expect(fileInput).toHaveAccessibleName('백업 가져오기');
    expect(importLabel).not.toHaveAttribute('aria-disabled');
    expect(fileInput).toBeEnabled();

    rerender(<SummaryDashboard {...props} saveStatus="saving" />);

    expect(importLabel).toHaveAttribute('aria-disabled', 'true');
    expect(fileInput).toBeDisabled();
  });

  it('only warns on browser exit when the scalar draft is dirty', () => {
    const props = {
      applied: appliedData,
      draft: appliedData,
      issues: [],
      saveStatus: 'idle' as const,
      onDraftChange: vi.fn(),
      onApply: vi.fn(),
      onCancel: vi.fn(),
      onRestart: vi.fn(),
    };
    const { rerender } = render(<SummaryDashboard {...props} dirty={false} />);
    const cleanExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanExit);
    expect(cleanExit.defaultPrevented).toBe(false);

    rerender(<SummaryDashboard {...props} dirty />);
    const dirtyExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyExit);
    expect(dirtyExit.defaultPrevented).toBe(true);
  });
});
