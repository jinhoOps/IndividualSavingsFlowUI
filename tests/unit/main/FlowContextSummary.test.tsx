import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { FlowContextSummary } from '../../../src/main/ui/setup/FlowContextSummary';

afterEach(cleanup);

const cashflowFixture: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('FlowContextSummary', () => {
  it('shows the live income plan and remaining-money context', () => {
    render(<FlowContextSummary data={cashflowFixture} />);

    expect(screen.getByText('월 수입 320만 원')).toBeVisible();
    expect(screen.getByText('현재 계획 230만 원')).toBeVisible();
    expect(screen.getByText('남는 돈 90만 원')).toBeVisible();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '71.875');
  });

  it('keeps an over-income plan visually capped while announcing its true percentage', () => {
    render(<FlowContextSummary data={{ ...cashflowFixture, monthlyInvestmentWon: 1_900_000 }} />);

    expect(screen.getByLabelText('현재 자금 계획 요약')).toHaveClass('flow-context-summary--warning');
    expect(screen.getByText('월 수입보다 80만 원 많아요')).toBeVisible();
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('aria-valuetext', '125.0%');
    expect(meter).toHaveClass('flow-context-summary__meter--warning');
    expect(meter).toHaveStyle({ width: '100%' });
  });

  it('shows a fully planned income as exactly 100 percent', () => {
    render(<FlowContextSummary data={{ ...cashflowFixture, monthlyInvestmentWon: 1_100_000 }} />);

    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '100.0%');
    expect(screen.queryByText(/월 수입보다/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('현재 자금 계획 요약')).not.toHaveClass('flow-context-summary--warning');
  });

  it('explains that a percentage is unavailable when income is zero', () => {
    render(<FlowContextSummary data={{ ...cashflowFixture, monthlyNetIncomeWon: 0, monthlyHousingWon: 0, monthlyLivingWon: 0, monthlySavingWon: 0, monthlyInvestmentWon: 0 }} />);

    expect(screen.getByText('수입을 먼저 입력해주세요.')).toBeVisible();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '수입을 먼저 입력해주세요.');
  });

  it('keeps a focused meter tooltip open after the pointer leaves, then closes it on blur', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('meter');

    fireEvent.focus(meter);
    fireEvent.mouseLeave(meter);
    expect(screen.getByRole('tooltip')).toHaveTextContent('71.9%');
    fireEvent.blur(meter);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
