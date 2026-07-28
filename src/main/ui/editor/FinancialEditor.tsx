import { useEffect } from 'react';
import type { FinancialItem, IncomeItem, MainData } from '../../domain/model';
import type { ValidationCode, ValidationResult } from '../../domain/validation';
import { MoneyField } from '../common/MoneyField';
import type { DashboardSection } from '../dashboard/CashflowSummary';

type EditorPresentation = 'panel' | 'dialog';
type EditableCollection = 'incomes' | 'expenses' | 'savings' | 'investments';
type ValidationIssue = ValidationResult['issues'][number];

export interface FinancialEditorProps {
  section: DashboardSection;
  draft: MainData;
  issues: ValidationIssue[];
  onChange(draft: MainData): void;
  presentation?: EditorPresentation;
  onRequestClose?(): void;
}

const sectionMeta: Record<DashboardSection, { label: string; collection: EditableCollection; itemLabel: string }> = {
  income: { label: '수입', collection: 'incomes', itemLabel: '새 수입' },
  expense: { label: '생활비', collection: 'expenses', itemLabel: '새 생활비' },
  saving: { label: '저축', collection: 'savings', itemLabel: '새 저축' },
  investment: { label: '투자', collection: 'investments', itemLabel: '새 투자' },
};

export function FinancialEditor({
  section,
  draft,
  issues,
  onChange,
  presentation = 'panel',
  onRequestClose,
}: FinancialEditorProps) {
  const meta = sectionMeta[section];
  const items = draft[meta.collection];
  const titleId = `${section}-editor-title`;
  const firstIssue = issues[0];

  useEffect(() => {
    if (firstIssue === undefined) return;
    const element = document.querySelector<HTMLElement>(validationPathSelector(firstIssue.path))
      ?? document.querySelector<HTMLElement>('[aria-invalid="true"]');
    element?.focus();
  }, [firstIssue]);

  useEffect(() => {
    if (onRequestClose === undefined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRequestClose]);

  function replaceItems(nextItems: FinancialItem[] | IncomeItem[]) {
    onChange({ ...draft, [meta.collection]: nextItems } as MainData);
  }

  function updateItem(index: number, item: FinancialItem | IncomeItem) {
    replaceItems(items.map((current, currentIndex) => currentIndex === index ? item : current));
  }

  function addItem() {
    const id = uniqueItemId(meta.collection, items);
    const base: FinancialItem = { id, name: meta.itemLabel, amountWon: 0 };
    replaceItems(section === 'income' ? [{ ...base, allocations: [] }, ...items] : [base, ...items]);
  }

  function deleteItem(index: number) {
    replaceItems(items.filter((_, currentIndex) => currentIndex !== index));
  }

  const content = (
    <>
      <header>
        <h2 id={titleId}>{meta.label} 편집</h2>
        {onRequestClose ? <button type="button" aria-label="편집기 닫기" onClick={onRequestClose}>닫기</button> : null}
      </header>

      {firstIssue?.path === meta.collection ? <p role="alert">{issueMessage(firstIssue.code)}</p> : null}
      <div>
        <button type="button" data-validation-path={meta.collection} onClick={addItem}>{meta.label} 추가</button>
        {items.map((item, index) => (
          <ItemEditor
            key={item.id}
            item={item}
            index={index}
            collection={meta.collection}
            label={meta.label}
            accounts={draft.accounts}
            issues={issues}
            onChange={(next) => updateItem(index, next)}
            onDelete={() => deleteItem(index)}
          />
        ))}
      </div>
      <AccountEditor accounts={draft.accounts} issues={issues} onChange={(accounts) => onChange({ ...draft, accounts })} />
    </>
  );

  if (presentation === 'dialog') {
    return <div aria-labelledby={titleId} aria-modal="true" role="dialog">{content}</div>;
  }

  return <aside aria-labelledby={titleId}>{content}</aside>;
}

interface ItemEditorProps {
  item: FinancialItem | IncomeItem;
  index: number;
  collection: EditableCollection;
  label: string;
  accounts: MainData['accounts'];
  issues: ValidationIssue[];
  onChange(item: FinancialItem | IncomeItem): void;
  onDelete(): void;
}

function ItemEditor({ item, index, collection, label, accounts, issues, onChange, onDelete }: ItemEditorProps) {
  const itemLabel = item.name.trim() || `${label} ${index + 1}`;
  const namePath = `${collection}.${item.id}.name`;
  const amountPath = `${collection}.${item.id}.amountWon`;
  const accountPath = `${collection}.${item.id}.accountId`;
  const nameIssue = findIssue(issues, namePath);
  const amountIssue = findIssue(issues, amountPath);
  const accountIssue = findIssue(issues, accountPath);

  return (
    <fieldset>
      <legend>{itemLabel}</legend>
      <label htmlFor={`${item.id}-name`}>{itemLabel} 이름</label>
      <input
        id={`${item.id}-name`}
        value={item.name}
        data-validation-path={namePath}
        aria-invalid={nameIssue ? 'true' : undefined}
        aria-describedby={nameIssue ? `${item.id}-name-error` : undefined}
        onChange={(event) => onChange({ ...item, name: event.target.value })}
      />
      {nameIssue ? <p id={`${item.id}-name-error`} role="alert">{issueMessage(nameIssue.code)}</p> : null}

      <MoneyField
        id={`${item.id}-amount`}
        label={`${itemLabel} 월 금액`}
        valueWon={item.amountWon}
        error={amountIssue ? issueMessage(amountIssue.code) : undefined}
        validationPath={amountPath}
        onChange={(amountWon) => onChange({ ...item, amountWon })}
      />

      <label htmlFor={`${item.id}-account`}>{itemLabel} 계좌</label>
      <select
        id={`${item.id}-account`}
        value={item.accountId ?? ''}
        data-validation-path={accountPath}
        aria-invalid={accountIssue ? 'true' : undefined}
        onChange={(event) => onChange({ ...item, accountId: event.target.value || undefined })}
      >
        <option value="">연결 안 함</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      {accountIssue ? <p role="alert">{issueMessage(accountIssue.code)}</p> : null}

      {collection === 'incomes' ? (
        <AllocationEditor
          income={item as IncomeItem}
          accounts={accounts}
          issues={issues}
          onChange={(income) => onChange(income)}
        />
      ) : null}
      <button type="button" onClick={onDelete}>{itemLabel} 삭제</button>
    </fieldset>
  );
}

interface AllocationEditorProps {
  income: IncomeItem;
  accounts: MainData['accounts'];
  issues: ValidationIssue[];
  onChange(income: IncomeItem): void;
}

function AllocationEditor({ income, accounts, issues, onChange }: AllocationEditorProps) {
  const allocationPath = `incomes.${income.id}.allocations`;
  const issue = findIssue(issues, allocationPath);

  function updateAllocation(index: number, patch: Partial<IncomeItem['allocations'][number]>) {
    onChange({
      ...income,
      allocations: income.allocations.map((allocation, allocationIndex) => (
        allocationIndex === index ? { ...allocation, ...patch } : allocation
      )),
    });
  }

  return (
    <section aria-label={`${income.name || '수입'} 배분`}>
      <h3>수입 배분</h3>
      {income.allocations.map((allocation, index) => (
        <div key={`${allocation.accountId}-${index}`}>
          <label htmlFor={`${income.id}-allocation-${index}-account`}>{income.name || '수입'} 배분 계좌</label>
          <select
            id={`${income.id}-allocation-${index}-account`}
            value={allocation.accountId}
            data-validation-path={allocationPath}
            aria-invalid={issue ? 'true' : undefined}
            onChange={(event) => updateAllocation(index, { accountId: event.target.value })}
          >
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <MoneyField
            id={`${income.id}-allocation-${index}-amount`}
            label={`${income.name || '수입'} 배분 금액`}
            valueWon={allocation.amountWon}
            error={issue ? issueMessage(issue.code) : undefined}
            validationPath={allocationPath}
            onChange={(amountWon) => updateAllocation(index, { amountWon })}
          />
          <button
            type="button"
            aria-label={`${income.name || '수입'} 배분 삭제`}
            onClick={() => onChange({ ...income, allocations: income.allocations.filter((_, allocationIndex) => allocationIndex !== index) })}
          >
            배분 삭제
          </button>
        </div>
      ))}
      {issue ? <p role="alert">{issueMessage(issue.code)}</p> : null}
      <button
        type="button"
        aria-label={`${income.name || '수입'} 배분 추가`}
        onClick={() => onChange({
          ...income,
          allocations: [...income.allocations, { accountId: accounts[0]?.id ?? '', amountWon: 0 }],
        })}
      >
        배분 추가
      </button>
    </section>
  );
}

interface AccountEditorProps {
  accounts: MainData['accounts'];
  issues: ValidationIssue[];
  onChange(accounts: MainData['accounts']): void;
}

function AccountEditor({ accounts, issues, onChange }: AccountEditorProps) {
  function addAccount() {
    let nextNumber = accounts.length + 1;
    while (accounts.some((account) => account.id === `account-${nextNumber}`)) nextNumber += 1;
    onChange([...accounts, { id: `account-${nextNumber}`, name: '새 계좌', kind: 'other' }]);
  }

  return (
    <section aria-labelledby="account-editor-title">
      <h3 id="account-editor-title">연결 계좌</h3>
      {accounts.map((account, index) => {
        const issue = findIssue(issues, `accounts.${account.id}.name`);
        return (
          <div key={account.id}>
            <label htmlFor={`${account.id}-account-name`}>계좌 {index + 1} 이름</label>
            <input
              id={`${account.id}-account-name`}
              value={account.name}
              data-validation-path={`accounts.${account.id}.name`}
              aria-invalid={issue ? 'true' : undefined}
              onChange={(event) => onChange(accounts.map((current, currentIndex) => (
                currentIndex === index ? { ...current, name: event.target.value } : current
              )))}
            />
            {issue ? <p role="alert">{issueMessage(issue.code)}</p> : null}
            <label htmlFor={`${account.id}-account-kind`}>계좌 {index + 1} 종류</label>
            <select
              id={`${account.id}-account-kind`}
              value={account.kind}
              onChange={(event) => onChange(accounts.map((current, currentIndex) => (
                currentIndex === index ? { ...current, kind: event.target.value as MainData['accounts'][number]['kind'] } : current
              )))}
            >
              <option value="income">수입</option>
              <option value="spending">지출</option>
              <option value="saving">저축</option>
              <option value="investment">투자</option>
              <option value="other">기타</option>
            </select>
            <button type="button" aria-label={`계좌 ${index + 1} 삭제`} onClick={() => onChange(accounts.filter((_, accountIndex) => accountIndex !== index))}>삭제</button>
          </div>
        );
      })}
      <button type="button" onClick={addAccount}>계좌 추가</button>
    </section>
  );
}

function uniqueItemId(collection: EditableCollection, items: FinancialItem[] | IncomeItem[]): string {
  const prefix = collection.slice(0, -1);
  let number = items.length + 1;
  while (items.some((item) => item.id === `${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function findIssue(issues: ValidationIssue[], path: string): ValidationIssue | undefined {
  return issues.find((candidate) => candidate.path === path);
}

function validationPathSelector(path: string): string {
  return `[data-validation-path="${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function issueMessage(code: ValidationCode): string {
  switch (code) {
    case 'income_required':
      return '수입을 하나 이상 입력해주세요.';
    case 'name_required':
      return '이름을 입력해주세요.';
    case 'amount_negative':
      return '금액은 0원 이상으로 입력해주세요.';
    case 'account_missing':
      return '연결한 계좌를 확인해주세요.';
    case 'allocation_total_mismatch':
      return '수입 금액과 배분 합계가 일치해야 합니다.';
  }
}
