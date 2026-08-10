import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterializedAllocation } from '../../../src/portfolio/domain/model';
import { PortfolioSummary } from '../../../src/portfolio/ui/PortfolioSummary';

afterEach(cleanup);

const allocation: MaterializedAllocation = {
  items: [{
    id: 'gold', name: '금', order: 0,
    shareUnits: 150_000, amountWon: 120_000, percentage: 15,
    classification: 'stable', classificationOrigin: 'automatic',
  }, {
    id: 'index', name: '글로벌 인덱스', order: 1,
    shareUnits: 500_000, amountWon: 400_000, percentage: 50,
    classification: 'growth', classificationOrigin: 'automatic',
  }, {
    id: 'bond', name: '채권', order: 2,
    shareUnits: 250_000, amountWon: 200_000, percentage: 25,
    classification: 'stable', classificationOrigin: 'automatic',
  }],
  cashAmountWon: 80_000,
  cashPercentage: 10,
  totalAmountWon: 800_000,
};

function visibleRowNames(): string[] {
  return screen.getAllByRole('listitem').map((row) => within(row).getByRole('heading').textContent ?? '');
}

describe('PortfolioSummary', () => {
  it('leads with the stable ratio and hides every won amount by default', () => {
    const onEdit = vi.fn();
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole('heading', { name: '안정 50%' })).toBeVisible();
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
    expect(screen.queryByText(/원/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('투자 배분 도넛')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(visibleRowNames()).toEqual(['글로벌 인덱스', '채권', '금', '현금']);
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '글로벌 인덱스50%',
      '채권25%',
      '금15%',
      '현금10%',
    ]);

    const edit = screen.getByRole('button', { name: '배분 수정' });
    expect(edit).toHaveClass('portfolio-summary__edit');
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('keeps ratios primary and reveals the total and every row amount together', () => {
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: true, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: '이번 달 투자금 800,000원' })).toBeVisible();
    expect(screen.getByText('안정 50%')).toBeVisible();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('글로벌 인덱스50%400,000원');
    expect(rows[1]).toHaveTextContent('채권25%200,000원');
    expect(rows[2]).toHaveTextContent('금15%120,000원');
    expect(rows[3]).toHaveTextContent('현금10%80,000원');
  });

  it('uses saved input order without changing cash placement', () => {
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
  });

  it('uses the first item in the current view when investments tie for the largest ratio', () => {
    const tied: MaterializedAllocation = {
      items: [{
        id: 'later', name: '두번째 입력', order: 1,
        shareUnits: 400_000, amountWon: 320_000, percentage: 40,
        classification: 'growth', classificationOrigin: 'automatic',
      }, {
        id: 'first', name: '첫번째 입력', order: 0,
        shareUnits: 400_000, amountWon: 320_000, percentage: 40,
        classification: 'stable', classificationOrigin: 'user',
      }],
      cashAmountWon: 160_000,
      cashPercentage: 20,
      totalAmountWon: 800_000,
    };

    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={tied}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['첫번째 입력', '두번째 입력', '현금']);
    expect(screen.getByText('첫번째 입력에 40%를 배분해요')).toBeVisible();
  });

  it('prefers an investment over cash when both share the largest ratio', () => {
    const cashTie: MaterializedAllocation = {
      items: [{
        id: 'index', name: '글로벌 인덱스', order: 0,
        shareUnits: 500_000, amountWon: 400_000, percentage: 50,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
      cashAmountWon: 400_000,
      cashPercentage: 50,
      totalAmountWon: 800_000,
    };

    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={cashTie}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['글로벌 인덱스', '현금']);
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
  });
});
