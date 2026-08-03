import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioAction } from '../../../src/portfolio/application/portfolioReducer';
import { setItemAmount } from '../../../src/portfolio/domain/allocation';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import { AllocationEditor } from '../../../src/portfolio/ui/AllocationEditor';
import { PortfolioApplyBar } from '../../../src/portfolio/ui/PortfolioApplyBar';

afterEach(cleanup);

const draft = setItemAmount(createCashOnlyDraft(200_000, 1), {
  id: 'index', name: '미국 인덱스', order: 0,
}, 120_000);

describe('AllocationEditor', () => {
  it('switches the whole mode and keeps both values visible', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction} now={() => 2} />);
    fireEvent.click(screen.getByRole('radio', { name: '비율' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'input-mode-changed', mode: 'percentage' });
    expect(screen.getByText('120,000원')).toBeVisible();
    expect(screen.getByText('60%')).toBeVisible();
  });

  it('explains manual cash and offers explicit automatic action', () => {
    render(<AllocationEditor
      draft={{ ...draft, cashMode: 'manual' }}
      investmentWon={200_000}
      onAction={vi.fn()}
      now={() => 2}
    />);
    expect(screen.getByText('현금 직접 배분 중')).toBeVisible();
    expect(screen.getByRole('button', { name: '현금 자동 배분 켜기' })).toBeVisible();
    expect(screen.getByText('남은 투자금을 현금으로 자동 배분합니다')).toBeVisible();
  });

  it('announces the ten-item limit', () => {
    const tenItems = {
      ...draft,
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `a-${index}`, name: `대상 ${index + 1}`, shareUnits: 10_000, order: index,
      })),
      cashShareUnits: 900_000,
    };
    render(<AllocationEditor draft={tenItems} investmentWon={200_000} onAction={vi.fn()} now={() => 2} />);
    expect(screen.getByRole('button', { name: '투자 대상 추가' })).toBeDisabled();
    expect(screen.getByText('투자 대상은 최대 10개까지 추가할 수 있습니다')).toBeVisible();
  });

  it('confirms apply and returns focus when cancelled', () => {
    render(<PortfolioApplyBar
      dirty
      draft={draft}
      investmentWon={200_000}
      onCancel={vi.fn()}
      onApply={vi.fn()}
    />);
    const trigger = screen.getByRole('button', { name: '적용' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: '투자 배분 적용' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확인 취소' }));
    expect(trigger).toHaveFocus();
  });
});
