import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../../../src/components/common/Toast';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../src/components/motion/tokens';
import type { JourneyApp } from '../../../src/journey/routes';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';
import { ManagementConfirmationDialog } from '../../../src/journey/ui/ManagementConfirmationDialog';

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
  if (Array.isArray(options.x)) target.style.transform = `translateX(${String(options.x.at(-1))}px)`;
}

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  animeMocks.state.reducedMotion = false;
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
      expect(screen.getByRole('link', { name: /계좌 연결 \(Account Map\)/ })).toBeVisible();
      expect(screen.queryByText('준비 중')).not.toBeInTheDocument();
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
    expect(within(menu).getByRole('link', { name: /계좌 연결 \(Account Map\)/ }))
      .toHaveAttribute('href', expect.stringContaining('/apps/account-map/'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '추가 앱' })).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(more).toHaveFocus();

    fireEvent.click(more);
    fireEvent.pointerDown(screen.getByRole('button', { name: '바깥 행동' }));
    expect(screen.queryByRole('region', { name: '추가 앱' })).not.toBeInTheDocument();
  });

  it('reveals the current line and overflow with fast shared motion while state closes immediately', () => {
    stubLauncherWidth(140);
    const { container } = render(<AppLauncher currentApp="portfolio" />);

    const currentLine = container.querySelector<HTMLElement>(
      '[aria-current="page"] .journey-launcher__current-line',
    );
    expect(currentLine).not.toBeNull();
    expect(animationOptionsFor(currentLine!)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.subtle, 0],
      duration: MOTION_DURATION.fast,
      ease: MOTION_EASE.enter,
    });

    const more = screen.getByRole('button', { name: '앱 더보기' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);

    const menu = screen.getByRole('region', { name: '추가 앱' });
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(animationOptionsFor(menu)).toMatchObject({
      opacity: [0, 1],
      y: [-MOTION_DISTANCE_PX.subtle, 0],
      duration: MOTION_DURATION.fast,
      ease: MOTION_EASE.enter,
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '추가 앱' })).not.toBeInTheDocument();
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveFocus();
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

describe('shared Journey overlays', () => {
  it('keeps confirmation focus inside during Strict Mode preflight and restores it on actual close', async () => {
    function Harness() {
      const triggerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Strict 확인 열기</button>
          {open ? (
            <ManagementConfirmationDialog
              confirmation={{
                title: 'Strict 확인',
                description: 'preflight focus를 확인합니다.',
                confirmLabel: '확인',
              }}
              pending={false}
              returnFocusRef={triggerRef}
              onCancel={() => setOpen(false)}
              onConfirm={() => undefined}
            />
          ) : null}
        </>
      );
    }

    render(<StrictMode><Harness /></StrictMode>);
    const trigger = screen.getByRole('button', { name: 'Strict 확인 열기' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Strict 확인' });
    const cancel = within(dialog).getByRole('button', { name: '취소' });
    await act(async () => undefined);
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Strict 확인' })).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(trigger).toHaveFocus();
  });

  it('reveals confirmation content with normal motion and removes it before returning focus', async () => {
    function Harness() {
      const triggerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>초기화 열기</button>
          {open ? (
            <ManagementConfirmationDialog
              confirmation={{
                title: '처음부터 다시 할까요?',
                description: '현재 초안을 지웁니다.',
                confirmLabel: '초기화',
              }}
              pending={false}
              returnFocusRef={triggerRef}
              onCancel={() => setOpen(false)}
              onConfirm={() => undefined}
            />
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '초기화 열기' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '처음부터 다시 할까요?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const motionContent = dialog.querySelector<HTMLElement>('[data-dialog-motion]');
    expect(motionContent).not.toBeNull();
    expect(animationOptionsFor(motionContent!)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.subtle, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(trigger).toHaveFocus();
  });

  it('reveals a toast without bounce and removes it on the close action immediately', () => {
    function Harness() {
      const [visible, setVisible] = useState(true);
      return visible ? <Toast message="백업 완료" onClose={() => setVisible(false)} /> : null;
    }

    render(<Harness />);
    const motionContent = screen.getByText('백업 완료').closest<HTMLElement>('[data-toast-motion]');
    expect(motionContent).not.toBeNull();
    expect(motionContent).not.toHaveClass('animate-bounce-short');
    expect(animationOptionsFor(motionContent!)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });

    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('백업 완료')).not.toBeInTheDocument();
  });
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

function animationOptionsFor(target: Element): Record<string, unknown> | undefined {
  return animeMocks.animate.mock.calls.find(([candidate]) => candidate === target)?.[1] as
    | Record<string, unknown>
    | undefined;
}

function stubLauncherWidth(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('journey-launcher__navigation') ? width : 0;
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
}
