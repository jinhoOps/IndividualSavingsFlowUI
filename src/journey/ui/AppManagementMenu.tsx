import { animate } from 'animejs';
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccountManagementContext, AccountProductBoundary } from '../../auth/AccountManagementContext';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { ManagementConfirmationDialog } from './ManagementConfirmationDialog';

export interface ManagementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  failureMessage?: string;
}

export type AppManagementItem =
  | { kind: 'action'; id: string; label: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect(): void | boolean | Promise<void | boolean>; confirmation?: ManagementConfirmation }
  | { kind: 'separator'; id: string }
  | { kind: 'message'; id: string; text: string }
  | { kind: 'control'; id: string; content: ReactNode };

export function AppManagementMenu({ items }: { items: readonly AppManagementItem[] }) {
  const account = useContext(AccountManagementContext);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationPendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Extract<AppManagementItem, { kind: 'action' }> | null>(null);
  const [confirmationFailed, setConfirmationFailed] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const popoverMotionRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    revealDisclosure(root, reducedMotion);
  }, [open]);

  function closePopover(restoreFocus = true): void {
    setOpen(false);
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

  function renderMenuItem(item: Exclude<AppManagementItem, { kind: 'control' }>, readOnly = false): ReactNode {
    if (item.kind === 'separator') return <hr key={item.id} role="separator" />;
    if (item.kind === 'message') return <p key={item.id} className="journey-management__message">{item.text}</p>;
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={`journey-management__row${item.tone === 'danger' ? ' journey-management__danger' : ''}`}
        disabled={item.disabled || readOnly}
        onClick={() => chooseAction(item)}
      >
        {item.label}
      </button>
    );
  }

  const sections = splitMenuSections(items);
  if (sections.length === 0 && (account?.items.length ?? 0) === 0) return null;

  return (
    <div
      ref={rootRef}
      className="journey-management"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
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
        }}
      >
        <GearIcon />
      </button>
      {open ? (
        <div ref={popoverMotionRef} id={menuId} className="journey-management__popover">
          {sections.map((section, index) => section.kind === 'control' ? (
            <div key={section.item.id} role="group" className="journey-management__control"><AccountProductBoundary>{section.item.content}</AccountProductBoundary></div>
          ) : (
            <div key={`menu-${index}`} role="menu" aria-label="관리 메뉴">
              {section.items.map(item => renderMenuItem(item, account?.readOnly))}
            </div>
          ))}
          {account === null ? null : <div role="group" aria-label="계정">
            {sections.length > 0 ? <hr /> : null}
            <p className="journey-management__message">계정</p>
            <div role="menu" aria-label="계정 메뉴">
              {account.items.map(item => item.kind === 'control' ? <div key={item.id}>{item.content}</div> : renderMenuItem(item))}
            </div>
          </div>}
        </div>
      ) : null}
      {pending?.confirmation === undefined ? null : (
        <AccountProductBoundary>
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
        </AccountProductBoundary>
      )}
    </div>
  );
}

function revealDisclosure(target: HTMLElement, reducedMotion: boolean): void {
  if (reducedMotion) {
    setDisclosureFinalState(target);
    return;
  }
  try {
    animate(target, {
      opacity: [0, 1],
      y: [-MOTION_DISTANCE_PX.subtle, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });
  } catch {
    setDisclosureFinalState(target);
  }
}

function setDisclosureFinalState(target: HTMLElement): void {
  target.style.opacity = '1';
  target.style.transform = 'translateY(0px)';
}

type AppManagementMenuEntry = Exclude<AppManagementItem, { kind: 'control' }>;
type MenuSection =
  | { kind: 'menu'; items: AppManagementMenuEntry[] }
  | { kind: 'control'; item: Extract<AppManagementItem, { kind: 'control' }> };

function splitMenuSections(items: readonly AppManagementItem[]): MenuSection[] {
  const sections: MenuSection[] = [{ kind: 'menu', items: [] }];
  for (const item of items) {
    if (item.kind === 'control') {
      sections.push({ kind: 'control', item }, { kind: 'menu', items: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current?.kind === 'menu') current.items.push(item);
  }
  return sections.flatMap<MenuSection>((section) => {
    if (section.kind === 'control') return [section];
    // Separators belong between actions, never at a section's edges.
    const rows = section.items.filter((item, index, all) => item.kind !== 'separator'
      || (index > 0 && index < all.length - 1 && all[index - 1].kind !== 'separator'));
    while (rows[0]?.kind === 'separator') rows.shift();
    while (rows.at(-1)?.kind === 'separator') rows.pop();
    return rows.length === 0 ? [] : [{ ...section, items: rows }];
  });
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.7 3.6h4.6l.7 2.2 1.9 1.1 2.3-.5 2.3 4-1.6 1.7v2.1l1.6 1.7-2.3 4-2.3-.5-1.9 1.1-.7 2.2H9.7L9 20.5l-1.9-1.1-2.3.5-2.3-4 1.6-1.7v-2.1l-1.6-1.7 2.3-4 2.3.5L9 5.8Z" />
      <circle cx="12" cy="13.1" r="3" />
    </svg>
  );
}
