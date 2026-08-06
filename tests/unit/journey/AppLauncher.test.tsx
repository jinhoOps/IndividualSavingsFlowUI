import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JourneyApp } from '../../../src/journey/routes';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it('separates app navigation from the management tool', () => {
    render(
      <AppLauncher currentApp="main" managementMenu={<button type="button">관리 메뉴</button>} />,
    );

    const navigation = screen.getByRole('navigation', { name: 'ISF 앱' });
    const tools = screen.getByRole('group', { name: '앱 도구' });
    const management = screen.getByRole('button', { name: '관리 메뉴' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(4);
    expect(within(navigation).queryByRole('button', { name: '관리 메뉴' })).not.toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: '관리 메뉴' })).toBe(management);
    expect(screen.queryByRole('button', { name: '앱 아이콘 도움말' })).not.toBeInTheDocument();
  });

  it('shows equivalent pointer and focus labels', () => {
    render(<><AppLauncher currentApp="portfolio" /><button type="button">바깥 행동</button></>);
    const main = screen.getByRole('link', { name: /자금 흐름 \(Main\)/ });

    fireEvent.mouseEnter(main);
    expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');
    fireEvent.keyDown(main, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(main);
    expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');
  });

  it('keeps the current app direct and routes hidden apps through more', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('journey-launcher__navigation') ? 140 : 0;
    });
    class ImmediateResizeObserver {
      observe(target: Element) {
        this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
      constructor(private readonly callback: ResizeObserverCallback) {}
    }
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);

    render(
      <>
        <AppLauncher currentApp="portfolio" managementMenu={<button type="button">관리 메뉴</button>} />
        <button type="button">바깥 행동</button>
      </>,
    );

    const navigation = screen.getByRole('navigation', { name: 'ISF 앱' });
    expect(within(navigation).getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getAllByRole('link')).toHaveLength(2);
    const more = within(navigation).getByRole('button', { name: '앱 더보기' });
    fireEvent.click(more);
    const menu = screen.getByRole('region', { name: '추가 앱' });
    expect(within(menu).getAllByRole('link')).toHaveLength(2);
    expect(within(menu).getByRole('link', { name: /미래 성장 \(Simulation\)/ }))
      .toHaveAttribute('href', expect.stringContaining('/apps/simulation/'));
    expect(within(menu).getByRole('link', { name: /계좌 연결 \(Account Map\).*준비 중/ }))
      .toHaveAttribute('href', expect.stringContaining('/apps/account-map/'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '추가 앱' })).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(more).toHaveFocus();

    fireEvent.click(more);
    fireEvent.pointerDown(screen.getByRole('button', { name: '바깥 행동' }));
    expect(screen.queryByRole('region', { name: '추가 앱' })).not.toBeInTheDocument();
  });

  it('preserves app focus when a resize moves an overflow link into direct navigation', () => {
    let width = 140;
    let resize: ResizeObserverCallback = () => undefined;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('journey-launcher__navigation') ? width : 0;
    });
    class ControlledResizeObserver {
      observe(target: Element) {
        resize([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
      constructor(callback: ResizeObserverCallback) { resize = callback; }
    }
    vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
    render(<AppLauncher currentApp="account-map" />);

    fireEvent.click(screen.getByRole('button', { name: '앱 더보기' }));
    const hiddenSimulation = within(screen.getByRole('region', { name: '추가 앱' }))
      .getByRole('link', { name: /미래 성장 \(Simulation\)/ });
    hiddenSimulation.focus();
    width = 300;
    act(() => resize([], {} as ResizeObserver));

    expect(screen.queryByRole('button', { name: '앱 더보기' })).not.toBeInTheDocument();
    const directSimulation = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });
    expect(directSimulation).toHaveFocus();

    width = 140;
    act(() => resize([], {} as ResizeObserver));
    expect(screen.getByRole('button', { name: '앱 더보기' })).toHaveFocus();
  });

  it('closes an active app tooltip when entering management tools', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" managementMenu={<button type="button">관리 메뉴</button>} />);
    const simulation = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });
    fireTouchPointerEvent(simulation, 'pointerdown');
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByRole('tooltip')).toBeVisible();

    fireEvent.pointerDown(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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

  it('keeps the established long-press click suppressed when a second touch joins', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" />);
    const link = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });

    fireTouchPointerEvent(link, 'pointerdown', 1);
    act(() => vi.advanceTimersByTime(450));
    fireTouchPointerEvent(link, 'pointerdown', 2);
    expect(link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
  });

  it('clears stale touch suppression when a mouse gesture starts', () => {
    vi.useFakeTimers();
    render(<AppLauncher currentApp="main" />);
    const link = screen.getByRole('link', { name: /미래 성장 \(Simulation\)/ });

    fireTouchPointerEvent(link, 'pointerdown', 1);
    act(() => vi.advanceTimersByTime(450));
    fireTouchPointerEvent(link, 'pointerup', 1);
    const mouseDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperty(mouseDown, 'pointerType', { value: 'mouse' });
    fireEvent(link, mouseDown);
    expect(link.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))).toBe(true);
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
