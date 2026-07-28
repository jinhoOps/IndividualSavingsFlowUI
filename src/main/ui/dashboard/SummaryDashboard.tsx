import { useEffect, useState } from 'react';
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
  saveStatus,
  onDraftChange,
  onApply,
  onCancel,
  onRestart,
}: SummaryDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection | null>(null);
  const isMobile = useMobileEditor();
  const summary = calculateCashflow(applied);

  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [dirty]);

  function requestClose() {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    setActiveSection(null);
  }

  return (
    <main aria-labelledby="summary-dashboard-title">
      <header>
        <div>
          <p role="status">{saveStatusMessage(saveStatus)}</p>
          <h1 id="summary-dashboard-title">이번 달 자금 흐름</h1>
          <p>수입과 계획 유출, 남는 금액을 먼저 확인하세요.</p>
        </div>
        <button type="button" onClick={onRestart}>처음부터 다시 설정</button>
      </header>

      <CashflowSummary summary={summary} onEdit={setActiveSection} />

      <section aria-labelledby="sankey-title">
        <h2 id="sankey-title">월간 현금흐름</h2>
        <CashflowSankey graph={buildSankeyGraph(applied)} />
      </section>

      <section aria-labelledby="category-summary-title">
        <h2 id="category-summary-title">항목별 요약</h2>
        {(Object.keys(sectionLabels) as DashboardSection[]).map((section) => (
          <button key={section} type="button" aria-label={`${sectionLabels[section]} 항목 관리`} onClick={() => setActiveSection(section)}>
            <span>{sectionLabels[section]}</span>
            <span>{sectionTotalLabel(section, applied)}</span>
          </button>
        ))}
      </section>

      {activeSection ? (
        <>
          {isMobile ? <button type="button" aria-label="편집기 배경 닫기" onClick={requestClose} /> : null}
          <FinancialEditor
            section={activeSection}
            draft={draft}
            issues={issues}
            presentation={isMobile ? 'dialog' : 'panel'}
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
