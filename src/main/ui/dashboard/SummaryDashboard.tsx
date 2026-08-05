import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MainState } from '../../application/mainReducer';
import { calculateCashflow } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';
import type { ValidationCode, ValidationResult } from '../../domain/validation';
import { Button } from '../common/Button';
import { MoneyField } from '../common/MoneyField';
import { Surface } from '../common/Surface';
import { ApplyBar } from '../editor/ApplyBar';
import { AllocationBar } from '../setup/AllocationBar';
import { CashflowDonutSummary } from './CashflowDonutSummary';
import { CashflowSummary } from './CashflowSummary';

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
  journeyEntry?: ReactNode;
  initialFocusPath?: keyof MainData;
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
  onRestart,
  onExport,
  onImportFile,
  backupStatus = null,
  journeyEntry,
  initialFocusPath,
}: SummaryDashboardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const desktopEditorRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMobileEditor();
  const summary = calculateCashflow(applied);
  const mobileModalOpen = isMobile && editorOpen;
  const saving = saveStatus === 'saving';
  const firstIssuePath = issues[0]?.path;
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
    if (firstIssuePath !== undefined) setEditorOpen(true);
  }, [firstIssuePath, validationAttempt]);

  useEffect(() => {
    if (initialFocusPath === undefined || initialFocusConsumed.current) return;
    initialFocusConsumed.current = true;
    setEditorOpen(true);
  }, [initialFocusPath]);

  useEffect(() => {
    if (editorOpen) {
      const container = isMobile ? modalRef.current : desktopEditorRef.current;
      if (container === null) return;
      const focusPath = firstIssuePath ?? initialFocusPath;
      if (focusPath !== undefined) {
        container.querySelector<HTMLElement>(validationPathSelector(focusPath))?.focus();
      } else if (isMobile) {
        getFocusableElements(container)[0]?.focus();
      } else {
        container.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
      }
      return;
    }

    if (openerRef.current !== null) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [editorOpen, firstIssuePath, initialFocusPath, isMobile, validationAttempt]);

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

  function requestRestart() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
    if (dirty) onCancel();
    onRestart();
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
            <p className="mb-0 mt-3 text-lg text-slate-600">수입과 소비, 저축, 투자 뒤에 남는 돈을 확인하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            {onExport === undefined ? null : (
              <Button className="rounded-full bg-white/80 text-sm shadow-sm" type="button" disabled={saving} onClick={onExport}>
                백업 내보내기
              </Button>
            )}
            {onImportFile === undefined ? null : (
              <label
                aria-disabled={saving ? 'true' : undefined}
                className="backup-import-action ui-button ui-button--secondary rounded-full bg-white/80 text-sm shadow-sm"
              >
                백업 가져오기
                <input
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  aria-label="백업 가져오기"
                  disabled={saving}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file !== undefined) onImportFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            )}
            <Button className="rounded-full bg-white/80 text-sm shadow-sm" type="button" disabled={saving} onClick={requestRestart}>처음부터 다시 설정</Button>
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

        <Surface as="section" className="min-w-0 bg-white/85 p-5 shadow-float sm:p-7" aria-label="월 자금 구성 요약">
          <CashflowDonutSummary data={applied} />
        </Surface>

        <CashflowSummary summary={summary} disabled={saving} onEdit={openEditor} />

        {journeyEntry === undefined ? null : journeyEntry}

        <details className="allocation-details">
          <summary className="allocation-details__summary">자세히 보기</summary>
          <Surface as="section" className="mt-4 min-w-0 bg-white/85 p-5 shadow-float sm:p-7" aria-labelledby="cashflow-allocation-title">
            <h2 className="m-0 text-2xl font-bold text-slate-950" id="cashflow-allocation-title">월 자금 구성</h2>
            <div className="mt-5">
              <AllocationBar data={applied} />
            </div>
          </Surface>
        </details>
      </div>

      {!editorOpen && dirty ? (
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
              className="editor-dialog fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
              aria-labelledby="cashflow-editor-title"
              aria-modal="true"
              onKeyDown={trapModalFocus}
              ref={modalRef}
              role="dialog"
            >
              <ScalarEditor
                draft={draft}
                issues={issues}
                saving={saving}
                presentation="content"
                onChange={onDraftChange}
                onRequestClose={requestClose}
              />
              <ApplyBar dirty={dirty} saveStatus={saveStatus} onApply={onApply} onCancel={onCancel} />
            </div>
          </>
        ) : (
          <div
            className="fixed inset-y-0 right-0 z-30 flex w-[min(34rem,42vw)] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
            ref={desktopEditorRef}
          >
            <ScalarEditor
              draft={draft}
              issues={issues}
              saving={saving}
              presentation="panel"
              onChange={onDraftChange}
              onRequestClose={requestClose}
            />
            <ApplyBar dirty={dirty} saveStatus={saveStatus} onApply={onApply} onCancel={onCancel} />
          </div>
        )
      ) : null}
    </main>
  );
}

