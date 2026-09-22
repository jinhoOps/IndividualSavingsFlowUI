import { ArrowLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useResponsiveDialogClose } from './ResponsiveDialog';

export interface ResponsiveDialogLayoutProps {
  title: ReactNode;
  titleId: string;
  eyebrow?: ReactNode;
  onBack?: () => void;
  onClose: () => void;
  closeInitialFocus?: boolean;
  showClose?: boolean;
  context?: ReactNode;
  contextHidden?: boolean;
  status?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  footerClassName?: string;
  children: ReactNode;
  layout?: 'edit' | 'step' | 'settings' | 'preview' | 'confirm';
}

/** Standard content frame for every responsive dialog surface. */
export function ResponsiveDialogLayout({
  title,
  titleId,
  eyebrow,
  onBack,
  onClose,
  closeInitialFocus = true,
  showClose = true,
  context,
  contextHidden = false,
  status,
  footer,
  bodyClassName,
  footerClassName,
  children,
  layout = 'edit',
}: ResponsiveDialogLayoutProps) {
  const bodyLabel = typeof title === 'string' ? `${title} 내용` : '대화 상자 내용';
  const requestDialogClose = useResponsiveDialogClose();

  return (
    <section className="responsive-dialog__layout" data-surface-layout={layout}>
      <header className="responsive-dialog__header" data-surface-header="">
        <div className="responsive-dialog__drag-handle" data-sheet-drag-handle aria-hidden="true" />
        <div className="responsive-dialog__header-row">
          {onBack ? <button className="responsive-dialog__icon-button" type="button" aria-label="뒤로" onClick={onBack}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button> : <span className="responsive-dialog__header-spacer" aria-hidden="true" />}
          <div className="responsive-dialog__heading">
            {eyebrow ? <p className="responsive-dialog__eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          {showClose ? <button className="responsive-dialog__icon-button" type="button" aria-label="닫기"
            data-dialog-initial-focus={closeInitialFocus ? '' : undefined} onClick={() => {
            if (requestDialogClose) requestDialogClose('button');
            else onClose();
          }}>
            <X size={20} aria-hidden="true" />
          </button> : <span className="responsive-dialog__header-spacer" aria-hidden="true" />}
        </div>
      </header>
      {context ? <div className="responsive-dialog__context" data-surface-context="" hidden={contextHidden}>{context}</div> : null}
      <div className={`responsive-dialog__body${bodyClassName ? ` ${bodyClassName}` : ''}`} data-surface-body="" role="region" aria-label={bodyLabel}>
        {children}
      </div>
      {status ? <div className="responsive-dialog__status" data-surface-status="">{status}</div> : null}
      {footer ? <footer className={`responsive-dialog__footer${footerClassName ? ` ${footerClassName}` : ''}`} data-surface-footer="">{footer}</footer> : null}
    </section>
  );
}
