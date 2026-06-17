import { Won } from './money';

export interface BaseItem {
  id: string;
  name: string;
  amount: Won;
}

export interface AllocationItem extends BaseItem {
  group?: string;
  annualRate?: number;
  maturityMonth?: string;
}

export interface Step1State {
  version: 2;
  updatedAt: number;
  incomes: BaseItem[];
  expenseItems: AllocationItem[];
  savingsItems: AllocationItem[];
  investItems: AllocationItem[];
  
  // Simulation params
  horizonYears: number;
  annualIncomeGrowth: number;
  annualExpenseGrowth: number;
  annualSavingsYield: number;
  annualInvestReturn: number;
  annualDebtInterest: number;
  
  // Starting balances
  startCash: Won;
  startSavings: Won;
  startInvest: Won;
  startDebt: Won;
  
  // Calculated totals (cached for bridge)
  monthlyExpense: Won;
  monthlySavings: Won;
  monthlyInvest: Won;
  monthlyDebtPayment: Won;
}

export interface DividendSimulationState {
  yield: number;
  growth: number;
  capitalGrowth: number;
  years: number;
  isDrip: boolean;
  presetName?: string;
  selectedBenchmark?: string;
  strategyKey?: string;
  strategyName?: string;
  coveredCallExample?: string;
}

export interface Step2Simulation {
  id: string;
  name: string;
  updatedAt: number;
  totalInitialAsset: Won;
  totalMonthlyInvestCapacity: Won;
  dividendSim: DividendSimulationState;
  modelVersion: 10;
}

export interface BackupEntry {
  id: string;
  appKey: string;
  createdAt: number;
  type: 'auto' | 'manual';
  source: string;
  data: any;
  schemaVersion: number;
}
