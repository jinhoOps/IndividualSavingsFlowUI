// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TargetAmountControl } from '../../../src/simulation/ui/TargetAmountControl';

afterEach(cleanup);

function setup(initialInvestmentWon = 0, target = 100_000_000) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState(target);
    return <TargetAmountControl initialInvestmentWon={initialInvestmentWon} targetAmountWon={value} targetReachMonth={120}
      onChange={(next) => { onChange(next); setValue(next); }} />;
  }
  render(<Harness />);
  return { input: screen.getByRole('textbox', { name: '목표 금액' }), onChange };
}

describe('TargetAmountControl', () => {
  it('starts at the default goal, adjusts by ten million, and restores the default', () => {
    const { input, onChange } = setup();
    expect(screen.getByText('기본 목표')).toBeVisible();
    expect(screen.getByRole('button', { name: '기본 목표로' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '+1천만' }));
    expect(input).toHaveValue('110,000,000');
    expect(onChange).toHaveBeenLastCalledWith(110_000_000);
    expect(screen.getByText('직접 설정')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '기본 목표로' }));
    expect(onChange).toHaveBeenLastCalledWith(100_000_000);
  });

  it.each([['-5천만', 50_000_000], ['+5천만', 150_000_000]] as const)
  ('adjusts by fifty million with %s', (label, expected) => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it('keeps typing local and commits on Enter or blur without duplicate writes', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '150000000' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('150,000,000');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(150_000_000);
  });

  it.each(['', '1,50,000,000', '10000001', '-10000000', '9007199254740992', 'Infinity', '5e7', '0'])
  ('rejects invalid or non-step-aligned goal %s without changing the stored goal', (raw) => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: raw } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('100,000,000');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('does not allow a goal at or below the starting asset', () => {
    const { input, onChange } = setup(80_000_000, 90_000_000);
    expect(screen.getByRole('button', { name: '-1천만' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '-5천만' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '80000000' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('preserves a legacy exact-won goal until explicitly adjusted to a whole step', () => {
    const { input, onChange } = setup(200_000_000, 250_000_001);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('250,000,001');
    expect(screen.queryByRole('button', { name: '기본 목표로' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '-1천만' }));
    expect(onChange).toHaveBeenLastCalledWith(250_000_000);
  });

  it('disables increases beyond the safe integer limit', () => {
    setup(0, Number.MAX_SAFE_INTEGER);
    expect(screen.getByRole('button', { name: '+1천만' })).toBeDisabled();
  });

  it('adjusts the typed amount rather than discarding an unblurred valid edit', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '150000000' } });
    fireEvent.click(screen.getByRole('button', { name: '+1천만' }));
    expect(onChange).toHaveBeenLastCalledWith(160_000_000);
  });
});
