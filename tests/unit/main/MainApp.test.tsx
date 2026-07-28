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
    discardRecovery: () => undefined,
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
      source: 'pending',
    })} />);

    expect(await screen.findByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
    expect(screen.getByText('현재 적용 중 · 300만 원')).toBeVisible();
    expect(screen.getByText('저장 대기 중 · 400만 원')).toBeVisible();
    expect(screen.getByRole('button', { name: '기존 원본 JSON 다운로드' })).toBeVisible();
    expect(screen.getByRole('button', { name: '저장 다시 시도' })).toBeVisible();
    expect(screen.getByRole('button', { name: '복구 초안 버리기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '현재 계획으로 돌아가기' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '복구 초안 버리기' }));
    expect(await screen.findByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  });

  it('retries a recovery candidate only after the user explicitly requests it', async () => {
    const storage = repository({
      status: 'recovery',
      current: data(3_000_000),
      data: data(4_000_000),
      original: { pending: true },
      source: 'pending',
    });
    storage.save = vi.fn(async (draft) => ({ ...draft, updatedAt: 30 }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '저장 다시 시도' }));

    expect(await screen.findByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
    expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({
      incomes: expect.arrayContaining([
        expect.objectContaining({ amountWon: 4_000_000 }),
      ]),
    }));
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('400만 원');
  });

  it('durably suppresses the recovery revision before returning to current data', async () => {
    const storage = repository({
      status: 'recovery',
      current: data(3_000_000),
      data: data(4_000_000),
      original: { history: true },
      source: 'history',
    });
    storage.discardPending = vi.fn();
    storage.discardRecovery = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '현재 계획으로 돌아가기' }));

    expect(await screen.findByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('300만 원');
    expect(storage.discardRecovery).toHaveBeenCalledWith(1);
    expect(storage.discardPending).toHaveBeenCalledOnce();
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

  it('imports a JSON backup into the draft and waits for explicit apply before saving', async () => {
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.save = vi.fn(async (draft) => ({ ...draft, updatedAt: 2 }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '이번 달 자금 흐름' });
    const file = new File([JSON.stringify(data(4_000_000))], 'plan.json', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText('JSON 백업 파일'), { target: { files: [file] } });

    expect(await screen.findByText('백업을 초안으로 불러왔습니다. 적용해야 저장됩니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('300만 원');
    expect(storage.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(await screen.findByRole('button', { name: '수입 편집' })).toHaveTextContent('400만 원');
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('rejects an invalid JSON backup without mutating the applied plan', async () => {
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.save = vi.fn(async (draft) => draft);
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '이번 달 자금 흐름' });
    const file = new File(['{invalid'], 'invalid.json', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText('JSON 백업 파일'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('백업 파일을 불러오지 못했습니다');
    expect(screen.getByRole('button', { name: '수입 편집' })).toHaveTextContent('300만 원');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('keeps setup editing available when progress persistence fails', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.loadSetupProgress = () => ({ kind: 'initial', step: 'income', draft: data(3_000_000) });
    storage.saveSetupProgress = vi.fn(() => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '월 수입을 알려주세요' });

    fireEvent.change(screen.getByLabelText('수입 이름'), { target: { value: '새 급여' } });

    expect(screen.getByLabelText('수입 이름')).toHaveValue('새 급여');
    expect(screen.getByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')).toBeVisible();
  });
});
