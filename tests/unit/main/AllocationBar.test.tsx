import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { AllocationBar } from '../../../src/main/ui/setup/AllocationBar';

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

describe('AllocationBar', () => {
  it('labels each allocation using its percentage of income', () => {
    render(<AllocationBar data={cashflowFixture} />);

    expect(screen.getByLabelText('소비 56.3%')).toBeVisible();
    expect(screen.getByLabelText('저축 9.4%')).toBeVisible();
    expect(screen.getByLabelText('투자 6.3%')).toBeVisible();
    expect(screen.getByLabelText('남는 돈 28.1%')).toBeVisible();
  });

  it('shows a percentage-only tooltip for hover, focus, and tap', () => {
    render(<AllocationBar data={cashflowFixture} />);
    const consumption = screen.getByLabelText('소비 56.3%');

    fireEvent.mouseEnter(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('56.3%');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    fireEvent.mouseLeave(consumption);
    fireEvent.focus(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    fireEvent.click(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses zero-width allocation labels when income is zero', () => {
    render(<AllocationBar data={{ ...cashflowFixture, monthlyNetIncomeWon: 0, monthlyHousingWon: 0, monthlyLivingWon: 0, monthlySavingWon: 0, monthlyInvestmentWon: 0 }} />);

    expect(screen.getByLabelText('소비 0.0%')).toBeVisible();
    expect(screen.getByLabelText('남는 돈 0.0%')).toBeVisible();
  });

  it('represents a deficit against planned outflow without a negative remaining segment', () => {
    render(<AllocationBar data={{ ...cashflowFixture, monthlyInvestmentWon: 1_500_000 }} />);

    expect(screen.getByLabelText('소비 50.0%')).toBeVisible();
    expect(screen.getByLabelText('저축 8.3%')).toBeVisible();
    expect(screen.getByLabelText('투자 41.7%')).toBeVisible();
    expect(screen.queryByLabelText(/남는 돈/)).not.toBeInTheDocument();
    expect(screen.getByText('수입보다 40만 원 초과')).toBeVisible();
  });
});
