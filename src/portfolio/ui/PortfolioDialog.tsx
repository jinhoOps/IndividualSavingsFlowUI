import { createPortal } from 'react-dom';
import { animate } from 'animejs';
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { AccountProductBoundary } from '../../auth/AccountManagementContext';
import { createProductSpring, MOTION_DISTANCE_PX, MOTION_DURATION } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { useSheetDismiss } from '../../components/motion/useSheetDismiss';

const openDialogs: HTMLDialogElement[] = [];

export function PortfolioDialog({
  labelledBy,
  onClose,
  onSheetDismiss = onClose,
  onSheetDismissed,
  onEscape,
  returnFocusRef,
  className,
  dataPresentation,
  closeOnBackdrop = false,
  enableSheetDismiss = false,
  open = true,
  children,
  }: {
  labelledBy: string;
  onClose(): void;
  onSheetDismiss?(): boolean | void | Promise<boolean | void>;
  onSheetDismissed?(): void;
  onEscape?(): void;
  returnFocusRef: RefObject<HTMLElement | null>;
  className?: string;
  dataPresentation?: 'sheet' | 'modal';
  closeOnBackdrop?: boolean;
  enableSheetDismiss?: boolean;
  open?: boolean;
  children: ReactNode;
}) {
  const focusEffectGenerationRef = useRef(0);
  const dialogRef = useAnimeScope<HTMLDialogElement>(({ root, reducedMotion }) => {
    if (!open) return;
    // The closed native dialog has no measurable height. Open before sizing the sheet.
    if (!root.open) {
      if (typeof root.showModal === 'function') root.showModal();
      else root.setAttribute('open', '');
    }
    const presentation = dataPresentation ?? 'modal';
    const target = presentation === 'modal'
      ? root.querySelector<HTMLElement>('[data-dialog-motion]')
      : root;
    if (target === null) return;
    const distance = presentation === 'modal'
      ? MOTION_DISTANCE_PX.subtle
      : presentation === 'sheet'
        ? root.getBoundingClientRect().height
        : MOTION_DISTANCE_PX.reveal;
    revealDialog(target, presentation, distance, reducedMotion);
  }, [dataPresentation, open]);
  useSheetDismiss({
    rootRef: dialogRef,
    enabled: enableSheetDismiss && dataPresentation === 'sheet',
    mediaQuery: '(max-width: 767px)',
    blocked: !open,
    isTopmost: () => openDialogs.at(-1) === dialogRef.current,
    onRequestDismiss: onSheetDismiss,
    onDismissed: onSheetDismissed,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || !open) return;
    const generation = ++focusEffectGenerationRef.current;
    const scrollPositions: { element: HTMLElement; top: number; left: number }[] = [];
    for (let element = returnFocusRef.current?.parentElement; element; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
    }
    openDialogs.push(dialog);
    for (const parent of openDialogs.slice(0, -1)) parent.inert = true;
    dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    return () => {
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      const parent = openDialogs.at(-1);
      if (parent) parent.inert = false;
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      queueMicrotask(() => {
        const target = returnFocusRef.current;
        const top = openDialogs.at(-1);
        if (focusEffectGenerationRef.current === generation && target?.isConnected && (!top || top.contains(target))) {
          target.focus({ preventScroll: true });
          for (const { element, top, left } of scrollPositions) {
            element.scrollTop = top;
            element.scrollLeft = left;
          }
        }
      });
    };
  }, [returnFocusRef, open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (openDialogs.at(-1) !== event.currentTarget) return;
    if (event.currentTarget.hasAttribute('data-sheet-exiting')) {
      if (event.key === 'Tab' || event.key === 'Escape') event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      (onEscape ?? onClose)();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.closest('[hidden], [inert]'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <AccountProductBoundary><dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`portfolio-dialog ui-surface${className ? ` ${className}` : ''}`}
      data-presentation={dataPresentation}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.hasAttribute('data-sheet-exiting')) return;
        if (openDialogs.at(-1) === event.currentTarget) (onEscape ?? onClose)();
      }}
      onClick={(event) => {
        if (event.currentTarget.hasAttribute('data-sheet-exiting') || !closeOnBackdrop
          || event.target !== event.currentTarget || openDialogs.at(-1) !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX >= bounds.right
          || event.clientY < bounds.top || event.clientY >= bounds.bottom) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div data-dialog-motion>{children}</div>
    </dialog></AccountProductBoundary>,
    document.body,
  );
}

function revealDialog(
  target: HTMLElement,
  presentation: 'modal' | 'sheet',
  distance: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    setDialogRevealFinalState(target, presentation);
    return;
  }
  if (presentation !== 'modal') target.style.removeProperty('transform');
  try {
    animate(target, {
      opacity: [0, 1],
      ...(presentation === 'modal'
        ? { y: [distance, 0] }
        : { bottom: [-distance, 0] }),
      duration: presentation === 'sheet' ? MOTION_DURATION.emphasis : MOTION_DURATION.normal,
      ease: createProductSpring('surface'),
      ...(presentation === 'modal'
        ? {}
        : { onComplete: () => clearPresentedRevealStyles(target, presentation) }),
    });
  } catch {
    setDialogRevealFinalState(target, presentation);
  }
}

function setDialogRevealFinalState(
  target: HTMLElement,
  presentation: 'modal' | 'sheet',
): void {
  target.style.opacity = '1';
  if (presentation === 'modal') {
    target.style.transform = 'translateY(0px)';
    return;
  }
  target.style.removeProperty('transform');
  target.style.removeProperty('bottom');
}

function clearPresentedRevealStyles(
  target: HTMLElement,
  presentation: 'sheet',
): void {
  target.style.removeProperty('opacity');
  target.style.removeProperty('transform');
  target.style.removeProperty('bottom');
}
