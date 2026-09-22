import { animate } from 'animejs';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { createProductSpring, MOTION_DISTANCE_PX, MOTION_DURATION } from '../motion/tokens';
import { useSheetDismiss } from '../motion/useSheetDismiss';
import './responsive-dialog.css';

export type DialogCloseReason = 'button' | 'escape' | 'backdrop' | 'drag' | 'back';

export interface ResponsiveDialogProps {
  open: boolean;
  labelledBy: string;
  size?: 'compact' | 'form' | 'wide';
  mobileHeight?: 'content' | 'full';
  mobileEntranceMotion?: boolean;
  busy?: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onRequestClose(reason: DialogCloseReason): boolean | Promise<boolean>;
  onClosed(): void;
  children: ReactNode;
}

const activeDialogs: HTMLDialogElement[] = [];
let bodyScrollLockCount = 0;
let unlockedBodyOverflow = '';
const focusableSelector = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Shared responsive overlay shell. Controllers keep draft and persistence decisions. */
export function ResponsiveDialog({
  open,
  labelledBy,
  size = 'form',
  mobileHeight = 'content',
  mobileEntranceMotion = false,
  busy = false,
  returnFocusRef,
  onRequestClose,
  onClosed,
  children,
}: ResponsiveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasOpenRef = useRef(false);
  const closeRequestPendingRef = useRef(false);
  const openingMotionRef = useRef<{ cancel?(): void } | null>(null);
  const bodyLockedRef = useRef(false);
  const [requestedClosed, setRequestedClosed] = useState(false);
  const presentation = useDialogPresentation();

  useSheetDismiss({
    rootRef: dialogRef,
    enabled: open && !requestedClosed,
    blocked: busy || closeRequestPendingRef.current,
    isTopmost: () => activeDialogs.at(-1) === dialogRef.current,
    mediaQuery: '(max-width: 767px)',
    onRequestDismiss: () => requestClose('drag', false),
    onDismissed: finishClose,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !requestedClosed) {
      wasOpenRef.current = true;
      if (dialog !== null) {
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        }
        if (mobileEntranceMotion) revealDialog(dialog, openingMotionRef);
        if (!activeDialogs.includes(dialog)) activeDialogs.push(dialog);
        lockBodyScroll(bodyLockedRef);
        window.requestAnimationFrame(() => {
          if (!dialog.contains(document.activeElement)) focusInitialElement(dialog);
        });
      }
      return;
    }

    if (!open) {
      if (wasOpenRef.current) finishClose();
      else if (requestedClosed) setRequestedClosed(false);
    }
  }, [mobileEntranceMotion, onClosed, open, requestedClosed, returnFocusRef]);

  useEffect(() => () => {
    try { openingMotionRef.current?.cancel?.(); } catch { /* best-effort cleanup */ }
    const dialog = dialogRef.current;
    closeNativeDialog(dialog);
    removeActiveDialog(dialog);
    unlockBodyScroll(bodyLockedRef);
  }, []);

  function requestClose(reason: DialogCloseReason, closeImmediately = true): Promise<boolean> {
    if (busy || closeRequestPendingRef.current) return Promise.resolve(false);
    closeRequestPendingRef.current = true;
    return Promise.resolve(onRequestClose(reason)).then(
      (approved) => {
        if (!approved) {
          closeRequestPendingRef.current = false;
          return false;
        }
        if (closeImmediately) finishClose();
        return true;
      },
      () => {
        closeRequestPendingRef.current = false;
        return false;
      },
    );
  }

  function finishClose(): void {
    if (!wasOpenRef.current) return;
    const dialog = dialogRef.current;
    wasOpenRef.current = false;
    closeRequestPendingRef.current = false;
    try { openingMotionRef.current?.cancel?.(); } catch { /* best-effort cleanup */ }
    openingMotionRef.current = null;
    closeNativeDialog(dialog);
    removeActiveDialog(dialog);
    unlockBodyScroll(bodyLockedRef);
    setRequestedClosed(true);
    queueMicrotask(() => {
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected) trigger.focus();
      onClosed();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    const dialog = dialogRef.current;
    if (dialog === null || activeDialogs.at(-1) !== dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose('escape');
      return;
    }
    if (event.key !== 'Tab') return;
    trapFocus(event, dialog);
  }

  if (!open || requestedClosed || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="responsive-dialog"
      data-mobile-height={mobileHeight}
      data-presentation={presentation}
      data-size={size}
      aria-busy={busy || undefined}
      aria-labelledby={labelledBy}
      aria-modal="true"
      role="dialog"
      onCancel={(event) => {
        event.preventDefault();
        requestClose('escape');
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose('backdrop');
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="responsive-dialog__surface">{children}</div>
    </dialog>,
    document.body,
  );
}

function useDialogPresentation(): 'sheet' | 'modal' {
  const query = '(max-width: 767px)';
  const [presentation, setPresentation] = useState<'sheet' | 'modal'>(() => (
    typeof window !== 'undefined' && window.matchMedia?.(query).matches ? 'sheet' : 'modal'
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia === undefined) return;
    const media = window.matchMedia(query);
    const update = () => setPresentation(media.matches ? 'sheet' : 'modal');
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return presentation;
}

function lockBodyScroll(lockRef: { current: boolean }): void {
  if (lockRef.current || typeof document === 'undefined') return;
  if (bodyScrollLockCount === 0) {
    unlockedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
  lockRef.current = true;
}

function unlockBodyScroll(lockRef: { current: boolean }): void {
  if (!lockRef.current || typeof document === 'undefined') return;
  lockRef.current = false;
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) document.body.style.overflow = unlockedBodyOverflow;
}

function revealDialog(
  dialog: HTMLDialogElement,
  motionRef: { current: { cancel?(): void } | null },
): void {
  if (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || !window.matchMedia?.('(max-width: 767px)').matches
    || dialog.getClientRects().length === 0
  ) {
    dialog.style.opacity = '1';
    dialog.style.transform = 'translateY(0px)';
    return;
  }

  try {
    motionRef.current?.cancel?.();
    motionRef.current = animate(dialog, {
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal,
      ease: createProductSpring('surface'),
      onComplete: () => {
        motionRef.current = null;
      },
    });
  } catch {
    dialog.style.opacity = '1';
    dialog.style.transform = 'translateY(0px)';
  }
}

function removeActiveDialog(dialog: HTMLDialogElement | null): void {
  const index = dialog === null ? -1 : activeDialogs.indexOf(dialog);
  if (index >= 0) activeDialogs.splice(index, 1);
}

function closeNativeDialog(dialog: HTMLDialogElement | null): void {
  if (!dialog?.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function focusInitialElement(dialog: HTMLDialogElement): void {
  const initial = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')
    ?? dialog.querySelector<HTMLElement>(focusableSelector)
    ?? dialog;
  initial.focus();
}

function trapFocus(event: KeyboardEvent<HTMLDialogElement>, dialog: HTMLDialogElement): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute('inert') && element.offsetParent !== null);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
