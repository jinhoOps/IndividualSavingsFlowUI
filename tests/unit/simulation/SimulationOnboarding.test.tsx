// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompoundSimulationDraft, SimulationMainSource } from '../../../src/simulation/domain/model';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { SimulationOnboarding } from '../../../src/simulation/ui/SimulationOnboarding';

afterEach(cleanup);

const source: SimulationMainSource = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('SimulationOnboarding', () => {
  it('guides a high-principal user through a separate validated goal decision', () => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    expect(screen.getByRole('region', { name: '지금 모아둔 투자금이 있나요?' }))
      .toHaveClass('ui-surface');
    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
      target: { value: '200000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();
    const target = screen.getByRole('textbox', { name: '목표 금액' });
    expect(target).toHaveAttribute('inputmode', 'numeric');
    expect(document.activeElement).toBe(screen.getByRole('heading', {
      name: '다음에는 얼마를 모으고 싶나요?',
    }));

    fireEvent.change(target, { target: { value: '200000000' } });
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(target).toHaveAttribute('aria-describedby', 'goal-amount-error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '현재 모아둔 투자금보다 큰 금액을 입력해주세요.',
    );

    fireEvent.change(target, { target: { value: '250000000' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '매년 어느 정도 수익을 기대하나요?' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();
    expect(screen.getByText('수익률 선택값은 상품 추천이나 과거 성과가 아닌 계산 가정입니다.'))
      .toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '연 기대수익률 13%' }));

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 250_000_000,
      years: 20,
      expectedAnnualReturnPercent: 13,
      updatedAt: 456,
    }));
  });

  it.each([
    [79_999_999, 100_000_000],
    [80_000_000, 200_000_000],
  ])('automatically uses a %s-won goal for %s-won starting assets', (
    initialInvestmentWon,
    targetAmountWon,
  ) => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
      target: { value: String(initialInvestmentWon) },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.queryByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '매년 어느 정도 수익을 기대하나요?' }))
      .toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon,
      targetAmountWon,
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

  it('resumes a migrated goal-required draft at the goal question without changing its return', () => {
    const onComplete = vi.fn();
    const initialDraft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 123),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
      years: 17,
      expectedAnnualReturnPercent: 5,
    };
    render(<SimulationOnboarding
      source={source}
      initialDraft={initialDraft}
      now={() => 456}
      onComplete={onComplete}
    />);

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), {
      target: { value: '300000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 300_000_000,
      years: 17,
      expectedAnnualReturnPercent: 5,
      updatedAt: 456,
    }));
  });
});
