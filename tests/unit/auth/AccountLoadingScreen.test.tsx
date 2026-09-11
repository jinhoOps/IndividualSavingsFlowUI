import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountLoadingScreen } from '../../../src/auth/AccountLoadingScreen';

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

describe('AccountLoadingScreen', () => {
  it('announces loading without an action that can bypass data validation', () => {
    render(<AccountLoadingScreen animate />);
    expect(screen.getByRole('status')).toHaveTextContent('계정의 계획을 불러오고 있어요.');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('main').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('runs once across rerenders and cancels motion immediately when data becomes ready', () => {
    const view = render(<AccountLoadingScreen animate />);
    view.rerender(<AccountLoadingScreen animate />);
    expect(animeMocks.createTimeline).toHaveBeenCalledTimes(1);
    expect(animeMocks.createTimeline.mock.calls[0]![0].onComplete).toBeUndefined();
    view.unmount();
    expect(animeMocks.scope.revert).toHaveBeenCalledOnce();
  });
  it.each(['existing-session', 'reduced-motion', 'motion-failure'])('keeps a static complete logo for %s', mode => {
    animeMocks.scope.matches.reducedMotion = mode === 'reduced-motion';
    if (mode === 'motion-failure') animeMocks.createTimeline.mockImplementationOnce(() => {throw new Error('motion unavailable');});
    render(<AccountLoadingScreen animate={mode !== 'existing-session'} />);
    const root = screen.getByRole('main');
    expect(root.querySelector('[data-brand-terminal-dot]')).toHaveStyle({opacity: '1', transform: 'scale(1)'});
    expect(root.querySelector('[data-brand-trend]')).toHaveStyle({strokeDashoffset: '0'});
    expect(screen.getByRole('status')).toBeVisible();
    if (mode !== 'motion-failure') expect(animeMocks.createTimeline).not.toHaveBeenCalled();
  });
});
