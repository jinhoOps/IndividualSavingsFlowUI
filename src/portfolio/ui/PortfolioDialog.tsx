import { animate } from 'animejs';
import { useEffect, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
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
  const dialogRef = useAnimeScope<HTMLDialogElement>(({ root, reducedMotion }) => {
    const target = dataPresentation === undefined
      ? root.querySelector<HTMLElement>('[data-dialog-motion]')
      : root;
    if (target === null) return;
    const direction = dataPresentation === 'panel' ? 'horizontal' : 'vertical';
    const distance = dataPresentation === undefined
      ? MOTION_DISTANCE_PX.subtle
      : MOTION_DISTANCE_PX.reveal;
    revealDialog(target, direction, distance, reducedMotion);
  }, [dataPresentation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      queueMicrotask(() => returnFocusRef.current?.focus());
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
  direction: 'vertical' | 'horizontal',
  distance: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    setDialogRevealFinalState(target, direction);
    return;
  }
  try {
    animate(target, {
      opacity: [0, 1],
      ...(direction === 'vertical' ? { y: [distance, 0] } : { x: [distance, 0] }),
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });
  } catch {
    setDialogRevealFinalState(target, direction);
  }
}

function setDialogRevealFinalState(
  target: HTMLElement,
  direction: 'vertical' | 'horizontal',
): void {
  target.style.opacity = '1';
  target.style.transform = direction === 'vertical' ? 'translateY(0px)' : 'translateX(0px)';
}
