import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../src/components/motion/tokens';
import { ReadinessApp } from '../../../src/journey/ui/ReadinessApp';

const animeMocks = vi.hoisted(() => {
  const state = { reducedMotion: false };
  return {
    animate: vi.fn((target: unknown, options: Record<string, unknown>) => {
      applyFinalAnimationStyles(target, options);
      return { cancel: vi.fn() };
    }),
    createScope: vi.fn(() => ({
      add: (setup: () => void) => setup(),
      matches: { reducedMotion: state.reducedMotion },
      revert: vi.fn(),
    })),
    state,
  };
});

function applyFinalAnimationStyles(target: unknown, options: Record<string, unknown>): void {
  if (!(target instanceof HTMLElement)) return;
  if (Array.isArray(options.opacity)) target.style.opacity = String(options.opacity.at(-1));
  if (Array.isArray(options.y)) target.style.transform = `translateY(${String(options.y.at(-1))}px)`;
}

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  animeMocks.state.reducedMotion = false;
});

describe('ReadinessApp', () => {
  it('shows only Account Map readiness and Main recovery', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    render(<ReadinessApp />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
    expect(screen.getByText('Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main으로 이동' }))
      .toHaveAttribute('href', expect.stringContaining('/apps/main/'));
    expect(screen.queryByText(/연결되었습니다|월 투자 가능액|Portfolio로 이어가기/))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText('아직 관리할 설정이 없습니다')).toBeVisible();
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: '앱 아이콘 안내' })).toBeVisible();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('reveals readiness once per mount with normal motion', () => {
    const { rerender } = render(<ReadinessApp />);
    const content = screen.getByRole('heading', { name: 'Account Map 준비 중' })
      .closest<HTMLElement>('[data-readiness-motion]');
    expect(content).not.toBeNull();
    expect(animationOptionsFor(content!)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });
    const revealCount = animationCountFor(content!);

    rerender(<ReadinessApp />);
    expect(animationCountFor(content!)).toBe(revealCount);
  });

  it('recreates the single visible reveal after Strict Mode cancels its pre-paint setup', () => {
    const { rerender } = render(
      <StrictMode>
        <ReadinessApp />
      </StrictMode>,
    );
    const content = screen.getByRole('heading', { name: 'Account Map 준비 중' })
      .closest<HTMLElement>('[data-readiness-motion]');

    expect(animationCountFor(content!)).toBe(2);
    rerender(
      <StrictMode>
        <ReadinessApp />
      </StrictMode>,
    );
    expect(animationCountFor(content!)).toBe(2);
  });

  it('commits the readiness final state before paint under reduced motion', () => {
    animeMocks.state.reducedMotion = true;
    render(<ReadinessApp />);
    const content = screen.getByRole('heading', { name: 'Account Map 준비 중' })
      .closest<HTMLElement>('[data-readiness-motion]');

    expect(content).toHaveStyle({ opacity: '1', transform: 'translateY(0px)' });
    expect(animationCountFor(content!)).toBe(0);
  });
});

function animationOptionsFor(target: Element): Record<string, unknown> | undefined {
  return animeMocks.animate.mock.calls.find(([candidate]) => candidate === target)?.[1] as
    | Record<string, unknown>
    | undefined;
}

function animationCountFor(target: Element): number {
  return animeMocks.animate.mock.calls.filter(([candidate]) => candidate === target).length;
}
