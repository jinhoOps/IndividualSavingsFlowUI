import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import type { ManagementConfirmation } from './AppManagementMenu';

export function ManagementConfirmationDialog({
  confirmation,
  returnFocusRef,
  onCancel,
  onConfirm,
}: {
  confirmation: ManagementConfirmation;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel(): void;
  onConfirm(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `journey-management-dialog-${confirmation.title.replace(/\s+/g, '-')}`;

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

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ));
    if (controls.length === 0) return;
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
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={trapFocus}
    >
      <h2 id={titleId}>{confirmation.title}</h2>
      <p>{confirmation.description}</p>
      <div className="journey-management__dialog-actions">
        <button className="ui-button ui-button--secondary" type="button" data-dialog-initial-focus onClick={onCancel}>취소</button>
        <button className="ui-button journey-management__danger" type="button" onClick={onConfirm}>{confirmation.confirmLabel}</button>
      </div>
    </dialog>
  );
}
