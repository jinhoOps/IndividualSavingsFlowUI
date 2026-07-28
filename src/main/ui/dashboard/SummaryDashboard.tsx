import { useEffect, useRef, useState } from 'react';
import { calculateCashflow } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { buildSankeyGraph } from '../../domain/sankey';
import type { ValidationResult } from '../../domain/validation';
import type { MainState } from '../../application/mainReducer';
import { AppErrorBoundary } from '../common/AppErrorBoundary';
import { ApplyBar } from '../editor/ApplyBar';
import { FinancialEditor } from '../editor/FinancialEditor';
import { CashflowSankey } from './CashflowSankey';
import { CashflowSummary, formatDashboardWon, type DashboardSection } from './CashflowSummary';

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
  onRestart(): void;
  onExport?(): void;
  onImportFile?(file: File): void;
  backupStatus?: { kind: 'success' | 'error'; message: string } | null;
}

const sectionLabels: Record<DashboardSection, string> = {
  income: '수입',
  expense: '생활비',
  saving: '저축',
  investment: '투자',
};

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
  onRestart,
  onExport,
  onImportFile,
  backupStatus = null,
}: SummaryDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMobileEditor();
  const summary = calculateCashflow(applied);
  const mobileModalOpen = isMobile && activeSection !== null;
  const saving = saveStatus === 'saving';

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
    const firstIssue = issues[0];
    const section = firstIssue ? sectionForIssue(firstIssue.path) : null;
    if (section !== null && section !== activeSection) setActiveSection(section);
  }, [activeSection, issues]);

  useEffect(() => {
    if (activeSection !== null) {
      if (issues.length === 0) {
        if (isMobile && modalRef.current !== null) {
          getFocusableElements(modalRef.current)[0]?.focus();
        } else {
          document.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
        }
      }
      return;
    }
    if (activeSection === null && openerRef.current !== null) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [activeSection, isMobile]);

  useEffect(() => {
    if (activeSection === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeSection, dirty, onCancel, saving]);

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    setActiveSection(null);
  }

  function requestRestart() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    onRestart();
  }

  function openEditor(section: DashboardSection, opener: HTMLElement) {
    if (saving) return;
    openerRef.current = opener;
    setActiveSection(section);
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
    <main className="relative mx-auto grid min-h-dvh w-full max-w-[1200px] gap-6 px-5 py-7 sm:px-8 sm:py-10" aria-labelledby="summary-dashboard-title">
      <div
        className="grid min-w-0 gap-6"
        aria-hidden={mobileModalOpen ? 'true' : undefined}
        data-testid="dashboard-controls"
        inert={mobileModalOpen || undefined}
      >
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-sm font-black tracking-wide text-accent" role="status">{saveStatusMessage(saveStatus)}</p>
          <h1 className="m-0 mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl" id="summary-dashboard-title">이번 달 자금 흐름</h1>
          <p className="mb-0 mt-3 text-lg text-slate-600">수입과 계획 유출, 남는 금액을 먼저 확인하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {onExport === undefined ? null : (
            <button className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm" type="button" disabled={saving} onClick={onExport}>
              백업 내보내기
            </button>
          )}
          {onImportFile === undefined ? null : (
            <label className="cursor-pointer rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
              백업 가져오기
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                aria-label="JSON 백업 파일"
                disabled={saving}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file !== undefined) onImportFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          )}
          <button className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm" type="button" disabled={saving} onClick={requestRestart}>처음부터 다시 설정</button>
        </div>
      </header>

      {backupStatus === null ? null : (
        <p
          className={`m-0 rounded-xl px-4 py-3 text-sm font-bold ${backupStatus.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`}
          role={backupStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {backupStatus.message}
        </p>
      )}

      <CashflowSummary summary={summary} disabled={saving} onEdit={openEditor} />

      <section className="min-w-0 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-float sm:p-7" aria-labelledby="sankey-title">
        <h2 className="m-0 text-2xl font-bold text-slate-950" id="sankey-title">월간 현금흐름</h2>
        <AppErrorBoundary
          fallback={<p className="mt-5 rounded-2xl bg-amber-50 p-5 font-bold text-amber-900" role="status">현금흐름 차트를 표시하지 못했습니다.</p>}
        >
          <SankeyVisualization data={applied} />
        </AppErrorBoundary>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/65 p-5 sm:p-7" aria-labelledby="category-summary-title">
        <h2 className="m-0 text-xl font-bold text-slate-900" id="category-summary-title">항목별 요약</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(sectionLabels) as DashboardSection[]).map((section) => (
          <button
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-accent/30"
            key={section}
            type="button"
            disabled={saving}
            aria-label={`${sectionLabels[section]} 항목 관리`}
            onClick={(event) => openEditor(section, event.currentTarget)}
          >
            <span>{sectionLabels[section]}</span>
            <span>{sectionTotalLabel(section, applied)}</span>
          </button>
        ))}
        </div>
      </section>
      </div>

      {activeSection === null && dirty ? (
        <ApplyBar
          dirty={dirty}
          saveStatus={saveStatus}
          onApply={onApply}
          onCancel={onCancel}
        />
      ) : null}

      {activeSection ? (
        isMobile ? (
          <>
            <div className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm" aria-hidden="true" data-testid="editor-backdrop" onClick={requestClose} />
            <div className="editor-dialog fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl" aria-labelledby={`${activeSection}-editor-title`} aria-modal="true" onKeyDown={trapModalFocus} ref={modalRef} role="dialog">
              <FinancialEditor
                section={activeSection}
                draft={draft}
                issues={issues}
                focusAttempt={validationAttempt}
                saving={saving}
                presentation="content"
                onChange={onDraftChange}
                onRequestClose={requestClose}
              />
              <ApplyBar
                dirty={dirty}
                saveStatus={saveStatus}
                onApply={onApply}
                onCancel={onCancel}
              />
            </div>
          </>
        ) : (
          <>
          <div className="fixed inset-y-0 right-0 z-30 flex w-[min(34rem,42vw)] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          <FinancialEditor
            section={activeSection}
            draft={draft}
            issues={issues}
            focusAttempt={validationAttempt}
            saving={saving}
            presentation="panel"
            onChange={onDraftChange}
            onRequestClose={requestClose}
          />
          <ApplyBar
            dirty={dirty}
            saveStatus={saveStatus}
            onApply={onApply}
            onCancel={onCancel}
          />
          </div>
          </>
        )
      ) : null}
    </main>
  );
}

function SankeyVisualization({ data }: { data: MainData }) {
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <CashflowSankey graph={buildSankeyGraph(data)} />
    </div>
  );
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

function saveStatusMessage(status: MainState['saveStatus']): string {
  switch (status) {
    case 'saving': return '저장 중';
    case 'saved': return '저장됨';
    case 'error': return '저장에 실패했습니다';
    case 'idle': return '저장된 계획';
  }
}

function sectionTotalLabel(section: DashboardSection, data: MainData): string {
  const values = section === 'income'
    ? data.incomes
    : section === 'expense'
      ? data.expenses
      : section === 'saving'
        ? data.savings
        : data.investments;
  return formatDashboardWon(values.reduce((total, item) => total + Math.max(0, item.amountWon), 0));
}

function sectionForIssue(path: string): DashboardSection | null {
  if (path === 'incomes' || path.startsWith('incomes.')) return 'income';
  if (path === 'expenses' || path.startsWith('expenses.')) return 'expense';
  if (path === 'savings' || path.startsWith('savings.')) return 'saving';
  if (path === 'investments' || path.startsWith('investments.')) return 'investment';
  return null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('aria-hidden'));
}
