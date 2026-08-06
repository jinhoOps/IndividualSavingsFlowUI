import { useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
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
    <Surface as="aside" className="portfolio-apply-bar" aria-label="배분 변경">
      {saveError && !open ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
      <Button type="button" variant="secondary" onClick={onCancel}>취소</Button>
      <Button
        type="button"
        variant="primary"
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          setOpen(true);
        }}
      >적용</Button>
      {open ? (
        <PortfolioDialog labelledBy="portfolio-apply-title" onClose={close} returnFocusRef={triggerRef}>
          <h2 id="portfolio-apply-title">투자 배분 적용</h2>
          <dl>
            <div><dt>투자 대상</dt><dd>{draft.items.length}개</dd></div>
            <div><dt>투자금</dt><dd>{formatPortfolioWon(investmentWon)}</dd></div>
            <div><dt>현금</dt><dd>{formatAllocationPercent(allocation.cashPercentage)}</dd></div>
          </dl>
          {saveError ? <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
          <Button type="button" variant="secondary" data-dialog-initial-focus onClick={close}>확인 취소</Button>
          <Button type="button" variant="primary" disabled={!validateApplicableDraft(draft)} onClick={onApply}>적용</Button>
        </PortfolioDialog>
      ) : null}
    </Surface>
  );
}
