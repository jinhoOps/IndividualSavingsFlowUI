import { useEffect, useRef, useState } from 'react';
import { calculateCashflow } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import { buildSankeyGraph } from '../../domain/sankey';
import type { ValidationResult } from '../../domain/validation';
import type { MainState } from '../../application/mainReducer';
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
}: SummaryDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMobileEditor();
  const summary = calculateCashflow(applied);
  const mobileModalOpen = isMobile && activeSection !== null;

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
    if (activeSection !== null && isMobile) {
      if (issues.length === 0 && modalRef.current !== null) {
        getFocusableElements(modalRef.current)[0]?.focus();
      }
      return;
    }
    if (activeSection === null && openerRef.current !== null) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [activeSection, isMobile, issues.length]);

  useEffect(() => {
    if (activeSection === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeSection, dirty, onCancel]);

  function requestClose() {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    setActiveSection(null);
  }

  function requestRestart() {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    onRestart();
  }

  function openEditor(section: DashboardSection, opener: HTMLElement) {
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
    <main aria-labelledby="summary-dashboard-title">
      <div
        aria-hidden={mobileModalOpen ? 'true' : undefined}
        data-testid="dashboard-controls"
        inert={mobileModalOpen || undefined}
      >
      <header>
        <div>
          <p role="status">{saveStatusMessage(saveStatus)}</p>
          <h1 id="summary-dashboard-title">이번 달 자금 흐름</h1>
          <p>수입과 계획 유출, 남는 금액을 먼저 확인하세요.</p>
        </div>
        <button type="button" onClick={requestRestart}>처음부터 다시 설정</button>
      </header>

      <CashflowSummary summary={summary} onEdit={openEditor} />

      <section aria-labelledby="sankey-title">
        <h2 id="sankey-title">월간 현금흐름</h2>
        <CashflowSankey graph={buildSankeyGraph(applied)} />
      </section>

      <section aria-labelledby="category-summary-title">
        <h2 id="category-summary-title">항목별 요약</h2>
        {(Object.keys(sectionLabels) as DashboardSection[]).map((section) => (
          <button
            key={section}
            type="button"
            aria-label={`${sectionLabels[section]} 항목 관리`}
            onClick={(event) => openEditor(section, event.currentTarget)}
          >
            <span>{sectionLabels[section]}</span>
            <span>{sectionTotalLabel(section, applied)}</span>
          </button>
        ))}
      </section>
      </div>

      {activeSection ? (
        isMobile ? (
          <>
            <div aria-hidden="true" data-testid="editor-backdrop" onClick={requestClose} />
            <div aria-labelledby={`${activeSection}-editor-title`} aria-modal="true" onKeyDown={trapModalFocus} ref={modalRef} role="dialog">
              <FinancialEditor
                section={activeSection}
                draft={draft}
                issues={issues}
                focusAttempt={validationAttempt}
                presentation="content"
                onChange={onDraftChange}
                onRequestClose={requestClose}
              />
              <ApplyBar
                dirty={dirty}
                saving={saveStatus === 'saving'}
                onApply={onApply}
                onCancel={onCancel}
              />
            </div>
          </>
        ) : (
          <>
          <FinancialEditor
            section={activeSection}
            draft={draft}
            issues={issues}
            focusAttempt={validationAttempt}
            presentation="panel"
            onChange={onDraftChange}
            onRequestClose={requestClose}
          />
          <ApplyBar
            dirty={dirty}
            saving={saveStatus === 'saving'}
            onApply={onApply}
            onCancel={onCancel}
          />
          </>
        )
      ) : null}
    </main>
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
