import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    discardPending: () => undefined,
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

  it('locks editor mutations while a save is pending so the submitted revision is not overwritten', async () => {
    let resolveSave: ((saved: MainData) => void) | undefined;
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.save = vi.fn(() => new Promise<MainData>((resolve) => {
      resolveSave = resolve;
    }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '이번 달 자금 흐름' });
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));
    const amount = screen.getByLabelText('급여 월 금액');
    fireEvent.change(amount, { target: { value: '4000000' } });

    fireEvent.click(screen.getByRole('button', { name: '적용' }));

    expect(screen.getByRole('complementary', { name: '수입 편집' })).toHaveAttribute('aria-busy', 'true');
    expect(amount).toBeDisabled();
    fireEvent.change(amount, { target: { value: '5000000' } });
    expect(amount).toHaveValue('4,000,000');

    await act(async () => {
      resolveSave?.({ ...data(4_000_000), updatedAt: 2 });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('저장됨');
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('400만 원');
  });

  it('discards pending recovery data when the user cancels an edit', async () => {
    const discardPending = vi.fn();
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.discardPending = discardPending;
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '이번 달 자금 흐름' });
    fireEvent.click(screen.getByRole('button', { name: '수입 편집' }));
    fireEvent.change(screen.getByLabelText('급여 월 금액'), { target: { value: '4000000' } });

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(discardPending).toHaveBeenCalledOnce();
  });
});
