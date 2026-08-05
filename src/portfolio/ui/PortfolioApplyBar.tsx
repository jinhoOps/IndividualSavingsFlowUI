import { useRef, useState } from 'react';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import { validateApplicableDraft } from '../domain/validation';
import { formatAllocationPercent, formatPortfolioWon } from './format';
import { PortfolioDialog } from './PortfolioDialog';

export function PortfolioApplyBar({
  dirty,
  saveError = false,
  draft,
  investmentWon,
  onCancel,
  onApply,
}: {
  dirty: boolean;
  saveError?: boolean;
  draft: PortfolioDraft;
  investmentWon: number;
  onCancel: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!dirty) return null;
  const allocation = materializeAllocation(draft, investmentWon);

  function close(): void {
    setOpen(false);
  }

  return (
    <aside className="portfolio-apply-bar" aria-label="배분 변경">
      {saveError && !open ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
      <button type="button" onClick={onCancel}>취소</button>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>적용</button>
      {open ? (
        <PortfolioDialog labelledBy="portfolio-apply-title" onClose={close} returnFocusRef={triggerRef}>
          <h2 id="portfolio-apply-title">투자 배분 적용</h2>
          <dl>
            <div><dt>투자 대상</dt><dd>{draft.items.length}개</dd></div>
            <div><dt>투자금</dt><dd>{formatPortfolioWon(investmentWon)}</dd></div>
            <div><dt>현금</dt><dd>{formatAllocationPercent(allocation.cashPercentage)}</dd></div>
          </dl>
          {saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
          <button type="button" data-dialog-initial-focus onClick={close}>확인 취소</button>
          <button type="button" disabled={!validateApplicableDraft(draft)} onClick={onApply}>적용</button>
        </PortfolioDialog>
      ) : null}
    </aside>
  );
}
