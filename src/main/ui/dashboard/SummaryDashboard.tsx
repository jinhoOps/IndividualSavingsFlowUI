import { animate } from 'animejs';
import { ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppContentFrame } from '../../../components/common/AppContentFrame';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { useAnimeScope } from '../../../components/motion/useAnimeScope';
import type { MainState } from '../../application/mainReducer';
import type { MainData } from '../../domain/model';
import type { ValidationResult } from '../../domain/validation';
import { Surface } from '../common/Surface';
import { Button } from '../common/Button';
import { ApplyBar } from '../editor/ApplyBar';
import { AllocationBar } from '../setup/AllocationBar';
import { CashflowDonutSummary } from './CashflowDonutSummary';
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
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const isMobile = useMobileEditor();
  const mobileModalOpen = isMobile && editorOpen;
  const modalRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    revealEditor(root, 'vertical', reducedMotion);
  }, [mobileModalOpen]);
  const desktopEditorRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    revealEditor(root, 'horizontal', reducedMotion);
  }, [editorOpen, isMobile]);
  const saving = saveStatus === 'saving';
  const firstIssuePath = issues[0]?.path;
  const editorFocusPath = (firstIssuePath as keyof MainData | undefined) ?? initialFocusPath;
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
    setEditorOpen(true);
  }, [initialFocusPath]);

  useEffect(() => {
    if (editorOpen || expenseOpen || remainingOpen) {
      return;
    }

    if (openerRef.current !== null) {
      if (openerRef.current.isConnected) openerRef.current.focus();
      else summaryHeadingRef.current?.focus();
      openerRef.current = null;
    }
  }, [editorOpen, expenseOpen, remainingOpen, firstIssuePath, initialFocusPath, isMobile, validationAttempt]);

  useEffect(() => {
    if (!editorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [dirty, editorOpen, saving]);

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    setEditorOpen(false);
  }

  function openEditor(opener: HTMLElement) {
    if (saving) return;
    openerRef.current = opener;
    setEditorOpen(true);
  }

  function trapModalFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || modalRef.current === null) return;
    const focusable = getFocusableElements(modalRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <AppContentFrame
      className="main-dashboard"
      data-testid="main-dashboard-frame"
      aria-labelledby="summary-dashboard-title"
    >
      <div
        className="main-dashboard__content"
        aria-hidden={mobileModalOpen || expenseOpen || remainingOpen ? 'true' : undefined}
        data-testid="dashboard-controls"
        inert={mobileModalOpen || expenseOpen || remainingOpen || undefined}
      >
        <header className="main-dashboard__header">
          <p className="main-eyebrow">자금 흐름</p>
          <h1 className="main-page-title" id="summary-dashboard-title" tabIndex={-1} ref={summaryHeadingRef}>이번 달 자금 흐름</h1>
          <p className="main-dashboard__description">수입과 지출, 저축, 투자 뒤에 남는 돈을 확인하세요.</p>
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
          <CashflowDonutSummary data={applied} onExpense={expenseRepository && !editorOpen && !dirty ? (opener) => {
            if (saving) return;
            openerRef.current = opener;
            setExpenseOpen(true);
          } : undefined} onRemaining={!editorOpen && (!dirty || remainingOpen) ? opener => {
            if (saving) return;
            openerRef.current = opener;
            setRemainingOpen(true);
          } : undefined} />
          <div className="main-dashboard__edit-dock" data-editor-open={editorOpen || expenseOpen || remainingOpen || undefined}>
            <Button type="button" variant="quiet" className="main-dashboard__edit" disabled={saving} onClick={(event) => openEditor(event.currentTarget)}><ChevronUp size={18} aria-hidden="true" />월 금액 편집</Button>
          </div>
        </Surface>

        {journeyEntry === undefined ? null : journeyEntry}

        <details className="allocation-details">
          <summary className="allocation-details__summary">자세히 보기</summary>
          <Surface as="section" className="mt-4 min-w-0 p-5 sm:p-6" aria-labelledby="cashflow-allocation-title">
            <h2 className="m-0 text-2xl font-bold text-slate-950" id="cashflow-allocation-title">월 자금 구성</h2>
            <div className="mt-5">
              <AllocationBar data={applied} />
            </div>
          </Surface>
        </details>
      </div>

      {expenseOpen && expenseRepository ? <ExpenseAssistantDialog repository={expenseRepository} onClose={() => setExpenseOpen(false)} onApplied={data => onExpenseApplied?.(data)} /> : null}

      {remainingOpen ? <RemainingAllocationDialog applied={applied} dirty={dirty} saveStatus={saveStatus}
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
        isMobile ? (
          <>
            <div className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm" aria-hidden="true" data-testid="editor-backdrop" onClick={requestClose} />
            <div
              className="main-editor-sheet"
              aria-labelledby="cashflow-editor-title"
              aria-modal="true"
              onKeyDown={trapModalFocus}
              ref={modalRef}
              role="dialog"
            >
              <MainPlanEditor
                draft={draft}
                issues={issues}
                saving={saving}
                presentation="content"
                initialFocusPath={editorFocusPath}
                onChange={onDraftChange}
                onRequestClose={requestClose}
              />
              <ApplyBar dirty={dirty} saveStatus={saveStatus} onApply={onApply} onCancel={onCancel} />
            </div>
          </>
        ) : (
          <div
            className="main-editor-panel"
            ref={desktopEditorRef}
          >
            <MainPlanEditor
              draft={draft}
              issues={issues}
              saving={saving}
              presentation="panel"
              initialFocusPath={editorFocusPath}
              onChange={onDraftChange}
              onRequestClose={requestClose}
            />
            <ApplyBar dirty={dirty} saveStatus={saveStatus} onApply={onApply} onCancel={onCancel} />
          </div>
        )
      ) : null}
    </AppContentFrame>
  );
}

function revealEditor(
  target: HTMLElement,
  direction: 'vertical' | 'horizontal',
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    setEditorRevealFinalState(target, direction);
    return;
  }
  try {
    animate(target, {
      opacity: [0, 1],
      ...(direction === 'vertical'
        ? { y: [MOTION_DISTANCE_PX.reveal, 0] }
        : { x: [MOTION_DISTANCE_PX.reveal, 0] }),
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });
  } catch {
    setEditorRevealFinalState(target, direction);
  }
}

function setEditorRevealFinalState(
  target: HTMLElement,
  direction: 'vertical' | 'horizontal',
): void {
  target.style.opacity = '1';
  target.style.transform = direction === 'vertical' ? 'translateY(0px)' : 'translateX(0px)';
}

function useMobileEditor(): boolean {
  const query = '(max-width: 767px)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true);

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia === undefined) return;
    const mediaQuery = window.matchMedia(query);
    const update = () => setMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return mobile;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('aria-hidden'));
}
