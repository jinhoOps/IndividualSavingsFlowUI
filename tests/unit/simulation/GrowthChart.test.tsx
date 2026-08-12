// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { GrowthChart } from '../../../src/simulation/ui/GrowthChart';
import { SimulationComparison } from '../../../src/simulation/ui/SimulationComparison';
import { formatWon } from '../../../src/simulation/ui/format';

let compactViewport = false;

const anime = vi.hoisted(() => {
  const scope = {
    add: vi.fn((callback: () => void) => callback()),
    revert: vi.fn(),
    matches: { reducedMotion: false },
  };

  return {
    animate: vi.fn((_target: unknown, _options: unknown) => ({ cancel: vi.fn() })),
    createScope: vi.fn(() => scope),
    scope,
  };
});

vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: anime.createScope,
}));

beforeEach(() => {
  anime.animate.mockImplementation((_target: unknown, _options: unknown) => ({ cancel: vi.fn() }));
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 767px)' && compactViewport,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  compactViewport = false;
  anime.scope.matches.reducedMotion = false;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  cleanup();
});

const result = projectCompoundGrowth(createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456));

describe('GrowthChart', () => {
  it('draws the first result through a restrained 260ms visual-only reveal', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);

    const semantic = container.querySelector<SVGPathElement>(
      '.growth-chart__semantic-path.growth-chart__current',
    );
    const visual = container.querySelector<SVGPathElement>(
      '.growth-chart__motion-path.growth-chart__current',
    );
    const revealClip = container.querySelector<SVGRectElement>('.growth-chart__reveal-clip');

    expect(semantic?.getAttribute('d')).toBeTruthy();
    expect(visual).toHaveAttribute('aria-hidden', 'true');
    expect(visual).toHaveAttribute('d', semantic?.getAttribute('d'));
    expect(revealClip).toHaveAttribute('width', '0');
    expect(anime.animate).toHaveBeenCalledWith(
      revealClip,
      expect.objectContaining({
        width: 620,
        duration: 260,
      }),
    );
  });

  it('preserves the first-result reveal through StrictMode effect replay', () => {
    render(
      <StrictMode>
        <GrowthChart result={result} amountMode="nominal" />
      </StrictMode>,
    );

    const revealCalls = anime.animate.mock.calls.filter(([target]) => (
      target instanceof Element && target.matches('.growth-chart__reveal-clip')
    ));
    expect(revealCalls).toHaveLength(2);
    expect(revealCalls.map(([, options]) => options)).toEqual([
      expect.objectContaining({ width: 620, duration: 260 }),
      expect.objectContaining({ width: 620, duration: 260 }),
    ]);
  });

  it('commits final semantic paths while the visual overlay interpolates from prior geometry', () => {
    const { container, rerender } = render(
      <GrowthChart result={result} amountMode="nominal" />,
    );
    const previousSemanticPaths = semanticPaths(container);
    anime.animate.mockClear();

    const updatedResult = projectCompoundGrowth(createDefaultSimulationDraft({
      monthlySavingsWon: 300_000,
      monthlyInvestmentWon: 200_000,
      mainUpdatedAt: 124,
    }, 457));
    rerender(<GrowthChart result={updatedResult} amountMode="real" />);

    const finalSemanticPaths = semanticPaths(container);
    const visualPaths = motionPaths(container);
    expect(finalSemanticPaths).not.toEqual(previousSemanticPaths);
    expect(visualPaths).toEqual(previousSemanticPaths);

    const transitionCall = anime.animate.mock.calls.find(([target]) => (
      typeof target === 'object' && target !== null && 'progress' in target
    ));
    expect(transitionCall).toBeDefined();
    const transitionState = transitionCall?.[0] as { progress: number };
    const transitionOptions = transitionCall?.[1] as {
      duration: number;
      onComplete(): void;
      onUpdate(): void;
      progress: number;
    };
    expect(transitionOptions).toEqual(expect.objectContaining({ progress: 1, duration: 260 }));

    transitionState.progress = 0.5;
    transitionOptions.onUpdate();
    expect(motionPaths(container)).not.toEqual(previousSemanticPaths);
    expect(motionPaths(container)).not.toEqual(finalSemanticPaths);

    transitionOptions.onComplete();
    expect(motionPaths(container)).toEqual(finalSemanticPaths);
  });

  it('does not restart graph motion for tooltip-only active year changes', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const visualPaths = motionPaths(container);
    anime.animate.mockClear();
    anime.createScope.mockClear();

    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });
    fireEvent.keyDown(explorer, { key: 'Home' });
    fireEvent.keyDown(explorer, { key: 'ArrowRight' });

    expect(screen.getByRole('status')).toHaveTextContent('1년');
    expect(motionPaths(container)).toEqual(visualPaths);
    expect(anime.createScope).not.toHaveBeenCalled();
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('does not restart graph motion when an unrelated parent render recreates the result', () => {
    const { rerender } = render(<GrowthChart result={result} amountMode="nominal" />);
    anime.animate.mockClear();
    anime.createScope.mockClear();

    rerender(<GrowthChart
      result={{ ...result, points: [...result.points] }}
      amountMode="nominal"
    />);

    expect(anime.createScope).not.toHaveBeenCalled();
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('continues an interrupted graph transition from the currently displayed paths', () => {
    const { container, rerender } = render(
      <GrowthChart result={result} amountMode="nominal" />,
    );
    const firstUpdate = projectCompoundGrowth({
      ...createDefaultSimulationDraft({
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 126,
      }, 459),
      years: 30,
      expectedAnnualReturnPercent: 12,
    });
    anime.animate.mockClear();
    rerender(<GrowthChart result={firstUpdate} amountMode="nominal" />);
    const firstTransition = graphTransitionCall();
    firstTransition.state.progress = 0.4;
    firstTransition.options.onUpdate();
    const interruptedPaths = motionPaths(container);

    const latestUpdate = projectCompoundGrowth({
      ...createDefaultSimulationDraft({
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 127,
      }, 460),
      years: 25,
      expectedAnnualReturnPercent: 5,
    });
    anime.animate.mockClear();
    rerender(<GrowthChart result={latestUpdate} amountMode="nominal" />);

    expect(motionPaths(container)).toEqual(interruptedPaths);
    expect(graphTransitionCall().options).toEqual(expect.objectContaining({
      progress: 1,
      duration: 260,
    }));
  });

  it('keeps the full prior curve shape at the start of a shorter-duration transition', () => {
    const longResult = projectCompoundGrowth({
      ...createDefaultSimulationDraft({
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 128,
      }, 461),
      years: 30,
    });
    const shortResult = projectCompoundGrowth({
      ...createDefaultSimulationDraft({
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 129,
      }, 462),
      years: 10,
    });
    const { container, rerender } = render(
      <GrowthChart result={longResult} amountMode="nominal" />,
    );
    const priorPaths = semanticPaths(container);

    rerender(<GrowthChart result={shortResult} amountMode="nominal" />);

    expect(motionPaths(container)).toEqual(priorPaths);
  });

  it('renders final graph geometry immediately without an intermediate path for reduced motion', () => {
    anime.scope.matches.reducedMotion = true;
    const { container, rerender } = render(
      <GrowthChart result={result} amountMode="nominal" />,
    );

    expect(motionPaths(container)).toEqual(semanticPaths(container));
    expect(container.querySelector('.growth-chart__reveal-clip')).toHaveAttribute('width', '620');
    expect(anime.animate).not.toHaveBeenCalled();

    const updatedResult = projectCompoundGrowth({
      ...createDefaultSimulationDraft({
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 125,
      }, 458),
      years: 30,
      expectedAnnualReturnPercent: 7,
    });
    rerender(<GrowthChart result={updatedResult} amountMode="real" />);

    expect(motionPaths(container)).toEqual(semanticPaths(container));
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('defaults to detailed mode when matchMedia is unavailable', () => {
    vi.unstubAllGlobals();
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('누적 납입원금')).toBeVisible();
  });

  it('names both series and exposes yearly detail by keyboard focus', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    expect(screen.getByText('현재 계획')).toBeVisible();
    expect(screen.getByText('전부 저축')).toBeVisible();

    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });
    explorer.focus();
    fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    fireEvent.keyDown(explorer, { key: 'End' });
    fireEvent.keyDown(explorer, { key: 'ArrowLeft' });
    expect(screen.queryByRole('slider', { name: '그래프 연도 상세' })).not.toBeInTheDocument();
    expect(screen.getByText('19년')).toBeVisible();
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
  });

  it('consumes Home and End while selecting their existing boundary years', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });

    expect(fireEvent.keyDown(explorer, { key: 'Home' })).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('0년');
    expect(fireEvent.keyDown(explorer, { key: 'End' })).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('20년');
  });

  it('dismisses detail with Escape or an outside pointer', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });
    fireEvent.keyDown(explorer, { key: 'Home' });
    fireEvent.keyDown(explorer, { key: 'Escape' });
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();

    fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();
  });

  it('shows only two comparison totals in compact mode without a close button', () => {
    compactViewport = true;
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('전부 저축 총액')).toBeVisible();
    expect(screen.queryByText('누적 납입원금')).not.toBeInTheDocument();
    expect(screen.queryByText('저축 잔액')).not.toBeInTheDocument();
    expect(screen.queryByText('투자 잔액')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('keeps detailed desktop values but removes the close button', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /0년, 현재 계획 총액 .* 전부 저축 총액/,
    );
  });

  it('drags through touch years, keeps release selection, and closes on scroll', () => {
    compactViewport = true;
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 680 }),
    });
    Object.defineProperty(chart, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(chart, 'releasePointerCapture', { value: vi.fn() });

    fireEvent(chart, pointerEvent('pointerdown', 36));
    fireEvent(chart, pointerEvent('pointermove', 656));
    fireEvent(chart, pointerEvent('pointerup', 656));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('20년');

    fireEvent.scroll(window);
    expect(container.querySelector('.growth-chart__tooltip')).not.toBeInTheDocument();
  });

  it('maps the first and last plotted x positions to their exact years', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 340 }),
    });

    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 100 + 36 / 680 * 340,
    }));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('0년');
    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 100 + 656 / 680 * 340,
    }));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('20년');
  });

  it('shows real component balances consistently in real mode', () => {
    render(<GrowthChart result={result} amountMode="real" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'End',
    });
    const final = result.points.at(-1)!;
    expect(screen.getByText('저축 잔액').nextElementSibling).toHaveTextContent(
      formatWon(final.savingsRealWon),
    );
  });

  it('follows pointer with a guide, markers, and six-value card', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 680 }),
    });

    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 340 }));
    expect(container.querySelector('.growth-chart__guide')).toBeInTheDocument();
    expect(container.querySelectorAll('.growth-chart__marker')).toHaveLength(2);
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('전부 저축 총액')).toBeVisible();
    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
  });

  it('summarizes the selected basis and final values for assistive technology', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    expect(screen.getByText(/명목 기준 20년/)).toHaveClass('sr-only');
    expect(screen.getByText(new RegExp(formatWon(result.finalCurrentPlanWon)))).toBeVisible();
  });
});

