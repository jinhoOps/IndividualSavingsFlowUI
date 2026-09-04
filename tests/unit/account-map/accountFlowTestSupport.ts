import { calculateAccountFlow } from '../../../src/account-map/domain/accountFlowCalculator';
import type { AccountMapAppliedV3, AccountTransferLink, PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

export function salaryLivingBrokerageFixture(overrides: Partial<{ transfers: AccountTransferLink[] }> = {}) {
  const main: MainData = {
    schemaVersion: 2,
    updatedAt: 10,
    monthlyNetIncomeWon: 3_100_000,
    monthlyHousingWon: 0,
    monthlyLivingWon: 900_000,
    monthlySavingWon: 0,
    monthlyInvestmentWon: 1_000_000,
  };
  const locations = [location('salary', '급여 통장'), location('living', '생활비 통장'), location('brokerage', '증권 계좌')];
  const links = [
    purposeLink('income-salary', 'system:income', 'salary', 3_100_000),
    purposeLink('living-local', 'system:living', 'living', 900_000),
    purposeLink('investing-local', 'system:investing', 'brokerage', 1_000_000),
  ];
  const transfers = overrides.transfers ?? [
    transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 900_000 }),
    transfer('living-brokerage', 'living', 'brokerage', { kind: 'sweep' }),
  ];
  const applied: AccountMapAppliedV3 = {
    schemaVersion: 3,
    sourceMainUpdatedAt: 10,
    customPurposes: [],
    links,
    transfers,
    setupCompletedAt: 10,
    updatedAt: 10,
  };

  return {
    main,
    locations,
    applied,
    calculation: calculateAccountFlow({ main, locations, links, transfers }),
  };
}

export function transfer(
  id: string,
  sourceLocationId: string,
  targetLocationId: string,
  allocation: AccountTransferLink['allocation'],
): AccountTransferLink {
  return { id, sourceLocationId, targetLocationId, allocation, status: 'active', createdAt: 1, updatedAt: 1 };
}

function location(id: string, shortName: string): FinancialLocation {
  return { id, shortName, kind: 'bank', roles: ['income', 'spending'], createdAt: 1, updatedAt: 1 };
}

function purposeLink(
  id: string,
  purposeId: PurposeLocationLink['purposeId'],
  locationId: string,
  monthlyAmountWon: number,
): PurposeLocationLink {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: false, status: 'active', createdAt: 1, updatedAt: 1 };
}
