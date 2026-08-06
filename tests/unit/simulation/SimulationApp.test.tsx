// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompoundSimulationDraft, SimulationMainSource } from '../../../src/simulation/domain/model';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import type { MainSourceRepository } from '../../../src/simulation/infrastructure/mainSourceRepository';
import type {
  SimulationLoadResult,
  SimulationRepository,
} from '../../../src/simulation/infrastructure/simulationRepository';
import { SimulationApp } from '../../../src/simulation/ui/SimulationApp';

afterEach(cleanup);

const source: SimulationMainSource = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

function mainRepository(next: SimulationMainSource): MainSourceRepository {
  return { load: () => ({ status: 'found', source: next }) };
}

function simulationRepository(loadResult: SimulationLoadResult = { status: 'empty' }) {
  const repository: SimulationRepository = {
    load: () => loadResult,
    save: vi.fn(() => ({ status: 'saved' as const })),
    clear: vi.fn(() => ({ status: 'cleared' as const })),
  };
  return repository;
}

describe('SimulationApp', () => {
  it('completes two-stage onboarding before saving the first result', () => {
    const repository = simulationRepository();
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 456}
    />);

    fireEvent.click(screen.getByRole('button', { name: '없어요' }));
    expect(screen.getByRole('heading', {
      name: '얼마나 오래, 어느 정도 수익을 기대할까요?',
    })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(screen.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it('revisits the result directly and persists only the latest Main source', async () => {
    const saved = { ...createDefaultSimulationDraft(source, 456), initialInvestmentWon: 10_000_000 };
    const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 999 };
    const repository = simulationRepository({ status: 'found', draft: saved, migration: null });

    render(<SimulationApp
      mainSourceRepository={mainRepository(latest)}
      repository={repository}
      now={() => 1_000}
    />);

    expect(screen.queryByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      source: latest,
      initialInvestmentWon: 10_000_000,
      years: 20,
    })));
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the last result visible when current Main storage is unavailable', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    render(<SimulationApp
      mainSourceRepository={{ load: () => ({ status: 'unavailable' }) }}
      repository={simulationRepository({ status: 'found', draft, migration: null })}
    />);

    expect(screen.getByText('이전 Main 기준')).toBeVisible();
    expect(screen.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
  });

  it('retries a stale Main source in place and persists only the refreshed source', async () => {
    const draft = createDefaultSimulationDraft(source, 456);
    const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 999 };
    const load = vi.fn()
      .mockReturnValueOnce({ status: 'unavailable' as const })
      .mockReturnValueOnce({ status: 'found' as const, source: latest });
    const repository = simulationRepository({ status: 'found', draft, migration: null });
    render(<SimulationApp
      mainSourceRepository={{ load }}
      repository={repository}
      now={() => 1_000}
    />);

    fireEvent.click(screen.getByRole('button', { name: '최신 Main 다시 불러오기' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      source: latest,
      years: draft.years,
      expectedAnnualReturnPercent: draft.expectedAnnualReturnPercent,
    })));
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('이전 Main 기준')).not.toBeInTheDocument();
    expect(screen.getByText(/월 저축 90만 원/)).toBeVisible();
  });

  it('keeps controls available instead of rendering a non-finite projection', () => {
    const draft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      years: 30,
      baseRatePercent: 1e100,
    };
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({ status: 'found', draft, migration: null })}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      '계산 결과를 표시할 수 없어요. 계산 기준을 조정해주세요.',
    );
    expect(screen.queryByRole('img', { name: '연도별 복리 성장 그래프' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '기간 숫자' })).toBeVisible();
    expect(screen.getByText('계산 기준')).toBeVisible();
  });

  it('explains a migrated duration once while preserving the result', () => {
    const draft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      years: 30,
    };
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({
        status: 'found',
        draft,
        migration: 'duration-capped',
      })}
    />);

    expect(screen.getByText('기간 범위가 변경되어 30년으로 조정됐어요.')).toBeVisible();
  });

  it('resets only Simulation from its menu and returns to onboarding', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({ status: 'found', draft, migration: null });
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
    />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 설정' }));

    expect(repository.clear).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  });

  it('routes zero Main contributions back to Main', () => {
    render(<SimulationApp
      mainSourceRepository={mainRepository({
        ...source,
        monthlySavingsWon: 0,
        monthlyInvestmentWon: 0,
      })}
      repository={simulationRepository()}
    />);

    expect(screen.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main에서 설정하기' }))
      .toHaveAttribute('href', '/apps/main/');
  });
});
