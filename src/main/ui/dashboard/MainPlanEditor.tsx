import { useLayoutEffect, useRef } from 'react';
import type { MainData } from '../../domain/model';
import type { ValidationCode, ValidationResult } from '../../domain/validation';
import { MoneyField } from '../common/MoneyField';

export interface MainPlanEditorProps {
  draft: MainData;
  issues: ValidationResult['issues'];
  saving: boolean;
  initialFocusPath?: keyof MainData;
  onChange(draft: MainData): void;
}

/** Main's controlled five-value editor. Presentation hosts own dismissal and persistence. */
export function MainPlanEditor({
  draft,
  issues,
  saving,
  initialFocusPath,
  onChange,
}: MainPlanEditorProps) {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    if (initialFocusPath === undefined) return;
    const target = root.querySelector<HTMLElement>(validationPathSelector(initialFocusPath));
    target?.focus();
  }, [initialFocusPath]);

  return (
    <section ref={rootRef} className="main-plan-editor" aria-busy={saving ? 'true' : undefined} aria-label="월 자금 계획 입력">
      <fieldset className="main-plan-editor__fields" disabled={saving}>
        <legend className="sr-only">월 자금 계획</legend>
        <MoneyField id="dashboard-monthly-net-income" label="월 실수령액" valueWon={draft.monthlyNetIncomeWon} error={findIssue(issues, 'monthlyNetIncomeWon')} validationPath="monthlyNetIncomeWon" disabled={saving} adjustmentsVisibility="focused" onChange={(valueWon) => onChange({ ...draft, monthlyNetIncomeWon: valueWon })} />
        <MoneyField id="dashboard-monthly-housing" label="월 주거 고정비" valueWon={draft.monthlyHousingWon} error={findIssue(issues, 'monthlyHousingWon')} validationPath="monthlyHousingWon" disabled={saving} adjustmentsVisibility="focused" onChange={(valueWon) => onChange({ ...draft, monthlyHousingWon: valueWon })} />
        <MoneyField id="dashboard-monthly-living" label="월평균 생활비" valueWon={draft.monthlyLivingWon} error={findIssue(issues, 'monthlyLivingWon')} validationPath="monthlyLivingWon" disabled={saving} adjustmentsVisibility="focused" onChange={(valueWon) => onChange({ ...draft, monthlyLivingWon: valueWon })} />
        <MoneyField id="dashboard-monthly-saving" label="월 저축액" valueWon={draft.monthlySavingWon} error={findIssue(issues, 'monthlySavingWon')} validationPath="monthlySavingWon" disabled={saving} adjustmentsVisibility="focused" onChange={(valueWon) => onChange({ ...draft, monthlySavingWon: valueWon })} />
        <MoneyField id="dashboard-monthly-investment" label="월 투자액" valueWon={draft.monthlyInvestmentWon} error={findIssue(issues, 'monthlyInvestmentWon')} validationPath="monthlyInvestmentWon" disabled={saving} adjustmentsVisibility="focused" onChange={(valueWon) => onChange({ ...draft, monthlyInvestmentWon: valueWon })} />
      </fieldset>
    </section>
  );
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
