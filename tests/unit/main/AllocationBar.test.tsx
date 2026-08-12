import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import {
  AllocationBar,
  createAllocationVisualSegments,
} from '../../../src/main/ui/setup/AllocationBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

const adjacentSmallFixture: MainData = {
  ...emptyFixture,
  monthlyNetIncomeWon: 10_000_000,
  monthlyHousingWon: 200_000,
  monthlyLivingWon: 300_000,
  monthlySavingWon: 600_000,
  monthlyInvestmentWon: 700_000,
};

const actualDeficitFixture: MainData = {
  ...cashflowFixture,
  monthlyInvestmentWon: 2_300_000,
};

let resizeObserverCallback: ResizeObserverCallback | undefined;

function mockBarViewport(initialClientWidth: number) {
  let clientWidth = initialClientWidth;
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => clientWidth);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isBar = this.classList.contains('allocation-bar__segments');
    const width = isBar ? 200 : 0;
    const left = 0;
    return {
      bottom: 44,
      height: 44,
      left,
      right: left + width,
      top: 0,
      width,
      x: left,
      y: 0,
      toJSON: () => ({}),
    };
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resizeObserverCallback = callback;
    }

    observe() {}
    disconnect() {}
  });

  return (nextClientWidth: number) => {
    clientWidth = nextClientWidth;
    act(() => resizeObserverCallback?.([], {} as ResizeObserver));
  };
}

