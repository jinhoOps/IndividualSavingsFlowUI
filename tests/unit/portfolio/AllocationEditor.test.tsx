import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('uses the shared surface and secondary add action', () => {
    render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={vi.fn()} now={() => 2} />);

    expect(screen.getByRole('heading', { name: '투자 배분 설정' }).closest('section'))
      .toHaveClass('ui-surface', 'portfolio-editor');
    expect(screen.getByRole('button', { name: '투자 대상 추가' }))
      .toHaveClass('ui-button', 'ui-button--secondary');
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

  it('provides each investment classification as an announced radio group and presents cash as stable without a control', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction} now={() => 2} />);

    const classification = screen.getByRole('group', { name: '미국 인덱스 분류' });
    expect(within(classification).getByRole('radio', { name: '성장' })).toBeChecked();
    expect(within(classification).getByRole('status')).toHaveTextContent('자동 추천: 성장');

    fireEvent.click(within(classification).getByRole('radio', { name: '안정' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-classification-changed', id: 'index', classification: 'stable', now: 2,
    });

    const cash = screen.getByRole('heading', { name: '현금' }).closest('section')!;
    expect(cash).toHaveTextContent('분류 안정');
    expect(within(cash).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('announces the ten-item limit', () => {
    const tenItems = {
      ...draft,
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `a-${index}`, name: `대상 ${index + 1}`, shareUnits: 10_000, order: index,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      })),
      cashShareUnits: 900_000,
    };
    render(<AllocationEditor draft={tenItems} investmentWon={200_000} onAction={vi.fn()} now={() => 2} />);
    expect(screen.getByRole('button', { name: '투자 대상 추가' })).toBeDisabled();
    expect(screen.getByText('투자 대상은 최대 10개까지 추가할 수 있습니다')).toBeVisible();
  });

  it('explains blank and normalized duplicate names at their fields', () => {
    const invalidDraft = {
      ...draft,
      items: [
        {
          id: 'blank', name: '   ', shareUnits: 200_000, order: 0,
          classification: 'growth' as const, classificationOrigin: 'automatic' as const,
        },
        {
          id: 'first', name: 'US INDEX', shareUnits: 200_000, order: 1,
          classification: 'growth' as const, classificationOrigin: 'automatic' as const,
        },
        {
          id: 'second', name: ' us   index ', shareUnits: 200_000, order: 2,
          classification: 'growth' as const, classificationOrigin: 'automatic' as const,
        },
      ],
      cashShareUnits: 400_000,
    };
    render(<AllocationEditor draft={invalidDraft} investmentWon={200_000} onAction={vi.fn()} now={() => 2} />);

    const blank = screen.getByRole('textbox', { name: '투자 대상 이름 1' });
    expect(blank).toHaveAttribute('aria-invalid', 'true');
    expect(blank).toHaveAccessibleDescription('투자 대상 이름을 입력해 주세요.');

    for (const name of ['투자 대상 이름 2', '투자 대상 이름 3']) {
      const duplicate = screen.getByRole('textbox', { name });
      expect(duplicate).toHaveAttribute('aria-invalid', 'true');
      expect(duplicate).toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
    }
  });

  it('confirms apply and returns focus when cancelled', async () => {
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
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('summarizes target count, stable share, then cash share before applying', () => {
    const classifiedDraft = {
      ...draft,
      items: [{ ...draft.items[0], classification: 'stable' as const }],
    };
    render(<PortfolioApplyBar
      dirty
      draft={classifiedDraft}
      investmentWon={200_000}
      onCancel={vi.fn()}
      onApply={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    const dialog = screen.getByRole('dialog', { name: '투자 배분 적용' });
    expect(within(dialog).getAllByRole('term').map((term) => term.textContent))
      .toEqual(['투자 대상', '안정 비중', '현금 비중']);
    expect(within(dialog).getByText('100%')).toBeVisible();
    expect(within(dialog).getByText('40%')).toBeVisible();
  });
});
