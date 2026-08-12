import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { animateVisualNumber } from '../../../src/components/motion/animateVisualNumber';

const anime = vi.hoisted(() => ({
  animate: vi.fn(),
}));

vi.mock('animejs', () => ({ animate: anime.animate }));

describe('animateVisualNumber', () => {
  beforeEach(() => anime.animate.mockReset());

  afterEach(() => vi.unstubAllGlobals());

  it('starts an interrupted animation from the currently rendered value', () => {
    const element = document.createElement('span');
    const format = (value: number) => value.toFixed(0);

    animateVisualNumber(element, 0, 100, format);
    const firstTarget = anime.animate.mock.calls[0][0] as { value: number };
    const firstOptions = anime.animate.mock.calls[0][1] as { onUpdate(): void };
    firstTarget.value = 42;
    firstOptions.onUpdate();

    animateVisualNumber(element, 0, 200, format);

    expect(element).toHaveTextContent('42');
    expect(anime.animate).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 42 }),
      expect.objectContaining({ value: 200 }),
    );
  });

  it('immediately renders the final visual value when reduced motion is active', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const element = document.createElement('span');
    element.setAttribute('aria-hidden', 'true');

    animateVisualNumber(element, 10, 20, (value) => `₩${value}`);

    expect(element).toHaveTextContent('₩20');
    expect(element).toHaveAttribute('aria-hidden', 'true');
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('returns cleanup that cancels an active visual-number animation', () => {
    const cancel = vi.fn();
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');

    const cleanupAnimation = animateVisualNumber(element, 10, 20, String);
    cleanupAnimation();

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('commits the final value when animation creation fails and resumes from it', () => {
    anime.animate.mockImplementationOnce(() => {
      throw new Error('animation unavailable');
    });
    const element = document.createElement('span');

    expect(() => animateVisualNumber(element, 10, 20, String)).not.toThrow();
    expect(element).toHaveTextContent('20');

    animateVisualNumber(element, 20, 30, String);
    expect(anime.animate).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 20 }),
      expect.objectContaining({ value: 30 }),
    );
  });
});
