// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { GrowthChart } from '../../../src/simulation/ui/GrowthChart';
import { formatWon } from '../../../src/simulation/ui/format';

let compactViewport = false;

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches: compactViewport,
    media: '(max-width: 767px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  compactViewport = false;
  vi.unstubAllGlobals();
  cleanup();
});

const result = projectCompoundGrowth(createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456));

describe('GrowthChart', () => {
  it('defaults to detailed mode when matchMedia is unavailable', () => {
    vi.unstubAllGlobals();
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('누적 납입원금')).toBeVisible();
  });

  it('names both series and exposes yearly detail by keyboard focus', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    expect(screen.getByText('현재 계획')).toBeVisible();
    expect(screen.getByText('전부 저축')).toBeVisible();

    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });
    explorer.focus();
    fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    fireEvent.keyDown(explorer, { key: 'End' });
    fireEvent.keyDown(explorer, { key: 'ArrowLeft' });
    expect(screen.queryByRole('slider', { name: '그래프 연도 상세' })).not.toBeInTheDocument();
    expect(screen.getByText('19년')).toBeVisible();
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
  });

  it('dismisses detail with Escape or an outside pointer', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    const explorer = screen.getByRole('application', { name: '그래프 연도 탐색' });
    fireEvent.keyDown(explorer, { key: 'Home' });
    fireEvent.keyDown(explorer, { key: 'Escape' });
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();

    fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();
  });

  it('shows only two comparison totals in compact mode without a close button', () => {
    compactViewport = true;
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('전부 저축 총액')).toBeVisible();
    expect(screen.queryByText('누적 납입원금')).not.toBeInTheDocument();
    expect(screen.queryByText('저축 잔액')).not.toBeInTheDocument();
    expect(screen.queryByText('투자 잔액')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('keeps detailed desktop values but removes the close button', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'Home',
    });

    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /0년, 현재 계획 총액 .* 전부 저축 총액/,
    );
  });

  it('drags through touch years, keeps release selection, and closes on scroll', () => {
    compactViewport = true;
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 680 }),
    });
    Object.defineProperty(chart, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(chart, 'releasePointerCapture', { value: vi.fn() });

    fireEvent(chart, pointerEvent('pointerdown', 36));
    fireEvent(chart, pointerEvent('pointermove', 656));
    fireEvent(chart, pointerEvent('pointerup', 656));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('20년');

    fireEvent.scroll(window);
    expect(container.querySelector('.growth-chart__tooltip')).not.toBeInTheDocument();
  });

  it('maps the first and last plotted x positions to their exact years', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 340 }),
    });

    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 100 + 36 / 680 * 340,
    }));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('0년');
    fireEvent(chart, new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 100 + 656 / 680 * 340,
    }));
    expect(container.querySelector('.growth-chart__tooltip > strong')).toHaveTextContent('20년');
  });

  it('shows real component balances consistently in real mode', () => {
    render(<GrowthChart result={result} amountMode="real" />);
    fireEvent.keyDown(screen.getByRole('application', { name: '그래프 연도 탐색' }), {
      key: 'End',
    });
    const final = result.points.at(-1)!;
    expect(screen.getByText('저축 잔액').nextElementSibling).toHaveTextContent(
      formatWon(final.savingsRealWon),
    );
  });

  it('follows pointer with a guide, markers, and six-value card', () => {
    const { container } = render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 680 }),
    });

    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 340 }));
    expect(container.querySelector('.growth-chart__guide')).toBeInTheDocument();
    expect(container.querySelectorAll('.growth-chart__marker')).toHaveLength(2);
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('전부 저축 총액')).toBeVisible();
    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
  });

  it('summarizes the selected basis and final values for assistive technology', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    expect(screen.getByText(/명목 기준 20년/)).toHaveClass('sr-only');
    expect(screen.getByText(new RegExp(formatWon(result.finalCurrentPlanWon)))).toBeVisible();
  });
});

function pointerEvent(type: string, clientX: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, clientX });
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: 'touch' },
  });
  return event;
}
