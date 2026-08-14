import { useEffect, useState, type RefObject } from 'react';
import { Button } from '../../components/common/Button';
import type { PortfolioAction } from '../application/portfolioReducer';
import type { PortfolioDraft } from '../domain/model';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioDialog } from './PortfolioDialog';

export function PortfolioEditSurface({
  draft,
  investmentWon,
  dirty,
  saveError,
  applying,
  showSaving,
  fieldError,
  returnFocusRef,
  onAction,
  onCancel,
  onApply,
  showAmounts,
  now,
}: {
  draft: PortfolioDraft;
  investmentWon: number;
  dirty: boolean;
  saveError: boolean;
  applying: boolean;
  showSaving: boolean;
  fieldError: string | null;
  returnFocusRef: RefObject<HTMLElement | null>;
  onAction(action: PortfolioAction): void;
  onCancel(): void;
  onApply(): void;
  showAmounts: boolean;
  now(): number;
}) {
  const [presentation, setPresentation] = useState<'sheet' | 'panel'>(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches
      ? 'sheet'
      : 'panel'
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setPresentation(media.matches ? 'sheet' : 'panel');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <PortfolioDialog
      className="portfolio-edit-surface"
      dataPresentation={presentation}
      labelledBy="portfolio-edit-title"
      onClose={() => {
        if (!applying) onCancel();
      }}
      returnFocusRef={returnFocusRef}
    >
      <header className="portfolio-edit-surface__header">
        <h2 id="portfolio-edit-title">투자 배분 수정</h2>
        <Button type="button" variant="quiet" data-dialog-initial-focus aria-label="편집기 닫기" disabled={applying} onClick={onCancel}>닫기</Button>
      </header>
      {showSaving ? <p role="status">저장 중</p> : null}
      <AllocationEditor
        draft={draft}
        investmentWon={investmentWon}
        onAction={onAction}
        now={now}
        fieldError={fieldError}
        presentation="edit"
      />
      {dirty ? (
        <PortfolioApplyBar
          dirty
          saveError={saveError}
          applying={applying}
          showAmounts={showAmounts}
          draft={draft}
          investmentWon={investmentWon}
          onCancel={onCancel}
          onApply={onApply}
        />
      ) : null}
    </PortfolioDialog>
  );
}
