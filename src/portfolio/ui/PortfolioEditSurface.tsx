import { useEffect, useState, type RefObject } from 'react';
import { Button } from '../../components/common/Button';
import type { PortfolioAction } from '../application/portfolioReducer';
import type { PortfolioDraft } from '../domain/model';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioEditorSummary } from './PortfolioEditorSummary';
import { PortfolioDialog } from './PortfolioDialog';
import { PortfolioExamplePicker } from './PortfolioExamplePicker';

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
  const [cashError, setCashError] = useState<string | null>(null);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
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
        if (!applying) {
          if (examplePickerOpen) setExamplePickerOpen(false);
          else onCancel();
        }
      }}
      returnFocusRef={returnFocusRef}
    >
      <header className="portfolio-edit-surface__header">
        <h2 id="portfolio-edit-title">{examplePickerOpen ? '샘플로 배분 시작' : '투자 배분 수정'}</h2>
        <div className="portfolio-edit-surface__header-actions">
          {examplePickerOpen ? null : (
            <Button type="button" variant="quiet" aria-label="샘플로 시작" onClick={() => setExamplePickerOpen(true)}>샘플</Button>
          )}
          <Button
            type="button"
            variant="quiet"
            data-dialog-initial-focus
            aria-label={examplePickerOpen ? '편집기로 돌아가기' : '편집기 닫기'}
            disabled={applying}
            onClick={examplePickerOpen ? () => setExamplePickerOpen(false) : onCancel}
          >
            {examplePickerOpen ? '돌아가기' : '닫기'}
          </Button>
        </div>
      </header>
      {showSaving ? <p role="status">저장 중</p> : null}
      {examplePickerOpen ? (
        <PortfolioExamplePicker
          draft={draft}
          investmentWon={investmentWon}
          now={now}
          onAction={onAction}
          onClose={() => setExamplePickerOpen(false)}
        />
      ) : (
        <>
          <PortfolioEditorSummary draft={draft} investmentWon={investmentWon} />
          <div className="portfolio-edit-surface__body">
            <AllocationEditor
              draft={draft}
              investmentWon={investmentWon}
              onAction={onAction}
              now={now}
              fieldError={fieldError}
              onCashErrorChange={setCashError}
              presentation="edit"
              showSummary={false}
            />
          </div>
        </>
      )}
      <footer className="portfolio-edit-surface__footer">
        {!examplePickerOpen && dirty ? (
          <PortfolioApplyBar
            dirty
            saveError={saveError}
            fieldError={cashError ?? fieldError}
            applying={applying}
            showAmounts={showAmounts}
            draft={draft}
            investmentWon={investmentWon}
            onCancel={onCancel}
            onApply={onApply}
          />
        ) : null}
      </footer>
    </PortfolioDialog>
  );
}
