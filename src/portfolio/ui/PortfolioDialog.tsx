import { animate } from 'animejs';
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';

export function PortfolioDialog({
  labelledBy,
  onClose,
  returnFocusRef,
  className,
  dataPresentation,
  closeOnBackdrop = false,
  children,
}: {
  labelledBy: string;
  onClose(): void;
  returnFocusRef: RefObject<HTMLElement | null>;
  className?: string;
  dataPresentation?: 'sheet' | 'panel';
  closeOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const focusEffectGenerationRef = useRef(0);
  const dialogRef = useAnimeScope<HTMLDialogElement>(({ root, reducedMotion }) => {
    const presentation = dataPresentation ?? 'modal';
    const target = presentation === 'modal'
      ? root.querySelector<HTMLElement>('[data-dialog-motion]')
      : root;
    if (target === null) return;
    const distance = presentation === 'modal'
      ? MOTION_DISTANCE_PX.subtle
      : MOTION_DISTANCE_PX.reveal;
    revealDialog(target, presentation, distance, reducedMotion);
  }, [dataPresentation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const generation = ++focusEffectGenerationRef.current;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      queueMicrotask(() => {
        if (focusEffectGenerationRef.current === generation) returnFocusRef.current?.focus();
      });
    };
  }, [returnFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
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

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`portfolio-dialog ui-surface${className ? ` ${className}` : ''}`}
      data-presentation={dataPresentation}
      style={{ animation: 'none' }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div data-dialog-motion>{children}</div>
    </dialog>
  );
}

function revealDialog(
  target: HTMLElement,
  presentation: 'modal' | 'sheet' | 'panel',
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
        : presentation === 'sheet'
          ? { bottom: [-distance, 0] }
          : { right: [-distance, 0] }),
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
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
  presentation: 'modal' | 'sheet' | 'panel',
): void {
  target.style.opacity = '1';
  if (presentation === 'modal') {
    target.style.transform = 'translateY(0px)';
    return;
  }
  target.style.removeProperty('transform');
  target.style.removeProperty(presentation === 'sheet' ? 'bottom' : 'right');
}

function clearPresentedRevealStyles(
  target: HTMLElement,
  presentation: 'sheet' | 'panel',
): void {
  target.style.removeProperty('opacity');
  target.style.removeProperty('transform');
  target.style.removeProperty(presentation === 'sheet' ? 'bottom' : 'right');
}
