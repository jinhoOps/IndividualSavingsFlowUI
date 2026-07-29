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

const emptyFixture: MainData = {
  ...cashflowFixture,
  monthlyNetIncomeWon: 0,
  monthlyHousingWon: 0,
  monthlyLivingWon: 0,
  monthlySavingWon: 0,
  monthlyInvestmentWon: 0,
};

const tinyFixture: MainData = {
  ...emptyFixture,
  monthlyNetIncomeWon: 3_200_000,
  monthlyInvestmentWon: 1_000,
};

describe('AllocationBar', () => {
  it('keeps the legend to allocation labels and amounts', () => {
    render(<AllocationBar data={cashflowFixture} />);

    expect(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요')).toBeVisible();
    expect(screen.queryByText(/배분/)).not.toBeInTheDocument();
    expect(screen.getByText('소비 180만 원')).toBeVisible();
    expect(screen.queryByText('소비 180만 원 (56.3%)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('소비 56.3%')).toBeVisible();
    expect(screen.getByLabelText('저축 9.4%')).toBeVisible();
    expect(screen.getByLabelText('투자 6.3%')).toBeVisible();
    expect(screen.getByLabelText('남는 돈 28.1%')).toBeVisible();
  });

  it('shows a shared percentage tooltip for hover, focus, and tap', () => {
    render(<AllocationBar data={cashflowFixture} />);
    const consumption = screen.getByLabelText('소비 56.3%');

    fireEvent.pointerEnter(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('56.3%');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    fireEvent.pointerLeave(consumption);
    fireEvent.focus(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    fireEvent.blur(consumption);
    fireEvent.click(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    fireEvent.click(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps a focused segment tooltip open after the pointer leaves, then closes it on blur', () => {
    render(<AllocationBar data={cashflowFixture} />);
    const consumption = screen.getByLabelText('소비 56.3%');

    fireEvent.focus(consumption);
    fireEvent.pointerLeave(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('56.3%');
    fireEvent.blur(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes a tapped segment tooltip when focus moves outside its wrapper', () => {
    render(<><AllocationBar data={cashflowFixture} /><button type="button">outside</button></>);
    const consumption = screen.getByLabelText('소비 56.3%');
    const outside = screen.getByRole('button', { name: 'outside' });

    fireEvent.pointerDown(consumption);
    fireEvent.focus(consumption);
    fireEvent.click(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);

    fireEvent.blur(consumption, { relatedTarget: outside });
    fireEvent.focus(outside);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('provides a legend-linked control for zero-width allocations', () => {
    render(<AllocationBar data={emptyFixture} />);

    expect(screen.getByText('소비 0원')).toBeVisible();
    expect(screen.getByRole('button', { name: '소비 0.0%' })).toBeVisible();
    expect(screen.getByRole('button', { name: '남는 돈 0.0%' })).toBeVisible();

    fireEvent.focus(screen.getByRole('button', { name: '소비 0.0%' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^0\.0%$/);
  });

  it.each([
    ['zero-width', emptyFixture, '소비 0.0%'],
    ['tiny-width', tinyFixture, '투자 0.0%'],
  ])('toggles the %s legend tooltip by tap and closes it on click-away', (_case, fixture, accessibleName) => {
    render(<AllocationBar data={fixture} />);
    const legendTarget = screen.getByRole('button', { name: accessibleName });

    fireEvent.click(legendTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^0\.0%$/);
    fireEvent.click(legendTarget);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(legendTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^0\.0%$/);
    fireEvent.click(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
