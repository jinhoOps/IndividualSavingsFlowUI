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
  it('accepts only amounts and presents percentage as a calculated result', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={{ ...draft, inputMode: 'percentage' }} investmentWon={200_000} onAction={onAction} now={() => 2} />);
    expect(screen.queryByRole('radio', { name: '금액' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '비율' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('미국 인덱스 금액')).toHaveValue('120000');
    expect(screen.getByText('120,000원')).toBeVisible();
    expect(screen.getByText('60%')).toBeVisible();
  });

  it('uses the shared surface and secondary add action', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction} now={() => 2} createId={() => 'new'} />);

    expect(screen.getByRole('heading', { name: '투자 배분 설정' }).closest('section'))
      .toHaveClass('ui-surface', 'portfolio-editor');
    expect(screen.getByRole('button', { name: '투자 대상 추가' }))
      .toHaveClass('ui-button', 'ui-button--secondary');
    expect(screen.getByRole('button', { name: '투자 대상 추가' })).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-item-added', item: { id: 'new', name: '', order: 1 }, now: 2,
    });
  });

  it('keeps completed setup targets compact and commits edits through a focused sheet', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor
      draft={draft}
      investmentWon={200_000}
      onAction={onAction}
      now={() => 2}
      presentation="setup"
    />);

    const editTarget = screen.getByRole('button', { name: '미국 인덱스 편집, 120,000원, 60%' });
    expect(editTarget).toHaveAccessibleName('미국 인덱스 편집, 120,000원, 60%');
    expect(editTarget).not.toHaveTextContent('성장');
    expect(editTarget).not.toHaveTextContent('자동 추천');
    expect(screen.queryByRole('dialog', { name: '투자 대상 수정' })).not.toBeInTheDocument();

    fireEvent.click(editTarget);

    const sheet = screen.getByRole('dialog', { name: '투자 대상 수정' });
    expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveValue('미국 인덱스');
    expect(within(sheet).getByLabelText('금액')).toHaveValue('120000');
    fireEvent.click(within(sheet).getByRole('button', { name: '성장, 누르면 안정으로 변경' }));
    fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-item-committed',
      item: { id: 'index', name: '미국 인덱스', order: 0 },
      amountWon: 120_000,
      classification: 'stable',
      classificationOrigin: 'user',
      now: 2,
    });
  });

  it('keeps new target input local until completion', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor
      draft={createCashOnlyDraft(200_000, 1)}
      investmentWon={200_000}
      onAction={onAction}
      now={() => 2}
      createId={() => 'new-target'}
      presentation="setup"
    />);

    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveFocus();
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '미국 인덱스' } });
    fireEvent.change(within(sheet).getByLabelText('금액'), { target: { value: '120000' } });
    fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-item-committed',
      item: { id: 'new-target', name: '미국 인덱스', order: 0 },
      amountWon: 120_000,
      classification: 'growth',
      classificationOrigin: 'automatic',
      now: 2,
    });
  });

  it('cancels a pristine new target without changing the draft', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor
      draft={createCashOnlyDraft(200_000, 1)}
      investmentWon={200_000}
      onAction={onAction}
      now={() => 2}
      presentation="setup"
    />);
    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 대상 추가' }))
      .getByRole('button', { name: '취소' }));

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '투자 대상 추가' })).not.toBeInTheDocument();
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

    fireEvent.click(within(classification).getByRole('radio', { name: '성장' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-classification-changed', id: 'index', classification: 'growth', now: 2,
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    onAction.mockClear();

    fireEvent.click(within(classification).getByRole('radio', { name: '안정' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-classification-changed', id: 'index', classification: 'stable', now: 2,
    });
    expect(onAction).toHaveBeenCalledTimes(1);

    const cash = screen.getByRole('heading', { name: '현금' }).closest('section')!;
    expect(cash).toHaveTextContent('분류 안정');
    expect(within(cash).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('announces a user classification and restores automatic recommendation explicitly', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    const userDraft = {
      ...draft,
      items: [{ ...draft.items[0], classification: 'stable' as const, classificationOrigin: 'user' as const }],
    };
    render(<AllocationEditor draft={userDraft} investmentWon={200_000} onAction={onAction} now={() => 2} />);

    const classification = screen.getByRole('group', { name: '미국 인덱스 분류' });
    expect(within(classification).getByRole('status')).toHaveTextContent('직접 선택: 안정');
    fireEvent.click(within(classification).getByRole('button', { name: '자동 추천 사용' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'draft-classification-auto-enabled', id: 'index', now: 2 });
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
    expect(screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '계속 수정' }));
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
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(within(dialog).getAllByRole('term').map((term) => term.textContent))
      .toEqual(['투자 대상', '안정 비중', '현금 비중']);
    expect(within(dialog).getByText('100%')).toBeVisible();
    expect(within(dialog).getByText('40%')).toBeVisible();
  });
});