interface ScalarEditorProps {
  draft: MainData;
  issues: ValidationResult['issues'];
  saving: boolean;
  presentation: 'content' | 'panel';
  onChange(draft: MainData): void;
  onRequestClose(): void;
}

function ScalarEditor({
  draft,
  issues,
  saving,
  presentation,
  onChange,
  onRequestClose,
}: ScalarEditorProps) {
  const className = presentation === 'content'
    ? 'grid gap-6 p-5 sm:p-7'
    : 'grid flex-1 content-start gap-6 p-6';
  const content = (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-sm font-black tracking-wide text-accent">MONTHLY FLOW</p>
          <h2 className="m-0 mt-2 text-2xl font-bold text-slate-950" id="cashflow-editor-title">월 자금 계획 편집</h2>
        </div>
        <Button type="button" variant="quiet" aria-label="편집기 닫기" data-dialog-initial-focus disabled={saving} onClick={onRequestClose}>닫기</Button>
      </header>
      <fieldset className="grid gap-6" disabled={saving}>
        <legend className="sr-only">월 자금 계획</legend>
        <MoneyField
          id="dashboard-monthly-net-income"
          label="월 실수령액"
          valueWon={draft.monthlyNetIncomeWon}
          error={findIssue(issues, 'monthlyNetIncomeWon')}
          validationPath="monthlyNetIncomeWon"
          disabled={saving}
          adjustmentsVisibility="focused"
          onChange={(valueWon) => onChange({ ...draft, monthlyNetIncomeWon: valueWon })}
        />
        <MoneyField
          id="dashboard-monthly-housing"
          label="월 주거 고정비"
          valueWon={draft.monthlyHousingWon}
          error={findIssue(issues, 'monthlyHousingWon')}
          validationPath="monthlyHousingWon"
          disabled={saving}
          adjustmentsVisibility="focused"
          onChange={(valueWon) => onChange({ ...draft, monthlyHousingWon: valueWon })}
        />
        <MoneyField
          id="dashboard-monthly-living"
          label="월평균 생활비"
          valueWon={draft.monthlyLivingWon}
          error={findIssue(issues, 'monthlyLivingWon')}
          validationPath="monthlyLivingWon"
          disabled={saving}
          adjustmentsVisibility="focused"
          onChange={(valueWon) => onChange({ ...draft, monthlyLivingWon: valueWon })}
        />
        <MoneyField
          id="dashboard-monthly-saving"
          label="월 저축액"
          valueWon={draft.monthlySavingWon}
          error={findIssue(issues, 'monthlySavingWon')}
          validationPath="monthlySavingWon"
          disabled={saving}
          adjustmentsVisibility="focused"
          onChange={(valueWon) => onChange({ ...draft, monthlySavingWon: valueWon })}
        />
        <MoneyField
          id="dashboard-monthly-investment"
          label="월 투자액"
          valueWon={draft.monthlyInvestmentWon}
          error={findIssue(issues, 'monthlyInvestmentWon')}
          validationPath="monthlyInvestmentWon"
          disabled={saving}
          adjustmentsVisibility="focused"
          onChange={(valueWon) => onChange({ ...draft, monthlyInvestmentWon: valueWon })}
        />
      </fieldset>
    </>
  );

  return presentation === 'content'
    ? <section className={className} aria-busy={saving ? 'true' : undefined} aria-labelledby="cashflow-editor-title">{content}</section>
    : <aside className={className} aria-busy={saving ? 'true' : undefined} aria-labelledby="cashflow-editor-title">{content}</aside>;
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

function findIssue(issues: ValidationResult['issues'], path: string): string | undefined {
  const issue = issues.find((candidate) => candidate.path === path);
  return issue ? issueMessage(issue.code) : undefined;
}

function issueMessage(code: ValidationCode): string {
  switch (code) {
    case 'income_required': return '수입을 먼저 입력해주세요.';
    case 'amount_negative': return '금액은 0원 이상으로 입력해주세요.';
    case 'amount_not_safe_integer': return '입력할 수 있는 금액 범위를 확인해주세요.';
  }
}

function validationPathSelector(path: string): string {
  return `[data-validation-path="${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('aria-hidden'));
}
