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
});
