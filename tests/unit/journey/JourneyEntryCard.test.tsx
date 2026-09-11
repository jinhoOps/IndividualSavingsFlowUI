import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JourneyEntryCard } from '../../../src/journey/ui/JourneyEntryCard';
let now = 1000;
beforeEach(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1600 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const bottom = () => Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
describe('JourneyEntryCard', () => {
  it('omits entry before a plan exists', () => {
    render(<JourneyEntryCard enabled={false} onContinue={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('reveals on keyboard focus, and only navigates on activation', () => {
    const onContinue = vi.fn();
    const { container } = render(<JourneyEntryCard enabled onContinue={onContinue} />);
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'false');
    const button = screen.getByRole('button', { name: '미래 성장 보기' });
    fireEvent.focus(button);
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'true');
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });
  it('does not reveal on the gesture arriving at the bottom; requires a further gesture', () => {
    const { container } = render(<JourneyEntryCard enabled onContinue={vi.fn()} />);
    fireEvent.wheel(window, { deltaY: 200 });
    bottom(); now += 20;
    fireEvent.wheel(window, { deltaY: 200 });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'false');
    now += 300;
    fireEvent.wheel(window, { deltaY: 70 });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'true');
  });
  it('ignores upward scroll, small movement and scrolling in an open editor', () => {
    bottom();
    const { container } = render(<div data-exploration-blocked="true"><JourneyEntryCard enabled onContinue={vi.fn()} /></div>);
    fireEvent.wheel(window, { deltaY: 200 });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'false');
    container.firstElementChild!.removeAttribute('data-exploration-blocked');
    now += 300;
    fireEvent.wheel(window, { deltaY: -200 });
    now += 300;
    fireEvent.wheel(window, { deltaY: 20 });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'false');
  });
  it('reveals only from a new upward swipe beginning at the page end', () => {
    const { container } = render(<JourneyEntryCard enabled onContinue={vi.fn()} />);
    fireEvent.touchStart(window, { touches: [{ clientY: 700 }] });
    bottom();
    fireEvent.touchMove(window, { touches: [{ clientY: 500 }] });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'false');
    fireEvent.touchEnd(window);
    fireEvent.touchStart(window, { touches: [{ clientY: 700 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 630 }] });
    expect(container.querySelector('section')).toHaveAttribute('data-revealed', 'true');
  });
});
