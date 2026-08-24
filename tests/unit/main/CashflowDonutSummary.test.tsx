import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCashflow } from '../../../src/main/domain/cashflow';
import type { MainData } from '../../../src/main/domain/model';
import { MainErrorBoundary } from '../../../src/main/ui/common/AppErrorBoundary';
import { CashflowDonutSummary } from '../../../src/main/ui/dashboard/CashflowDonutSummary';
import { CashflowSummary } from '../../../src/main/ui/dashboard/CashflowSummary';

const anime = vi.hoisted(() => ({
  animate: vi.fn((_target: unknown, _options: unknown) => ({ cancel: vi.fn() })),
}));

vi.mock('animejs', () => ({
  animate: anime.animate,
}));

beforeEach(() => {
  anime.animate.mockImplementation((_target: unknown, _options: unknown) => ({ cancel: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

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
  it('commits final donut geometry without the app fallback when animation creation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <MainErrorBoundary><CashflowDonutSummary data={appliedData} /></MainErrorBoundary>,
    );
    let geometryAnimationFailed = false;
    anime.animate.mockImplementation((target: unknown) => {
      if (
        !geometryAnimationFailed
        && typeof target === 'object'
        && target !== null
        && 'visiblePercentage' in target
      ) {
        geometryAnimationFailed = true;
        throw new Error('animate failed');
      }
      return { cancel: vi.fn() };
    });

    rerender(
      <MainErrorBoundary>
        <CashflowDonutSummary data={{ ...appliedData, updatedAt: 2, monthlyInvestmentWon: 400_000 }} />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' })).not.toBeInTheDocument();
    expect(container.querySelector('circle.cashflow-donut__segment--investment'))
      .toHaveAttribute('stroke-dasharray', '12.5 87.5');
    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .toHaveAttribute('stroke-dasharray', '21.875 78.125');
  });

  it('commits the latest final donut geometry when cancelling prior arcs fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <MainErrorBoundary><CashflowDonutSummary data={appliedData} /></MainErrorBoundary>,
    );
    rerender(
      <MainErrorBoundary>
        <CashflowDonutSummary data={{ ...appliedData, updatedAt: 2, monthlyInvestmentWon: 400_000 }} />
      </MainErrorBoundary>,
    );
    const activeGeometryIndex = anime.animate.mock.calls.findIndex(([target]) => (
      typeof target === 'object' && target !== null && 'visiblePercentage' in target
    ));
    const activeAnimation = anime.animate.mock.results[activeGeometryIndex].value as {
      cancel: ReturnType<typeof vi.fn>;
    };
    activeAnimation.cancel.mockImplementationOnce(() => {
      throw new Error('cancel failed');
    });

    rerender(
      <MainErrorBoundary>
        <CashflowDonutSummary data={{ ...appliedData, updatedAt: 3, monthlyInvestmentWon: 600_000 }} />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' })).not.toBeInTheDocument();
    expect(container.querySelector('circle.cashflow-donut__segment--investment'))
      .toHaveAttribute('stroke-dasharray', '18.75 81.25');
    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .toHaveAttribute('stroke-dasharray', '15.625 84.375');
  });

  it('keeps the applied card value semantic while its visual number interpolates', () => {
    const { rerender, unmount } = render(
      <CashflowSummary summary={calculateCashflow(appliedData)} onEdit={vi.fn()} />,
    );

    const consumption = screen.getByRole('button', { name: '월 소비 편집' });
    const visualValue = consumption.querySelector('strong > [aria-hidden="true"]');
    expect(visualValue).toHaveTextContent('180만 원');

    const updated = {
      ...appliedData,
      updatedAt: 2,
      monthlyLivingWon: 1_200_000,
    };
    rerender(<CashflowSummary summary={calculateCashflow(updated)} onEdit={vi.fn()} />);

    expect(consumption).toHaveAccessibleDescription(expect.stringMatching(/200만 원/));
    expect(visualValue).toHaveAttribute('aria-hidden', 'true');
    expect(visualValue).toHaveTextContent('180만 원');

    const activeAnimations = anime.animate.mock.results
      .map((result) => result.value as { cancel: ReturnType<typeof vi.fn> });
    expect(activeAnimations.length).toBeGreaterThan(0);
    unmount();
    expect(activeAnimations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
  });

  it('keeps final Main card values when visual-number cleanup cancellation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let cancelFailed = false;
    anime.animate.mockImplementation(() => ({
      cancel: vi.fn(() => {
        if (!cancelFailed) {
          cancelFailed = true;
          throw new Error('cancel failed');
        }
      }),
    }));
    const { rerender } = render(
      <MainErrorBoundary>
        <CashflowSummary summary={calculateCashflow(appliedData)} onEdit={vi.fn()} />
      </MainErrorBoundary>,
    );

    rerender(
      <MainErrorBoundary>
        <CashflowSummary
          summary={calculateCashflow({ ...appliedData, monthlyLivingWon: 1_200_000 })}
          onEdit={vi.fn()}
        />
      </MainErrorBoundary>,
    );
    rerender(
      <MainErrorBoundary>
        <CashflowSummary
          summary={calculateCashflow({ ...appliedData, monthlyLivingWon: 1_400_000 })}
          onEdit={vi.fn()}
        />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' }))
      .not.toBeInTheDocument();
    const consumption = screen.getByRole('button', { name: '월 소비 편집' });
    expect(consumption).toHaveAccessibleDescription(expect.stringMatching(/220만 원/));
    expect(consumption.querySelector('strong > [aria-hidden="true"]')).toHaveTextContent('220만 원');
  });

  it('keeps final donut semantics while SVG and visual numbers start from prior applied values', () => {
    const { container, rerender } = render(<CashflowDonutSummary data={appliedData} />);
    const updated = {
      ...appliedData,
      updatedAt: 2,
      monthlyInvestmentWon: 400_000,
    };

    rerender(<CashflowDonutSummary data={updated} />);

    expect(screen.getByRole('img', { name: /투자 12\.5%.*여윳돈 21\.9%/ })).toBeVisible();
    expect(container.querySelector('circle.cashflow-donut__segment--investment'))
      .toHaveAttribute('stroke-dasharray', '6.25 93.75');
    const centerVisual = container.querySelector('.cashflow-donut__center strong > [aria-hidden="true"]');
    expect(centerVisual).toHaveTextContent('15.6%');
    expect(centerVisual).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.cashflow-donut__center strong > .sr-only')).toHaveTextContent('21.9%');
  });

  it('keeps final donut values when visual-number cleanup cancellation fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    anime.animate.mockImplementation((target: unknown) => ({
      cancel: vi.fn(() => {
        if (
          typeof target === 'object'
          && target !== null
          && 'value' in target
        ) {
          throw new Error('cancel failed');
        }
      }),
    }));
    const { container, rerender } = render(
      <MainErrorBoundary><CashflowDonutSummary data={appliedData} /></MainErrorBoundary>,
    );
    rerender(
      <MainErrorBoundary>
        <CashflowDonutSummary
          data={{ ...appliedData, updatedAt: 2, monthlyInvestmentWon: 400_000 }}
        />
      </MainErrorBoundary>,
    );
    rerender(
      <MainErrorBoundary>
        <CashflowDonutSummary
          data={{ ...appliedData, updatedAt: 3, monthlyInvestmentWon: 600_000 }}
        />
      </MainErrorBoundary>,
    );

    expect(screen.queryByRole('heading', { name: '화면을 표시하지 못했습니다' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /투자 18\.8%.*여윳돈 15\.6%/ })).toBeVisible();
    expect(container.querySelector('.cashflow-donut__center strong > [aria-hidden="true"]'))
      .toHaveTextContent('28.1%');
    expect(container.querySelector('.cashflow-donut__center strong > .sr-only'))
      .toHaveTextContent('28.1%');
  });

  it('shrinks a surplus remaining arc to zero before removing its visual-only circle', () => {
    const { container, rerender } = render(<CashflowDonutSummary data={appliedData} />);
    rerender(<CashflowDonutSummary data={{
      ...appliedData,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);

    expect(screen.getByRole('img')).not.toHaveAccessibleName(/여윳돈/);
    expect(screen.queryByRole('button', { name: /여윳돈/ })).not.toBeInTheDocument();
    const exitingRemaining = container.querySelector(
      'circle.cashflow-donut__segment--remaining',
    );
    expect(exitingRemaining).toHaveAttribute('aria-hidden', 'true');
    expect(exitingRemaining).toHaveAttribute('stroke-dasharray', '28.125 71.875');

    const animationIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { visiblePercentage?: number }).visiblePercentage === 0
    ));
    const state = anime.animate.mock.calls[animationIndex][0] as {
      dashoffset: number;
      visiblePercentage: number;
    };
    const options = anime.animate.mock.calls[animationIndex][1] as {
      dashoffset: number;
      onComplete(): void;
      onUpdate(): void;
      visiblePercentage: number;
    };
    act(() => {
      state.visiblePercentage = options.visiblePercentage;
      state.dashoffset = options.dashoffset;
      options.onUpdate();
      options.onComplete();
    });

    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .not.toBeInTheDocument();
  });

  it('grows a restored remaining arc from zero with final chart semantics immediately', () => {
    const deficit = { ...appliedData, monthlyInvestmentWon: 1_500_000 };
    const { container, rerender } = render(<CashflowDonutSummary data={deficit} />);

    rerender(<CashflowDonutSummary data={{ ...appliedData, updatedAt: 2 }} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/여윳돈 28\.1%/);
    expect(screen.getByRole('button', { name: /여윳돈 · 90만 원 · 28\.1%/ })).toBeVisible();
    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .toHaveAttribute('stroke-dasharray', '0 100');
  });

  it('cancels an exiting arc when a newer applied update restores it', () => {
    const { container, rerender } = render(<CashflowDonutSummary data={appliedData} />);
    const deficit = { ...appliedData, updatedAt: 2, monthlyInvestmentWon: 1_500_000 };
    rerender(<CashflowDonutSummary data={deficit} />);
    const exitingIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { visiblePercentage?: number }).visiblePercentage === 0
    ));
    const exitingResult = anime.animate.mock.results[exitingIndex].value as {
      cancel: ReturnType<typeof vi.fn>;
    };
    const exitingOptions = anime.animate.mock.calls[exitingIndex][1] as { onComplete(): void };

    rerender(<CashflowDonutSummary data={{ ...appliedData, updatedAt: 3 }} />);
    expect(exitingResult.cancel).toHaveBeenCalledOnce();
    act(() => exitingOptions.onComplete());

    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/여윳돈 28\.1%/);
  });

  it('removes an exiting arc synchronously under reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { container, rerender } = render(<CashflowDonutSummary data={appliedData} />);

    rerender(<CashflowDonutSummary data={{
      ...appliedData,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);

    expect(container.querySelector('circle.cashflow-donut__segment--remaining'))
      .not.toBeInTheDocument();
    expect(screen.getByRole('img')).not.toHaveAccessibleName(/여윳돈/);
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('cancels an exiting arc animation on unmount', () => {
    const { rerender, unmount } = render(<CashflowDonutSummary data={appliedData} />);
    rerender(<CashflowDonutSummary data={{
      ...appliedData,
      updatedAt: 2,
      monthlyInvestmentWon: 1_500_000,
    }} />);
    const exitingIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      (options as { visiblePercentage?: number }).visiblePercentage === 0
    ));
    const exitingResult = anime.animate.mock.results[exitingIndex].value as {
      cancel: ReturnType<typeof vi.fn>;
    };

    unmount();

    expect(exitingResult.cancel).toHaveBeenCalledOnce();
  });

  it('renders legend labels and percentages while keeping amounts in accessible names', () => {
    const { container } = render(<CashflowDonutSummary data={appliedData} />);

    expect(screen.getByRole('img', { name: /소비 56\.3%.*저축 9\.4%.*투자 6\.3%.*여윳돈 28\.1%/ })).toBeVisible();
    expect(screen.getByText('15.6%', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(screen.getByText('저축·투자')).toBeVisible();
    const legend = container.querySelector('.cashflow-donut__legend');
    expect(legend).not.toBeNull();
    for (const [label, amount, percentage] of [
      ['소비', '180만 원', '56.3%'],
      ['저축', '30만 원', '9.4%'],
      ['투자', '20만 원', '6.3%'],
      ['여윳돈', '90만 원', '28.1%'],
    ]) {
      expect(screen.getByRole('button', { name: `${label} · ${amount} · ${percentage}` })).toBeVisible();
      expect(legend).not.toHaveTextContent(amount);
    }
    expect(document.querySelectorAll('.cashflow-donut__legend-amount')).toHaveLength(0);
  });

  it('shows focused allocation detail in the donut center without a tooltip overlay', () => {
    const { container } = render(<CashflowDonutSummary data={appliedData} />);
    const consumption = screen.getByRole('button', { name: '소비 · 180만 원 · 56.3%' });

    fireEvent.focus(consumption);
    const center = container.querySelector('.cashflow-donut__center');
    expect(within(center as HTMLElement).getByText('56.3%')).toBeVisible();
    expect(within(center as HTMLElement).getByText('소비')).toBeVisible();
    expect(within(center as HTMLElement).getByText('180만 원')).toBeVisible();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.blur(consumption);
    expect(within(center as HTMLElement).getByText('저축·투자')).toBeVisible();
  });

  it('selects a touched ring segment and dismisses the fixed detail outside', () => {
    const { container } = render(
      <>
        <CashflowDonutSummary data={appliedData} />
        <button type="button">outside</button>
      </>,
    );
    const chart = screen.getByRole('img', { name: /소비 56\.3%/ });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });

    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 50,
      clientY: 10,
    }));

    const center = container.querySelector('.cashflow-donut__center');
    expect(center).not.toBeNull();
    expect(within(center as HTMLElement).getByText('56.3%')).toBeVisible();
    expect(within(center as HTMLElement).getByText('소비')).toBeVisible();
    expect(container.querySelector('.cashflow-donut__segment--consumption'))
      .toHaveClass('cashflow-donut__segment--active');
    expect(screen.getByRole('button', { name: '소비 · 180만 원 · 56.3%' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(center as HTMLElement).getByText('180만 원')).toBeVisible();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));

    expect(within(center as HTMLElement).getByText('15.6%', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(within(center as HTMLElement).getByText('저축·투자')).toBeVisible();
    expect(container.querySelector('.cashflow-donut__segment--active')).not.toBeInTheDocument();
  });

  it('ignores pointer input inside the hole or outside the ring', () => {
    const { container } = render(<CashflowDonutSummary data={appliedData} />);
    const chart = screen.getByRole('img', { name: /소비 56\.3%/ });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });

    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 50,
      clientY: 50,
    }));
    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 99,
      clientY: 50,
    }));

    const center = container.querySelector('.cashflow-donut__center');
    expect(within(center as HTMLElement).getByText('15.6%', { selector: '[aria-hidden="true"]' })).toBeVisible();
    expect(container.querySelector('.cashflow-donut__segment--active')).not.toBeInTheDocument();
  });

  it('asks for monthly income instead of rendering a chart when income is zero', () => {
    render(<CashflowDonutSummary data={{ ...appliedData, monthlyNetIncomeWon: 0 }} />);

    expect(screen.getByText('월소득을 입력해주세요.')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('clips over-income segments in actual income order while retaining the deficit state', () => {
    const { container } = render(<CashflowDonutSummary data={{ ...appliedData, monthlyInvestmentWon: 1_500_000 }} />);

    expect(screen.getByText('소득 초과')).toBeVisible();
    expect(screen.queryByRole('button', { name: /여윳돈/ })).not.toBeInTheDocument();
    expect(container.querySelector('circle.cashflow-donut__segment--consumption')).toHaveAttribute('stroke-dasharray', '56.25 43.75');
    expect(container.querySelector('circle.cashflow-donut__segment--saving')).toHaveAttribute('stroke-dasharray', '9.375 90.625');
    expect(container.querySelector('circle.cashflow-donut__segment--investment')).toHaveAttribute('stroke-dasharray', '34.375 65.625');
    expect(container.querySelector('circle.cashflow-donut__segment--investment')).toHaveAttribute('stroke-dashoffset', '-65.625');
  });
});
