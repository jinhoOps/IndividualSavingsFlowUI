import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

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
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </dialog>
  );
}
