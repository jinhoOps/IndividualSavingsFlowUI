import { animate } from 'animejs';
import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '../../components/common/Button';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import type { ManagementConfirmation } from './AppManagementMenu';

export function ManagementConfirmationDialog({
  confirmation,
  pending,
  errorMessage,
  returnFocusRef,
  onCancel,
  onConfirm,
}: {
  confirmation: ManagementConfirmation;
  pending: boolean;
  errorMessage?: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel(): void;
  onConfirm(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusEffectGenerationRef = useRef(0);
  const titleId = `journey-management-dialog-${confirmation.title.replace(/\s+/g, '-')}`;
  const motionRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    if (reducedMotion) {
      setRevealFinalState(root);
      return;
    }
    try {
      animate(root, {
        opacity: [0, 1],
        y: [MOTION_DISTANCE_PX.subtle, 0],
        duration: MOTION_DURATION.normal,
        ease: MOTION_EASE.enter,
      });
    } catch {
      setRevealFinalState(root);
    }
  }, []);

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

  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!pending) onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (controls.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
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
      className="journey-management__dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={pending}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onKeyDown={trapFocus}
      onPointerDown={(event) => {
        if (!pending && event.target === event.currentTarget) onCancel();
      }}
    >
      <div ref={motionRef} data-dialog-motion>
        <h2 id={titleId}>{confirmation.title}</h2>
        <p>{confirmation.description}</p>
        {errorMessage === undefined ? null : (
          <p className="journey-management__dialog-alert" role="alert">{errorMessage}</p>
        )}
        <div className="journey-management__dialog-actions">
          <Button variant="secondary" type="button" data-dialog-initial-focus disabled={pending} onClick={onCancel}>취소</Button>
          <Button className="journey-management__danger" type="button" disabled={pending} onClick={onConfirm}>{confirmation.confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}

function setRevealFinalState(target: HTMLElement): void {
  target.style.opacity = '1';
  target.style.transform = 'translateY(0px)';
}
