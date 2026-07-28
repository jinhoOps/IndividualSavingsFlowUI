import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import type { MigrationResult } from '../../../src/main/infrastructure/legacyMigration';
import { MainApp } from '../../../src/main/ui/MainApp';

afterEach(cleanup);

function data(amountWon: number): MainData {
  return {
    schemaVersion: 1,
    updatedAt: 1,
    incomes: [{ id: 'salary', name: '급여', amountWon, allocations: [] }],
    expenses: [],
    savings: [],
    investments: [],
    accounts: [],
  };
}

function repository(result: MigrationResult): MainRepository {
  return {
    load: async () => result,
    save: async (draft) => draft,
    saveSetupProgress: () => undefined,
    loadSetupProgress: () => null,
    clearSetupProgress: () => undefined,
  };
}

describe('MainApp', () => {
  it('shows loading until bootstrap finishes and then starts setup for a new user', async () => {
    let resolveLoad: ((value: MigrationResult) => void) | undefined;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.load = () => new Promise((resolve) => {
      resolveLoad = resolve;
    });

    render(<MainApp repository={storage} />);

    expect(screen.getByRole('status')).toHaveTextContent('자금 계획을 불러오는 중');

    resolveLoad?.({ status: 'empty', data: null, original: null });

    expect(await screen.findByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  });

  it('exposes both the applied plan and pending draft in recovery', async () => {
    render(<MainApp repository={repository({
      status: 'recovery',
      current: data(3_000_000),
      data: data(4_000_000),
      original: { pending: true },
    })} />);

    expect(await screen.findByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
    expect(screen.getByText('현재 적용 중 · 300만 원')).toBeVisible();
    expect(screen.getByText('저장 대기 중 · 400만 원')).toBeVisible();
    expect(screen.getByRole('button', { name: '기존 원본 JSON 다운로드' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));
    expect(await screen.findByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  });
});
