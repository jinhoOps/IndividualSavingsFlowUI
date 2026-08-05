// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SimulationMainSource } from '../../../src/simulation/domain/model';
import { SimulationOnboarding } from '../../../src/simulation/ui/SimulationOnboarding';

afterEach(cleanup);

const source: SimulationMainSource = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('SimulationOnboarding', () => {
  it('guides a zero-principal user through two stages', () => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: '없어요' }));

    expect(screen.getByRole('heading', {
      name: '얼마나 오래, 어느 정도 수익을 기대할까요?',
    })).toBeVisible();
    expect(screen.getByText(/이대로 20년 유지하면/)).toBeVisible();
    expect(screen.getByRole('img', { name: '설정 결과 미리보기' })).toBeVisible();
    expect(screen.queryByText('기준금리')).not.toBeInTheDocument();
    expect(screen.queryByText('명목')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 0,
      years: 20,
      expectedAnnualReturnPercent: 9,
    }));
  });

  it('reveals principal input only after choosing that money exists', () => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    expect(screen.queryByRole('textbox', { name: '현재 모아둔 투자금' }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
      target: { value: '10000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 10_000_000,
    }));
  });

  it('adjusts principal with large presets and never drops below zero', () => {
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    const input = screen.getByRole('textbox', { name: '현재 모아둔 투자금' });
    fireEvent.change(input, { target: { value: '5000000' } });

    fireEvent.click(screen.getByRole('button', { name: '-1000만' }));
    expect(input).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: '+100만' }));
    expect(input).toHaveValue('1000000');
    fireEvent.click(screen.getByRole('button', { name: '+1000만' }));
    expect(input).toHaveValue('11000000');
    fireEvent.click(screen.getByRole('button', { name: '-100만' }));
    expect(input).toHaveValue('10000000');
  });
});
