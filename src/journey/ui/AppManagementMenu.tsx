import { useEffect, useId, useRef, useState } from 'react';
import { ManagementConfirmationDialog } from './ManagementConfirmationDialog';

export interface ManagementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  failureMessage?: string;
}

export type AppManagementItem =
  | { kind: 'action'; id: string; label: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect(): void | boolean; confirmation?: ManagementConfirmation }
  | { kind: 'file'; id: string; label: string; accept: string; disabled?: boolean; onFile(file: File): void }
  | { kind: 'separator'; id: string }
  | { kind: 'message'; id: string; text: string };

export function AppManagementMenu({ items }: { items: readonly AppManagementItem[] }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Extract<AppManagementItem, { kind: 'action' }> | null>(null);
  const [confirmationFailed, setConfirmationFailed] = useState(false);

  function closeAndRestoreFocus(): void {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAndRestoreFocus();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAndRestoreFocus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function chooseAction(item: Extract<AppManagementItem, { kind: 'action' }>): void {
    setOpen(false);
    if (item.confirmation !== undefined) {
      setConfirmationFailed(false);
      setPending(item);
      return;
    }
    item.onSelect();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div ref={rootRef} className="journey-management">
      <button
        ref={triggerRef}
        type="button"
        className="journey-launcher__management-trigger"
        aria-label="관리 메뉴"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <GearIcon />
      </button>
      {open ? (
        <div id={menuId} className="journey-management__popover" role="menu" aria-label="관리 메뉴">
          {items.map((item) => {
            if (item.kind === 'separator') return <hr key={item.id} role="separator" />;
            if (item.kind === 'message') return <p key={item.id} className="journey-management__message">{item.text}</p>;
            if (item.kind === 'file') {
              return (
                <label key={item.id} className="journey-management__row" role="menuitem" aria-disabled={item.disabled || undefined}>
                  {item.label}
                  <input
                    className="sr-only"
                    type="file"
                    accept={item.accept}
                    aria-label={item.label}
                    disabled={item.disabled}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file !== undefined) {
                        item.onFile(file);
                        closeAndRestoreFocus();
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`journey-management__row${item.tone === 'danger' ? ' journey-management__danger' : ''}`}
                disabled={item.disabled}
                onClick={() => chooseAction(item)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {pending?.confirmation === undefined ? null : (
        <ManagementConfirmationDialog
          confirmation={pending.confirmation}
          errorMessage={confirmationFailed ? pending.confirmation.failureMessage : undefined}
          returnFocusRef={triggerRef}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.onSelect() === false) {
              setConfirmationFailed(true);
              return;
            }
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.7 3.6h4.6l.7 2.2 1.9 1.1 2.3-.5 2.3 4-1.6 1.7v2.1l1.6 1.7-2.3 4-2.3-.5-1.9 1.1-.7 2.2H9.7L9 20.5l-1.9-1.1-2.3.5-2.3-4 1.6-1.7v-2.1l-1.6-1.7 2.3-4 2.3.5L9 5.8Z" />
      <circle cx="12" cy="13.1" r="3" />
    </svg>
  );
}
