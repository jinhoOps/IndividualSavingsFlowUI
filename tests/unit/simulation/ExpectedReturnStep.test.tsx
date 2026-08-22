// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { ExpectedReturnStep } from '../../../src/simulation/ui/ExpectedReturnStep';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

describe('ExpectedReturnStep', () => {
  it('offers only expected-return controls and completes without changing the period', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<ExpectedReturnStep draft={draft} onChange={onChange} onComplete={onComplete} />);

    expect(screen.getByRole('region', { name: '매년 어느 정도 수익을 기대하나요?' }))
      .toHaveClass('ui-surface');
    expect(document.activeElement).toBe(screen.getByRole('heading', {
      name: '매년 어느 정도 수익을 기대하나요?',
    }));
    expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: '기간 숫자' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
    fireEvent.click(screen.getByRole('button', { name: '기대수익률 0.25%p 올리기' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      years: 20,
      expectedAnnualReturnPercent: 9.25,
    }));

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
