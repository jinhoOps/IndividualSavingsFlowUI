// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import { PortfolioApplyBar } from '../../../src/portfolio/ui/PortfolioApplyBar';
import { PortfolioManagementMenu } from '../../../src/portfolio/ui/PortfolioManagementMenu';

afterEach(cleanup);

describe('Portfolio confirmation dialogs', () => {
  it('focuses the apply cancel action, traps Tab, closes on Escape, and restores the trigger', async () => {
    render(
      <PortfolioApplyBar
        dirty
        draft={createCashOnlyDraft(200_000, 1)}
        investmentWon={200_000}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: '적용' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '투자 배분 적용' });
    expect(screen.getByRole('complementary', { name: '배분 변경' })).toHaveClass('ui-surface');
    expect(dialog).toHaveClass('ui-surface');
    const cancel = within(dialog).getByRole('button', { name: '확인 취소' });
    const confirm = within(dialog).getByRole('button', { name: '적용' });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '투자 배분 적용' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('focuses reset cancel and restores its trigger after Escape', async () => {
    render(<PortfolioManagementMenu onReset={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('changes view preferences without closing the management menu', () => {
    const onPreferencesChange = vi.fn();
    render(
      <PortfolioManagementMenu
        onReset={vi.fn()}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('switch', { name: '금액 보기' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '비율순' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '입력순' }));

    expect(onPreferencesChange).toHaveBeenCalledWith({ showAmounts: false, sortMode: 'input' });
    expect(screen.getByRole('group', { name: '보기 설정' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' })).toBeVisible();
  });
});
