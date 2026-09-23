import { useContext, useId, useRef, useState, type ReactNode } from 'react';
import { AccountManagementContext, AccountProductBoundary } from '../../auth/AccountManagementContext';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { ManagementConfirmationDialog } from './ManagementConfirmationDialog';

export interface ManagementConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
  failureMessage?: string;
  alternateAction?: { label: string; delayMs: number; onSelect(): void | boolean | Promise<void | boolean> };
}

export type AppManagementItem =
  | { kind: 'action'; id: string; label: string; tone?: 'default' | 'danger'; disabled?: boolean; onSelect(): void | boolean | Promise<void | boolean>; confirmation?: ManagementConfirmation }
  | { kind: 'separator'; id: string }
  | { kind: 'message'; id: string; text: string }
  | { kind: 'control'; id: string; content: ReactNode };

export function AppManagementMenu({ items }: { items: readonly AppManagementItem[] }) {
  const account = useContext(AccountManagementContext);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationPendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Extract<AppManagementItem, { kind: 'action' }> | null>(null);
  const [confirmationReady, setConfirmationReady] = useState(false);
  const [confirmationFailed, setConfirmationFailed] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  function closeSettings(): void {
    setOpen(false);
  }

  function chooseAction(item: Extract<AppManagementItem, { kind: 'action' }>): void {
    if (item.confirmation !== undefined) {
      confirmationPendingRef.current = false;
      setConfirmationPending(false);
      setConfirmationFailed(false);
      setConfirmationReady(false);
      setPending(item);
      closeSettings();
      return;
    }
    item.onSelect();
    closeSettings();
  }

  function confirmAction(action: () => void | boolean | Promise<void | boolean>): void {
    if (confirmationPendingRef.current) return;
    confirmationPendingRef.current = true;
    setConfirmationPending(true);
    setConfirmationFailed(false);
    const settle = (result: void | boolean) => {
      confirmationPendingRef.current = false;
      setConfirmationPending(false);
      if (result !== false) setPending(null);
      else setConfirmationFailed(true);
    };
    try {
      const result = action();
      if (result instanceof Promise) void result.then(settle, () => settle(false));
      else settle(result);
    } catch { settle(false); }
  }

  function renderMenuItem(item: Exclude<AppManagementItem, { kind: 'control' }>, readOnly = false): ReactNode {
    if (item.kind === 'separator') return <hr key={item.id} role="separator" />;
    if (item.kind === 'message') return <p key={item.id} className="journey-management__message">{item.text}</p>;
    return (
      <button
        key={item.id}
        type="button"
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
    <div className="journey-management">
      <button
        ref={triggerRef}
        type="button"
        className="journey-launcher__management-trigger"
        aria-label="관리 메뉴"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <GearIcon />
      </button>
      <ResponsiveDialog
        open={open}
        labelledBy={menuId}
        size="compact"
        mobileHeight="content"
        returnFocusRef={triggerRef}
        onRequestClose={() => {
          closeSettings();
          return true;
        }}
        onClosed={() => {
          if (pending !== null) setConfirmationReady(true);
        }}
      >
        <ResponsiveDialogLayout
          title="관리 메뉴"
          titleId={menuId}
          eyebrow="앱 설정"
          layout="settings"
          bodyClassName="journey-management__settings-body"
          onClose={closeSettings}
        >
          {sections.map((section, index) => section.kind === 'control' ? (
            <div key={section.item.id} role="group" className="journey-management__control"><AccountProductBoundary>{section.item.content}</AccountProductBoundary></div>
          ) : (
            <div key={`menu-${index}`} className="journey-management__actions">
              {section.items.map(item => renderMenuItem(item, account?.readOnly))}
            </div>
          ))}
          {account === null ? null : <div role="group" aria-label="계정">
            {sections.length > 0 ? <hr /> : null}
            <p className="journey-management__message">계정</p>
            <div className="journey-management__actions">
              {account.items.map(item => item.kind === 'control' ? <div key={item.id}>{item.content}</div> : renderMenuItem(item))}
            </div>
          </div>}
        </ResponsiveDialogLayout>
      </ResponsiveDialog>
      {pending?.confirmation === undefined || !confirmationReady ? null : (
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
          onConfirm={() => confirmAction(pending.onSelect)}
          onAlternate={() => {
            if (pending.confirmation?.alternateAction) confirmAction(pending.confirmation.alternateAction.onSelect);
          }}
        />
        </AccountProductBoundary>
      )}
    </div>
  );
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
