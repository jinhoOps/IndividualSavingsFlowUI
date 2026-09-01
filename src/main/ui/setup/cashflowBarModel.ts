import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';

export type CashflowAllocationId = 'consumption' | 'saving' | 'investment' | 'remaining';

export interface CashflowBarAllocation {
  id: CashflowAllocationId;
  label: string;
  amountWon: number;
  percentage: number | null;
  startPercent: number;
  widthPercent: number;
}

export interface CashflowBarModel {
  incomeWon: number;
  deficitWon: number;
  allocations: CashflowBarAllocation[];
}

export function buildCashflowBarModel(data: MainData): CashflowBarModel {
  const cashflow = calculateCashflow(data);
  let allocatedWon = 0;
  const allocation = (
    id: CashflowAllocationId,
    label: string,
    amountWon: number,
  ): CashflowBarAllocation => {
    const percentage = percentageOfIncome(amountWon, cashflow.incomeWon);
    const widthPercent = percentage === null || !Number.isFinite(percentage)
      ? 0
      : amountWon / (cashflow.incomeWon / 100);
    const startPercent = percentage === null || !Number.isFinite(percentage)
      ? 0
      : allocatedWon / (cashflow.incomeWon / 100);
    const result = { id, label, amountWon, percentage, startPercent, widthPercent };
    allocatedWon += amountWon;
    return result;
  };
  const allocations = [
    allocation('consumption', '소비', cashflow.consumptionWon),
    allocation('saving', '저축', cashflow.savingWon),
    allocation('investment', '투자', cashflow.investmentWon),
  ];

  if (cashflow.deficitWon === 0) {
    allocations.push(allocation('remaining', '남는 돈', cashflow.remainingWon));
  }

  return {
    incomeWon: cashflow.incomeWon,
    deficitWon: cashflow.deficitWon,
    allocations,
  };
}
