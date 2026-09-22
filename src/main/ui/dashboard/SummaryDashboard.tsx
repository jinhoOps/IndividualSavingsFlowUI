import { ChevronUp } from 'lucide-react';
import { AccountProductBoundary } from '../../../auth/AccountManagementContext';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppContentFrame } from '../../../components/common/AppContentFrame';
import { ResponsiveDialog, type DialogCloseReason } from '../../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../../components/common/ResponsiveDialogLayout';
import type { MainState } from '../../application/mainReducer';
import type { MainData } from '../../domain/model';
import type { ValidationResult } from '../../domain/validation';
import { Surface } from '../common/Surface';
import { Button } from '../common/Button';
import { ApplyBar } from '../editor/ApplyBar';
import { CashflowAllocationSummary } from './CashflowAllocationSummary';
import { MainPlanEditor } from './MainPlanEditor';
import { ExpenseAssistantDialog } from './ExpenseAssistantDialog';
import { RemainingAllocationDialog } from './RemainingAllocationDialog';
import type { ExpenseAssistantRepository } from '../../infrastructure/expenseAssistantRepository';

export interface SummaryDashboardProps {
  applied: MainData;
  draft: MainData;
  dirty: boolean;
  issues: ValidationResult['issues'];
  validationAttempt?: number;
  saveStatus: MainState['saveStatus'];
  onDraftChange(draft: MainData): void;
  onApply(): void;
  onCancel(): void;
  backupStatus?: { kind: 'success' | 'error'; message: string } | null;
  journeyEntry?: ReactNode;
  initialFocusPath?: keyof MainData;
  expenseRepository?: ExpenseAssistantRepository;
  onExpenseApplied?(data: MainData): void;
}

