export const LOAN_METHODS = ['equal-payment', 'equal-principal', 'bullet'] as const;
export type LoanMethod = typeof LOAN_METHODS[number];
export const LOAN_METHOD_LABELS: Record<LoanMethod, string> = {
  'equal-payment': '원리금균등분할상환', 'equal-principal': '원금균등분할상환', bullet: '만기일시상환',
};

export interface HousingLoan {
  id: string;
  name: string;
  method: LoanMethod;
  basis: 'new' | 'remaining';
  principalWon: number;
  annualRateBps: number;
  rateType: 'fixed' | 'variable';
  months: number;
  graceMonths: number;
  firstPaymentMonth: string;
}
export interface HousingLoanPlan {
  month: string;
  loans: HousingLoan[];
  /** Confirmed regular outflow for this month only; never changes the projected debt. */
  paymentOverrideWon: number | null;
}
export interface LoanPayment {
  month: string;
  installment: number;
  principalWon: number;
  interestWon: number;
  paymentWon: number;
  balanceWon: number;
  maturityWon: number;
}

export function monthIndex(month: string): number | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  return year >= 1900 ? year * 12 + Number(month.slice(5)) - 1 : null;
}
export function addLoanMonths(month: string, count: number): string {
  const index = monthIndex(month);
  if (index === null || !Number.isInteger(count)) throw new Error('Invalid loan month');
  const next = index + count;
  return `${Math.floor(next / 12).toString().padStart(4, '0')}-${(next % 12 + 1).toString().padStart(2, '0')}`;
}
export function currentLoanMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function parseHousingLoan(value: unknown): HousingLoan | null {
  if (!keys(value, ['id', 'name', 'method', 'basis', 'principalWon', 'annualRateBps', 'rateType', 'months', 'graceMonths', 'firstPaymentMonth'])
    || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(value.id)
    || typeof value.name !== 'string' || value.name.trim().length < 1 || value.name.length > 40
    || !LOAN_METHODS.includes(value.method as LoanMethod) || !['new', 'remaining'].includes(value.basis as string)
    || !int(value.principalWon, 1, 1_000_000_000_000) || !int(value.annualRateBps, 0, 10000)
    || !['fixed', 'variable'].includes(value.rateType as string) || !int(value.months, 1, 600)
    || !int(value.graceMonths, 0, value.months - 1) || (value.method === 'bullet' && value.graceMonths !== 0)
    || typeof value.firstPaymentMonth !== 'string' || monthIndex(value.firstPaymentMonth) === null
    || monthIndex(value.firstPaymentMonth)! + value.months > 120000) return null;
  return structuredClone(value) as unknown as HousingLoan;
}
export function parseHousingLoanPlan(value: unknown): HousingLoanPlan | null {
  if (!keys(value, ['month', 'loans', 'paymentOverrideWon']) || typeof value.month !== 'string' || monthIndex(value.month) === null
    || !Array.isArray(value.loans) || value.loans.length > 10
    || (value.paymentOverrideWon !== null && !int(value.paymentOverrideWon, 0, 10_000_000_000_000))) return null;
  const loans = value.loans.map(parseHousingLoan);
  if (loans.some(loan => loan === null) || new Set(loans.map(loan => loan!.id)).size !== loans.length) return null;
  return {month: value.month, loans: loans as HousingLoan[], paymentOverrideWon: value.paymentOverrideWon as number | null};
}

/** Integer-won monthly estimate. Rational annuity math matches the SQL calculator. */
export function calculateLoanSchedule(loan: HousingLoan): LoanPayment[] {
  if (!parseHousingLoan(loan)) throw new Error('Invalid housing loan');
  const principal = BigInt(loan.principalWon);
  const rate = BigInt(loan.annualRateBps);
  const divisor = 120000n;
  const installments = BigInt(loan.months - loan.graceMonths);
  const power = (divisor + rate) ** installments;
  const levelPayment = rate === 0n ? roundRatio(principal, installments)
    : roundRatio(principal * rate * power, divisor * (power - divisor ** installments));
  const levelPrincipal = roundRatio(principal, installments);
  let balance = principal;
  return Array.from({length: loan.months}, (_, index) => {
    const interest = roundRatio(balance * rate, divisor);
    const last = index === loan.months - 1;
    let paidPrincipal = last ? balance : index < loan.graceMonths || loan.method === 'bullet' ? 0n
      : loan.method === 'equal-principal' ? levelPrincipal : levelPayment - interest;
    paidPrincipal = paidPrincipal < 0n ? 0n : paidPrincipal > balance ? balance : paidPrincipal;
    balance -= paidPrincipal;
    return {month: addLoanMonths(loan.firstPaymentMonth, index), installment: index + 1,
      principalWon: Number(paidPrincipal), interestWon: Number(interest), paymentWon: Number(paidPrincipal + interest),
      balanceWon: Number(balance), maturityWon: loan.method === 'bullet' && last ? Number(paidPrincipal) : 0};
  });
}

export function loanPlanMonthTotals(plan: HousingLoanPlan) {
  const rows = plan.loans.flatMap(loan => calculateLoanSchedule(loan).filter(row => row.month === plan.month));
  const principalWon = rows.reduce((sum, row) => sum + row.principalWon - row.maturityWon, 0);
  const interestWon = rows.reduce((sum, row) => sum + row.interestWon, 0);
  const maturityWon = rows.reduce((sum, row) => sum + row.maturityWon, 0);
  return {principalWon, interestWon, maturityWon, estimatedRegularWon: principalWon + interestWon,
    regularWon: plan.paymentOverrideWon ?? principalWon + interestWon};
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
function int(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function keys(value: unknown, names: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Reflect.ownKeys(value).length === names.length && Reflect.ownKeys(value).every(key => typeof key === 'string' && names.includes(key));
}
