import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoneyField } from '../../../src/main/ui/common/MoneyField';

afterEach(cleanup);

describe('MoneyField', () => {
  it('marks only opt-in fields for focus-based adjustment visibility', () => {
    const { rerender } = render(
      <MoneyField id="amount" label="금액" valueWon={0} onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('금액').closest('.money-field'))
      .not.toHaveClass('money-field--focused-adjustments');

    rerender(
      <MoneyField
        id="amount"
        label="금액"
        valueWon={0}
        adjustmentsVisibility="focused"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('금액').closest('.money-field'))
      .toHaveClass('money-field--focused-adjustments');
  });

  it('uses the shared money-field and quiet button styles', () => {
    render(<MoneyField id="amount" label="금액" valueWon={3_000_000} onChange={vi.fn()} />);

    expect(screen.getByLabelText('금액')).toHaveClass('money-field__input');
    expect(screen.getByRole('button', { name: '-50만' })).toHaveClass('ui-button--quiet');
    expect(screen.getByRole('button', { name: '-10만' })).toHaveClass('ui-button--quiet');
    expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
  });

  it('disables the input and every adjustment control', () => {
    render(<MoneyField id="amount" label="금액" valueWon={0} disabled onChange={vi.fn()} />);

    expect(screen.getByLabelText('금액')).toBeDisabled();
    expect(screen.getByLabelText('금액')).toHaveClass('money-field__input--disabled');
    for (const name of ['-50만', '-10만', '+10만', '+50만']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('exposes invalid semantics and a dedicated invalid visual state', () => {
    render(
      <MoneyField
        id="amount"
        label="금액"
        valueWon={0}
        error="금액을 확인해주세요."
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('금액')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('금액')).toHaveClass('money-field__input--invalid');
  });

  it.each([
    ['unsafe integer', '9007199254740992', 0],
    ['decimal punctuation', '1.5', 15],
    ['negative punctuation', '-1', 1],
  ])('sanitizes %s input', (_label, input, expectedValueWon) => {
    const onChange = vi.fn();
    render(<MoneyField id="amount" label="금액" valueWon={0} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('금액'), { target: { value: input } });

    expect(onChange).toHaveBeenLastCalledWith(expectedValueWon);
  });

  it('restores a digit-relative caret after reformatting an edit', () => {
    const onChange = vi.fn();
    render(<MoneyField id="amount" label="금액" valueWon={3_000_000} onChange={onChange} />);

    const input = screen.getByLabelText('금액') as HTMLInputElement;
    input.setSelectionRange(3, 3);
    fireEvent.change(input, { target: { value: '3,200,000', selectionStart: 3 } });

    expect(onChange).toHaveBeenLastCalledWith(3_200_000);
    expect(input.value).toBe('3,200,000');
    expect(input.selectionStart).toBe(3);
  });

  it('offers symmetric quick adjustments around the input', () => {
    const onChange = vi.fn();
    render(<MoneyField id="amount" label="금액" valueWon={3_000_000} onChange={onChange} />);

    expect(screen.getByText('원')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '-50만' }));
    fireEvent.click(screen.getByRole('button', { name: '-10만' }));
    fireEvent.click(screen.getByRole('button', { name: '+10만' }));
    fireEvent.click(screen.getByRole('button', { name: '+50만' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 2_500_000);
    expect(onChange).toHaveBeenNthCalledWith(2, 2_900_000);
    expect(onChange).toHaveBeenNthCalledWith(3, 3_100_000);
    expect(onChange).toHaveBeenNthCalledWith(4, 3_500_000);
  });
});
