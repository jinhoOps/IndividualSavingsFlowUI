import { animate } from 'animejs';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import { materializeAllocation } from '../domain/allocation';
import { stableShareUnits } from '../domain/classification';
import type { PortfolioDraft } from '../domain/model';
import { validateApplicableDraft } from '../domain/validation';
import { formatAllocationPercent, formatPortfolioWon } from './format';
import { PortfolioDialog } from './PortfolioDialog';

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
  const motionRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    if (reducedMotion) return;
    try { animate(root, { opacity: [0, 1], y: [4, 0], duration: MOTION_DURATION.normal, ease: MOTION_EASE.enter }); }
    catch { root.style.opacity = '1'; root.style.transform = 'none'; }
  }, [dirty]);
  if (!dirty) return null;
  const allocation = materializeAllocation(draft, investmentWon);

  function close(): void {
    if (applying) return;
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
      <Button type="button" variant="secondary" disabled={applying} onClick={onCancel}>취소</Button>
      <Button
        type="button"
        variant="primary"
        disabled={applying || fieldError !== null || !validateApplicableDraft(draft)}
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          setOpen(true);
        }}
      >적용</Button>
      {open ? (
        <PortfolioDialog labelledBy="portfolio-apply-title" onClose={close} returnFocusRef={triggerRef}>
          <h2 id="portfolio-apply-title">투자 배분을 적용할까요?</h2>
          <dl className="portfolio-confirmation">
            <div className="portfolio-confirmation__row"><dt>투자 대상</dt><dd>{draft.items.length}개</dd></div>
            <div className="portfolio-confirmation__row"><dt>안정 비중</dt><dd>{formatAllocationPercent(stableShareUnits(draft) / 10_000)}</dd></div>
            <div className="portfolio-confirmation__row"><dt>현금 비중</dt><dd>{formatAllocationPercent(allocation.cashPercentage)}</dd></div>
            {showAmounts ? <div className="portfolio-confirmation__row"><dt>총 투자금</dt><dd>{formatPortfolioWon(investmentWon)}</dd></div> : null}
          </dl>
          {fieldError ? <p role="alert">입력 오류를 수정한 뒤 적용해 주세요.</p> : null}
          {saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
          <Button type="button" variant="secondary" data-dialog-initial-focus disabled={applying} onClick={close}>계속 수정</Button>
          <Button type="button" variant="primary" disabled={applying || fieldError !== null || !validateApplicableDraft(draft)} onClick={onApply}>배분 적용</Button>
        </PortfolioDialog>
      ) : null}
    </Surface>
  );
}
