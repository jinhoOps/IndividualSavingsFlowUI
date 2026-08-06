import { calculateCashflow, percentageOfIncome } from './cashflow';
import type { MainData } from './model';

export type SavingsInvestmentBand =
  | 'under-50' | 'under-60' | 'under-70'
  | 'under-80' | 'under-90' | 'at-least-90';

export type InvestmentSavingBand =
  | 'unset' | 'below-1-to-3' | 'near-1-to-3'
  | 'near-1-to-2' | 'near-1-to-1'
  | 'near-2-to-1' | 'near-3-to-1' | 'above-3-to-1';

export interface DonutAllocation {
  id: 'consumption' | 'saving' | 'investment' | 'remaining';
  label: '소비' | '저축' | '투자' | '여윳돈';
  amountWon: number;
  percentage: number;
  displayPercentage: number;
}

export interface CashflowInsight {
  allocations: DonutAllocation[];
  savingsInvestmentPercentage: number | null;
  savingsInvestmentBand: SavingsInvestmentBand | null;
  investmentSavingRatio: number | null;
  investmentSavingBand: InvestmentSavingBand;
  isOverIncome: boolean;
}

export function classifySavingsInvestmentBand(percentage: number): SavingsInvestmentBand {
  if (percentage < 50) return 'under-50';
  if (percentage < 60) return 'under-60';
  if (percentage < 70) return 'under-70';
  if (percentage < 80) return 'under-80';
  if (percentage < 90) return 'under-90';
  return 'at-least-90';
}

export function classifyInvestmentSavingBand(
  savingWon: number,
  investmentWon: number,
): InvestmentSavingBand {
  if (savingWon === 0 && investmentWon === 0) return 'unset';

  const ratio = investmentWon / savingWon;
  if (ratio < 1 / 3) return 'below-1-to-3';
  if (ratio < 5 / 12) return 'near-1-to-3';
  if (ratio < 3 / 4) return 'near-1-to-2';
  if (ratio < 3 / 2) return 'near-1-to-1';
  if (ratio < 5 / 2) return 'near-2-to-1';
  if (ratio <= 3) return 'near-3-to-1';
  return 'above-3-to-1';
}

export function calculateCashflowInsight(data: MainData): CashflowInsight {
  const cashflow = calculateCashflow(data);
  const isOverIncome = cashflow.deficitWon > 0;
  const rawAllocations = [
    { id: 'consumption' as const, label: '소비' as const, amountWon: cashflow.consumptionWon },
    { id: 'saving' as const, label: '저축' as const, amountWon: cashflow.savingWon },
    { id: 'investment' as const, label: '투자' as const, amountWon: cashflow.investmentWon },
    ...(cashflow.remainingWon >= 0
      ? [{ id: 'remaining' as const, label: '여윳돈' as const, amountWon: cashflow.remainingWon }]
      : []),
  ];
  const ringTotalWon = rawAllocations.reduce((total, allocation) => total + allocation.amountWon, 0);
  const savingsInvestmentPercentage = percentageOfIncome(
    cashflow.savingWon + cashflow.investmentWon,
    cashflow.incomeWon,
  );

  return {
    allocations: rawAllocations.map((allocation) => {
      const percentage = percentageOfIncome(allocation.amountWon, cashflow.incomeWon) ?? 0;

      return {
        ...allocation,
        percentage,
        displayPercentage: cashflow.incomeWon === 0 && ringTotalWon > 0
          ? (allocation.amountWon / ringTotalWon) * 100
          : percentage,
      };
    }),
    savingsInvestmentPercentage,
    savingsInvestmentBand: savingsInvestmentPercentage === null
      ? null
      : classifySavingsInvestmentBand(savingsInvestmentPercentage),
    investmentSavingRatio: cashflow.savingWon > 0
      ? cashflow.investmentWon / cashflow.savingWon
      : null,
    investmentSavingBand: classifyInvestmentSavingBand(cashflow.savingWon, cashflow.investmentWon),
    isOverIncome,
  };
}
