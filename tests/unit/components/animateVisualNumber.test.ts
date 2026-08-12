import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import {
  animateVisualNumber,
  commitVisualNumber,
} from '../../../src/components/motion/animateVisualNumber';

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

  it('commits the requested final value when interrupt cancellation fails', () => {
    const cancel = vi.fn(() => {
      throw new Error('cancel failed');
    });
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');

    animateVisualNumber(element, 10, 20, String);
    const firstTarget = anime.animate.mock.calls[0][0] as { value: number };
    const firstOptions = anime.animate.mock.calls[0][1] as { onUpdate(): void };

    expect(() => animateVisualNumber(element, 20, 30, String)).not.toThrow();
    expect(element).toHaveTextContent('30');

    firstTarget.value = 15;
    firstOptions.onUpdate();
    expect(element).toHaveTextContent('30');

    anime.animate.mockClear();
    animateVisualNumber(element, 30, 40, String);
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 30 }),
      expect.objectContaining({ value: 40 }),
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

  it('cancels an interrupted animation once when reduced motion commits its final value', () => {
    const cancel = vi.fn();
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');
    animateVisualNumber(element, 10, 20, String);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    animateVisualNumber(element, 20, 30, String);

    expect(cancel).toHaveBeenCalledOnce();
    expect(element).toHaveTextContent('30');
  });

  it('commits the reduced-motion final value when interrupt cancellation fails', () => {
    const cancel = vi.fn(() => {
      throw new Error('cancel failed');
    });
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');
    animateVisualNumber(element, 10, 20, String);
    const firstTarget = anime.animate.mock.calls[0][0] as { value: number };
    const firstOptions = anime.animate.mock.calls[0][1] as { onUpdate(): void };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    expect(() => animateVisualNumber(element, 20, 30, String)).not.toThrow();
    expect(element).toHaveTextContent('30');

    firstTarget.value = 15;
    firstOptions.onUpdate();
    expect(element).toHaveTextContent('30');
  });

  it('returns cleanup that cancels an active visual-number animation', () => {
    const cancel = vi.fn();
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');

    const cleanupAnimation = animateVisualNumber(element, 10, 20, String);
    cleanupAnimation();

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('keeps cleanup non-throwing when active animation cancellation fails', () => {
    const cancel = vi.fn(() => {
      throw new Error('cancel failed');
    });
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');
    const cleanupAnimation = animateVisualNumber(element, 10, 20, String);
    const firstTarget = anime.animate.mock.calls[0][0] as { value: number };
    const firstOptions = anime.animate.mock.calls[0][1] as { onUpdate(): void };

    expect(cleanupAnimation).not.toThrow();
    firstTarget.value = 15;
    firstOptions.onUpdate();
    expect(element).toHaveTextContent('20');

    expect(() => animateVisualNumber(element, 20, 30, String)).not.toThrow();
    expect(element).toHaveTextContent('30');
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

  it('synchronously commits a final value and resets interrupted continuity', () => {
    const cancel = vi.fn();
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');
    animateVisualNumber(element, 10, 20, String);
    const state = anime.animate.mock.calls[0][0] as { value: number };
    const options = anime.animate.mock.calls[0][1] as { onUpdate(): void };
    state.value = 15;
    options.onUpdate();

    commitVisualNumber(element, 20, String);

    expect(cancel).toHaveBeenCalledOnce();
    expect(element).toHaveTextContent('20');
    anime.animate.mockClear();
    animateVisualNumber(element, 20, 30, String);
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 20 }),
      expect.objectContaining({ value: 30 }),
    );
  });

  it('synchronously commits a final value when cancellation fails', () => {
    const cancel = vi.fn(() => {
      throw new Error('cancel failed');
    });
    anime.animate.mockReturnValueOnce({ cancel });
    const element = document.createElement('span');
    animateVisualNumber(element, 10, 20, String);
    const firstTarget = anime.animate.mock.calls[0][0] as { value: number };
    const firstOptions = anime.animate.mock.calls[0][1] as { onUpdate(): void };

    expect(() => commitVisualNumber(element, 30, String)).not.toThrow();
    expect(element).toHaveTextContent('30');

    firstTarget.value = 15;
    firstOptions.onUpdate();
    expect(element).toHaveTextContent('30');

    anime.animate.mockClear();
    animateVisualNumber(element, 30, 40, String);
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 30 }),
      expect.objectContaining({ value: 40 }),
    );
  });
});
