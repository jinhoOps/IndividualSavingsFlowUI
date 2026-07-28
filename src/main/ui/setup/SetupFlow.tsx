import type { MainData, SetupStep, FinancialItem, IncomeItem, Account } from '../../domain/model';
import type { ValidationCode } from '../../domain/validation';
import { MoneyField } from '../common/MoneyField';

export interface ValidationIssue {
  path: string;
  code: ValidationCode;
}

export interface SetupFlowProps {
  draft: MainData;
  step: SetupStep;
  issues: ValidationIssue[];
  onChange(draft: MainData): void;
  onStepChange(step: SetupStep): void;
  onApply(): void;
}

const steps: SetupStep[] = ['welcome', 'income', 'expense', 'saving-investment', 'account', 'review'];

const stepLabels: Record<SetupStep, string> = {
  welcome: '시작',
  income: '수입',
  expense: '생활비',
  'saving-investment': '저축·투자',
  account: '계좌',
  review: '확인',
};

export function SetupFlow({ draft, step, issues, onChange, onStepChange, onApply }: SetupFlowProps) {
  const stepIndex = steps.indexOf(step);
  const previousStep = steps[stepIndex - 1];
  const nextStep = steps[stepIndex + 1];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'review') {
      onApply();
      return;
    }
    if (nextStep) onStepChange(nextStep);
  }

  return (
    <section aria-labelledby="setup-flow-title">
      <p id="setup-flow-title" role="status">{stepIndex + 1} / {steps.length} · {stepLabels[step]}</p>
      <form aria-label="설정 단계" onSubmit={submit}>
        {step === 'welcome' ? <WelcomeStep /> : null}
        {step === 'income' ? <IncomeStep draft={draft} issues={issues} onChange={onChange} /> : null}
        {step === 'expense' ? <ExpenseStep draft={draft} issues={issues} onChange={onChange} /> : null}
        {step === 'saving-investment' ? <SavingInvestmentStep draft={draft} issues={issues} onChange={onChange} /> : null}
        {step === 'account' ? <AccountStep draft={draft} issues={issues} onChange={onChange} /> : null}
        {step === 'review' ? <ReviewStep draft={draft} /> : null}

        <nav aria-label="설정 이동">
          {previousStep ? <button type="button" onClick={() => onStepChange(previousStep)}>이전</button> : null}
          <button type="submit">{step === 'review' ? '계획 적용' : '다음'}</button>
        </nav>
      </form>
    </section>
  );
}

function WelcomeStep() {
  return (
    <>
      <h1>내 자금 계획을 시작합니다</h1>
      <p>먼저 매달 들어오는 수입과 생활비를 간단히 적어볼게요.</p>
    </>
  );
}

function IncomeStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  const income = draft.incomes[0] ?? createIncome(draft.incomes.length);
  const issue = findIssue(issues, `incomes.${income.id}.name`);
  const amountIssue = findIssue(issues, `incomes.${income.id}.amountWon`);

  return (
    <>
      <h1>월 수입을 알려주세요</h1>
      <p>흐름의 출발점입니다. 한 달에 실제로 들어오는 금액을 적어주세요.</p>
      <TextField
        id="income-name"
        label="수입 이름"
        value={income.name}
        error={issue}
        onChange={(name) => onChange({ ...draft, incomes: [{ ...income, name }] })}
      />
      <MoneyField
        id="income-amount"
        label="월 금액"
        valueWon={income.amountWon}
        error={amountIssue}
        onChange={(amountWon) => onChange({ ...draft, incomes: [{ ...income, amountWon }] })}
      />
    </>
  );
}

function ExpenseStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  const expense = draft.expenses[0] ?? createItem('expense', draft.expenses.length, '생활비');
  const nameIssue = findIssue(issues, `expenses.${expense.id}.name`);
  const amountIssue = findIssue(issues, `expenses.${expense.id}.amountWon`);

  return (
    <>
      <h1>월 생활비를 알려주세요</h1>
      <p>매달 꼭 나가는 생활비부터 적으면 수입과 지출의 균형을 바로 볼 수 있어요.</p>
      <TextField
        id="expense-name"
        label="생활비 이름"
        value={expense.name}
        error={nameIssue}
        onChange={(name) => onChange({ ...draft, expenses: [{ ...expense, name }] })}
      />
      <MoneyField
        id="expense-amount"
        label="월 금액"
        valueWon={expense.amountWon}
        error={amountIssue}
        onChange={(amountWon) => onChange({ ...draft, expenses: [{ ...expense, amountWon }] })}
      />
    </>
  );
}

function SavingInvestmentStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  const saving = draft.savings[0] ?? createItem('saving', draft.savings.length, '저축');
  const investment = draft.investments[0] ?? createItem('investment', draft.investments.length, '투자');

  return (
    <>
      <h1>저축과 투자를 알려주세요</h1>
      <p>지금 정해둔 금액이 있다면 적어주세요. 나중에 언제든 바꿀 수 있어요.</p>
      <MoneyField
        id="saving-amount"
        label="월 저축 금액"
        valueWon={saving.amountWon}
        error={findIssue(issues, `savings.${saving.id}.amountWon`)}
        onChange={(amountWon) => onChange({ ...draft, savings: [{ ...saving, amountWon }] })}
      />
      <MoneyField
        id="investment-amount"
        label="월 투자 금액"
        valueWon={investment.amountWon}
        error={findIssue(issues, `investments.${investment.id}.amountWon`)}
        onChange={(amountWon) => onChange({ ...draft, investments: [{ ...investment, amountWon }] })}
      />
    </>
  );
}

function AccountStep({ draft, issues, onChange }: Pick<SetupFlowProps, 'draft' | 'issues' | 'onChange'>) {
  const account = draft.accounts[0] ?? createAccount(draft.accounts.length);

  return (
    <>
      <h1>계좌를 알려주세요</h1>
      <p>계좌 이름은 나중에 자금의 이동을 이해하는 데만 쓰입니다.</p>
      <TextField
        id="account-name"
        label="계좌 이름"
        value={account.name}
        error={findIssue(issues, `accounts.${account.id}.name`)}
        onChange={(name) => onChange({ ...draft, accounts: [{ ...account, name }] })}
      />
    </>
  );
}

function ReviewStep({ draft }: Pick<SetupFlowProps, 'draft'>) {
  return (
    <>
      <h1>입력한 월 자금 계획을 확인해주세요</h1>
      <dl>
        <div><dt>월 수입</dt><dd>{formatWon(total(draft.incomes))}</dd></div>
        <div><dt>월 생활비</dt><dd>{formatWon(total(draft.expenses))}</dd></div>
        <div><dt>월 저축</dt><dd>{formatWon(total(draft.savings))}</dd></div>
        <div><dt>월 투자</dt><dd>{formatWon(total(draft.investments))}</dd></div>
      </dl>
    </>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange(value: string): void;
}

function TextField({ id, label, value, error, onChange }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

function createIncome(index: number): IncomeItem {
  return { ...createItem('income', index, ''), allocations: [] };
}

function createItem(kind: 'income' | 'expense' | 'saving' | 'investment', index: number, name: string): FinancialItem {
  return { id: `${kind}-${index + 1}`, name, amountWon: 0 };
}

function createAccount(index: number): Account {
  return { id: `account-${index + 1}`, name: '', kind: 'other' };
}

function findIssue(issues: ValidationIssue[], path: string): string | undefined {
  const issue = issues.find((candidate) => candidate.path === path);
  return issue ? issueMessage(issue.code) : undefined;
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

function total(items: FinancialItem[]): number {
  return items.reduce((sum, item) => sum + item.amountWon, 0);
}

function formatWon(amountWon: number): string {
  return `${amountWon.toLocaleString('ko-KR')}원`;
}
