// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveDialogLayout } from '../../../src/components/common/ResponsiveDialogLayout';

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
});
