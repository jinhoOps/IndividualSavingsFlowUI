import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashflowAllocationSummary } from '../../../src/main/ui/dashboard/CashflowAllocationSummary';
const data = { schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
afterEach(cleanup);
describe('CashflowAllocationSummary', () => {
  it('shows the income basis, exact ratios and rows in allocation order', () => {
    const { container } = render(<CashflowAllocationSummary data={data} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/월수입 대비.*지출 56.3%.*저축 9.4%.*투자 6.3%.*여윳돈 28.1%/);
    expect(screen.getByText('15.6%')).toBeVisible();
    expect(screen.getByText('60 : 40')).toBeVisible();
    expect(screen.queryByText('320만 원')).toBeNull();
    expect(screen.getByRole('img')).not.toHaveAccessibleName(/320만 원/);
    expect([...container.querySelectorAll('.cashflow-metric__label')].map(item => item.textContent)).toEqual(['월 지출', '월 저축', '월 투자', '남는 돈']);
    expect(container.querySelector('[data-segment="consumption"]')).toHaveStyle({ width: '56.25%' });
  });
  it('keeps all over-income allocations visible on the same scale with an income marker', () => {
    const { container } = render(<CashflowAllocationSummary data={{ ...data, monthlyInvestmentWon: 1_500_000 }} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/투자 46.9%.*40만 원 초과/);
    expect(container.querySelector('[data-segment="investment"]')).toHaveStyle({ width: `${150 / 360 * 100}%` });
    expect(container.querySelector('[data-segment="remaining"]')).toBeNull();
    expect(screen.getByText('기준선: 월수입 100%')).toBeVisible();
    expect(screen.getByText('-40만 원', { selector: '.sr-only' })).toBeInTheDocument();
  });
  it('highlights from keyboard and touch rows without hiding figures or requiring tooltips', () => {
    const { container } = render(<CashflowAllocationSummary data={data} />);
    const saving = screen.getByRole('button', { name: '저축 · 30만 원 · 9.4%' });
    fireEvent.focus(saving);
    expect(container.querySelector('[data-segment="saving"]')).toHaveAttribute('data-active', 'true');
    fireEvent.click(saving);
    fireEvent.blur(saving);
    expect(saving).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('15.6%')).toBeVisible();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('keeps zero and tiny amounts readable and editing connected', () => {
    const edit = vi.fn();
    const { container } = render(<CashflowAllocationSummary data={{ ...data, monthlySavingWon: 0, monthlyInvestmentWon: 1 }} onEditAmount={edit} />);
    expect(container.querySelector('[data-segment="saving"]')).toBeNull();
    expect(container.querySelector('[data-segment="investment"]')).toHaveStyle({ width: `${1 / 3_200_000 * 100}%` });
    fireEvent.click(screen.getByRole('button', { name: '월 저축 금액 편집 · 현재 0원' }));
    expect(edit).toHaveBeenCalledWith('monthlySavingWon', expect.any(HTMLElement));
  });
  it.each([
    [0, 200_000, '0 : 100'],
    [300_000, 0, '100 : 0'],
    [0, 0, '—'],
    [200_000, 300_000, '40 : 60'],
  ])('shows saving:investment independently from income for %i and %i', (saving, investment, expected) => {
    const { container } = render(<CashflowAllocationSummary data={{ ...data, monthlyNetIncomeWon: 0, monthlySavingWon: saving, monthlyInvestmentWon: investment }} />);
    expect(container.querySelector('.cashflow-allocation__split strong')).toHaveTextContent(expected);
    expect(container.querySelector('.cashflow-allocation__ratio strong')).toHaveTextContent('—');
  });
  it('does not invent percentages without income', () => {
    render(<CashflowAllocationSummary data={{ ...data, monthlyNetIncomeWon: 0 }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('월소득을 입력해주세요.')).toBeVisible();
  });
});
