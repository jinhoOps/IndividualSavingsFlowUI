// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { PortfolioItemSheet } from '../../../src/portfolio/ui/PortfolioItemSheet';

afterEach(cleanup);

const blankItem = {
  name: '', amountWon: 0,
  classification: 'growth' as const,
  classificationOrigin: 'automatic' as const,
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof PortfolioItemSheet>> = {}) {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  const returnFocusRef = createRef<HTMLElement>();
  returnFocusRef.current = trigger;
  const props: React.ComponentProps<typeof PortfolioItemSheet> = {
    mode: 'add',
    initialValue: blankItem,
    existingNames: [],
    investmentWon: 200_000,
    returnFocusRef,
    onComplete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<PortfolioItemSheet {...props} />);
  return props;
}

describe('PortfolioItemSheet', () => {
  it('focuses amount-only target entry and completes one valid local value', () => {
    const props = renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveFocus();
    expect(within(sheet).getByRole('button', { name: '성장, 누르면 안정으로 변경' })).toBeVisible();
    expect(within(sheet).getByRole('button', { name: '완료' })).toBeDisabled();
    expect(within(sheet).queryByText('투자 대상 이름을 입력해 주세요.')).not.toBeInTheDocument();
    expect(within(sheet).queryByText('투자 대상 금액은 1,000원 이상이어야 합니다.')).not.toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '미국 인덱스' } });
    fireEvent.change(within(sheet).getByLabelText('금액'), { target: { value: '120000' } });
    fireEvent.click(within(sheet).getByRole('button', { name: '성장, 누르면 안정으로 변경' }));
    fireEvent.click(within(sheet).getByRole('button', { name: '완료' }));

    expect(props.onComplete).toHaveBeenCalledWith({
      name: '미국 인덱스', amountWon: 120_000,
      classification: 'stable', classificationOrigin: 'user',
    });
  });

  it('updates an automatic recommendation as the local name changes', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });

    fireEvent.change(within(sheet).getByLabelText('투자 대상 이름'), { target: { value: '국채 ETF' } });

    expect(within(sheet).getByRole('button', { name: '안정, 누르면 성장으로 변경' })).toBeVisible();
  });

  it('quick-fills the approved target names and moves focus to the amount', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    const names = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'];

    for (const name of names) {
      expect(within(sheet).getByRole('button', { name })).toBeVisible();
    }

    fireEvent.click(within(sheet).getByRole('button', { name: '미국 국채' }));

    expect(within(sheet).getByLabelText('투자 대상 이름')).toHaveValue('미국 국채');
    expect(within(sheet).getByRole('button', { name: '안정, 누르면 성장으로 변경' })).toBeVisible();
    expect(within(sheet).getByLabelText('금액')).toHaveFocus();
  });

  it('preserves a user classification when quick-filling a name', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    fireEvent.click(within(sheet).getByRole('button', { name: '성장, 누르면 안정으로 변경' }));

    fireEvent.click(within(sheet).getByRole('button', { name: '나스닥' }));

    expect(within(sheet).getByRole('button', { name: '안정, 누르면 성장으로 변경' })).toBeVisible();
  });

  it.each(['취소', 'Escape', 'backdrop'] as const)('closes pristine input directly through %s', (route) => {
    const props = renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });

    if (route === '취소') fireEvent.click(within(sheet).getByRole('button', { name: '취소' }));
    if (route === 'Escape') fireEvent.keyDown(sheet, { key: 'Escape' });
    if (route === 'backdrop') fireEvent.click(sheet);

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '입력 내용을 버릴까요?' })).not.toBeInTheDocument();
  });

  it('protects dirty input, preserves it on continue, and discards only after confirmation', () => {
    const props = renderSheet();
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    const name = within(sheet).getByLabelText('투자 대상 이름');
    fireEvent.change(name, { target: { value: '미국 인덱스' } });

    fireEvent.click(sheet);
    const confirmation = screen.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole('button', { name: '계속 입력' }));
    expect(name).toHaveValue('미국 인덱스');

    fireEvent.keyDown(sheet, { key: 'Escape' });
    fireEvent.click(within(screen.getByRole('dialog', { name: '입력 내용을 버릴까요?' }))
      .getByRole('button', { name: '버리기' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('connects duplicate-name and minimum-amount errors to their fields', () => {
    renderSheet({ existingNames: ['US INDEX'] });
    const sheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    const name = within(sheet).getByLabelText('투자 대상 이름');
    const amount = within(sheet).getByLabelText('금액');

    fireEvent.change(name, { target: { value: ' us   index ' } });
    fireEvent.change(amount, { target: { value: '999' } });

    expect(name).toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
    expect(amount).toHaveAccessibleDescription('투자 대상 금액은 1,000원 이상이어야 합니다.');
    expect(within(sheet).getByRole('button', { name: '완료' })).toBeDisabled();
  });

  it('offers icon removal and no quick fills only while editing', () => {
    const onRemove = vi.fn();
    renderSheet({
      mode: 'edit',
      initialValue: {
        name: '미국 인덱스', amountWon: 120_000,
        classification: 'growth', classificationOrigin: 'automatic',
      },
      onRemove,
    });
    const sheet = screen.getByRole('dialog', { name: '투자 대상 수정' });

    expect(within(sheet).queryByRole('button', { name: 'S&P 500' })).not.toBeInTheDocument();
    const remove = within(sheet).getByRole('button', { name: '투자 대상 삭제' });
    expect(remove).not.toHaveTextContent('투자 대상 삭제');
    expect(remove.querySelector('svg')).toBeInTheDocument();
    fireEvent.click(remove);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
