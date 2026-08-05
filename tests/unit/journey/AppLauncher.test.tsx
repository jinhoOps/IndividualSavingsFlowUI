import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JourneyApp } from '../../../src/journey/routes';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AppLauncher', () => {
  it.each([
    ['main', '자금 흐름 (Main)'],
    ['simulation', '미래 성장 (Simulation)'],
    ['portfolio', '투자 배분 (Portfolio)'],
    ['account-map', '계좌 연결 (Account Map)'],
  ] satisfies ReadonlyArray<[JourneyApp, string]>)(
    'renders icon navigation and marks %s as the current location',
    (currentApp, currentLabel) => {
      const { container } = render(<AppLauncher currentApp={currentApp} />);

      expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
      const currentLink = screen.getByRole('link', {
        name: new RegExp(`${escapeRegExp(currentLabel)}.*현재 위치`),
      });
      expect(currentLink).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: /계좌 연결 \(Account Map\).*준비 중/ })).toBeVisible();
      expect(screen.queryByText('사용 중')).not.toBeInTheDocument();
      expect(container.querySelector('details, summary')).toBeNull();
      expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4);
    },
  );

  it('shows equivalent pointer, focus and narrow-help labels', () => {
    render(<><AppLauncher currentApp="portfolio" /><button type="button">바깥 행동</button></>);
    const main = screen.getByRole('link', { name: /자금 흐름 \(Main\)/ });

    fireEvent.mouseEnter(main);
    expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');
    fireEvent.keyDown(main, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(main);
    expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');

    const help = screen.getByRole('button', { name: '앱 아이콘 도움말' });
    expect(help).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(help);
    fireEvent.click(help);
    expect(help).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: '앱 아이콘 안내' });
    expect(panel).toHaveTextContent('자금 흐름 (Main)');
    expect(panel).toHaveTextContent('계좌 연결 (Account Map)');
    expect(panel).toHaveTextContent('준비 중');

    fireEvent.blur(help, { relatedTarget: screen.getByRole('button', { name: '바깥 행동' }) });
    expect(screen.queryByRole('region', { name: '앱 아이콘 안내' })).not.toBeInTheDocument();
    fireEvent.click(help);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: '앱 아이콘 안내' })).not.toBeInTheDocument();
  });

  it('keeps a pointer tooltip briefly available while moving across its boundary', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="portfolio" />);
    const main = screen.getByRole('link', { name: /자금 흐름 \(Main\)/ });

    fireEvent.mouseEnter(main);
    fireEvent.mouseLeave(main);
    act(() => vi.advanceTimersByTime(79));
    expect(screen.getByRole('tooltip')).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens a touch tooltip after 450ms and suppresses its click and context menu once', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" />);
    const link = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });

    fireTouchPointerEvent(link, 'pointerdown');
    act(() => vi.advanceTimersByTime(449));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('tooltip')).toHaveTextContent('미래 성장 (Simulation)');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(link.dispatchEvent(click)).toBe(false);
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    expect(link.dispatchEvent(contextMenu)).toBe(false);
    const ordinaryContextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    expect(link.dispatchEvent(ordinaryContextMenu)).toBe(true);
  });

  it('limits long-press suppression to its link and expires unused suppression', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" />);
    const simulation = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });
    const portfolio = screen.getByRole('link', { name: /투자 배분 \(Portfolio\)/ });

    fireTouchPointerEvent(simulation, 'pointerdown', 1);
    act(() => vi.advanceTimersByTime(450));
    expect(dispatchObservedClick(portfolio)).toBe(false);

    fireTouchPointerEvent(simulation, 'pointerup', 1);
    fireTouchPointerEvent(simulation, 'pointerdown', 2);
    fireTouchPointerEvent(simulation, 'pointerup', 2);
    expect(dispatchObservedClick(simulation)).toBe(false);

    fireTouchPointerEvent(simulation, 'pointerdown', 3);
    act(() => vi.advanceTimersByTime(450));
    fireTouchPointerEvent(simulation, 'pointerup', 3);
    act(() => vi.advanceTimersByTime(1_500));
    expect(dispatchObservedClick(simulation)).toBe(false);
  });

  it('cancels long press when another touch joins and preserves a short tap', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" />);
    const link = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });

    fireTouchPointerEvent(link, 'pointerdown', 1);
    fireTouchPointerEvent(link, 'pointerdown', 2);
    act(() => vi.advanceTimersByTime(450));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireTouchPointerEvent(link, 'pointerdown', 3);
    act(() => vi.advanceTimersByTime(450));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireTouchPointerEvent(link, 'pointerup', 1);
    fireTouchPointerEvent(link, 'pointerup', 2);
    fireTouchPointerEvent(link, 'pointerup', 3);

    fireTouchPointerEvent(link, 'pointerdown', 4);
    fireTouchPointerEvent(link, 'pointerup', 4);
    expect(dispatchObservedClick(link)).toBe(false);
  });

  it.each(['pointerUp', 'pointerMove', 'pointerCancel'] as const)(
    'cancels touch explanation on %s before the threshold',
    (eventName) => {
      vi.useFakeTimers();
      render(<AppLauncher currentApp="main" />);
      const link = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });
      fireTouchPointerEvent(link, 'pointerdown');
      fireTouchPointerEvent(link, eventName.toLowerCase());
      act(() => vi.advanceTimersByTime(450));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    },
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fireTouchPointerEvent(element: Element, type: string, pointerId = 1): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
  });
  fireEvent(element, event);
}

function dispatchObservedClick(element: Element): boolean {
  let preventedByLauncher = false;
  document.addEventListener('click', (event) => {
    preventedByLauncher = event.defaultPrevented;
    event.preventDefault();
  }, { once: true });
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return preventedByLauncher;
}
