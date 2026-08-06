// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { SimulationControls } from '../../../src/simulation/ui/SimulationControls';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

describe('SimulationControls', () => {
  it('selects expected-return presets and changes custom return by 0.25%p', () => {
    const onChange = vi.fn();
    render(<SimulationControls draft={draft} onChange={onChange} />);

    expect(screen.getByRole('region', { name: '시뮬레이션 조건' })).toHaveClass('ui-surface');
    expect(screen.getByRole('button', { name: '연 기대수익률 9%' }))
      .toHaveClass('ui-button', 'ui-button--secondary');
    expect(screen.getByRole('button', { name: '직접 입력' }))
      .toHaveClass('ui-button', 'ui-button--secondary');

    fireEvent.click(screen.getByRole('button', { name: '연 기대수익률 13%' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedAnnualReturnPercent: 13,
    }));

    expect(screen.queryByRole('spinbutton', { name: '연 기대수익률 직접 입력' }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
    expect(screen.getByRole('spinbutton', { name: '연 기대수익률 직접 입력' }))
      .toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '기대수익률 0.25%p 올리기' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedAnnualReturnPercent: 9.25,
    }));
  });

  it('changes duration through a 0 to 30 slider and connected number input', () => {
    const onChange = vi.fn();
    render(<SimulationControls draft={draft} onChange={onChange} />);

    const slider = screen.getByRole('slider', { name: '기간' });
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '30');
    fireEvent.change(slider, { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 0 }));

    fireEvent.change(screen.getByRole('spinbutton', { name: '기간 숫자' }), {
      target: { value: '30' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 30 }));
    expect(screen.queryByRole('button', { name: '기간 1년 늘리기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10년' })).not.toBeInTheDocument();
  });

  it('keeps invalid direct input visible without changing the saved draft', () => {
    const onChange = vi.fn();
    render(<SimulationControls draft={draft} onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: '기간 숫자' }), {
      target: { value: '' },
    });
    expect(screen.getByRole('spinbutton', { name: '기간 숫자' })).toHaveValue(null);
    expect(screen.getByText('0~30년 사이의 정수를 입력해주세요.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '연 기대수익률 직접 입력' }), {
      target: { value: '9.123' },
    });
    expect(screen.getByText('0~30 사이, 소수점 둘째 자리까지 입력해주세요.')).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });
});