describe('SimulationComparison', () => {
  it('keeps final comparison text semantic while both visual values interpolate', () => {
    const { container, rerender } = render(<SimulationComparison result={result} />);
    const initialVisualValues = comparisonVisualValues(container);
    anime.animate.mockClear();

    const updated = {
      ...result,
      advantageOverAllSavingsWon: 123_456_000,
      principalRatioPercent: 187.6,
    };
    rerender(<SimulationComparison result={updated} />);

    expect(comparisonSemanticValues(container)).toEqual([
      formatWon(123_456_000),
      '188%',
    ]);
    expect(comparisonVisualValues(container)).toEqual(initialVisualValues);
    expect(anime.animate).toHaveBeenCalledTimes(2);
    expect(anime.animate.mock.calls.map(([, options]) => options)).toEqual([
      expect.objectContaining({ value: 123_456_000, duration: 180 }),
      expect.objectContaining({ value: 187.6, duration: 180 }),
    ]);
  });

  it('keeps final comparison values visible when Anime cannot create an animation', () => {
    const { container, rerender } = render(<SimulationComparison result={result} />);
    anime.animate.mockImplementation(() => {
      throw new Error('animation unavailable');
    });
    const updated = {
      ...result,
      advantageOverAllSavingsWon: 98_765_000,
      principalRatioPercent: 165.2,
    };

    expect(() => rerender(<SimulationComparison result={updated} />)).not.toThrow();

    expect(comparisonVisualValues(container)).toEqual(comparisonSemanticValues(container));
  });
});

function graphTransitionCall(): {
  state: { progress: number };
  options: { duration: number; onComplete(): void; onUpdate(): void; progress: number };
} {
  const call = anime.animate.mock.calls.find(([target]) => (
    typeof target === 'object' && target !== null && 'progress' in target
  ));
  if (call === undefined) throw new Error('graph transition animation was not created');
  return {
    state: call[0] as { progress: number },
    options: call[1] as {
      duration: number;
      onComplete(): void;
      onUpdate(): void;
      progress: number;
    },
  };
}

function semanticPaths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<SVGPathElement>('.growth-chart__semantic-path')]
    .map((path) => path.getAttribute('d') ?? '');
}

function motionPaths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<SVGPathElement>('.growth-chart__motion-path')]
    .map((path) => path.getAttribute('d') ?? '');
}

function comparisonSemanticValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.simulation-comparison__semantic-value')]
    .map((element) => element.textContent ?? '');
}

function comparisonVisualValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.simulation-comparison__visual-value')]
    .map((element) => element.textContent ?? '');
}

function pointerEvent(type: string, clientX: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, clientX });
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: 'touch' },
  });
  return event;
}
