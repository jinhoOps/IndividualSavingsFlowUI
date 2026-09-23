// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveDialogActionRow, ResponsiveDialogLayout } from '../../../src/components/common/ResponsiveDialogLayout';

afterEach(cleanup);

describe('ResponsiveDialogLayout', () => {
  it('keeps content in the standard labelled body region', () => {
    render(
      <ResponsiveDialogLayout title="조건 편집" titleId="condition-editor-title" onClose={vi.fn()} footer={<button type="button">적용</button>}>
        <input aria-label="기간" />
      </ResponsiveDialogLayout>,
    );

    expect(screen.getByRole('heading', { name: '조건 편집' })).toHaveAttribute('id', 'condition-editor-title');
    expect(screen.getByRole('region', { name: '조건 편집 내용' })).toHaveAttribute('data-surface-body', '');
    expect(screen.getByRole('button', { name: '닫기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '적용' })).toBeVisible();
  });

  it('routes back and close buttons through their supplied surface actions', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <ResponsiveDialogLayout title="투자 대상 수정" titleId="portfolio-item-title" onBack={onBack} onClose={onClose}>
        <p>항목 내용</p>
      </ResponsiveDialogLayout>,
    );

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps footer actions in the shared row and preserves their declared order', () => {
    render(
      <ResponsiveDialogLayout title="변경을 적용할까요?" titleId="apply-title" onClose={vi.fn()}
        footer={<ResponsiveDialogActionRow className="responsive-dialog__actions--danger-leading">
          <button type="button">변경 버리기</button>
          <button type="button">계속 수정</button>
          <button type="button">적용</button>
        </ResponsiveDialogActionRow>}>
        <p>변경 내용을 확인해 주세요.</p>
      </ResponsiveDialogLayout>,
    );

    const row = screen.getByRole('button', { name: '변경 버리기' }).closest('.responsive-dialog__actions');
    expect(row).toHaveClass('responsive-dialog__actions--danger-leading');
    expect(within(row as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '변경 버리기', '계속 수정', '적용',
    ]);
  });
});
