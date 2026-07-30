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
    const { rerender } = render(<SimulationControls draft={draft} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '연 기대수익률 13%' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedAnnualReturnPercent: 13,
    }));

    const custom = { ...draft, expectedAnnualReturnPercent: 9.25 };
    rerender(<SimulationControls draft={custom} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '기대수익률 0.25%p 올리기' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedAnnualReturnPercent: 9.5,
    }));
  });

  it('changes duration through one-year controls and shortcuts', () => {
    const onChange = vi.fn();
    render(<SimulationControls draft={draft} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '기간 1년 늘리기' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 21 }));
    fireEvent.click(screen.getByRole('button', { name: '30년' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ years: 30 }));
    expect(screen.getByRole('slider', { name: '투자 기간' })).toHaveAttribute('min', '1');
    expect(screen.getByRole('slider', { name: '투자 기간' })).toHaveAttribute('max', '50');
  });
});
