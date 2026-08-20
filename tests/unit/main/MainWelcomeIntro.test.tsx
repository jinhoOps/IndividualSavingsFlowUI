import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../src/main/ui/main.css';
import { MOTION_DURATION, MOTION_EASE } from '../../../src/components/motion/tokens';
import { MainWelcomeIntro } from '../../../src/main/ui/MainWelcomeIntro';

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

describe('MainWelcomeIntro', () => {
  it('exposes an labelled introduction while keeping the brand graphic decorative', () => {
    render(<MainWelcomeIntro onComplete={vi.fn()} />);

    const section = screen.getByRole('region', { name: '나의 가계 흐름 시작 화면' });
    expect(screen.getByTestId('main-welcome-intro')).toBe(section);
    expect(screen.getByRole('heading', { name: '나의 가계 흐름 시작 화면' })).toHaveClass('sr-only');
    expect(section).toHaveAttribute('aria-describedby');
    expect(screen.getByText('잠시 후 설정 화면으로 이동합니다. 화면을 누르거나 건너뛰기 버튼을 선택할 수 있습니다.')).toHaveClass('sr-only');
    expect(screen.getByText('나의 가계 흐름')).toBeVisible();
    expect(section.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('places the minor app-name label after the brand icon', () => {
    render(<MainWelcomeIntro onComplete={vi.fn()} />);

    const icon = document.querySelector('.main-welcome-intro__visual');
    const appName = screen.getByText('나의 가계 흐름');

    expect(icon).not.toBeNull();
    expect(icon!.compareDocumentPosition(appName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('focuses the one 44px skip button', () => {
    render(<MainWelcomeIntro onComplete={vi.fn()} />);

    const button = screen.getByRole('button', { name: '화면을 눌러 건너뛰기' }) as HTMLButtonElement;
    expect(button).toHaveFocus();
    expect(button.getBoundingClientRect().height || Number.parseFloat(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(44);
    const styles = getComputedStyle(button);
    expect(styles.minHeight).toBe('44px');
    expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(styles.borderTopWidth).toBe('0px');
    expect(styles.borderRadius).toBe('0px');
    expect(styles.textAlign).toBe('center');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it.each([
    ['background pointer', (section: HTMLElement, _button: HTMLButtonElement) => fireEvent.pointerDown(section)],
    ['button click', (_section: HTMLElement, button: HTMLButtonElement) => fireEvent.click(button)],
    ['Enter', (_section: HTMLElement, button: HTMLButtonElement) => fireEvent.keyDown(button, { key: 'Enter' })],
    ['Space', (_section: HTMLElement, button: HTMLButtonElement) => fireEvent.keyDown(button, { key: ' ' })],
    ['Escape', (_section: HTMLElement, button: HTMLButtonElement) => fireEvent.keyDown(button, { key: 'Escape' })],
  ])('completes once from %s', (_label, interact) => {
    const onComplete = vi.fn();
    render(<MainWelcomeIntro onComplete={onComplete} />);
    const section = screen.getByRole('region', { name: '나의 가계 흐름 시작 화면' });
    const button = screen.getByRole('button', { name: '화면을 눌러 건너뛰기' }) as HTMLButtonElement;

    interact(section, button);
    fireEvent.click(button);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reverts the active Anime scope immediately after a pointer skip without parent unmount', () => {
    const onComplete = vi.fn();
    render(<MainWelcomeIntro onComplete={onComplete} />);
    const section = screen.getByRole('region', { name: '나의 가계 흐름 시작 화면' });
    const button = screen.getByRole('button', { name: '화면을 눌러 건너뛰기' });

    fireEvent.pointerDown(section);
    fireEvent.click(button);

    expect(animeMocks.scope.revert).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the screen noninteractive except for its explicit button', () => {
    render(<MainWelcomeIntro onComplete={vi.fn()} />);
    const section = screen.getByRole('region', { name: '나의 가계 흐름 시작 화면' });

    expect(section).not.toHaveAttribute('role');
    expect(section).not.toHaveAttribute('tabindex');
  });

  it('animates the brand in the required timeline order within the completion budget', () => {
    render(<MainWelcomeIntro onComplete={vi.fn()} />);

    expect(animeMocks.createTimeline).toHaveBeenCalledWith({
      defaults: { ease: MOTION_EASE.enter },
      onComplete: expect.any(Function),
    });
    expect(animeMocks.timeline.add.mock.calls).toHaveLength(5);
    const [background, backgroundOptions] = animeMocks.timeline.add.mock.calls[0]!;
    const [bars, barsOptions, barsPosition] = animeMocks.timeline.add.mock.calls[1]!;
    const [trend, trendOptions, trendPosition] = animeMocks.timeline.add.mock.calls[2]!;
    const [dot, dotOptions, dotPosition] = animeMocks.timeline.add.mock.calls[3]!;
    const [, holdOptions] = animeMocks.timeline.add.mock.calls[4]!;

    expect(background).toHaveAttribute('data-brand-background');
    expect(backgroundOptions).toMatchObject({ opacity: [0, 1], duration: 180 });
    expect(bars).toHaveLength(4);
    expect(barsOptions).toMatchObject({ scaleY: [0, 1], duration: 420, delay: 70 });
    expect(barsPosition).toBe('<');
    expect(trend).toHaveAttribute('data-brand-trend');
    expect(trendOptions).toMatchObject({ strokeDashoffset: [expect.any(Number), 0], duration: 560 });
    expect(trendPosition).toBe('+=40');
    expect(dot).toHaveAttribute('data-brand-terminal-dot');
    expect(dotOptions).toMatchObject({ opacity: [0, 1], scale: [0.72, 1], duration: MOTION_DURATION.normal });
    expect(dotPosition).toBe('<+=360');
    expect(holdOptions).toEqual({ duration: 260 });
    expect(180 + 420 + 560 + MOTION_DURATION.normal + 260).toBeLessThanOrEqual(2200);
  });

  it('settles and completes when Anime scope or timeline setup fails', () => {
    animeMocks.createTimeline.mockImplementationOnce(() => {
      throw new Error('timeline unavailable');
    });
    const onComplete = vi.fn();
    render(<MainWelcomeIntro onComplete={onComplete} />);

    const section = screen.getByRole('region', { name: '나의 가계 흐름 시작 화면' });
    expect(section.querySelector<HTMLElement>('[data-brand-background]')).toHaveStyle({ opacity: '1' });
    expect(section.querySelector<HTMLElement>('[data-brand-terminal-dot]')).toHaveStyle({ opacity: '1', transform: 'scale(1)' });
    fireEvent.click(screen.getByRole('button', { name: '화면을 눌러 건너뛰기' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reverts the scope and prevents late completion after unmount or an early skip', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<MainWelcomeIntro onComplete={onComplete} />);
    const onTimelineComplete = animeMocks.createTimeline.mock.calls[0]![0].onComplete!;

    unmount();
    onTimelineComplete();
    vi.runAllTimers();

    expect(animeMocks.scope.revert).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
