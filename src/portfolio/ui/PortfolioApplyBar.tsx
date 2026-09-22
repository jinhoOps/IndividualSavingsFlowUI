import { animate } from 'animejs';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { createProductSpring, MOTION_DURATION } from '../../components/motion/tokens';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { ResponsiveDialog, useResponsiveDialogClose } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { Surface } from '../../components/common/Surface';
import { materializeAllocation } from '../domain/allocation';
import { stableShareUnits } from '../domain/classification';
import type { PortfolioDraft } from '../domain/model';
import { validateApplicableDraft } from '../domain/validation';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export function PortfolioApplyBar({
  dirty,
  saveError = false,
  fieldError = null,
  applying = false,
  showAmounts = false,
  draft,
  investmentWon,
  onCancel,
  onApply,
}: {
  dirty: boolean;
  saveError?: boolean;
  fieldError?: string | null;
  applying?: boolean;
  showAmounts?: boolean;
  draft: PortfolioDraft;
  investmentWon: number;
  onCancel: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusOnCloseRef = useRef(false);
  const requestDialogClose = useResponsiveDialogClose();
  const motionRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    if (reducedMotion) return;
    try { animate(root, { opacity: [0, 1], y: [4, 0], duration: MOTION_DURATION.normal, ease: createProductSpring('surface') }); }
    catch { root.style.opacity = '1'; root.style.transform = 'none'; }
  }, [dirty]);

  useEffect(() => {
    if (open || !restoreFocusOnCloseRef.current) return;
    restoreFocusOnCloseRef.current = false;
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [open]);

  if (!dirty) return null;
  const allocation = materializeAllocation(draft, investmentWon);

  function close(): void {
    if (applying) return;
    restoreFocusOnCloseRef.current = true;
    setOpen(false);
  }

  return (
    <Surface
      ref={motionRef}
      as="aside"
      className="portfolio-apply-bar"
      aria-busy={applying ? 'true' : undefined}
      aria-label="배분 변경"
    >
      <p className="portfolio-apply-bar__status">아직 적용하지 않은 변경이 있어요</p>
      {saveError && !open ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
      <Button type="button" variant="secondary" disabled={applying} onClick={() => {
        if (requestDialogClose) requestDialogClose('button');
        else onCancel();
      }}>취소</Button>
      <Button
        ref={triggerRef}
        type="button"
        variant="primary"
        disabled={applying || fieldError !== null || !validateApplicableDraft(draft)}
        onClick={() => {
          setOpen(true);
        }}
      >적용</Button>
      {open ? (
        <ResponsiveDialog
          open
          labelledBy="portfolio-apply-title"
          size="compact"
          busy={applying}
          returnFocusRef={triggerRef}
          onRequestClose={() => !applying}
          onClosed={close}
        >
          <ResponsiveDialogLayout
            title="투자 배분을 적용할까요?"
            titleId="portfolio-apply-title"
            layout="confirm"
            onClose={close}
            closeInitialFocus={false}
            footer={<PortfolioApplyConfirmationActions
              applying={applying}
              canApply={fieldError === null && validateApplicableDraft(draft)}
              onClose={close}
              onApply={onApply}
            />}
          >
            <dl className="portfolio-confirmation">
              <div className="portfolio-confirmation__row"><dt>투자 대상</dt><dd>{draft.items.length}개</dd></div>
              <div className="portfolio-confirmation__row"><dt>안정 비중</dt><dd>{formatAllocationPercent(stableShareUnits(draft) / 10_000)}</dd></div>
              <div className="portfolio-confirmation__row"><dt>현금 비중</dt><dd>{formatAllocationPercent(allocation.cashPercentage)}</dd></div>
              {showAmounts ? <div className="portfolio-confirmation__row"><dt>총 투자금</dt><dd>{formatPortfolioWon(investmentWon)}</dd></div> : null}
            </dl>
            {fieldError ? <p role="alert">입력 오류를 수정한 뒤 적용해 주세요.</p> : null}
            {saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
          </ResponsiveDialogLayout>
        </ResponsiveDialog>
      ) : null}
    </Surface>
  );
}

function PortfolioApplyConfirmationActions({
  applying,
  canApply,
  onClose,
  onApply,
}: {
  applying: boolean;
  canApply: boolean;
  onClose(): void;
  onApply(): void;
}) {
  const requestDialogClose = useResponsiveDialogClose();
  return (
    <div className="portfolio-item-sheet__discard-actions">
      <Button type="button" variant="secondary" data-dialog-initial-focus disabled={applying} onClick={() => {
        if (requestDialogClose) requestDialogClose('button');
        else onClose();
      }}>계속 수정</Button>
      <Button type="button" variant="primary" disabled={applying || !canApply} onClick={onApply}>배분 적용</Button>
    </div>
  );
}
