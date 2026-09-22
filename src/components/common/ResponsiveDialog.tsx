import { animate } from 'animejs';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { createProductSpring, MOTION_DISTANCE_PX, MOTION_DURATION } from '../motion/tokens';
import { useSheetDismiss } from '../motion/useSheetDismiss';
import './responsive-dialog.css';

export type DialogCloseReason = 'button' | 'escape' | 'backdrop' | 'drag' | 'back';

export interface ResponsiveDialogProps {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  initialFocusSelector?: string;
  className?: string;
  size?: 'compact' | 'form' | 'wide';
  mobileHeight?: 'content' | 'full';
  mobileEntranceMotion?: boolean;
  busy?: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onRequestClose(reason: DialogCloseReason): boolean | Promise<boolean>;
  onClosed(): void;
  children: ReactNode | ((actions: ResponsiveDialogActions) => ReactNode);
}

export interface ResponsiveDialogActions {
  requestClose(reason: DialogCloseReason): void;
}

const ResponsiveDialogCloseContext = createContext<((reason: DialogCloseReason) => void) | null>(null);

/** Lets shared content route its close button through the dialog's guarded close contract. */
export function useResponsiveDialogClose(): ((reason: DialogCloseReason) => void) | null {
  return useContext(ResponsiveDialogCloseContext);
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
  describedBy,
  initialFocusSelector,
  className,
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

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open && !requestedClosed) {
      const isOpening = !wasOpenRef.current;
      wasOpenRef.current = true;
      if (dialog !== null) {
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        }
        // A state change inside an open sheet must not replay its entrance.
        // Apart from looking disruptive, a fresh translateY can temporarily put
        // the footer outside the viewport while a nested editor is closing.
        if (isOpening && mobileEntranceMotion) {
          prepareDialogEntrance(dialog);
          // showModal() must paint before Anime can measure and animate the
          // sheet. This also keeps React's development effect replay from
          // cancelling the only entrance animation.
          window.requestAnimationFrame(() => {
            if (wasOpenRef.current && dialog.open) revealDialog(dialog, openingMotionRef);
          });
        }
        if (!activeDialogs.includes(dialog)) activeDialogs.push(dialog);
        lockBodyScroll(bodyLockedRef);
        const hasExplicitInitialFocus = initialFocusSelector !== undefined
          || dialog.querySelector('[data-dialog-initial-focus]') !== null;
        if (isOpening && (
          hasExplicitInitialFocus
          || document.activeElement === dialog
          || !dialog.contains(document.activeElement)
        )) {
          focusInitialElement(dialog, initialFocusSelector);
          window.requestAnimationFrame(() => {
            if (wasOpenRef.current && dialog.isConnected && !dialog.contains(document.activeElement)) {
              focusInitialElement(dialog, initialFocusSelector);
            }
          });
        }
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
    wasOpenRef.current = false;
    closeRequestPendingRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (busy && dialogRef.current?.open) dialogRef.current.focus();
  }, [busy]);

  function requestClose(reason: DialogCloseReason, closeImmediately = true): boolean | Promise<boolean> {
    if (busy || closeRequestPendingRef.current) return false;
    closeRequestPendingRef.current = true;
    let approval: boolean | Promise<boolean>;
    try {
      approval = onRequestClose(reason);
    } catch {
      closeRequestPendingRef.current = false;
      return false;
    }
    if (typeof approval !== 'object' || approval === null || typeof approval.then !== 'function') {
      if (!approval) {
        closeRequestPendingRef.current = false;
        return false;
      }
      if (closeImmediately) finishClose();
      return true;
    }
    return Promise.resolve(approval).then(
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
    const trigger = returnFocusRef.current;
    onClosed();
    if (trigger?.isConnected) trigger.focus();
    window.requestAnimationFrame(() => {
      const topmost = activeDialogs.at(-1);
      if (trigger?.isConnected && (topmost === undefined || topmost.contains(trigger))) trigger.focus();
    });
    window.setTimeout(() => {
      const topmost = activeDialogs.at(-1);
      if (trigger?.isConnected && (topmost === undefined || topmost.contains(trigger))) trigger.focus();
    }, 0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>): void {
    const dialog = dialogRef.current;
    if (dialog === null || activeDialogs.at(-1) !== dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      requestClose('escape');
      return;
    }
    if (event.key === 'Tab') trapFocus(event.nativeEvent, dialog);
  }

  if (!open || requestedClosed || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`responsive-dialog${className ? ` ${className}` : ''}`}
      data-mobile-height={mobileHeight}
      data-mobile-entrance={mobileEntranceMotion || undefined}
      data-presentation={presentation}
      data-size={size}
      aria-busy={busy}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        requestClose('escape');
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose('backdrop');
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose('backdrop');
      }}
      onKeyDown={handleKeyDown}
    >
      <ResponsiveDialogCloseContext.Provider value={(reason) => { void requestClose(reason); }}>
        <div className="responsive-dialog__surface">
          {typeof children === 'function'
            ? children({ requestClose: (reason) => { void requestClose(reason); } })
            : children}
        </div>
      </ResponsiveDialogCloseContext.Provider>
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
    const entranceDistance = Math.max(MOTION_DISTANCE_PX.reveal, dialog.getBoundingClientRect().height + 16);
    motionRef.current?.cancel?.();
    motionRef.current = animate(dialog, {
      opacity: [0, 1],
      y: [entranceDistance, 0],
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

function prepareDialogEntrance(dialog: HTMLDialogElement): void {
  if (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || !window.matchMedia?.('(max-width: 767px)').matches
    || dialog.getClientRects().length === 0
  ) {
    commitVisibleDialogState(dialog);
    return;
  }
  const dialogHeight = dialog.getBoundingClientRect().height;
  const entranceDistance = Math.max(
    MOTION_DISTANCE_PX.reveal,
    dialogHeight > 0 ? dialogHeight + 16 : window.innerHeight + 16,
  );
  dialog.style.opacity = '0';
  dialog.style.transform = `translateY(${entranceDistance}px)`;
}

function commitVisibleDialogState(dialog: HTMLDialogElement): void {
  dialog.style.opacity = '1';
  dialog.style.transform = 'translateY(0px)';
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

function focusInitialElement(dialog: HTMLDialogElement, initialFocusSelector?: string): void {
  const initial = (initialFocusSelector === undefined ? null : dialog.querySelector<HTMLElement>(initialFocusSelector))
    ?? dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')
    ?? dialog.querySelector<HTMLElement>(focusableSelector)
    ?? dialog;
  initial.focus();
}

function trapFocus(event: globalThis.KeyboardEvent, dialog: HTMLDialogElement): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(isVisibleFocusable);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  event.preventDefault();
  if (currentIndex < 0) {
    (event.shiftKey ? focusable.at(-1)! : focusable[0]!).focus();
    return;
  }
  const offset = event.shiftKey ? -1 : 1;
  focusable[(currentIndex + offset + focusable.length) % focusable.length].focus();
}

function isVisibleFocusable(element: HTMLElement): boolean {
  if (element.closest('[hidden], [inert]') !== null) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}
