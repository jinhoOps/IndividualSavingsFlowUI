// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveDialog } from '../../../src/components/common/ResponsiveDialog';

const animate = vi.hoisted(() => vi.fn((_target: unknown, _options: Record<string, unknown>) => ({ cancel: vi.fn() })));
vi.mock('animejs', () => ({
  animate,
  remove: vi.fn(),
  spring: vi.fn(() => ({ ease: (progress: number) => progress })),
}));

beforeEach(() => { animate.mockClear(); });
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ResponsiveDialog', () => {
  it('closes only after its close request is approved', async () => {
    vi.useFakeTimers();
    const onRequestClose = vi.fn(() => true);
    const onClosed = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={triggerRef}>열기</button>
        <ResponsiveDialog
          open
          labelledBy="dialog-title"
          returnFocusRef={triggerRef}
          onRequestClose={onRequestClose}
          onClosed={onClosed}
        >
          <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
        </ResponsiveDialog>
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: '편집' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onRequestClose).toHaveBeenCalledWith('escape');
    expect(dialog.querySelector('.responsive-dialog__surface')).toHaveAttribute('inert');
    expect(dialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(onClosed).not.toHaveBeenCalled();
    const closeCall = animate.mock.calls.at(-1);
    expect(closeCall?.[0]).toBe(dialog);
    expect(closeCall?.[1]).toEqual(expect.objectContaining({
      opacity: [1, 0],
      scale: [1, 0.97],
      duration: 450,
    }));

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(dialog).toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();
    const onComplete = closeCall?.[1].onComplete as (() => void) | undefined;
    await act(async () => { onComplete?.(); });
    await act(async () => { onComplete?.(); });
    expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe('');
    expect(triggerRef.current).toHaveFocus();
  });

  it('waits for asynchronous close approval and ignores duplicate requests', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    let approve!: (approved: boolean) => void;
    const onRequestClose = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={onRequestClose}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
        <div data-sheet-drag-handle>드래그 손잡이</div>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });
    const surface = dialog.querySelector('.responsive-dialog__surface');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(surface).not.toHaveAttribute('inert');
    expect(animate).not.toHaveBeenCalled();
    const handle = screen.getByText('드래그 손잡이');
    dispatchTouch(handle, 'touchstart', 0);
    dispatchTouch(handle, 'touchmove', 120);
    dispatchTouch(handle, 'touchend', 120);
    expect(onRequestClose).toHaveBeenCalledOnce();

    await act(async () => { approve(true); });
    expect(animate).toHaveBeenCalledOnce();
    expect(surface).toHaveAttribute('inert');
    expect(onClosed).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledOnce();
  });

  it('keeps an asynchronously rejected close surface interactive', async () => {
    let approve!: (approved: boolean) => void;
    const onRequestClose = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={onRequestClose}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });
    const surface = dialog.querySelector('.responsive-dialog__surface');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(surface).not.toHaveAttribute('inert');
    await act(async () => { approve(false); });

    expect(surface).not.toHaveAttribute('inert');
    expect(dialog).toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it('finishes an approved drag after a breakpoint cleanup without reopening the dialog', async () => {
    const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
    let mobile = true;
    const listeners: Array<() => void> = [];
    const mobileQuery = {
      get matches() { return mobile; },
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn((query: string) => (
      query === '(max-width: 767px)' ? mobileQuery : { matches: false }
    )));
    let approve!: (approved: boolean) => void;
    const onRequestClose = vi.fn((reason: string) => (
      reason === 'drag' ? new Promise<boolean>((resolve) => { approve = resolve; }) : true
    ));
    const onClosed = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    try {
      render(
        <>
          <button ref={triggerRef}>열기</button>
          <ResponsiveDialog
            open
            labelledBy="dialog-title"
            returnFocusRef={triggerRef}
            onRequestClose={onRequestClose}
            onClosed={onClosed}
          >
            <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
            <div data-sheet-drag-handle>드래그 손잡이</div>
          </ResponsiveDialog>
        </>,
      );
      const dialog = screen.getByRole('dialog', { name: '편집' });
      expect(showModal).toHaveBeenCalledOnce();
      const handle = screen.getByText('드래그 손잡이');
      dispatchTouch(handle, 'touchstart', 0);
      dispatchTouch(handle, 'touchmove', 120);
      dispatchTouch(handle, 'touchend', 120);
      await act(async () => { approve(true); });
      expect(onClosed).not.toHaveBeenCalled();

      await act(async () => {
        mobile = false;
        listeners.forEach((listener) => listener());
        await Promise.resolve();
      });

      expect(onClosed).toHaveBeenCalledOnce();
      expect(showModal).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument();
      expect(triggerRef.current).toHaveFocus();
      expect((dialog as HTMLDialogElement).open).toBe(false);
    } finally {
      if (showModalDescriptor === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
      else Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModalDescriptor);
    }
  });

  it('uses the 550ms recovery deadline if Anime never calls onComplete', () => {
    vi.useFakeTimers();
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(dialog).toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(249); });
    expect(dialog).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it('uses a vertical 450ms exit for the mobile sheet presentation', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={vi.fn()}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });
    expect(dialog).toHaveAttribute('data-presentation', 'sheet');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    const options = animate.mock.calls.at(-1)?.[1];
    expect(options).toEqual(expect.objectContaining({
      translateY: [0, 16],
      opacity: [1, 0],
      duration: 450,
    }));
    expect(options).not.toHaveProperty('scale');
  });

  it('cancels a close animation and finishes if the surface changes presentation', () => {
    let mobile = false;
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      get matches() { return query === '(max-width: 767px)' && mobile; },
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    })));
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    const closeHandle = animate.mock.results.at(-1)?.value as { cancel?: () => void } | undefined;
    expect(onClosed).not.toHaveBeenCalled();

    mobile = true;
    act(() => { listeners.forEach((listener) => listener()); });

    expect(onClosed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument();
    expect(closeHandle?.cancel).toHaveBeenCalledOnce();
  });

  it('ignores an old asynchronous approval after the surface has been externally closed and reopened', async () => {
    let approve!: (approved: boolean) => void;
    const onRequestClose = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve; }));
    const onClosed = vi.fn();
    function ControlledDialog() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(false)}>외부 닫기</button>
          <button onClick={() => setOpen(true)}>다시 열기</button>
          <ResponsiveDialog
            open={open}
            labelledBy="dialog-title"
            returnFocusRef={{ current: null }}
            onRequestClose={onRequestClose}
            onClosed={onClosed}
          >
            <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
          </ResponsiveDialog>
        </>
      );
    }
    render(<ControlledDialog />);
    fireEvent.keyDown(screen.getByRole('dialog', { name: '편집' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '외부 닫기' }));
    expect(onClosed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '다시 열기' }));
    expect(screen.getByRole('dialog', { name: '편집' })).toBeInTheDocument();

    await act(async () => { approve(true); });

    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '편집' })).toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it('closes immediately if Anime cannot create the exit animation', () => {
    animate.mockImplementationOnce(() => { throw new Error('animation unavailable'); });
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: '편집' }), { key: 'Escape' });

    expect(onClosed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument();
  });

  it('finishes immediately when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: '편집' }), { key: 'Escape' });

    expect(onClosed).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
  });

  it.each([
    ['sheet', true, { translateY: [336, 0] }],
    ['modal', false, { scale: [0.97, 1] }],
  ] as const)('enters the %s presentation along its own axis', async (presentation, mobile, surfaceMotion) => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)' && mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    vi.spyOn(HTMLDialogElement.prototype, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    vi.spyOn(HTMLDialogElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 320 } as DOMRect);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(16), 16)
    ));
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={() => true}
        onClosed={vi.fn()}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: '편집' });
    expect(dialog).toHaveAttribute('data-presentation', presentation);

    await act(async () => { vi.advanceTimersByTime(16); });

    const options = animate.mock.calls.at(-1)?.[1];
    expect(options).toEqual(expect.objectContaining({
      ...surfaceMotion,
      opacity: [0, 1],
      duration: 450,
    }));
    if (presentation === 'modal') expect(options).not.toHaveProperty('translateY');
    else expect(options).not.toHaveProperty('scale');
  });
});

function dispatchTouch(target: HTMLElement, type: 'touchstart' | 'touchmove' | 'touchend', clientY: number): void {
  const touch = { identifier: 1, target, clientX: 0, clientY, pageX: 0, pageY: clientY, screenX: 0, screenY: clientY };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: [touch] },
    touches: { value: type === 'touchend' ? [] : [touch] },
  });
  target.dispatchEvent(event);
}
