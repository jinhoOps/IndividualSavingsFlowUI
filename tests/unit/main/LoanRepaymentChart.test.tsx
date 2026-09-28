import {cleanup, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach, expect, it, vi} from 'vitest';
import {LoanRepaymentChart} from '../../../src/main/ui/loans/LoanRepaymentChart';
import {calculateLoanSchedule, type HousingLoan} from '../../../src/main/domain/housingLoan';

const motion = vi.hoisted(() => ({reduced: false, fail: false, animate: vi.fn(), revert: vi.fn()}));
vi.mock('animejs', () => ({
  createScope: () => ({matches: {reducedMotion: motion.reduced}, add: (setup: () => void) => setup(), revert: motion.revert}),
  animate: (...args: unknown[]) => { if (motion.fail) throw new Error('motion unavailable'); motion.animate(...args); return {cancel() {}}; },
}));
afterEach(() => {cleanup(); vi.clearAllMocks(); motion.reduced = false; motion.fail = false;});
const loan: HousingLoan = {id: 'home', name: '집', method: 'equal-payment', basis: 'remaining', principalWon: 100000000,
  annualRateBps: 400, rateType: 'fixed', months: 12, graceMonths: 0, firstPaymentMonth: '2026-09'};
it('uses scoped Anime.js for graph reveal and releases the scope on condition change/unmount', () => {
  const {rerender, unmount} = render(<LoanRepaymentChart rows={calculateLoanSchedule(loan)} selectedIndex={0} />);
  expect(motion.animate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({duration: 500}));
  rerender(<LoanRepaymentChart rows={calculateLoanSchedule({...loan, annualRateBps: 300})} selectedIndex={0} />);
  expect(motion.revert).toHaveBeenCalledTimes(1);
  unmount(); expect(motion.revert).toHaveBeenCalledTimes(2);
});
it.each(['reduced', 'failed'])('shows the complete schedule and separate maturity amount when animation is %s', mode => {
  motion.reduced = mode === 'reduced'; motion.fail = mode === 'failed';
  const {container} = render(<LoanRepaymentChart rows={calculateLoanSchedule({...loan, method: 'bullet'})} selectedIndex={0} />);
  expect(container.querySelector('clipPath rect')).toHaveAttribute('width', '600');
  expect(screen.getByRole('img')).toHaveAccessibleName(expect.stringContaining('만기 원금'));
  expect(screen.getByText('100,000,000원')).toBeVisible();
  expect(motion.animate).not.toHaveBeenCalled();
});
