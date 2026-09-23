import { animate } from 'animejs';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { createDialogMotionTiming, DIALOG_MOTION_MS, readDialogTranslateY } from '../motion/dialogMotion';
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
type AnimationHandle = { cancel?(): void };

const MOTION_RECOVERY_DEADLINE_MS = DIALOG_MOTION_MS + 100;
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
  mobileEntranceMotion = true,
  busy = false,
  returnFocusRef,
  onRequestClose,
  onClosed,
  children,
}: ResponsiveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasOpenRef = useRef(false);
  const closeRequestPendingRef = useRef(false);
  const openingMotionRef = useRef<AnimationHandle | null>(null);
  const closingMotionRef = useRef<AnimationHandle | null>(null);
  const openingFrameRef = useRef<number | undefined>(undefined);
  const closingTimerRef = useRef<number | undefined>(undefined);
  const lifecycleGenerationRef = useRef(0);
  const openingGenerationRef = useRef(0);
  const closingGenerationRef = useRef(0);
  const bodyLockedRef = useRef(false);
  const [requestedClosed, setRequestedClosed] = useState(false);
  const [closeRequestPending, setCloseRequestPending] = useState(false);
  const presentation = useDialogPresentation();
  const presentationRef = useRef(presentation);
  const previousPresentationRef = useRef(presentation);
  presentationRef.current = presentation;

  useSheetDismiss({
    rootRef: dialogRef,
    enabled: open && !requestedClosed,
    blocked: busy || closeRequestPending,
    isTopmost: () => activeDialogs.at(-1) === dialogRef.current,
    mediaQuery: '(max-width: 767px)',
    onRequestDismiss: () => requestClose('drag', false),
    onDismissed: finishClose,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const presentationChanged = previousPresentationRef.current !== presentation;
    previousPresentationRef.current = presentation;
    if (presentationChanged && wasOpenRef.current && dialog !== null) {
      const wasClosing = closingMotionRef.current !== null;
      cancelOpeningMotion();
      cancelClosingMotion();
      clearDialogMotionStyles(dialog);
      if (wasClosing) {
        finishClose();
        return undefined;
      }
    }

    if (open && !requestedClosed) {
      const isOpening = !wasOpenRef.current;
      if (isOpening) {
        wasOpenRef.current = true;
        lifecycleGenerationRef.current += 1;
      }
      if (dialog !== null) {
        if (!dialog.open) {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        }
        if (isOpening && prepareDialogEntrance(dialog, presentation)) {
          // Start after showModal has painted so Anime measures the real surface.
          const generation = lifecycleGenerationRef.current;
          openingFrameRef.current = window.requestAnimationFrame(() => {
            openingFrameRef.current = undefined;
            if (generation === lifecycleGenerationRef.current && wasOpenRef.current && dialog.open) {
              revealDialog(dialog, presentation, openingMotionRef, openingGenerationRef);
            }
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
  }, [mobileEntranceMotion, onClosed, open, presentation, requestedClosed, returnFocusRef]);

  useEffect(() => () => {
    lifecycleGenerationRef.current += 1;
    cancelOpeningMotion();
    cancelClosingMotion();
    const dialog = dialogRef.current;
    if (dialog !== null) clearDialogMotionStyles(dialog);
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
    setCloseRequestPending(true);
    const generation = lifecycleGenerationRef.current;
    let approval: boolean | Promise<boolean>;
    try {
      approval = onRequestClose(reason);
    } catch {
      closeRequestPendingRef.current = false;
      setCloseRequestPending(false);
      return false;
    }
    if (typeof approval !== 'object' || approval === null || typeof approval.then !== 'function') {
      if (!approval) {
        closeRequestPendingRef.current = false;
        setCloseRequestPending(false);
        return false;
      }
      if (closeImmediately) startApprovedClose();
      return true;
    }
    return Promise.resolve(approval).then(
      (approved) => {
        if (!approved || generation !== lifecycleGenerationRef.current || !wasOpenRef.current) {
          if (generation === lifecycleGenerationRef.current) {
            closeRequestPendingRef.current = false;
            setCloseRequestPending(false);
          }
          return false;
        }
        if (closeImmediately) startApprovedClose();
        return true;
      },
      () => {
        if (generation === lifecycleGenerationRef.current) {
          closeRequestPendingRef.current = false;
          setCloseRequestPending(false);
        }
        return false;
      },
    );
  }

  function startApprovedClose(): void {
    const dialog = dialogRef.current;
    if (dialog === null || !dialog.open || !wasOpenRef.current) {
      finishClose();
      return;
    }
    const entranceNotStarted = openingFrameRef.current !== undefined;
    let currentY = readDialogTranslateY(dialog);
    let currentOpacity = readOpacity(dialog);
    let currentScale = readScale(dialog);
    cancelOpeningMotion();
    if (entranceNotStarted) {
      clearDialogMotionStyles(dialog);
      currentY = 0;
      currentOpacity = 1;
      currentScale = 1;
    }
    cancelClosingMotion();
    if (prefersReducedMotion()) {
      finishClose();
      return;
    }

    const generation = ++closingGenerationRef.current;
    const presentationAtClose = presentationRef.current;
    const height = dialog.getBoundingClientRect().height;
    let completed = false;
    const finish = () => {
      if (completed || generation !== closingGenerationRef.current) return;
      completed = true;
      window.clearTimeout(closingTimerRef.current);
      closingTimerRef.current = undefined;
      closingMotionRef.current = null;
      clearDialogMotionStyles(dialog);
      finishClose();
    };
    const surfaceExit: Record<string, [number, number]> = presentationAtClose === 'sheet'
      ? { translateY: [currentY, Math.max(height, currentY) + 16] }
      : { scale: [currentScale, 0.97] };

    try {
      const motion = animate(dialog, {
        ...surfaceExit,
        opacity: [currentOpacity, 0],
        ...createDialogMotionTiming(0),
        onComplete: finish,
      });
      if (!completed) {
        closingMotionRef.current = motion;
        closingTimerRef.current = window.setTimeout(finish, MOTION_RECOVERY_DEADLINE_MS);
      }
    } catch {
      finish();
    }
  }

  function finishClose(): void {
    if (!wasOpenRef.current) return;
    const dialog = dialogRef.current;
    wasOpenRef.current = false;
    lifecycleGenerationRef.current += 1;
    closeRequestPendingRef.current = false;
    setCloseRequestPending(false);
    cancelOpeningMotion();
    cancelClosingMotion();
    if (dialog !== null) clearDialogMotionStyles(dialog);
    closeNativeDialog(dialog);
    removeActiveDialog(dialog);
    unlockBodyScroll(bodyLockedRef);
    setRequestedClosed(true);
    const trigger = returnFocusRef.current;
    onClosed();
    if (trigger?.isConnected) trigger.focus();
    const restoreUnclaimedFocus = () => {
      const active = document.activeElement;
      const unclaimed = active === null || active === document.body || active === document.documentElement
        || active === trigger || (active !== null && dialog?.contains(active));
      const topmost = activeDialogs.at(-1);
      if (unclaimed && trigger?.isConnected && (topmost === undefined || topmost.contains(trigger))) trigger.focus();
    };
    window.requestAnimationFrame(restoreUnclaimedFocus);
    window.setTimeout(restoreUnclaimedFocus, 0);
  }

  function cancelOpeningMotion(): void {
    openingGenerationRef.current += 1;
    if (openingFrameRef.current !== undefined) {
      window.cancelAnimationFrame(openingFrameRef.current);
      openingFrameRef.current = undefined;
    }
    try { openingMotionRef.current?.cancel?.(); } catch { /* best-effort cleanup */ }
    openingMotionRef.current = null;
  }

  function cancelClosingMotion(): void {
    closingGenerationRef.current += 1;
    window.clearTimeout(closingTimerRef.current);
    closingTimerRef.current = undefined;
    try { closingMotionRef.current?.cancel?.(); } catch { /* best-effort cleanup */ }
    closingMotionRef.current = null;
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
  presentation: 'sheet' | 'modal',
  motionRef: { current: AnimationHandle | null },
  generationRef: { current: number },
): void {
  if (prefersReducedMotion() || !dialog.isConnected) {
    clearDialogMotionStyles(dialog);
    return;
  }
  const generation = ++generationRef.current;
  let completed = false;
  const finish = () => {
    if (completed || generation !== generationRef.current || !dialog.isConnected) return;
    completed = true;
    motionRef.current = null;
    clearDialogMotionStyles(dialog);
  };
  const surfaceEnter: Record<string, [number, number]> = presentation === 'sheet'
    ? { translateY: [readDialogTranslateY(dialog), 0] }
    : { scale: [readScale(dialog), 1] };
  try {
    const motion = animate(dialog, {
      ...surfaceEnter,
      opacity: [readOpacity(dialog), 1],
      ...createDialogMotionTiming(0.12),
      onComplete: finish,
    });
    if (!completed) motionRef.current = motion;
  } catch {
    finish();
  }
}

function prepareDialogEntrance(dialog: HTMLDialogElement, presentation: 'sheet' | 'modal'): boolean {
  if (prefersReducedMotion() || dialog.getClientRects().length === 0) {
    clearDialogMotionStyles(dialog);
    return false;
  }
  dialog.style.opacity = '0';
  dialog.style.removeProperty('translate');
  if (presentation === 'sheet') {
    const height = dialog.getBoundingClientRect().height || window.innerHeight;
    dialog.style.transform = `translateY(${height + 16}px)`;
    dialog.style.removeProperty('scale');
  } else {
    dialog.style.transform = 'scale(0.97)';
    dialog.style.removeProperty('scale');
  }
  return true;
}

function clearDialogMotionStyles(dialog: HTMLDialogElement): void {
  dialog.style.removeProperty('opacity');
  dialog.style.removeProperty('transform');
  dialog.style.removeProperty('translate');
  dialog.style.removeProperty('scale');
}

function readOpacity(dialog: HTMLDialogElement): number {
  const opacity = Number.parseFloat(window.getComputedStyle(dialog).opacity);
  return Number.isFinite(opacity) ? opacity : 1;
}

function readScale(dialog: HTMLDialogElement): number {
  const style = window.getComputedStyle(dialog);
  if (style.scale !== '' && style.scale !== 'none') {
    const individual = Number.parseFloat(style.scale);
    if (Number.isFinite(individual)) return individual;
  }
  const transform = style.transform;
  const matrix = transform.match(/^matrix\(\s*([\d.]+)/);
  if (matrix !== null) return Number.parseFloat(matrix[1]);
  const scale = transform.match(/scale\(\s*([\d.]+)/);
  return scale === null ? 1 : Number.parseFloat(scale[1]);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
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
