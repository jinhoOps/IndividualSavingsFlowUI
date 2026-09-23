import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../../components/common/Button';
import { ResponsiveDialog, useResponsiveDialogClose } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogActionRow, ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { AccountProductBoundary } from '../../auth/AccountManagementContext';
import type { PortfolioAction } from '../application/portfolioReducer';
import type { PortfolioDraft } from '../domain/model';
import type { PortfolioSampleSelection } from '../domain/samplePreset';
import { AllocationEditor, type AllocationEditorItemNavigation } from './AllocationEditor';
import { PortfolioApplyBar } from './PortfolioApplyBar';
import { PortfolioEditorSummary } from './PortfolioEditorSummary';
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
  initialSample,
  openExamples = false,
  onSampleIntentOpened,
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
  initialSample?: PortfolioSampleSelection;
  openExamples?: boolean;
  onSampleIntentOpened?(): void;
}) {
  const [cashError, setCashError] = useState<string | null>(null);
  const [stage, setStage] = useState<'allocation' | 'item' | 'examples'>('allocation');
  const [itemMode, setItemMode] = useState<'add' | 'edit'>('edit');
  const [exampleVisited, setExampleVisited] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [cashDirty, setCashDirty] = useState(false);
  const [itemEditing, setItemEditing] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const pickerRef = useRef<PortfolioExampleNavigation>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);
  const discardTriggerRef = useRef<HTMLElement | null>(null);
  const pendingCloseRef = useRef<((approved: boolean) => void) | null>(null);
  const itemNavigationRef = useRef<AllocationEditorItemNavigation>(null);
  const sampleIntentOpenedRef = useRef(false);

  useEffect(() => {
    if (!openExamples || stage === 'examples' || sampleIntentOpenedRef.current) return;
    sampleIntentOpenedRef.current = true;
    setExampleVisited(true);
    setStage('examples');
    onSampleIntentOpened?.();
  }, [onSampleIntentOpened, openExamples, stage]);

  useEffect(() => () => {
    pendingCloseRef.current?.(false);
    pendingCloseRef.current = null;
  }, []);

  function requestClose(): boolean | Promise<boolean> {
    if (applying) return false;
    if (stage === 'item') {
      itemNavigationRef.current?.requestClose();
      return false;
    }
    if (stage === 'examples') {
      if (!pickerRef.current?.hasChanges) {
        pickerRef.current?.back();
        return false;
      }
      discardTriggerRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscard(true);
      return new Promise((resolve) => { pendingCloseRef.current = resolve; });
    }
    if (itemEditing) return false;
    if (dirty || cashDirty || cashError || fieldError || pickerRef.current?.hasChanges) {
      discardTriggerRef.current = document.activeElement as HTMLElement | null;
      setConfirmDiscard(true);
      return new Promise((resolve) => { pendingCloseRef.current = resolve; });
    }
    return true;
  }

  function cancelDiscard(): void {
    setConfirmDiscard(false);
    const resolve = pendingCloseRef.current;
    pendingCloseRef.current = null;
    resolve?.(false);
  }

  function discardChanges(): void {
    setConfirmDiscard(false);
    const resolve = pendingCloseRef.current;
    pendingCloseRef.current = null;
    if (resolve) resolve(true);
    else onCancel();
  }

  function closeExamples(): void {
    setStage('allocation');
    requestAnimationFrame(() => sampleTriggerRef.current?.focus());
  }

  return (
    <>
      <ResponsiveDialog
        open
        className={`portfolio-edit-surface${stage === 'examples' ? ' portfolio-edit-surface--examples' : ''}`}
        labelledBy="portfolio-edit-title"
        size={stage === 'examples' ? 'wide' : 'form'}
        mobileHeight={stage === 'examples' ? 'full' : 'content'}
        busy={applying}
        returnFocusRef={returnFocusRef}
        onRequestClose={() => requestClose()}
        onClosed={() => {
          onCancel();
          onSheetDismissed?.();
          requestAnimationFrame(() => {
            document.querySelector<HTMLElement>('[data-return-focus-id="portfolio-edit"]')?.focus();
          });
        }}
      >
        <AccountProductBoundary><ResponsiveDialogLayout
          title={stage === 'item' ? `투자 대상 ${itemMode === 'add' ? '추가' : '수정'}` : stage === 'examples' ? '샘플로 구성하기' : '투자 배분 수정'}
          titleId="portfolio-edit-title"
          eyebrow={stage === 'examples' ? '포트폴리오 샘플' : '월 투자 배분'}
          layout="edit"
          onBack={stage === 'item'
            ? () => itemNavigationRef.current?.requestClose()
            : stage === 'examples' ? () => pickerRef.current?.back() : undefined}
          onClose={() => undefined}
          context={<PortfolioEditorSummary draft={draft} investmentWon={investmentWon} />}
          contextHidden={stage !== 'allocation'}
          status={showSaving ? <p role="status">저장 중</p> : undefined}
          bodyClassName="portfolio-edit-surface__body"
          footer={stage === 'allocation' && !itemEditing && dirty ? (
            <PortfolioApplyBar
              dirty
              saveError={saveError}
              fieldError={cashError ?? fieldError}
              applying={applying}
              showAmounts={showAmounts}
              draft={draft}
              investmentWon={investmentWon}
              onCancel={() => { void requestClose(); }}
              onApply={onApply}
            />
          ) : undefined}
        >
          {stage === 'examples' && exampleVisited ? <PortfolioExamplePicker
            embedded
            draft={draft} investmentWon={investmentWon} now={now} onAction={(action) => {
              onAction(action);
              if (action.type === 'draft-replaced') {
                setCashError(null);
                setCashDirty(false);
                setEditorGeneration((generation) => generation + 1);
              }
            }}
            onClose={closeExamples} active navigationRef={pickerRef}
            initialSample={initialSample}
          /> : (
            <>
              {stage === 'allocation' ? <Button ref={sampleTriggerRef} type="button" variant="quiet" className="portfolio-edit-surface__samples"
                disabled={itemEditing}
                onClick={() => { setExampleVisited(true); setStage('examples'); }}>샘플로 구성하기</Button> : null}
            <AllocationEditor
              key={editorGeneration}
              draft={draft}
              investmentWon={investmentWon}
              onAction={onAction}
              now={now}
              fieldError={fieldError}
              onCashErrorChange={setCashError}
              onCashDirtyChange={setCashDirty}
              onItemEditingChange={(editing, mode) => {
                setItemEditing(editing);
                if (editing) {
                  setItemMode(mode ?? 'edit');
                  setStage('item');
                } else setStage('allocation');
              }}
              itemNavigationRef={itemNavigationRef}
              presentation="edit"
              showSummary={false}
            />
            </>
          )}
        </ResponsiveDialogLayout></AccountProductBoundary>
      </ResponsiveDialog>
      {confirmDiscard ? <ResponsiveDialog open labelledBy="portfolio-discard-title" returnFocusRef={discardTriggerRef}
        size="compact" onRequestClose={() => true} onClosed={cancelDiscard}>
        <AccountProductBoundary><ResponsiveDialogLayout title="변경사항을 버릴까요?" titleId="portfolio-discard-title" layout="confirm"
          onClose={cancelDiscard} closeInitialFocus={false}
          footer={<PortfolioDiscardActions onContinue={cancelDiscard} onDiscard={discardChanges} />}>
          <p>적용하지 않은 배분과 샘플 구성을 버리고 닫습니다.</p>
        </ResponsiveDialogLayout></AccountProductBoundary>
      </ResponsiveDialog> : null}
    </>
  );
}

function PortfolioDiscardActions({ onContinue, onDiscard }: { onContinue(): void; onDiscard(): void }) {
  const requestDialogClose = useResponsiveDialogClose();
  return (
    <ResponsiveDialogActionRow>
      <Button type="button" variant="secondary" data-dialog-initial-focus onClick={() => {
        onContinue();
        requestDialogClose?.('button');
      }}>계속 수정</Button>
      <Button type="button" variant="primary" onClick={onDiscard}>변경 버리기</Button>
    </ResponsiveDialogActionRow>
  );
}
