import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioMainSourceRepository } from '../../../src/portfolio/infrastructure/mainSourceRepository';
import { PortfolioApp } from '../../../src/portfolio/ui/PortfolioApp';
import { createMemoryPortfolioRepository } from './MemoryPortfolioRepository';

afterEach(cleanup);

const plan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const mainFound: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 1 } }),
};
const zeroMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 1 } }),
};

describe('PortfolioApp', () => {
  it('opens setup on first run', () => {
    render(<PortfolioApp mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository()} now={() => 1} />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  });

  it('revisits a saved plan result-first', () => {
    render(<PortfolioApp mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 2} />);
    expect(screen.getByText('한 달 투자금을 배분합니다')).toBeVisible();
    expect(screen.getByRole('heading', { name: /투자금/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /투자금/ }).closest('section'))
      .toHaveClass('ui-surface', 'portfolio-summary');
    expect(screen.getByRole('button', { name: '배분 수정' }))
      .toHaveClass('ui-button', 'ui-button--primary');
  });

  it('preserves the plan behind a zero-investment blurred gate', () => {
    render(<PortfolioApp mainSourceRepository={zeroMain} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 1} />);
    expect(screen.getByTestId('portfolio-gated-content')).toHaveClass('portfolio-content--blurred');
    expect(screen.getByRole('link', { name: 'Main에서 투자금 설정' }))
      .toHaveAttribute('href', expect.stringContaining('?edit=investment'));
  });

  it('shows the newly applied plan when draft cleanup fails after the applied write', async () => {
    const repository = createMemoryPortfolioRepository();
    repository.failClearDraft = true;
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분 적용' }))
      .getByRole('button', { name: '적용' }));

    expect(await screen.findByRole('heading', { name: '투자금 200,000원' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('배분은 적용했지만 편집 초안을 정리하지 못했습니다');
    expect(repository.applied).not.toBeNull();
  });

  it('reports a failed automatic Main synchronization write', async () => {
    const repository = createMemoryPortfolioRepository({
      applied: { ...plan, syncedInvestmentWon: 100_000 },
    });
    repository.failNextWrite();

    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다'));
  });

  it('reports an applied write failure while staying in the editor', async () => {
    const repository = createMemoryPortfolioRepository();
    repository.failNextWrite();
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분 적용' }))
      .getByRole('button', { name: '적용' }));

    expect(await screen.findByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(repository.applied).toBeNull();
  });

  it('queues draft persistence so a slower earlier save cannot win over later UI state', async () => {
    const repository = createMemoryPortfolioRepository();
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let saveCount = 0;
    repository.saveDraft = vi.fn(async (draft) => {
      saveCount += 1;
      if (saveCount === 1) await firstGate;
      repository.draft = structuredClone(draft);
      return { status: 'saved' as const };
    });
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('투자 대상 이름 1'), { target: { value: '최신 이름' } });
    expect(repository.saveDraft).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(repository.draft?.items[0]?.name).toBe('최신 이름'));
  });

  it('clears only the aggregate scope on reset and waits before changing the visible state', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    let releaseClear: (() => void) | undefined;
    const clearGate = new Promise<void>((resolve) => { releaseClear = resolve; });
    const originalClearScope = repository.clearScope.bind(repository);
    repository.clearScope = vi.fn(async (scope) => {
      await clearGate;
      return await originalClearScope(scope);
    });
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 3} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    await waitFor(() => expect(repository.clearScope).toHaveBeenCalledWith({ type: 'aggregate' }));
    expect(screen.getByRole('heading', { name: '투자금 200,000원' })).toBeVisible();
    releaseClear?.();
    expect(await screen.findByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
    expect(repository.applied).toBeNull();
  });

  it('keeps the applied result and reports an asynchronous reset failure', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    repository.clearScope = vi.fn(async () => ({ status: 'unavailable' as const }));
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 3} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByRole('heading', { name: '투자금 200,000원' })).toBeVisible();
  });

  it('isolates a corrupt draft and keeps the valid applied result', () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    repository.load = () => ({
      applied: { status: 'found', plan },
      draft: { status: 'invalid' },
    });

    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    expect(screen.getByRole('heading', { name: '투자금 200,000원' })).toBeVisible();
  });
});
