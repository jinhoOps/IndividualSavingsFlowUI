import {describe, expect, it} from 'vitest';
import {addLoanMonths, calculateLoanSchedule, loanPlanMonthTotals, parseHousingLoan, parseHousingLoanPlan, type HousingLoan, LOAN_METHODS} from '../../../src/main/domain/housingLoan';

const loan: HousingLoan = {id: 'home', name: '주택담보대출', method: 'equal-payment', basis: 'new', principalWon: 100_000_000,
  annualRateBps: 400, rateType: 'fixed', months: 120, graceMonths: 0, firstPaymentMonth: '2026-09'};
describe('monthly housing-loan estimates', () => {
  it('matches independent first-payment examples and conserves all principal for each method', () => {
    for (const [method, expected] of [['equal-payment', 1012451], ['equal-principal', 1166666], ['bullet', 333333]] as const) {
      const rows = calculateLoanSchedule({...loan, method});
      expect(rows[0].paymentWon).toBe(expected);
      expect(rows.reduce((sum, row) => sum + row.principalWon, 0)).toBe(loan.principalWon);
      expect(rows.at(-1)?.balanceWon).toBe(0);
      expect(rows.every(row => row.paymentWon === row.principalWon + row.interestWon && row.balanceWon >= 0)).toBe(true);
      if (method === 'equal-payment') expect(new Set(rows.slice(0, -1).map(row => row.paymentWon)).size).toBe(1);
      if (method === 'equal-principal') expect(rows.slice(1, -1).every((row, index) => row.paymentWon <= rows[index].paymentWon)).toBe(true);
      if (method === 'bullet') expect(rows.at(-1)?.maturityWon).toBe(loan.principalWon);
    }
  });
  it('handles zero rates, tiny principals, a single month and grace without losing rounded residuals', () => {
    for (const method of LOAN_METHODS) for (const months of [1, 3, 600]) for (const principalWon of [1, 100, 999999999999]) {
      const rows = calculateLoanSchedule({...loan, method, months, principalWon, annualRateBps: 0});
      expect(rows.reduce((sum, row) => sum + row.principalWon, 0)).toBe(principalWon);
      expect(rows.every(row => row.interestWon === 0 && row.balanceWon >= 0)).toBe(true);
    }
    const rows = calculateLoanSchedule({...loan, months: 24, graceMonths: 12});
    expect(rows.slice(0, 12).every(row => row.principalWon === 0 && row.balanceWon === loan.principalWon)).toBe(true);
    expect(rows[12].principalWon).toBeGreaterThan(0);
    expect(rows.at(-1)?.balanceWon).toBe(0);
  });
  it('separates the maturity obligation from recurring outflow and keeps cash overrides out of debt math', () => {
    const bullet = {...loan, method: 'bullet' as const, months: 1};
    const plan = {month: '2026-09', loans: [bullet], paymentOverrideWon: null};
    expect(loanPlanMonthTotals(plan)).toMatchObject({regularWon: 333333, maturityWon: 100000000, principalWon: 0});
    expect(loanPlanMonthTotals({...plan, paymentOverrideWon: 330000})).toMatchObject({regularWon: 330000, maturityWon: 100000000});
    expect(loanPlanMonthTotals({...plan, month: '2026-08'})).toMatchObject({regularWon: 0, maturityWon: 0});
  });
  it('rejects malformed, unsafe and contradictory contracts at the boundary', () => {
    for (const patch of [{principalWon: -1}, {principalWon: 1e13}, {annualRateBps: 4.1}, {months: 0}, {months: 601},
      {graceMonths: 120}, {method: 'bullet', graceMonths: 1}, {firstPaymentMonth: '2026-13'}, {firstPaymentMonth: '9999-12'}, {extra: true}]) {
      expect(parseHousingLoan({...loan, ...patch})).toBeNull();
    }
    expect(parseHousingLoanPlan({month: '2026-09', loans: [loan, loan], paymentOverrideWon: null})).toBeNull();
    expect(addLoanMonths('2026-12', 2)).toBe('2027-02');
  });
});