describe('AllocationBar', () => {
  it('provides the same visual segments used by the review transition', () => {
    expect(createAllocationVisualSegments(cashflowFixture)).toEqual([
      { id: 'consumption', visualPercentage: 56.25 },
      { id: 'saving', visualPercentage: 9.375 },
      { id: 'investment', visualPercentage: 6.25 },
      { id: 'remaining', visualPercentage: 28.125 },
    ]);
  });

  it('starts the review transition at the current planned-outflow width', () => {
    const { container } = render(<AllocationBar data={cashflowFixture} transitioning />);
    expect(container.querySelector('.setup-review-transition__accent')).toHaveStyle({
      width: '71.875%',
    });
  });

  it('shows allocation labels, amounts, and income percentages in a table', () => {
    render(<AllocationBar data={cashflowFixture} />);

    expect(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요')).toBeVisible();
    const table = screen.getByRole('table', { name: '월 자금 항목' });
    expect(within(table).getByRole('columnheader', { name: '종류' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: '금액' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: '수입 대비' })).toBeVisible();
    const consumptionRow = within(table).getByRole('row', { name: /소비 180만 원 56\.3%/ });
    expect(consumptionRow).toBeVisible();
    expect(screen.getByRole('button', { name: '소비 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '저축 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투자 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '남는 돈 상세 정보' })).toBeVisible();
  });

  it('shows a shared percentage tooltip for hover, focus, and tap', () => {
    render(<AllocationBar data={cashflowFixture} />);
    const consumption = screen.getByRole('button', { name: '소비 상세 정보' });

    fireEvent.pointerEnter(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);
    fireEvent.pointerLeave(consumption);
    fireEvent.focus(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);
    fireEvent.blur(consumption);
    fireEvent.click(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);
    fireEvent.click(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps a focused segment tooltip open after the pointer leaves, then closes it on blur', () => {
    render(<AllocationBar data={cashflowFixture} />);
    const consumption = screen.getByRole('button', { name: '소비 상세 정보' });

    fireEvent.focus(consumption);
    fireEvent.pointerLeave(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent('소비 · 180만 원 · 56.3%');
    fireEvent.blur(consumption);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes a tapped segment tooltip when focus moves outside its wrapper', () => {
    render(<><AllocationBar data={cashflowFixture} /><button type="button">outside</button></>);
    const consumption = screen.getByRole('button', { name: '소비 상세 정보' });
    const outside = screen.getByRole('button', { name: 'outside' });

    fireEvent.pointerDown(consumption);
    fireEvent.focus(consumption);
    fireEvent.click(consumption);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);

    fireEvent.blur(consumption, { relatedTarget: outside });
    fireEvent.focus(outside);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('provides a legend-linked control for zero-width allocations', () => {
    render(<AllocationBar data={emptyFixture} />);

    expect(screen.getByRole('row', { name: /소비 0원 0\.0%/ })).toBeVisible();
    expect(screen.getByRole('button', { name: '소비 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '남는 돈 상세 정보' })).toBeVisible();

    fireEvent.focus(screen.getByRole('button', { name: '소비 상세 정보' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 0원 · 0\.0%$/);
  });

  it.each([
    ['zero-width', emptyFixture, '소비 상세 정보', '소비 · 0원 · 0.0%'],
    ['tiny-width', tinyFixture, '투자 상세 정보', '투자 · 1,000원 · 0.0%'],
  ])('toggles the %s table tooltip by tap and closes it on click-away', (_case, fixture, accessibleName, tooltipText) => {
    render(<AllocationBar data={fixture} />);
    const legendTarget = screen.getByRole('button', { name: accessibleName });

    fireEvent.click(legendTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent(tooltipText);
    fireEvent.click(legendTarget);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(legendTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent(tooltipText);
    fireEvent.click(screen.getByText('월 수입을 이렇게 나눠 쓰고 있어요'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('routes adjacent segments narrower than 44px to distinct legend targets', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.classList.contains('allocation-bar__segments') ? 320 : 0;
      return {
        bottom: 44,
        height: 44,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
    render(<AllocationBar data={adjacentSmallFixture} />);

    for (const [name, text, percentage] of [
      ['소비 상세 정보', '소비', '5.0%'],
      ['저축 상세 정보', '저축', '6.0%'],
      ['투자 상세 정보', '투자', '7.0%'],
    ] as const) {
      const target = screen.getByRole('button', { name });
      expect(target).toHaveClass('allocation-table__label-target');
      expect(target).toHaveTextContent(text);

      fireEvent.click(target);
      expect(screen.getByRole('tooltip')).toHaveTextContent(percentage);
    }

    const remaining = screen.getByRole('button', { name: '남는 돈 · 820만 원 · 82.0%' });
    expect(remaining).toHaveClass('allocation-bar__segment-target');
    expect(remaining).toHaveStyle({ left: '18%', width: '82%' });
    expect(document.querySelectorAll('.allocation-bar__segment-target')).toHaveLength(1);
  });

  it('represents a deficit against planned outflow without a negative remaining segment', () => {
    render(<AllocationBar data={{ ...cashflowFixture, monthlyInvestmentWon: 1_500_000 }} />);

    expect(screen.getByRole('button', { name: '소비 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '저축 상세 정보' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투자 상세 정보' })).toBeVisible();
    expect(screen.queryByLabelText(/남는 돈/)).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /초과 40만 원 12\.5%/ })).toBeVisible();
    expect(screen.getByText('수입보다 40만 원 초과')).toBeVisible();
  });

  it('preserves actual deficit geometry when the viewport has enough room', () => {
    mockBarViewport(1_000);
    render(<AllocationBar data={actualDeficitFixture} />);

    const track = document.querySelector('.allocation-bar__segments');
    expect(track).toHaveAttribute('data-desired-end-percent', '137.5');
    expect(track).toHaveAttribute('data-visible-end-percent', '137.5');
    expect(track).toHaveAttribute('data-overflow-clipped', 'false');
    expect(screen.queryByText('+37.5% 초과')).not.toBeInTheDocument();
    expect(screen.getByText('수입보다 120만 원 초과')).toBeVisible();
  });

  it('shows the actual overflow label only after a ResizeObserver update clips the strip', () => {
    const resizeTo = mockBarViewport(1_000);
    render(<AllocationBar data={actualDeficitFixture} />);
    const track = document.querySelector('.allocation-bar__segments');

    expect(screen.queryByText('+37.5% 초과')).not.toBeInTheDocument();
    resizeTo(256);

    expect(track).toHaveAttribute('data-desired-end-percent', '137.5');
    expect(track).toHaveAttribute('data-visible-end-percent', '120');
    expect(track).toHaveAttribute('data-overflow-clipped', 'true');
    expect(screen.getByText('+37.5% 초과')).toBeVisible();
    expect(screen.getByRole('row', { name: /초과 120만 원 37\.5%/ })).toBeVisible();
  });
});
