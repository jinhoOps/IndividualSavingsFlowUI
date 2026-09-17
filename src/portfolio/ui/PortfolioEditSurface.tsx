import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../../components/common/Button';
import type { PortfolioAction } from '../application/portfolioReducer';
import type { PortfolioDraft } from '../domain/model';
import { AllocationEditor } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioEditorSummary } from './PortfolioEditorSummary';
import { PortfolioDialog } from './PortfolioDialog';
import { PortfolioExamplePicker, type PortfolioExampleNavigation } from './PortfolioExamplePicker';

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
  onSheetDismiss,
  onSheetDismissed,
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
  onSheetDismiss?(): boolean | void;
  onSheetDismissed?(): void;
  onApply(): void;
  showAmounts: boolean;
  now(): number;
}) {
  const [cashError, setCashError] = useState<string | null>(null);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
  const [exampleVisited, setExampleVisited] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [cashDirty, setCashDirty] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const pickerRef = useRef<PortfolioExampleNavigation>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const discardTriggerRef = useRef<HTMLElement | null>(null);
  const pendingSheetDismissRef = useRef<((approved: boolean) => void) | null>(null);
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

  useEffect(() => () => {
    pendingSheetDismissRef.current?.(false);
    pendingSheetDismissRef.current = null;
  }, []);

  function requestClose(): void {
    if (applying) return;
    if (dirty || cashDirty || cashError || fieldError || pickerRef.current?.hasChanges) {
      discardTriggerRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscard(true);
    } else onCancel();
  }

  function requestSheetDismiss(): boolean | Promise<boolean> {
    if (applying) return false;
    if (dirty || cashDirty || cashError || fieldError || pickerRef.current?.hasChanges) {
      discardTriggerRef.current = closeButtonRef.current;
      setConfirmDiscard(true);
      return new Promise(resolve => { pendingSheetDismissRef.current = resolve; });
    }
    return onSheetDismiss?.() !== false;
  }

  function cancelDiscard(): void {
    setConfirmDiscard(false);
    const resolve = pendingSheetDismissRef.current;
    pendingSheetDismissRef.current = null;
    resolve?.(false);
  }

  function discardChanges(): void {
    setConfirmDiscard(false);
    const resolve = pendingSheetDismissRef.current;
    pendingSheetDismissRef.current = null;
    if (!resolve) {
      onCancel();
      return;
    }
    if (onSheetDismiss === undefined) {
      onCancel();
      resolve(false);
      return;
    }
    resolve(onSheetDismiss() !== false);
  }

  function closeExamples(): void {
    setExamplePickerOpen(false);
    requestAnimationFrame(() => sampleTriggerRef.current?.focus());
  }

  return (
    <>
      <PortfolioDialog
        className={`portfolio-edit-surface${examplePickerOpen ? ' portfolio-edit-surface--examples' : ''}`}
        dataPresentation={presentation}
        labelledBy={examplePickerOpen ? 'portfolio-example-picker-title' : 'portfolio-edit-title'}
        closeOnBackdrop
        enableSheetDismiss={!examplePickerOpen}
        onSheetDismiss={requestSheetDismiss}
        onSheetDismissed={onSheetDismissed}
        onClose={requestClose}
        onEscape={() => {
          if (applying) return;
          if (examplePickerOpen) pickerRef.current?.back();
          else requestClose();
        }}
        returnFocusRef={returnFocusRef}
      >
        <div className="portfolio-edit-surface__editor" hidden={examplePickerOpen}>
          <header className="portfolio-edit-surface__header" data-sheet-drag-handle>
            <h2 id="portfolio-edit-title">투자 배분 수정</h2>
            <div className="portfolio-edit-surface__header-actions">
              <Button
                type="button"
              variant="quiet"
              ref={closeButtonRef}
              data-dialog-initial-focus
                aria-label="편집기 닫기"
                disabled={applying}
                onClick={requestClose}
              >
                닫기
              </Button>
            </div>
          </header>
          {showSaving ? <p role="status">저장 중</p> : null}
          <PortfolioEditorSummary draft={draft} investmentWon={investmentWon} />
          <div className="portfolio-edit-surface__body">
            <Button ref={sampleTriggerRef} type="button" variant="quiet" className="portfolio-edit-surface__samples"
              onClick={() => { setExampleVisited(true); setExamplePickerOpen(true); }}>샘플로 구성하기</Button>
            <AllocationEditor
              key={editorGeneration}
              draft={draft}
              investmentWon={investmentWon}
              onAction={onAction}
              now={now}
              fieldError={fieldError}
              onCashErrorChange={setCashError}
              onCashDirtyChange={setCashDirty}
              presentation="edit"
              showSummary={false}
            />
          </div>
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
                onCancel={requestClose}
                onApply={onApply}
              />
            ) : null}
          </footer>
        </div>
        {exampleVisited ? <PortfolioExamplePicker
          draft={draft} investmentWon={investmentWon} now={now} onAction={(action) => {
            onAction(action);
            if (action.type === 'draft-replaced') {
              setCashError(null);
              setCashDirty(false);
              setEditorGeneration((generation) => generation + 1);
            }
          }}
          onClose={closeExamples} onDismiss={requestClose} active={examplePickerOpen} navigationRef={pickerRef}
        /> : null}
      </PortfolioDialog>
      {confirmDiscard ? <PortfolioDialog labelledBy="portfolio-discard-title" returnFocusRef={discardTriggerRef}
        onClose={cancelDiscard}>
        <h2 id="portfolio-discard-title">변경사항을 버릴까요?</h2>
        <p>적용하지 않은 배분과 샘플 구성을 버리고 닫습니다.</p>
        <div className="portfolio-item-sheet__discard-actions">
          <Button type="button" variant="secondary" data-dialog-initial-focus onClick={cancelDiscard}>계속 수정</Button>
          <Button type="button" variant="primary" onClick={discardChanges}>변경 버리기</Button>
        </div>
      </PortfolioDialog> : null}
    </>
  );
}
