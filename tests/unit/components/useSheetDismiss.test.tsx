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
      <div data-testid="sheet-body" style={{ height: '300px', overflow: 'auto' }}>
        <div style={{ height: '900px' }}>Scrollable content</div>
      </div>
      <div data-sheet-drag-handle>제목<button type="button">버튼</button></div>
    </div>
  );
}

describe('useSheetDismiss', () => {
  it('requests dismissal after a downward drag past the distance threshold', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('제목');

    dispatchPointer(handle, 'pointerdown', { clientX: 0, clientY: 0 });
    dispatchPointer(handle, 'pointermove', { clientX: 0, clientY: 100 });
    dispatchPointer(handle, 'pointerup', { clientX: 0, clientY: 100 });

    expect(onRequestDismiss).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });

  it('accepts a quick flick only while its measured velocity is recent', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

    dispatchPointer(handle, 'pointerdown', { clientX: 0, clientY: 100 });
    dispatchPointer(handle, 'pointermove', { clientX, clientY });
    dispatchPointer(handle, 'pointerup', { clientX, clientY });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it.each(['pointercancel', 'lostpointercapture'] as const)('returns after %s', (type) => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');
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

  it('does not bind a dismiss gesture to the scrollable sheet body', () => {
    const onRequestDismiss = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} />);
    const body = screen.getByTestId('sheet-body');
    body.scrollTop = 120;

    dispatchPointer(body, 'pointerdown', { pointerId: 1, clientY: 100 });
    dispatchPointer(body, 'pointermove', { pointerId: 1, clientY: 220 });
    dispatchPointer(body, 'pointerup', { pointerId: 1, clientY: 220 });

    expect(onRequestDismiss).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
    expect(body.scrollTop).toBe(120);
  });

  it('runs the exit profile only after the host approves and completes it once', () => {
    const onRequestDismiss = vi.fn(() => true);
    const onDismissed = vi.fn();
    render(<Harness onRequestDismiss={onRequestDismiss} onDismissed={onDismissed} />);
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');
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
    const handle = screen.getByText('제목');
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
    const handle = screen.getByText('제목');
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
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

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
    const handle = screen.getByText('제목');

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

  it('ignores interactive handle children and blocked or non-topmost sheets', () => {
    const interactiveClose = vi.fn();
    const interactiveSheet = render(<Harness onRequestDismiss={interactiveClose} />);
    const handle = screen.getByText('제목');
    const button = screen.getByRole('button', { name: '버튼' });

    dispatchPointer(button, 'pointerdown', { clientY: 0 });
    dispatchPointer(button, 'pointermove', { clientY: 120 });
    dispatchPointer(button, 'pointerup', { clientY: 120 });
    expect(interactiveClose).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
    interactiveSheet.unmount();

    for (const inactiveState of [{ blocked: true }, { topmost: false }]) {
      const onRequestDismiss = vi.fn();
      const inactiveSheet = render(<Harness {...inactiveState} onRequestDismiss={onRequestDismiss} />);
      const inactiveHandle = screen.getByText('제목');
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
    pointerType: 'touch',
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    ...properties,
  })) Object.defineProperty(event, key, { configurable: true, value });
  target.dispatchEvent(event);
}
