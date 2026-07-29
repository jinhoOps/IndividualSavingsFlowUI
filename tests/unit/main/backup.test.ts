import { describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { exportMainData, importMainData } from '../../../src/main/infrastructure/backup';

describe('Main JSON backup', () => {
  it('round-trips a current MainData document without changing it', () => {
    const data: MainData = {
      schemaVersion: 2,
      updatedAt: 42,
      monthlyNetIncomeWon: 4_200_000,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 600_000,
      monthlyInvestmentWon: 800_000,
    };

    expect(importMainData(exportMainData(data))).toStrictEqual(data);
  });

  it('rejects malformed JSON', () => {
    expect(() => importMainData('{bad')).toThrow('Backup data is not valid JSON.');
  });

  it('rejects schema v1 JSON instead of migrating it', () => {
    expect(() => importMainData(JSON.stringify({
      schemaVersion: 1,
      updatedAt: 42,
      incomes: [],
      expenses: [],
      savings: [],
      investments: [],
      accounts: [],
    }))).toThrow('Backup data is not valid MainData.');
  });

  it('rejects a v2 plan whose income is not valid', () => {
    expect(() => importMainData(JSON.stringify({
      schemaVersion: 2,
      updatedAt: 42,
      monthlyNetIncomeWon: 0,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 600_000,
      monthlyInvestmentWon: 800_000,
    }))).toThrow('Backup data contains an invalid plan.');
  });

  it('rejects an otherwise valid v2 backup with an unknown nested field', () => {
    expect(() => importMainData(JSON.stringify({
      schemaVersion: 2,
      updatedAt: 42,
      monthlyNetIncomeWon: 4_200_000,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 600_000,
      monthlyInvestmentWon: 800_000,
      metadata: { currency: 'KRW' },
    }))).toThrow('Backup data is not valid MainData.');
  });

  it('rejects v2 scalar data mixed with legacy collection fields', () => {
    expect(() => importMainData(JSON.stringify({
      schemaVersion: 2,
      updatedAt: 42,
      monthlyNetIncomeWon: 4_200_000,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 600_000,
      monthlyInvestmentWon: 800_000,
      incomes: [],
      accounts: [],
    }))).toThrow('Backup data is not valid MainData.');
  });
});
