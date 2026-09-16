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
  it('opens applied editing with a summary and one selectable row', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={draft} investmentWon={200_000}
      onAction={onAction} now={() => 2} presentation="edit" />);
    expect(screen.getByRole('region', { name: '현재 배분 요약' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /미국 인덱스 편집/ }));
    expect(screen.getByRole('dialog', { name: '투자 대상 수정' })).toBeVisible();
    expect(onAction).not.toHaveBeenCalled();
  });

  describe.each(['setup', 'edit'] as const)('%s focused editor', (presentation) => {
    it('keeps unallocated manual cash separate from growth', () => {
      render(<AllocationEditor draft={{ ...draft, cashMode: 'manual', cashShareUnits: 100_000 }}
        investmentWon={200_000} onAction={vi.fn()} now={() => 2} presentation={presentation} />);
      const summary = screen.getByRole('region', { name: '현재 배분 요약' });
      expect(summary).toHaveTextContent('성장 60%');
      expect(summary).toHaveTextContent('안정 10%');
      expect(summary).toHaveTextContent('아직 배분하지 않은 금액 60,000원');
    });

    it('rejects aggregate overflow locally and allows correction before one commit', () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction}
        now={() => 2} presentation={presentation} createId={() => 'new'} />);
      fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
      const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
      fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '금 현물' } });
      const amount = within(sheet).getByLabelText('금액');
      fireEvent.change(amount, { target: { value: '90000' } });
      fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));
      expect(sheet).toBeVisible();
      expect(amount).toHaveValue('90,000');
      expect(amount).toHaveAccessibleDescription('투자금을 초과해 배분할 수 없습니다.');
      expect(amount).toHaveFocus();
      expect(onAction).not.toHaveBeenCalled();
      fireEvent.change(amount, { target: { value: '80000' } });
      fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith({
        type: 'draft-item-committed', item: { id: 'new', name: '금 현물', order: 1 },
        amountWon: 80_000, classification: 'stable', classificationOrigin: 'automatic', now: 2,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps duplicate names and subminimum amounts local', () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction}
        now={() => 2} presentation={presentation} />);
      fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
      const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
      const name = within(sheet).getByLabelText('투자 대상 이름');
      fireEvent.change(name, { target: { value: ' 미국   인덱스 ' } });
      fireEvent.change(within(sheet).getByLabelText('금액'), { target: { value: '500' } });
      expect(name).toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
      expect(within(sheet).getByLabelText('금액')).toHaveAccessibleDescription('투자 대상 금액은 1,000원 이상이어야 합니다.');
      expect(within(sheet).getByRole('button', { name: '완료' })).toBeDisabled();
      expect(onAction).not.toHaveBeenCalled();
    });

    it('discards a local addition and returns focus without changing the draft', async () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction}
        now={() => 2} presentation={presentation} />);
      const add = screen.getByRole('button', { name: '투자 대상 추가' });
      fireEvent.click(add);
      const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
      fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '금 현물' } });
      fireEvent.click(within(sheet).getByRole('button', { name: '취소' }));
      fireEvent.click(screen.getByRole('button', { name: '버리기' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onAction).not.toHaveBeenCalled();
      await waitFor(() => expect(add).toHaveFocus());
    });

    it('restores automatic classification and returns focus to the selected row', async () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      render(<AllocationEditor draft={{ ...draft, items: [{ ...draft.items[0], classification: 'stable', classificationOrigin: 'user' }] }}
        investmentWon={200_000} onAction={onAction} now={() => 2} presentation={presentation} />);
      const row = screen.getByRole('button', { name: /미국 인덱스 편집/ });
      fireEvent.click(row);
      fireEvent.click(screen.getByRole('button', { name: '자동 추천 사용' }));
      fireEvent.click(screen.getByRole('button', { name: '완료' }));
      expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
        type: 'draft-item-committed', classification: 'growth', classificationOrigin: 'automatic',
      }));
      await waitFor(() => expect(row).toHaveFocus());
    });

    it('disables addition at ten targets', () => {
      render(<AllocationEditor draft={{ ...draft, items: Array.from({ length: 10 }, (_, i) => ({ ...draft.items[0], id: String(i), name: `대상 ${i}`, shareUnits: 10_000 })) }}
        investmentWon={200_000} onAction={vi.fn()} now={() => 2} presentation={presentation} />);
      expect(screen.getByRole('button', { name: '투자 대상 추가' })).toBeDisabled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('focuses the new row after the committed draft is rendered', async () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      const props = { investmentWon: 200_000, onAction, now: () => 2, presentation, createId: () => 'gold' };
      const { rerender } = render(<AllocationEditor {...props} draft={draft} />);
      fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
      const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
      fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '금 현물' } });
      fireEvent.change(within(sheet).getByLabelText('금액'), { target: { value: '50000' } });
      fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));
      rerender(<AllocationEditor {...props} draft={setItemAmount(draft, { id: 'gold', name: '금 현물', order: 1 }, 50_000)} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /금 현물 편집/ })).toHaveFocus());
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('removes the selected target and returns focus to addition', async () => {
      const onAction = vi.fn<(action: PortfolioAction) => void>();
      render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction}
        now={() => 2} presentation={presentation} />);
      fireEvent.click(screen.getByRole('button', { name: /미국 인덱스 편집/ }));
      fireEvent.click(screen.getByRole('button', { name: '투자 대상 삭제' }));
      expect(onAction).toHaveBeenCalledWith({ type: 'draft-item-removed', id: 'index', now: 2 });
      await waitFor(() => expect(screen.getByRole('button', { name: '투자 대상 추가' })).toHaveFocus());
    });
  });
  it('accepts only amounts and presents percentage as a calculated result', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={{ ...draft, inputMode: 'percentage' }} investmentWon={200_000} onAction={onAction} now={() => 2} />);
    expect(screen.queryByRole('radio', { name: '금액' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '비율' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('미국 인덱스 금액')).toHaveValue('120,000');
    expect(screen.getByLabelText('현금 금액')).toHaveValue('80,000');
    expect(screen.getByText('120,000원')).toBeVisible();
    expect(screen.getByText('60%')).toBeVisible();
  });

  it('formats direct amounts and parses commas before the blur action', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<AllocationEditor draft={draft} investmentWon={200_000} onAction={onAction} now={() => 2} />);
    const amount = screen.getByLabelText('미국 인덱스 금액');

    fireEvent.change(amount, { target: { value: '150000' } });
    expect(amount).toHaveValue('150,000');
    fireEvent.blur(amount);

    expect(onAction).toHaveBeenCalledWith({
      type: 'draft-item-amount-changed', id: 'index', amountWon: 150_000, now: 2,
    });
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
    expect(editTarget).toHaveTextContent('성장');
    expect(editTarget).not.toHaveTextContent('자동 추천');
    expect(screen.queryByRole('dialog', { name: '투자 대상 수정' })).not.toBeInTheDocument();

    fireEvent.click(editTarget);

    const sheet = screen.getByRole('dialog', { name: '투자 대상 수정' });
    expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveValue('미국 인덱스');
    expect(within(sheet).getByLabelText('금액')).toHaveValue('120,000');
    fireEvent.click(within(sheet).getByRole('button', { name: '안정' }));
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
