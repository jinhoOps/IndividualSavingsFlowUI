// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountManagementContext, AccountProductBoundary } from '../../../src/auth/AccountManagementContext';
import { ResponsiveDialog } from '../../../src/components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../../src/components/common/ResponsiveDialogLayout';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import { PortfolioApplyBar } from '../../../src/portfolio/ui/PortfolioApplyBar';
import { PortfolioEditSurface } from '../../../src/portfolio/ui/PortfolioEditSurface';
import { PortfolioManagementMenu } from '../../../src/portfolio/ui/PortfolioManagementMenu';

const animeMocks = vi.hoisted(() => ({
  animate: vi.fn(() => ({ cancel: vi.fn() })),
  createScope: vi.fn(() => ({
    add: (setup: () => void) => setup(),
    matches: { reducedMotion: false },
    revert: vi.fn(),
  })),
}));

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Portfolio shared dialogs', () => {
  it('edits an item inside one shared surface with a back action', () => {
    const draft = {
      ...createCashOnlyDraft(200_000, 1),
      items: [{
        id: 'index', name: '미국 인덱스', order: 0, shareUnits: 600_000,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 400_000,
    };

    render(<PortfolioEditSurface
      draft={draft}
      investmentWon={200_000}
      dirty={false}
      saveError={false}
      applying={false}
      showSaving={false}
      fieldError={null}
      returnFocusRef={{ current: null }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
      onApply={vi.fn()}
      showAmounts
      now={() => 2}
    />);

    const dialog = screen.getByRole('dialog', { name: '투자 배분 수정' });
    expect(dialog.querySelector('[data-surface-layout="edit"]')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /미국 인덱스 편집/ }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '뒤로' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: '투자 대상 이름' })).toHaveValue('미국 인덱스');
  });

  it('keeps account controls locked through the portaled common dialog', () => {
    const content = <ResponsiveDialog open labelledBy="offline-title" returnFocusRef={{ current: null }}
      onRequestClose={() => true} onClosed={vi.fn()}>
      <AccountProductBoundary><ResponsiveDialogLayout title="계정 편집" titleId="offline-title" onClose={vi.fn()}>
        <input aria-label="입력" /><button type="button">완료</button>
      </ResponsiveDialogLayout></AccountProductBoundary>
    </ResponsiveDialog>;
    const { rerender } = render(<AccountManagementContext.Provider value={{ items: [], readOnly: false }}>{content}</AccountManagementContext.Provider>);
    expect(screen.getByLabelText('입력')).toBeEnabled();
    rerender(<AccountManagementContext.Provider value={{ items: [], readOnly: true }}>{content}</AccountManagementContext.Provider>);
    expect(screen.getByLabelText('입력')).toBeDisabled();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
  });

  it('focuses the apply cancel action, traps Tab, closes on Escape, and restores the trigger', async () => {
    render(<PortfolioApplyBar dirty draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000} onCancel={vi.fn()} onApply={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '적용' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(screen.getByRole('complementary', { name: '배분 변경' })).toHaveClass('ui-surface');
    expect(dialog.querySelector('[data-surface-layout="confirm"]')).toBeTruthy();
    const cancel = within(dialog).getByRole('button', { name: '계속 수정' });
    const confirm = within(dialog).getByRole('button', { name: '배분 적용' });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '투자 배분을 적용할까요?' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('blocks an already open apply confirmation when a field error arrives', () => {
    const onApply = vi.fn();
    const props = { dirty: true, draft: createCashOnlyDraft(200_000, 1), investmentWon: 200_000, onCancel: vi.fn(), onApply };
    const { rerender } = render(<PortfolioApplyBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    rerender(<PortfolioApplyBar {...props} fieldError="allocation-exceeds-investment" />);
    const confirmation = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    const confirm = within(confirmation).getByRole('button', { name: '배분 적용' });
    expect(confirm).toBeDisabled();
    expect(within(confirmation).getByRole('alert')).toHaveTextContent('입력 오류를 수정한 뒤 적용해 주세요.');
    fireEvent.click(confirm);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('disables apply, cancel, and confirmation close paths while explicit apply is pending', () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    const props = { dirty: true, draft: createCashOnlyDraft(200_000, 1), investmentWon: 200_000, onCancel, onApply };
    const { rerender } = render(<PortfolioApplyBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    rerender(<PortfolioApplyBar {...props} applying />);

    const bar = screen.getByRole('complementary', { name: '배분 변경' });
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(within(dialog).getByRole('button', { name: '계속 수정' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '배분 적용' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('focuses reset cancel and restores its trigger after Escape', async () => {
    render(<PortfolioManagementMenu onReset={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '투자 배분 처음부터 다시' }));
    const dialog = await screen.findByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('changes view preferences without closing the management menu', () => {
    const onPreferencesChange = vi.fn();
    render(<PortfolioManagementMenu onReset={vi.fn()} preferences={{ showAmounts: false, sortMode: 'ratio' }} onPreferencesChange={onPreferencesChange} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('radio', { name: '입력순' }));

    expect(onPreferencesChange).toHaveBeenCalledWith({ showAmounts: false, sortMode: 'input' });
    expect(screen.getByRole('group', { name: '보기 설정' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투자 배분 처음부터 다시' })).toBeVisible();
  });
});
