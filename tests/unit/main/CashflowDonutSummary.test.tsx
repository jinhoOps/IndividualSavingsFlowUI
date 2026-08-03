import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { CashflowDonutSummary } from '../../../src/main/ui/dashboard/CashflowDonutSummary';

afterEach(cleanup);

const appliedData: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('CashflowDonutSummary', () => {
  it('renders the accessible allocation chart, savings-investment center, and legend controls', () => {
    render(<CashflowDonutSummary data={appliedData} />);

    expect(screen.getByRole('img', { name: /소비 56\.3%.*저축 9\.4%.*투자 6\.3%.*남는 돈 28\.1%/ })).toBeVisible();
    expect(screen.getByText('15.6%')).toBeVisible();
    expect(screen.getByText('저축·투자')).toBeVisible();
    for (const label of ['소비', '저축', '투자', '남는 돈']) {
      expect(screen.getByRole('button', { name: `${label} 상세 정보` })).toBeVisible();
    }
  });

  it('shows allocation detail for focus and tap', () => {
    render(<CashflowDonutSummary data={appliedData} />);
    const consumption = screen.getByRole('button', { name: '소비 상세 정보' });

    fireEvent.focus(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('소비 · 180만 원 · 56.3%');
    fireEvent.blur(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('소비 · 180만 원 · 56.3%');
    fireEvent.click(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('asks for monthly income instead of rendering a chart when income is zero', () => {
    render(<CashflowDonutSummary data={{ ...appliedData, monthlyNetIncomeWon: 0 }} />);

    expect(screen.getByText('월소득을 입력해주세요.')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('clips over-income segments in actual income order while retaining the deficit state', () => {
    const { container } = render(<CashflowDonutSummary data={{ ...appliedData, monthlyInvestmentWon: 1_500_000 }} />);

    expect(screen.getByText('소득 초과')).toBeVisible();
    expect(screen.queryByRole('button', { name: '남는 돈 상세 정보' })).not.toBeInTheDocument();
    expect(container.querySelector('circle.cashflow-donut__segment--consumption')).toHaveAttribute('stroke-dasharray', '56.25 43.75');
    expect(container.querySelector('circle.cashflow-donut__segment--saving')).toHaveAttribute('stroke-dasharray', '9.375 90.625');
    expect(container.querySelector('circle.cashflow-donut__segment--investment')).toHaveAttribute('stroke-dasharray', '34.375 65.625');
    expect(container.querySelector('circle.cashflow-donut__segment--investment')).toHaveAttribute('stroke-dashoffset', '-65.625');
  });
});
