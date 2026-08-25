import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PercentageTooltip } from '../../../src/main/ui/common/PercentageTooltip';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PercentageTooltip', () => {
  it('keeps its full accessible value and visual-target positioning contract', () => {
    render(
      <PercentageTooltip
        id="tip"
        open
        value="소비 · 180만 원 · 56.3%"
        position={{ xPercent: 42 }}
      />,
    );

    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'tip');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '42%' });
  });

  it('uses its contained fallback alignment without changing the tooltip semantics', () => {
    render(
      <PercentageTooltip
        id="tip"
        open
        value="저축 · 100만 원 · 100.0%"
        position={{ alignment: 'end-contained', xPercent: 100 }}
      />,
    );

    expect(screen.getByRole('tooltip')).toHaveClass('flow-tooltip--end-contained');
    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'tip');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^저축 · 100만 원 · 100\.0%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ insetInlineEnd: '0' });
  });

  it('re-measures final stage bounds after resize layout has stabilized', () => {
    let finalLayout = false;
    let nextFrameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const frameId = ++nextFrameId;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (frameId: number) => {
      frames.delete(frameId);
    });
    const originalBounds = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tooltip') {
        return rect(finalLayout ? 289.375 : 529, finalLayout ? 431.46875 : 671.09375);
      }
      if (this.contains(screen.queryByRole('tooltip'))) {
        return rect(finalLayout ? 29 : 0, finalLayout ? 361 : 1200);
      }
      return originalBounds.call(this);
    });

    render(
      <PercentageTooltip
        id="tip"
        open
        value="소비 · 100만 원 · 100.0%"
        position={{ xPercent: 100 }}
      />,
    );

    act(() => {
      window.dispatchEvent(new Event('resize'));
      const pendingFrames = [...frames.values()];
      frames.clear();
      pendingFrames.forEach((callback) => callback(performance.now()));
      finalLayout = true;
      const settledFrames = [...frames.values()];
      frames.clear();
      settledFrames.forEach((callback) => callback(performance.now()));
    });

    expect(screen.getByRole('tooltip')).toHaveStyle({
      transform: 'translateX(calc(-50% + -70.46875px))',
    });
  });
});

function rect(left: number, right: number): DOMRect {
  return {
    bottom: 24,
    height: 24,
    left,
    right,
    top: 0,
    width: right - left,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}