export function SummaryDashboard({
  applied,
  draft,
  dirty,
  issues,
  validationAttempt = 0,
  saveStatus,
  onDraftChange,
  onApply,
  onCancel,
  backupStatus = null,
  journeyEntry,
  initialFocusPath,
  expenseRepository,
  onExpenseApplied,
}: SummaryDashboardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [requestedFocusPath, setRequestedFocusPath] = useState(initialFocusPath);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const submittedEditorRef = useRef(false);
  const saving = saveStatus === 'saving';
  const firstIssuePath = issues[0]?.path;
  const editorFocusPath = (firstIssuePath as keyof MainData | undefined)
    ?? requestedFocusPath;
  const initialFocusConsumed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dirty]);

  useEffect(() => {
    if (firstIssuePath !== undefined && !remainingOpen) setEditorOpen(true);
  }, [firstIssuePath, validationAttempt, remainingOpen]);

  useEffect(() => {
    if (initialFocusPath === undefined || initialFocusConsumed.current) return;
    initialFocusConsumed.current = true;
    setRequestedFocusPath(initialFocusPath);
    setEditorOpen(true);
  }, [initialFocusPath]);

  useEffect(() => {
    if (editorOpen || expenseOpen || remainingOpen) {
      return;
    }

    if (openerRef.current !== null) {
      if (openerRef.current.isConnected) openerRef.current.focus();
      else {
        const returnFocusId = openerRef.current.dataset.returnFocusId;
        window.setTimeout(() => {
          const replacement = returnFocusId
            ? document.querySelector<HTMLElement>(`[data-return-focus-id="${returnFocusId}"]`)
            : null;
          if (replacement !== null) replacement.focus();
          else summaryHeadingRef.current?.focus();
        }, 0);
      }
      openerRef.current = null;
    }
  }, [editorOpen, expenseOpen, remainingOpen, firstIssuePath, initialFocusPath, validationAttempt]);

  useEffect(() => {
    if (!submittedEditorRef.current) return;
    if (saveStatus === 'error' && issues.length === 0) {
      submittedEditorRef.current = false;
      setEditorOpen(false);
      return;
    }
    if (saveStatus !== 'saved' || dirty) return;
    submittedEditorRef.current = false;
    setEditorOpen(false);
  }, [dirty, issues.length, saveStatus]);

  function requestClose(_reason: DialogCloseReason): boolean {
    if (saving) return false;
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return false;
    if (dirty) onCancel();
    return true;
  }

  function openEditor(opener: HTMLElement, focusPath?: keyof MainData) {
    if (saving) return;
    openerRef.current = opener;
    setRequestedFocusPath(focusPath);
    setEditorOpen(true);
    // The modal can already be open on this field; focus again without
    // remounting it or discarding any other draft input.
    if (editorOpen && focusPath) {
      document.querySelector<HTMLElement>(`[data-validation-path="${focusPath}"]`)?.focus();
    }
  }

  function applyEditor(): void {
    submittedEditorRef.current = true;
    onApply();
  }

  return (
    <AppContentFrame
      className="main-dashboard"
      data-testid="main-dashboard-frame"
      aria-labelledby="summary-dashboard-title"
    >
      <div
        className="main-dashboard__content"
        aria-hidden={editorOpen || expenseOpen || remainingOpen ? 'true' : undefined}
        data-testid="dashboard-controls"
        data-exploration-blocked={editorOpen || expenseOpen || remainingOpen || undefined}
        inert={expenseOpen || remainingOpen || undefined}
      >
        <header className="main-dashboard__header">
          <p className="main-eyebrow">자금 흐름</p>
          <h1 className="main-page-title" id="summary-dashboard-title" tabIndex={-1} ref={summaryHeadingRef}>이번 달 자금 흐름</h1>
        </header>

        {backupStatus === null ? null : (
          <p
            className={`m-0 rounded-xl px-4 py-3 text-sm font-bold ${backupStatus.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`}
            role={backupStatus.kind === 'error' ? 'alert' : 'status'}
          >
            {backupStatus.message}
          </p>
        )}

        <Surface as="section" className="main-dashboard__summary" aria-label="월 자금 구성 요약">
          <CashflowAllocationSummary data={applied} onEditAmount={(field, opener) => openEditor(opener, field)} onExpense={expenseRepository && !editorOpen && !dirty ? (opener) => {
            if (saving) return;
            openerRef.current = opener;
            setExpenseOpen(true);
          } : undefined} onRemaining={!editorOpen && (!dirty || remainingOpen) ? opener => {
            if (saving) return;
            openerRef.current = opener;
            setRemainingOpen(true);
          } : undefined} />
          <div className="main-dashboard__edit-dock" data-editor-open={editorOpen || expenseOpen || remainingOpen || undefined}>
          <Button type="button" variant="quiet" className="main-dashboard__edit" data-return-focus-id="main-editor" disabled={saving} onClick={(event) => openEditor(event.currentTarget)}><ChevronUp size={18} aria-hidden="true" />월 금액 편집</Button>
          </div>
        </Surface>

        {journeyEntry === undefined ? null : journeyEntry}
      </div>

      {expenseOpen && expenseRepository ? <ExpenseAssistantDialog repository={expenseRepository} returnFocusRef={openerRef} onClose={() => setExpenseOpen(false)} onApplied={data => onExpenseApplied?.(data)} /> : null}

      {remainingOpen ? <RemainingAllocationDialog applied={applied} dirty={dirty} saveStatus={saveStatus} returnFocusRef={openerRef}
        onDraftChange={onDraftChange} onApply={onApply} onCancel={onCancel} onClose={() => setRemainingOpen(false)} /> : null}

      {!editorOpen && !remainingOpen && dirty ? (
        <ApplyBar
          dirty={dirty}
          saveStatus={saveStatus}
          onApply={onApply}
          onCancel={onCancel}
        />
      ) : null}

      {editorOpen ? (
        <ResponsiveDialog
          open={editorOpen}
          labelledBy="cashflow-editor-title"
          initialFocusSelector={editorFocusPath === undefined ? undefined : `[data-validation-path="${editorFocusPath}"]`}
          size="form"
          busy={saving}
          mobileEntranceMotion
          returnFocusRef={openerRef}
          onRequestClose={requestClose}
          onClosed={() => setEditorOpen(false)}
        >
          <AccountProductBoundary><ResponsiveDialogLayout
            title="월 자금 계획 편집"
            titleId="cashflow-editor-title"
            eyebrow="월간 계획"
            context={<p className="m-0 text-sm text-slate-600">한 달 기준 금액을 입력해 주세요.</p>}
            onClose={() => undefined}
            footer={<ApplyBar dirty={dirty} saveStatus={saveStatus} embedded onApply={applyEditor} onCancel={onCancel} />}
          >
            <MainPlanEditor
              draft={draft}
              issues={issues}
              saving={saving}
              initialFocusPath={editorFocusPath}
              onChange={onDraftChange}
            />
          </ResponsiveDialogLayout></AccountProductBoundary>
        </ResponsiveDialog>
      ) : null}
    </AppContentFrame>
  );
}
