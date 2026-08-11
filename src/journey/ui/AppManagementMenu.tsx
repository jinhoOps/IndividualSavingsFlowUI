import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ManagementConfirmationDialog } from './ManagementConfirmationDialog';
import { AppNavigationIcon } from './AppNavigationIcon';
import { APP_NAV_ITEMS } from './appNavigation';

export interface ManagementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  failureMessage?: string;
}

export type AppManagementItem =
  | { kind: 'action'; id: string; label: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect(): void | boolean | Promise<void | boolean>; confirmation?: ManagementConfirmation }
  | { kind: 'file'; id: string; label: string; accept: string; disabled?: boolean; onFile(file: File): void }
  | { kind: 'separator'; id: string }
  | { kind: 'message'; id: string; text: string }
  | { kind: 'control'; id: string; content: ReactNode };

export function AppManagementMenu({ items }: { items: readonly AppManagementItem[] }) {
  const menuId = useId();
  const helpId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationPendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<Extract<AppManagementItem, { kind: 'action' }> | null>(null);
  const [confirmationFailed, setConfirmationFailed] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  function closePopover(restoreFocus = true): void {
    setOpen(false);
    setHelpOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const root = rootRef.current;
      const target = event.target as Node;
      if (root?.contains(target)) return;
      const movingWithinLauncher = root?.closest('.journey-launcher')?.contains(target) ?? false;
      closePopover(!movingWithinLauncher);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePopover();
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
      confirmationPendingRef.current = false;
      setConfirmationPending(false);
      setConfirmationFailed(false);
      setPending(item);
      return;
    }
    item.onSelect();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function renderMenuItem(item: Exclude<AppManagementItem, { kind: 'control' }>): ReactNode {
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
                closePopover();
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
  }

  return (
    <div
      ref={rootRef}
      className="journey-management"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setHelpOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="journey-launcher__management-trigger"
        aria-label="관리 메뉴"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
          setHelpOpen(false);
        }}
      >
        <GearIcon />
      </button>
      {open ? (
        <div id={menuId} className="journey-management__popover">
          {splitMenuSections(items).map((section, index) => section.kind === 'control' ? (
            <div key={section.item.id} role="group" className="journey-management__control">{section.item.content}</div>
          ) : (
            <div key={`menu-${index}`} role="menu" aria-label={section.includesHelp ? '관리 메뉴' : '관리 메뉴 행동'}>
              {section.includesHelp ? (
                <button
                  type="button"
                  role="menuitem"
                  className="journey-management__row journey-management__help-trigger"
                  aria-expanded={helpOpen}
                  aria-controls={helpId}
                  onClick={(event) => {
                    const trigger = event.currentTarget;
                    setHelpOpen((current) => !current);
                    if (helpOpen) window.setTimeout(() => trigger.focus(), 0);
                  }}
                >
                  <span>앱 아이콘 안내</span>
                  <ChevronIcon expanded={helpOpen} />
                </button>
              ) : null}
              {section.items.map(renderMenuItem)}
            </div>
          ))}
          {helpOpen ? (
            <div id={helpId} role="region" aria-label="앱 아이콘 안내" className="journey-management__app-help">
              {APP_NAV_ITEMS.map((item) => (
                <div key={item.id} className="journey-management__app-help-row">
                  <AppNavigationIcon app={item.id} />
                  <span>{item.accessibleLabel}</span>
                  {item.availability === 'readiness' ? <small>준비 중</small> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {pending?.confirmation === undefined ? null : (
        <ManagementConfirmationDialog
          confirmation={pending.confirmation}
          pending={confirmationPending}
          errorMessage={confirmationFailed ? pending.confirmation.failureMessage : undefined}
          returnFocusRef={triggerRef}
          onCancel={() => {
            confirmationPendingRef.current = false;
            setPending(null);
          }}
          onConfirm={() => {
            if (confirmationPendingRef.current) return;
            confirmationPendingRef.current = true;
            setConfirmationPending(true);
            setConfirmationFailed(false);

            const settle = (result: void | boolean) => {
              confirmationPendingRef.current = false;
              setConfirmationPending(false);
              if (result !== false) {
                setPending(null);
                return;
              }
              setConfirmationFailed(true);
            };
            try {
              const result = pending.onSelect();
              if (result instanceof Promise) {
                void result.then(settle, () => settle(false));
              } else {
                settle(result);
              }
            } catch {
              settle(false);
            }
          }}
        />
      )}
    </div>
  );
}

type AppManagementMenuEntry = Exclude<AppManagementItem, { kind: 'control' }>;
type MenuSection =
  | { kind: 'menu'; includesHelp: boolean; items: AppManagementMenuEntry[] }
  | { kind: 'control'; item: Extract<AppManagementItem, { kind: 'control' }> };

function splitMenuSections(items: readonly AppManagementItem[]): MenuSection[] {
  const sections: MenuSection[] = [{ kind: 'menu', includesHelp: true, items: [] }];
  for (const item of items) {
    if (item.kind === 'control') {
      sections.push({ kind: 'control', item }, { kind: 'menu', includesHelp: false, items: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current?.kind === 'menu') current.items.push(item);
  }
  return sections.filter((section) => section.kind !== 'menu' || section.includesHelp || section.items.length > 0);
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : undefined} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6.5 8 3.5 3.5L13.5 8" />
    </svg>
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
