import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { MainErrorBoundary } from '../../../src/main/ui/common/AppErrorBoundary';
import { AllocationBar } from '../../../src/main/ui/setup/AllocationBar';

const anime = vi.hoisted(() => ({
  animate: vi.fn((_target: unknown, _options: unknown) => ({ cancel: vi.fn() })),
}));

vi.mock('animejs', () => ({
  animate: anime.animate,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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

const deeplyClippedDeficitFixture: MainData = {
  ...cashflowFixture,
  monthlyNetIncomeWon: 1_000_000,
  monthlyHousingWon: 1_000_000,
  monthlyLivingWon: 0,
  monthlySavingWon: 1_000_000,
  monthlyInvestmentWon: 1_000_000,
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
  it('commits final bar geometry without the app fallback when animation creation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <MainErrorBoundary><AllocationBar data={cashflowFixture} /></MainErrorBoundary>,
    );
    anime.animate.mockImplementationOnce(() => {
      throw new Error('animate failed');
    });

    rerender(
      <MainErrorBoundary>
        <AllocationBar data={{ ...cashflowFixture, updatedAt: 2, monthlyInvestmentWon: 400_000 }} />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' })).not.toBeInTheDocument();
    expect(container.querySelector('.allocation-bar__visual-segment--investment'))
      .toHaveStyle({ width: '12.5%' });
    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .toHaveStyle({ width: '21.875%' });
  });

  it('commits the latest final bar geometry when cancelling the prior animation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <MainErrorBoundary><AllocationBar data={cashflowFixture} /></MainErrorBoundary>,
    );
    rerender(
      <MainErrorBoundary>
        <AllocationBar data={{ ...cashflowFixture, updatedAt: 2, monthlyInvestmentWon: 400_000 }} />
      </MainErrorBoundary>,
    );
    const activeAnimation = anime.animate.mock.results.at(-1)?.value as { cancel: ReturnType<typeof vi.fn> };
    activeAnimation.cancel.mockImplementationOnce(() => {
      throw new Error('cancel failed');
    });

    rerender(
      <MainErrorBoundary>
        <AllocationBar data={{ ...cashflowFixture, updatedAt: 3, monthlyInvestmentWon: 600_000 }} />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' })).not.toBeInTheDocument();
    expect(container.querySelector('.allocation-bar__visual-segment--investment'))
      .toHaveStyle({ width: '18.75%' });
    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .toHaveStyle({ width: '15.625%' });
  });

  it('uses one intrinsic visual track with actual income percentages', () => {
    const { container } = render(<AllocationBar data={cashflowFixture} />);
    const track = container.querySelector('.allocation-bar__visual-track');
    expect(track).not.toBeNull();
    expect(container.querySelectorAll('.allocation-bar__visual-track')).toHaveLength(1);
    expect(Array.from(track!.querySelectorAll<HTMLElement>('[data-width-percent]')).map(
      (segment) => Number(segment.dataset.widthPercent),
    )).toEqual([56.25, 9.375, 6.25, 28.125]);
  });

  it('keeps final table semantics while the visual bar starts from prior applied geometry', () => {
    const { container, rerender } = render(<AllocationBar data={cashflowFixture} />);
    const investment = container.querySelector<HTMLElement>('.allocation-bar__visual-segment--investment');
    expect(investment).toHaveStyle({ width: '6.25%' });

    rerender(<AllocationBar data={{ ...cashflowFixture, updatedAt: 2, monthlyInvestmentWon: 400_000 }} />);

    expect(screen.getByRole('row', { name: /투자 40만 원 12\.5%/ })).toBeVisible();
    expect(investment).toHaveStyle({ width: '6.25%' });
  });

  it('shrinks a surplus remaining segment to zero before removing its visual-only node', () => {
    const { container, rerender } = render(<AllocationBar data={cashflowFixture} />);

    rerender(<AllocationBar data={{
      ...cashflowFixture,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);

    expect(screen.queryByRole('row', { name: /남는 돈/ })).not.toBeInTheDocument();
    const exitingRemaining = container.querySelector<HTMLElement>(
      '.allocation-bar__visual-segment--remaining',
    );
    expect(exitingRemaining).toHaveStyle({ width: '28.125%' });
    expect(exitingRemaining?.closest('[aria-hidden="true"]')).not.toBeNull();

    const animationIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { remaining?: number }).remaining === 0
    ));
    const state = anime.animate.mock.calls[animationIndex][0] as { remaining: number };
    const options = anime.animate.mock.calls[animationIndex][1] as {
      onComplete(): void;
      onUpdate(): void;
      remaining: number;
    };
    act(() => {
      state.remaining = options.remaining;
      options.onUpdate();
      options.onComplete();
    });

    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .not.toBeInTheDocument();
  });

  it('grows a newly restored remaining segment from zero with final semantics immediately', () => {
    const deficit = { ...cashflowFixture, monthlyInvestmentWon: 1_500_000 };
    const { container, rerender } = render(<AllocationBar data={deficit} />);

    rerender(<AllocationBar data={{ ...cashflowFixture, updatedAt: 2 }} />);

    expect(screen.getByRole('row', { name: /남는 돈 90만 원 28\.1%/ })).toBeVisible();
    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .toHaveStyle({ width: '0%' });
  });

  it('cancels an exiting segment animation when a newer applied update restores it', () => {
    const { container, rerender } = render(<AllocationBar data={cashflowFixture} />);
    const deficit = { ...cashflowFixture, updatedAt: 2, monthlyInvestmentWon: 1_500_000 };
    rerender(<AllocationBar data={deficit} />);
    const exitingIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { remaining?: number }).remaining === 0
    ));
    const exitingResult = anime.animate.mock.results[exitingIndex].value as {
      cancel: ReturnType<typeof vi.fn>;
    };
    const exitingOptions = anime.animate.mock.calls[exitingIndex][1] as { onComplete(): void };

    rerender(<AllocationBar data={{ ...cashflowFixture, updatedAt: 3 }} />);
    expect(exitingResult.cancel).toHaveBeenCalledOnce();
    act(() => exitingOptions.onComplete());

    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .toBeInTheDocument();
    expect(screen.getByRole('row', { name: /남는 돈 90만 원 28\.1%/ })).toBeVisible();
  });

  it('removes exiting visual geometry synchronously under reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { container, rerender } = render(<AllocationBar data={cashflowFixture} />);

    rerender(<AllocationBar data={{
      ...cashflowFixture,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);

    expect(container.querySelector('.allocation-bar__visual-segment--remaining'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /남는 돈/ })).not.toBeInTheDocument();
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('cancels an exiting segment animation on unmount', () => {
    const { rerender, unmount } = render(<AllocationBar data={cashflowFixture} />);
    rerender(<AllocationBar data={{
      ...cashflowFixture,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);
    const exitingIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { remaining?: number }).remaining === 0
    ));
    const exitingResult = anime.animate.mock.results[exitingIndex].value as {
      cancel: ReturnType<typeof vi.fn>;
    };

    unmount();

    expect(exitingResult.cancel).toHaveBeenCalledOnce();
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
    expect(screen.getByText('+37.5% 초과')).toHaveAttribute('data-assembly-content');
    expect(screen.getByRole('row', { name: /초과 120만 원 37\.5%/ })).toBeVisible();
  });

  it('clips hit targets to the visible strip and routes hidden allocations to table buttons', () => {
    mockBarViewport(256);
    render(<AllocationBar data={deeplyClippedDeficitFixture} />);

    const track = document.querySelector('.allocation-bar__segments');
    const targetClip = track?.querySelector('.cashflow-bar__targets-clip');
    expect(targetClip).toHaveStyle({ overflow: 'hidden', width: '120%' });
    expect(targetClip?.querySelectorAll('.allocation-bar__segment-target')).toHaveLength(1);
    expect(document.querySelectorAll('.allocation-bar__segment-target')).toHaveLength(1);
    expect(track).not.toHaveAttribute('data-overflow');

    const table = screen.getByRole('table', { name: '월 자금 항목' });
    expect(within(table).getByRole('button', { name: '저축 상세 정보' })).toBeVisible();
    expect(within(table).getByRole('button', { name: '투자 상세 정보' })).toBeVisible();
  });
});
