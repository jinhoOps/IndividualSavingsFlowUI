import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from '../../../src/components/motion/useReducedMotion';

interface MatchMediaStub {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emit(matches: boolean): void;
}

function createMatchMediaStub(initialMatches: boolean): MatchMediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    emit(matches: boolean) {
      this.matches = matches;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useReducedMotion', () => {
  it('uses the initial preference and observes later changes', () => {
    const mediaQuery = createMatchMediaStub(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    act(() => mediaQuery.emit(true));
    expect(result.current).toBe(true);
  });

  it('removes the exact change listener on cleanup', () => {
    const mediaQuery = createMatchMediaStub(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    const { unmount } = renderHook(() => useReducedMotion());
    const listener = mediaQuery.addEventListener.mock.calls[0]?.[1];
    unmount();

    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', listener);
  });

  it('conservatively reduces motion when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });
});
