import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandVisual } from '../../../src/auth/BrandVisual';

const animeMocks = vi.hoisted(() => {
  const scope = {
    add: vi.fn((setup: () => void) => setup()),
    matches: { reducedMotion: false },
    revert: vi.fn(),
  };
  const timeline = {
    add: vi.fn().mockReturnThis(),
  };
  return {
    animate: vi.fn(),
    createScope: vi.fn(() => scope),
    createTimeline: vi.fn((_options: { onComplete?: () => void }) => timeline),
    scope,
    timeline,
  };
});

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
  createTimeline: animeMocks.createTimeline,
  stagger: vi.fn((interval: number) => interval),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  animeMocks.createScope.mockImplementation(() => animeMocks.scope);
  animeMocks.createTimeline.mockImplementation(() => animeMocks.timeline);
  animeMocks.scope.matches.reducedMotion = false;
  vi.useRealTimers();
});

describe('BrandVisual', () => {
  it('shows a welcome message without loading semantics', () => {
    render(<BrandVisual animate />);
    expect(screen.getByText('한 달 돈의 흐름을 한눈에.')).toHaveTextContent('한 달 돈의 흐름을 한눈에.');
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('main').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('runs once across rerenders and cancels motion immediately on unmount', () => {
    const view = render(<BrandVisual animate />);
    view.rerender(<BrandVisual animate />);
    expect(animeMocks.createTimeline).toHaveBeenCalledTimes(1);
    expect(animeMocks.createTimeline.mock.calls[0]![0].onComplete).toBeUndefined();
    view.unmount();
    expect(animeMocks.scope.revert).toHaveBeenCalledOnce();
  });
  it.each(['existing-session', 'reduced-motion', 'motion-failure'])('keeps a static complete logo for %s', mode => {
    animeMocks.scope.matches.reducedMotion = mode === 'reduced-motion';
    if (mode === 'motion-failure') animeMocks.createTimeline.mockImplementationOnce(() => {throw new Error('motion unavailable');});
    render(<BrandVisual animate={mode !== 'existing-session'} />);
    const root = screen.getByRole('main');
    expect(root.querySelector('[data-brand-terminal-dot]')).toHaveStyle({opacity: '1', transform: 'scale(1)'});
    expect(root.querySelector('[data-brand-trend]')).toHaveStyle({strokeDashoffset: '0'});
    expect(screen.getByText('한 달 돈의 흐름을 한눈에.')).toBeVisible();
    if (mode !== 'motion-failure') expect(animeMocks.createTimeline).not.toHaveBeenCalled();
  });
});
