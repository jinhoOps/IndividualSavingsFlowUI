import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioMainSourceRepository } from '../../../src/portfolio/infrastructure/mainSourceRepository';
import type { PortfolioPreferencesRepository } from '../../../src/portfolio/infrastructure/portfolioPreferencesRepository';
import { PortfolioApp } from '../../../src/portfolio/ui/PortfolioApp';
import { createMemoryPortfolioRepository } from './MemoryPortfolioRepository';

afterEach(cleanup);

const plan: PortfolioPlan = {
  schemaVersion: 2,
  items: [{
    id: 'a', name: '인덱스', shareUnits: 600_000, order: 0,
    classification: 'growth', classificationOrigin: 'automatic',
  }],
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
const unavailableMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'unavailable' }),
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
    expect(screen.getByText('이번 달 투자금')).toBeVisible();
    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '안정 40%' }).closest('section'))
      .toHaveClass('ui-surface', 'portfolio-summary');
    expect(screen.getByRole('button', { name: '배분 수정' }))
      .toHaveClass('portfolio-summary__edit');
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps an automatic classification in the applied plan until an explicit re-selection is applied', () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    const classification = screen.getByRole('group', { name: '인덱스 분류' });
    fireEvent.click(within(classification).getByRole('radio', { name: '성장' }));

    expect(within(classification).getByRole('status')).toHaveTextContent('직접 선택: 성장');
    expect(repository.applied?.items[0].classificationOrigin).toBe('automatic');
    expect(repository.draft?.items[0].classificationOrigin).toBe('user');

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분 적용' }))
      .getByRole('button', { name: '적용' }));
    expect(repository.applied?.items[0].classificationOrigin).toBe('user');
  });

  it('shows the total investment in apply confirmation only when the amount preference is enabled', () => {
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: true, sortMode: 'ratio' }),
      save: () => ({ status: 'saved' }),
    };
    render(
      <PortfolioApp
        mainSourceRepository={mainFound}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    fireEvent.click(within(screen.getByRole('group', { name: '인덱스 분류' })).getByRole('radio', { name: '안정' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    const dialog = screen.getByRole('dialog', { name: '투자 배분 적용' });
    expect(within(dialog).getByText('총 투자금')).toBeVisible();
    expect(within(dialog).getByText('200,000원')).toBeVisible();
  });

  it('preserves the plan behind a zero-investment blurred gate', () => {
    render(<PortfolioApp mainSourceRepository={zeroMain} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 1} />);
    expect(screen.getByTestId('portfolio-gated-content')).toHaveClass('portfolio-content--blurred');
    expect(screen.getByRole('link', { name: 'Main에서 투자금 설정' }))
      .toHaveAttribute('href', expect.stringContaining('?edit=investment'));
  });

  it('keeps loaded amount preferences consistent in a stale Main result', () => {
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: true, sortMode: 'ratio' }),
      save: () => ({ status: 'saved' }),
    };
    render(
      <PortfolioApp
        mainSourceRepository={unavailableMain}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('switch', { name: '금액 보기' })).toBeChecked();
    expect(screen.getByRole('heading', { name: '이번 달 투자금 200,000원' })).toBeVisible();
  });

  it('shows the newly applied plan when draft cleanup fails after the applied write', () => {
    const repository = createMemoryPortfolioRepository();
    repository.failClearDraft = true;
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분 적용' }))
      .getByRole('button', { name: '적용' }));

    expect(screen.getByRole('heading', { name: '안정 100%' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('배분은 적용했지만 편집 초안을 정리하지 못했습니다');
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

  it('reports an applied write failure while staying in the editor', () => {
    const repository = createMemoryPortfolioRepository();
    repository.failNextWrite();
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분 적용' }))
      .getByRole('button', { name: '적용' }));

    expect(screen.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(repository.applied).toBeNull();
  });

  it('isolates a corrupt draft and keeps the valid applied result', () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    repository.load = () => ({
      applied: { status: 'found', plan },
      draft: { status: 'invalid' },
    });

    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  });

  it('keeps an unavailable view-preference save out of allocation save state', () => {
    let savedPreferences: { showAmounts: boolean; sortMode: 'ratio' | 'input' } | null = null;
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: false, sortMode: 'ratio' }),
      save: (value) => {
        savedPreferences = value;
        return { status: 'unavailable' };
      },
    };

    render(
      <PortfolioApp
        mainSourceRepository={mainFound}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('radio', { name: '입력순' }));

    expect(savedPreferences).toEqual({ showAmounts: false, sortMode: 'input' });
    expect(screen.getByRole('radio', { name: '입력순' })).toBeChecked();
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
