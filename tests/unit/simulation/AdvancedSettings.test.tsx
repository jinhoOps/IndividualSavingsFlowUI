// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { AdvancedSettings } from '../../../src/simulation/ui/AdvancedSettings';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

function draftWithInitial(
  initialInvestmentWon: number,
  targetAmountWon: number | null = 100_000_000,
) {
  return {
    ...draft,
    initialInvestmentWon,
    targetAmountWon,
  };
}

describe('AdvancedSettings', () => {
  it('shows and updates the existing accumulated amount inside calculation basis', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(12_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));

    const input = screen.getByRole('textbox', { name: '현재 모아둔 돈' });
    expect(input).toHaveValue('12,000,000');
    fireEvent.change(input, { target: { value: '20,000,000' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: 20_000_000,
      targetAmountWon: 100_000_000,
    }));
  });

  it('moves an automatic goal with the edited accumulated amount threshold', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(70_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 돈' }), {
      target: { value: '80,000,000' },
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: 80_000_000,
      targetAmountWon: 200_000_000,
    }));
  });

  it('returns to goal setup when an edited amount reaches a user-defined goal', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(200_000_000, 300_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 돈' }), {
      target: { value: '300,000,000' },
    });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: 300_000_000,
      targetAmountWon: null,
    }));
  });

  it('does not persist blank, nonfinite, or over-precise rates', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings draft={draft} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '명목' })).toBeVisible();
    expect(screen.getByRole('button', { name: '실질' })).toBeVisible();
    fireEvent.click(screen.getByText('계산 기준'));

    fireEvent.change(screen.getByRole('spinbutton', { name: '기준금리' }), {
      target: { value: '' },
    });
    expect(screen.getByText('−100%보다 크고 소수점 둘째 자리까지 입력해주세요.')).toBeVisible();

    fireEvent.change(screen.getByRole('spinbutton', { name: '물가상승률 차이' }), {
      target: { value: '0.123' },
    });
    expect(screen.getAllByText('−100%보다 크고 소수점 둘째 자리까지 입력해주세요.')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
