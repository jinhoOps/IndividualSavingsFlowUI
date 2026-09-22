import { useEffect, useState, type RefObject } from 'react';
import { AccountProductBoundary } from '../../auth/AccountManagementContext';
import { Button } from '../../components/common/Button';
import { ResponsiveDialog, useResponsiveDialogClose } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import type { ManagementConfirmation } from './AppManagementMenu';

export function ManagementConfirmationDialog({
  confirmation,
  pending,
  errorMessage,
  returnFocusRef,
  onCancel,
  onConfirm,
  onAlternate,
}: {
  confirmation: ManagementConfirmation;
  pending: boolean;
  errorMessage?: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel(): void;
  onConfirm(): void;
  onAlternate?(): void;
}) {
  const delayMs = confirmation.alternateAction?.delayMs ?? 0;
  const [delayElapsed, setDelayElapsed] = useState(delayMs === 0);
  useEffect(() => {
    setDelayElapsed(delayMs === 0);
    if (delayMs === 0) return;
    const timer = window.setTimeout(() => setDelayElapsed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <ResponsiveDialog
      open
      labelledBy="journey-management-confirmation-title"
      describedBy="journey-management-confirmation-description"
      size="compact"
      mobileEntranceMotion
      busy={pending}
      returnFocusRef={returnFocusRef}
      onRequestClose={() => !pending}
      onClosed={onCancel}
    >
      <AccountProductBoundary><ResponsiveDialogLayout
        title={confirmation.title}
        titleId="journey-management-confirmation-title"
        eyebrow="관리 작업"
        layout="confirm"
        closeInitialFocus={false}
        showClose={false}
        onClose={onCancel}
        footer={<ManagementConfirmationActions
          confirmation={confirmation}
          pending={pending}
          delayElapsed={delayElapsed}
          onCancel={onCancel}
          onConfirm={onConfirm}
          onAlternate={onAlternate}
        />}
      >
        <p id="journey-management-confirmation-description">{confirmation.description}</p>
        {errorMessage === undefined ? null : (
          <p className="journey-management__dialog-alert" role="alert">{errorMessage}</p>
        )}
      </ResponsiveDialogLayout></AccountProductBoundary>
    </ResponsiveDialog>
  );
}

function ManagementConfirmationActions({
  confirmation,
  pending,
  delayElapsed,
  onCancel,
  onConfirm,
  onAlternate,
}: {
  confirmation: ManagementConfirmation;
  pending: boolean;
  delayElapsed: boolean;
  onCancel(): void;
  onConfirm(): void;
  onAlternate?(): void;
}) {
  const requestDialogClose = useResponsiveDialogClose();
  const alternateDisabled = pending || !delayElapsed;
  return (
    <div className="journey-management__dialog-actions">
      {confirmation.alternateAction && onAlternate ? (
        <Button variant="bare" className={`journey-management__danger journey-management__dialog-alternate${alternateDisabled ? ' journey-management__dialog-alternate--disabled' : ''}`}
          type="button" disabled={alternateDisabled}
          onClick={() => { if (!pending && delayElapsed) onAlternate(); }}>
          {confirmation.alternateAction.label}
        </Button>
      ) : null}
      <Button variant="secondary" type="button" data-dialog-initial-focus disabled={pending}
        onClick={() => requestDialogClose ? requestDialogClose('button') : onCancel()}>취소</Button>
      <Button variant="bare" className="journey-management__danger" type="button" disabled={pending} onClick={onConfirm}>{confirmation.confirmLabel}</Button>
    </div>
  );
}
