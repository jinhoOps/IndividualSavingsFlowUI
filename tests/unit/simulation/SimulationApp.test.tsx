// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { SimulationMainSource } from '../../../src/simulation/domain/model';
import type {
  MainSourceRepository,
} from '../../../src/simulation/infrastructure/mainSourceRepository';
import type {
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

function emptyRepository(): SimulationRepository {
  return {
    load: () => ({ status: 'empty' }),
    save: () => ({ status: 'saved' }),
    clear: () => ({ status: 'cleared' }),
  };
}

describe('SimulationApp', () => {
  it('asks the simple starting-principal question and starts from zero', () => {
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={emptyRepository()}
      now={() => 456}
    />);

    expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '없어요' }));
    expect(screen.getByRole('heading', { name: '20년 뒤 예상금액' })).toBeVisible();
  });

  it('routes zero Main contributions back to Main', () => {
    render(<SimulationApp
      mainSourceRepository={mainRepository({
        ...source,
        monthlySavingsWon: 0,
        monthlyInvestmentWon: 0,
      })}
      repository={emptyRepository()}
    />);

    expect(screen.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main에서 설정하기' }))
      .toHaveAttribute('href', '/apps/main/');
  });

  it('accepts a starting investment principal', () => {
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={emptyRepository()}
      now={() => 456}
    />);

    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
      target: { value: '10000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '계산 시작' }));
    expect(screen.getByText('1,000만 원')).toBeVisible();
  });
});
