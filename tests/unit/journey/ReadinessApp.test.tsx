import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessApp } from '../../../src/journey/ui/ReadinessApp';

afterEach(cleanup);

const validMainSnapshot = {
  version: 1 as const,
  sourceApp: 'main' as const,
  sourceView: 'dashboard' as const,
  destinationApp: 'simulation' as const,
  monthlyInvestableAmountWon: 1_100_000,
  mainUpdatedAt: 10,
  createdAt: 20,
};

describe('ReadinessApp', () => {
  it('shows a connected negative amount without treating it as an error', () => {
    render(<ReadinessApp destination="simulation" repository={{
      load: () => ({
        status: 'found',
        snapshot: {
          version: 1,
          sourceApp: 'main',
          sourceView: 'dashboard',
          destinationApp: 'simulation',
          monthlyInvestableAmountWon: -100_000,
          mainUpdatedAt: 10,
          createdAt: 20,
        },
      }),
      save: vi.fn(),
    }} />);

    expect(screen.getByRole('status')).toHaveTextContent('연결되었습니다');
    expect(screen.getByText('월 투자 가능액 -10만 원')).toBeVisible();
  });

  it.each([
    [{ status: 'empty' as const }, 'Main에서 계획을 먼저 완성해 주세요'],
    [{ status: 'invalid' as const }, '연결 정보를 확인하지 못했습니다'],
  ])('offers Main recovery for %o', (result, message) => {
    render(<ReadinessApp destination="simulation" repository={{
      load: () => result,
      save: vi.fn(),
    }} />);

    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main으로 이동' })).toHaveAttribute('href', expect.stringContaining('/apps/main/'));
  });

  it('saves the Portfolio handoff before navigation', () => {
    const save = vi.fn();
    const navigate = vi.fn();

    render(<ReadinessApp destination="simulation" now={() => 30} navigate={navigate} repository={{
      load: () => ({ status: 'found', snapshot: validMainSnapshot }),
      save,
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Portfolio로 이어가기' }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      sourceApp: 'simulation',
      destinationApp: 'portfolio',
      createdAt: 30,
    }));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/apps/portfolio/'));
  });

  it('accepts zero as a connected amount', () => {
    render(<ReadinessApp destination="simulation" repository={{
      load: () => ({
        status: 'found',
        snapshot: { ...validMainSnapshot, monthlyInvestableAmountWon: 0 },
      }),
      save: vi.fn(),
    }} />);

    expect(screen.getByRole('status')).toHaveTextContent('연결되었습니다');
    expect(screen.getByText('월 투자 가능액 0원')).toBeVisible();
  });

  it('rejects a snapshot for another destination', () => {
    render(<ReadinessApp destination="portfolio" repository={{
      load: () => ({ status: 'found', snapshot: validMainSnapshot }),
      save: vi.fn(),
    }} />);

    expect(screen.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
  });

  it('stops navigation when the Portfolio handoff cannot be saved', () => {
    const navigate = vi.fn();

    render(<ReadinessApp destination="simulation" navigate={navigate} repository={{
      load: () => ({ status: 'found', snapshot: validMainSnapshot }),
      save: () => { throw new Error('quota'); },
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Portfolio로 이어가기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Main 데이터는 변경되지 않았습니다');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not load journey data for Account Map', () => {
    const load = vi.fn();

    render(<ReadinessApp destination="account-map" repository={{ load, save: vi.fn() }} />);

    expect(screen.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });
});
