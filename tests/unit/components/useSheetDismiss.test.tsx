// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSheetDismiss } from '../../../src/components/motion/useSheetDismiss';

const animate = vi.hoisted(() => vi.fn((target: unknown, options: Record<string, unknown>) => {
  if (target instanceof HTMLElement && Array.isArray(options.translateY)) {
    target.style.transform = `translateY(${String(options.translateY.at(-1))}px)`;
  }
  (options.onComplete as (() => void) | undefined)?.();
  return { cancel: vi.fn() };
}));

vi.mock('animejs', () => ({ animate }));

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function Harness({
  onRequestDismiss = vi.fn(),
  enabled = true,
  blocked = false,
  topmost = true,
  onDismissed,
}: {
  onRequestDismiss?: () => boolean | void | Promise<boolean | void>;
  onDismissed?: () => void;
  enabled?: boolean;
  blocked?: boolean;
  topmost?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSheetDismiss({ rootRef, enabled, blocked, isTopmost: () => topmost, onRequestDismiss, onDismissed });
  return (
    <div ref={rootRef} data-testid="sheet">
      <div data-testid="sheet-header-space">제목 여백</div>
      <div data-testid="sheet-body" data-surface-body="" style={{ height: '300px', overflow: 'auto' }}>
        <div style={{ height: '900px' }}>Scrollable content</div>
        <div data-testid="nested-scroll" style={{ height: '150px', overflowY: 'auto' }}>
          <div style={{ height: '900px' }}>Nested scrollable content</div>
        </div>
        <label data-testid="sheet-label">이름<input aria-label="이름" /></label>
        <button type="button">버튼</button>
        <div role="slider" aria-label="비율" tabIndex={0}>비율</div>
        <div data-testid="custom-control" data-sheet-no-drag="">커스텀 조작부</div>
      </div>
      <div data-testid="sheet-footer-space">하단 여백</div>
      <div data-sheet-drag-handle>손잡이</div>
    </div>
  );
}

describe('useSheetDismiss', () => {
  it('requests dismissal after a downward drag past the distance threshold', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientX: 0, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientX: 0, clientY: 100 });
    dispatchPointer(handle, 'pointerup', { clientX: 0, clientY: 100 });

    expect(onRequestDismiss).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });

  it('accepts a quick flick only while its measured velocity is recent', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientY: 0, timeStamp: 1000 });
    dispatchPointer(handle, 'pointermove', { clientY: 40, timeStamp: 1030 });
    dispatchPointer(handle, 'pointerup', { clientY: 40, timeStamp: 1060 });
    expect(onRequestDismiss).toHaveBeenCalledOnce();

    onRequestDismiss.mockClear();
    dispatchPointer(handle, 'pointerdown', { clientY: 0, timeStamp: 2000 });
    dispatchPointer(handle, 'pointermove', { clientY: 40, timeStamp: 2030 });
    dispatchPointer(handle, 'pointerup', { clientY: 40, timeStamp: 2140 });
    expect(onRequestDismiss).not.toHaveBeenCalled();
  });

  it('returns a short drag to its resting position without dismissing', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientX: 0, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientX: 0, clientY: 24 });
    dispatchPointer(handle, 'pointerup', { clientX: 0, clientY: 24 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sheet')).not.toHaveAttribute('data-sheet-dragging');
  });

  it.each([
    ['upward', 0, -40],
    ['horizontal', 40, 8],
  ] as const)('does not start a dismiss gesture for %s movement', (_direction, clientX, clientY) => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientX: 0, clientY: 100 });
    dispatchPointer(handle, 'pointermove', { clientX, clientY });
    dispatchPointer(handle, 'pointerup', { clientX, clientY });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it.each(['pointercancel', 'lostpointercapture'] as const)('returns after %s', (type) => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { pointerId: 1, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { pointerId: 1, clientY: 40 });
    dispatchPointer(handle, type, { pointerId: 1, clientY: 40 });
    dispatchPointer(handle, 'pointerup', { pointerId: 1, clientY: 120 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [40, 0],
    }));
  });

  it('returns an active drag after the viewport changes size', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { pointerId: 1, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { pointerId: 1, clientY: 40 });
    window.dispatchEvent(new Event('resize'));
    dispatchPointer(handle, 'pointerup', { pointerId: 1, clientY: 120 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [40, 0],
    }));
  });

  it('returns an active drag when the visual viewport changes size', () => {
    const viewport = new EventTarget();
    vi.stubGlobal('visualViewport', viewport);
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { pointerId: 1, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { pointerId: 1, clientY: 40 });
    viewport.dispatchEvent(new Event('resize'));
    dispatchPointer(handle, 'pointerup', { pointerId: 1, clientY: 120 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [40, 0],
    }));
  });

  it('cancels a drag when another pointer starts elsewhere in the sheet', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');
    const sheet = screen.getByTestId('sheet');

    dispatchPointer(handle, 'pointerdown', { pointerId: 1, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { pointerId: 1, clientY: 40 });
    dispatchPointer(document.body, 'pointerdown', { pointerId: 2, clientY: 100 });
    dispatchPointer(handle, 'pointerup', { pointerId: 1, clientY: 120 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [40, 0],
    }));
    expect(sheet).not.toHaveAttribute('data-sheet-dragging');
  });

  it('starts a dismiss gesture from scrollable body space at the scroll origin', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');
    body.scrollTop = 0;

    dispatchPointer(body, 'pointerdown', { pointerId: 1, clientY: 100 });
    dispatchPointer(body, 'pointermove', { pointerId: 1, clientY: 220 });
    dispatchPointer(body, 'pointerup', { pointerId: 1, clientY: 220 });

    expect(onRequestDismiss).toHaveBeenCalledOnce();
  });

  it('keeps a body scroll gesture from turning into dismissal after it reaches the origin', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');
    body.scrollTop = 40;

    dispatchPointer(body, 'pointerdown', { pointerId: 1, clientY: 100 });
    body.scrollTop = 0;
    dispatchPointer(body, 'pointermove', { pointerId: 1, clientY: 220 });
    dispatchPointer(body, 'pointerup', { pointerId: 1, clientY: 220 });
    expect(onRequestDismiss).not.toHaveBeenCalled();

    dispatchPointer(body, 'pointerdown', { pointerId: 2, clientY: 100 });
    dispatchPointer(body, 'pointermove', { pointerId: 2, clientY: 220 });
    dispatchPointer(body, 'pointerup', { pointerId: 2, clientY: 220 });
    expect(onRequestDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses from body space with a real touch gesture and prevents native pan only after activation', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');

    dispatchTouch(body, 'touchstart', { clientY: 100 });
    const move = dispatchTouch(body, 'touchmove', { clientY: 120 });
    expect(move.defaultPrevented).toBe(true);
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-sheet-dragging', 'true');
    dispatchTouch(body, 'touchend', { clientY: 220 });

    expect(onRequestDismiss).toHaveBeenCalledOnce();
  });

  it('keeps a touch gesture in native scrolling after its body reaches the top', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');
    body.scrollTop = 40;

    dispatchTouch(body, 'touchstart', { clientY: 100 });
    body.scrollTop = 0;
    const move = dispatchTouch(body, 'touchmove', { clientY: 220 });
    dispatchTouch(body, 'touchend', { clientY: 220 });
    expect(move.defaultPrevented).toBe(false);
    expect(onRequestDismiss).not.toHaveBeenCalled();

    dispatchTouch(body, 'touchstart', { identifier: 2, clientY: 100 });
    dispatchTouch(body, 'touchmove', { identifier: 2, clientY: 220 });
    dispatchTouch(body, 'touchend', { identifier: 2, clientY: 220 });
    expect(onRequestDismiss).toHaveBeenCalledOnce();
  });

  it('keeps a nested scroller gesture in native scrolling after it reaches the top', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const nested = screen.getByTestId('nested-scroll');
    nested.scrollTop = 40;

    dispatchTouch(nested, 'touchstart', { clientY: 100 });
    nested.scrollTop = 0;
    const move = dispatchTouch(nested, 'touchmove', { clientY: 220 });
    dispatchTouch(nested, 'touchend', { clientY: 220 });
    expect(move.defaultPrevented).toBe(false);
    expect(onRequestDismiss).not.toHaveBeenCalled();

    dispatchTouch(nested, 'touchstart', { identifier: 2, clientY: 100 });
    dispatchTouch(nested, 'touchmove', { identifier: 2, clientY: 220 });
    dispatchTouch(nested, 'touchend', { identifier: 2, clientY: 220 });
    expect(onRequestDismiss).toHaveBeenCalledOnce();
  });

  it('does not turn an upward body scroll into a downward touch dismissal', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');

    dispatchTouch(body, 'touchstart', { clientY: 100 });
    dispatchTouch(body, 'touchmove', { clientY: 88 });
    dispatchTouch(body, 'touchmove', { clientY: 220 });
    dispatchTouch(body, 'touchend', { clientY: 220 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it('ignores touch gestures that start on an interactive control', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const input = screen.getByRole('textbox', { name: '이름' });

    dispatchTouch(input, 'touchstart', { clientY: 100 });
    dispatchTouch(input, 'touchmove', { clientY: 220 });
    dispatchTouch(input, 'touchend', { clientY: 220 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it('returns an active touch drag when a second finger joins', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('손잡이');

    dispatchTouch(handle, 'touchstart', { clientY: 0 });
    dispatchTouch(handle, 'touchmove', { clientY: 24 });
    dispatchTouch(handle, 'touchmove', { clientY: 32 }, 2);
    dispatchTouch(handle, 'touchend', { clientY: 120 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [24, 0],
    }));
  });

  it('suppresses the click produced at the end of an active touch drag', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const sheet = screen.getByTestId('sheet');
    const handle = screen.getByText('손잡이');
    const click = vi.fn();
    sheet.addEventListener('click', click);

    dispatchTouch(handle, 'touchstart', { clientY: 0 });
    dispatchTouch(handle, 'touchmove', { clientY: 24 });
    dispatchTouch(handle, 'touchend', { clientY: 120 });
    fireEvent.click(handle);

    expect(onRequestDismiss).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });

  it('leaves a newly started text selection to the browser', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const header = screen.getByTestId('sheet-header-space');

    dispatchTouch(header, 'touchstart', { clientY: 0 });
    const range = document.createRange();
    range.selectNodeContents(header);
    window.getSelection()?.addRange(range);
    const move = dispatchTouch(header, 'touchmove', { clientY: 24 });
    dispatchTouch(header, 'touchend', { clientY: 120 });

    expect(move.defaultPrevented).toBe(false);
    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('sheet')).not.toHaveAttribute('data-sheet-dragging');
  });

  it('runs the exit profile only after the host approves and completes it once', () => {
    const onRequestDismiss = vi.fn(() => true);
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });

    expect(onRequestDismiss).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [120, 136],
      opacity: [1, 0],
    }));
    expect(onDismissed).toHaveBeenCalledOnce();
    expect(screen.getByTestId('sheet')).toHaveAttribute('data-sheet-exiting', 'true');
  });

  it('returns to rest while an async guard is pending, then exits from rest after approval', async () => {
    let approve!: (approved: boolean) => void;
    const onRequestDismiss = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');
    const sheet = screen.getByTestId('sheet');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });

    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenNthCalledWith(1, sheet, expect.objectContaining({ translateY: [120, 0] }));
    expect(sheet).not.toHaveAttribute('data-sheet-exiting');
    expect(onDismissed).not.toHaveBeenCalled();

    await act(async () => { approve(true); });

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenNthCalledWith(2, sheet, expect.objectContaining({ translateY: [0, 16] }));
    expect(onDismissed).toHaveBeenCalledOnce();
  });

  it('waits for the return spring before starting exit when async approval arrives early', async () => {
    let approve!: (approved: boolean) => void;
    let finishReturn!: () => void;
    const onRequestDismiss = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onDismissed = vi.fn();
    animate.mockImplementationOnce((_target, options) => {
      finishReturn = options.onComplete as () => void;
      return { cancel: vi.fn() };
    });
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');
    const sheet = screen.getByTestId('sheet');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });
    await act(async () => { approve(true); });

    expect(animate).toHaveBeenCalledOnce();
    expect(sheet).not.toHaveAttribute('data-sheet-exiting');
    expect(onDismissed).not.toHaveBeenCalled();

    await act(async () => { finishReturn(); });

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenNthCalledWith(2, sheet, expect.objectContaining({ translateY: [0, 16] }));
    expect(onDismissed).toHaveBeenCalledOnce();
  });

  it('stays at rest when an async close guard declines', async () => {
    let approve!: (approved: boolean) => void;
    const onRequestDismiss = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');
    const sheet = screen.getByTestId('sheet');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });
    await act(async () => { approve(false); });

    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(sheet, expect.objectContaining({ translateY: [120, 0] }));
    expect(onDismissed).not.toHaveBeenCalled();
    expect(sheet).not.toHaveAttribute('data-sheet-exiting');
  });

  it('finishes an approved exit at its deadline when the animation callback never runs', () => {
    vi.useFakeTimers();
    animate.mockImplementationOnce(() => ({ cancel: vi.fn() }));
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={() => true} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });

    expect(onDismissed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(onDismissed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismissed).toHaveBeenCalledOnce();
  });

  it('closes without a presentation delay when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={() => true} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });

    expect(onDismissed).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
  });

  it('springs back when the existing close guard rejects the request', () => {
    const onRequestDismiss = vi.fn(() => false);
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('손잡이');

    dispatchPointer(handle, 'pointerdown', { clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientY: 120 });
    dispatchPointer(handle, 'pointerup', { clientY: 120 });

    expect(onRequestDismiss).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      translateY: [120, 0],
    }));
    expect(onDismissed).not.toHaveBeenCalled();
    expect(screen.getByTestId('sheet')).not.toHaveAttribute('data-sheet-exiting');
  });

  it('ignores interactive controls and blocked or non-topmost sheets', () => {
    const interactiveClose = vi.fn();
    const interactiveSheet = render(<Harness onRequestDismiss={interactiveClose} />);
    const handle = screen.getByText('손잡이');
    const button = screen.getByRole('button', { name: '버튼' });

    dispatchPointer(button, 'pointerdown', { clientY: 0 });
    dispatchPointer(button, 'pointermove', { clientY: 120 });
    dispatchPointer(button, 'pointerup', { clientY: 120 });
    expect(interactiveClose).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();

    for (const interactive of [
      screen.getByRole('textbox', { name: '이름' }),
      screen.getByTestId('sheet-label'),
      screen.getByRole('slider', { name: '비율' }),
      screen.getByTestId('custom-control'),
    ]) {
      dispatchPointer(interactive, 'pointerdown', { clientY: 0 });
      dispatchPointer(interactive, 'pointermove', { clientY: 120 });
      dispatchPointer(interactive, 'pointerup', { clientY: 120 });
    }
    expect(interactiveClose).not.toHaveBeenCalled();
    interactiveSheet.unmount();

    for (const inactiveState of [{ blocked: true }, { topmost: false }]) {
      const onRequestDismiss = vi.fn();
      const inactiveSheet = render(<Harness {...inactiveState} onRequestDismiss={onRequestDismiss} />);
      const inactiveHandle = screen.getByText('손잡이');
      dispatchPointer(inactiveHandle, 'pointerdown', { clientY: 0 });
      dispatchPointer(inactiveHandle, 'pointermove', { clientY: 120 });
      dispatchPointer(inactiveHandle, 'pointerup', { clientY: 120 });
      expect(onRequestDismiss).not.toHaveBeenCalled();
      expect(animate).not.toHaveBeenCalled();
      inactiveSheet.unmount();
    }
  });
});

function dispatchPointer(target: HTMLElement, type: string, properties: Record<string, unknown>): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...properties,
  })) Object.defineProperty(event, key, { configurable: true, value });
  target.dispatchEvent(event);
}

function dispatchTouch(
  target: HTMLElement,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  { identifier = 1, clientX = 0, clientY = 0 }: { identifier?: number; clientX?: number; clientY?: number },
  touchCount = 1,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touch = { identifier, target, clientX, clientY, pageX: clientX, pageY: clientY, screenX: clientX, screenY: clientY };
  const activeTouches = Array.from({ length: touchCount }, (_, index) => ({
    ...touch,
    identifier: identifier + index,
  }));
  Object.defineProperty(event, 'changedTouches', { configurable: true, value: [touch] });
  Object.defineProperty(event, 'touches', { configurable: true, value: type === 'touchend' || type === 'touchcancel' ? [] : activeTouches });
  target.dispatchEvent(event);
  return event;
}
