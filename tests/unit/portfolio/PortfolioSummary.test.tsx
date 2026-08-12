import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterializedAllocation } from '../../../src/portfolio/domain/model';
import { PortfolioSummary } from '../../../src/portfolio/ui/PortfolioSummary';

const anime = vi.hoisted(() => {
  const scope = {
    add: vi.fn((callback: () => void) => callback()),
    revert: vi.fn(),
    matches: { reducedMotion: false },
  };

  return {
    animate: vi.fn((_target: unknown, _options: unknown) => ({ cancel: vi.fn() })),
    createScope: vi.fn(() => scope),
    scope,
  };
});

let rowLayoutSpy: ReturnType<typeof vi.spyOn> | undefined;

vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: anime.createScope,
}));

beforeEach(() => {
  anime.animate.mockImplementation((_target: unknown, _options: unknown) => ({ cancel: vi.fn() }));
  anime.scope.matches.reducedMotion = false;
});

afterEach(() => {
  cleanup();
  anime.scope.matches.reducedMotion = false;
  rowLayoutSpy?.mockRestore();
  rowLayoutSpy = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const allocation: MaterializedAllocation = {
  items: [{
    id: 'gold', name: '금', order: 0,
    shareUnits: 150_000, amountWon: 120_000, percentage: 15,
    classification: 'stable', classificationOrigin: 'automatic',
  }, {
    id: 'index', name: '글로벌 인덱스', order: 1,
    shareUnits: 500_000, amountWon: 400_000, percentage: 50,
    classification: 'growth', classificationOrigin: 'automatic',
  }, {
    id: 'bond', name: '채권', order: 2,
    shareUnits: 250_000, amountWon: 200_000, percentage: 25,
    classification: 'stable', classificationOrigin: 'automatic',
  }],
  cashAmountWon: 80_000,
  cashPercentage: 10,
  totalAmountWon: 800_000,
};

function visibleRowNames(): string[] {
  return screen.getAllByRole('listitem').map((row) => within(row).getByRole('heading').textContent ?? '');
}

function allocationRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    right: 100,
    bottom: top + 80,
    left: 0,
    width: 100,
    height: 80,
    toJSON: () => ({}),
  };
}

function mockRowLayout(topById: () => Record<string, number>): void {
  rowLayoutSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: Element) {
    const id = (this as HTMLElement).dataset.allocationId;
    return allocationRect(id === undefined ? 0 : (topById()[id] ?? 0));
  });
}

const changedAllocation: MaterializedAllocation = {
  items: [{
    ...allocation.items[0], shareUnits: 300_000, amountWon: 240_000, percentage: 30,
  }, {
    ...allocation.items[1], shareUnits: 400_000, amountWon: 320_000, percentage: 40,
  }, {
    ...allocation.items[2], shareUnits: 200_000, amountWon: 160_000, percentage: 20,
  }],
  cashAmountWon: 80_000,
  cashPercentage: 10,
  totalAmountWon: 800_000,
};

describe('PortfolioSummary', () => {
  it('leads with the stable ratio and hides every won amount by default', () => {
    const onEdit = vi.fn();
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole('heading', { name: '안정 50%' })).toBeVisible();
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
    expect(screen.queryByText(/원/)).not.toBeInTheDocument();
    expect(visibleRowNames()).toEqual(['글로벌 인덱스', '채권', '금', '현금']);
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '글로벌 인덱스50%',
      '채권25%',
      '금15%',
      '현금10%',
    ]);

    const edit = screen.getByRole('button', { name: '배분 수정' });
    expect(edit).toHaveClass('portfolio-summary__edit');
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('uses the configured Vite base for the vendored edit icon', () => {
    vi.stubEnv('BASE_URL', '/IndividualSavingsFlowUI/');
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    const icon = screen.getByRole('button', { name: '배분 수정' }).querySelector('img');
    expect(icon).toHaveAttribute(
      'src',
      '/IndividualSavingsFlowUI/icons/portfolio-edit.svg',
    );
  });

  it('keeps ratios primary and reveals the total and every row amount together', () => {
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: true, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: '이번 달 투자금 800,000원' })).toBeVisible();
    expect(screen.getByText('안정 50%')).toBeVisible();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('글로벌 인덱스50%400,000원');
    expect(rows[1]).toHaveTextContent('채권25%200,000원');
    expect(rows[2]).toHaveTextContent('금15%120,000원');
    expect(rows[3]).toHaveTextContent('현금10%80,000원');
  });

  it('uses saved input order without changing cash placement', () => {
    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
  });

  it('commits final order and accessible ratios while keyed rows and visual fills interpolate', () => {
    let tops: Record<string, number> = { index: 0, bond: 100, gold: 200, cash: 300 };
    mockRowLayout(() => tops);
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    anime.animate.mockClear();
    tops = { gold: 0, index: 100, bond: 200, cash: 300 };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={changedAllocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    const goldRow = screen.getAllByRole('listitem')[0];
    const ratio = goldRow.querySelector<HTMLElement>('.portfolio-allocation-row__ratio');
    const visualRatio = goldRow.querySelector<HTMLElement>('[data-allocation-ratio-visual]');
    const fill = goldRow.querySelector<HTMLElement>('.portfolio-allocation-row__fill');
    expect(ratio).toHaveAccessibleName('30%');
    expect(visualRatio).toHaveAttribute('aria-hidden', 'true');
    expect(visualRatio).toHaveTextContent('15%');
    expect(fill?.style.getPropertyValue('--allocation-scale')).toBe('0.3');
    expect(anime.animate).toHaveBeenCalledWith(
      goldRow,
      expect.objectContaining({
        translateY: [200, 0],
        duration: 180,
        ease: 'inOut(2)',
      }),
    );
    expect(anime.animate).toHaveBeenCalledWith(
      fill,
      expect.objectContaining({
        scaleX: [0.15, 0.3],
        duration: 180,
        ease: 'inOut(2)',
      }),
    );
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 15 }),
      expect.objectContaining({ value: 30, duration: 180 }),
    );
  });

  it('reveals a newly applied item without moving focus', () => {
    let tops: Record<string, number> = { index: 0, bond: 100, gold: 200, cash: 300 };
    mockRowLayout(() => tops);
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    const edit = screen.getByRole('button', { name: '배분 수정' });
    edit.focus();
    anime.animate.mockClear();
    tops = { index: 0, bond: 100, gold: 200, emerging: 300, cash: 400 };
    const withNewItem: MaterializedAllocation = {
      ...allocation,
      items: [
        { ...allocation.items[1], shareUnits: 400_000, amountWon: 320_000, percentage: 40 },
        allocation.items[2],
        allocation.items[0],
        {
          id: 'emerging', name: '신흥국', order: 3,
          shareUnits: 100_000, amountWon: 80_000, percentage: 10,
          classification: 'growth', classificationOrigin: 'user',
        },
      ],
    };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={withNewItem}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    const newRow = screen.getByRole('heading', { name: '신흥국' }).closest('li');
    expect(edit).toHaveFocus();
    expect(anime.animate).toHaveBeenCalledWith(
      newRow,
      expect.objectContaining({
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 180,
        ease: 'out(3)',
      }),
    );
    expect(anime.animate).toHaveBeenCalledWith(
      newRow?.querySelector('.portfolio-allocation-row__fill'),
      expect.objectContaining({ scaleX: [0, 0.1], duration: 180 }),
    );
  });

  it('continues an interrupted new-row reveal from its visible opacity', () => {
    let tops: Record<string, number> = { index: 0, bond: 100, gold: 200, cash: 300 };
    mockRowLayout(() => tops);
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    const edit = screen.getByRole('button', { name: '배분 수정' });
    edit.focus();
    tops = { index: 0, bond: 100, gold: 200, emerging: 300, cash: 400 };
    const withNewItem: MaterializedAllocation = {
      ...allocation,
      items: [
        { ...allocation.items[1], shareUnits: 400_000, amountWon: 320_000, percentage: 40 },
        allocation.items[2],
        allocation.items[0],
        {
          id: 'emerging', name: '신흥국', order: 3,
          shareUnits: 100_000, amountWon: 80_000, percentage: 10,
          classification: 'growth', classificationOrigin: 'user',
        },
      ],
    };
    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={withNewItem}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    const newRow = screen.getByRole('heading', { name: '신흥국' }).closest('li')!;
    const revealCall = anime.animate.mock.calls.find(([target]) => target === newRow);
    const revealOptions = revealCall?.[1] as { onUpdate?(): void } | undefined;
    expect(revealOptions?.onUpdate).toEqual(expect.any(Function));
    newRow.style.opacity = '0.4';
    revealOptions?.onUpdate?.();
    newRow.style.opacity = '1';
    anime.animate.mockClear();
    const latestAllocation: MaterializedAllocation = {
      ...withNewItem,
      items: withNewItem.items.map((item) => item.id === 'emerging'
        ? { ...item, shareUnits: 150_000, amountWon: 120_000, percentage: 15 }
        : item.id === 'index'
          ? { ...item, shareUnits: 350_000, amountWon: 280_000, percentage: 35 }
          : item),
    };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={latestAllocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(newRow.querySelector('.portfolio-allocation-row__ratio')).toHaveAccessibleName('15%');
    expect(edit).toHaveFocus();
    expect(anime.animate).toHaveBeenCalledWith(
      newRow,
      expect.objectContaining({
        opacity: [0.4, 1],
        duration: 180,
        ease: 'out(3)',
      }),
    );
  });

  it('commits an interrupted new-row reveal immediately when reduced motion activates', () => {
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    const withNewItem: MaterializedAllocation = {
      ...allocation,
      items: [
        { ...allocation.items[1], shareUnits: 400_000, amountWon: 320_000, percentage: 40 },
        allocation.items[2],
        allocation.items[0],
        {
          id: 'emerging', name: '신흥국', order: 3,
          shareUnits: 100_000, amountWon: 80_000, percentage: 10,
          classification: 'growth', classificationOrigin: 'user',
        },
      ],
    };
    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={withNewItem}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    const newRow = screen.getByRole('heading', { name: '신흥국' }).closest('li')!;
    const revealCall = anime.animate.mock.calls.find(([target]) => target === newRow);
    const revealOptions = revealCall?.[1] as { onUpdate?(): void } | undefined;
    newRow.style.opacity = '0.35';
    revealOptions?.onUpdate?.();
    anime.scope.matches.reducedMotion = true;
    anime.animate.mockClear();
    const latestAllocation: MaterializedAllocation = {
      ...withNewItem,
      items: withNewItem.items.map((item) => item.id === 'emerging'
        ? { ...item, shareUnits: 150_000, amountWon: 120_000, percentage: 15 }
        : item),
    };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={latestAllocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(newRow.style.opacity).toBe('');
    expect(newRow.querySelector('[data-allocation-ratio-visual]')).toHaveTextContent('15%');
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('uses final order, ratios, and fill geometry immediately with reduced motion', () => {
    let tops: Record<string, number> = { index: 0, bond: 100, gold: 200, cash: 300 };
    mockRowLayout(() => tops);
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    anime.animate.mockClear();
    anime.scope.matches.reducedMotion = true;
    tops = { gold: 0, index: 100, bond: 200, cash: 300 };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={changedAllocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    const goldRow = screen.getAllByRole('listitem')[0];
    expect(goldRow).not.toHaveStyle({ transform: expect.any(String) });
    expect(goldRow.querySelector('.portfolio-allocation-row__ratio')).toHaveAccessibleName('30%');
    expect(goldRow.querySelector('[data-allocation-ratio-visual]')).toHaveTextContent('30%');
    expect((goldRow.querySelector('.portfolio-allocation-row__fill') as HTMLElement)
      .style.getPropertyValue('--allocation-scale')).toBe('0.3');
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it('continues a rapid replacement from the currently displayed row and fill', () => {
    let tops: Record<string, number> = { index: 0, bond: 100, gold: 200, cash: 300 };
    mockRowLayout(() => tops);
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    tops = { gold: 0, index: 100, bond: 200, cash: 300 };
    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={changedAllocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );
    const goldRow = screen.getAllByRole('listitem')[0];
    const fill = goldRow.querySelector<HTMLElement>('.portfolio-allocation-row__fill');
    const rowTransition = anime.animate.mock.calls.find(([target]) => target === goldRow);
    const fillTransition = anime.animate.mock.calls.find(([target]) => target === fill);
    const rowOptions = rowTransition?.[1] as { onUpdate?: () => void } | undefined;
    const fillOptions = fillTransition?.[1] as { onUpdate?: () => void } | undefined;
    expect(rowOptions?.onUpdate).toEqual(expect.any(Function));
    expect(fillOptions?.onUpdate).toEqual(expect.any(Function));
    tops.gold = 100;
    fill!.style.transform = 'scaleX(0.225)';
    rowOptions?.onUpdate?.();
    fillOptions?.onUpdate?.();
    const visualNumberTransition = anime.animate.mock.calls.find(([, options]) => (
      typeof options === 'object' && options !== null && 'value' in options
    ));
    const visualNumberState = visualNumberTransition?.[0] as { value: number } | undefined;
    const visualNumberOptions = visualNumberTransition?.[1] as { onUpdate?: () => void } | undefined;
    if (visualNumberState !== undefined) visualNumberState.value = 22.5;
    visualNumberOptions?.onUpdate?.();
    anime.animate.mockClear();
    tops = { gold: 0, index: 100, bond: 200, cash: 300 };
    const latestAllocation: MaterializedAllocation = {
      ...changedAllocation,
      items: [{
        ...changedAllocation.items[0], shareUnits: 500_000, amountWon: 400_000, percentage: 50,
      }, {
        ...changedAllocation.items[1], shareUnits: 250_000, amountWon: 200_000, percentage: 25,
      }, {
        ...changedAllocation.items[2], shareUnits: 150_000, amountWon: 120_000, percentage: 15,
      }],
    };

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={latestAllocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(anime.animate).toHaveBeenCalledWith(
      goldRow,
      expect.objectContaining({ translateY: [100, 0], duration: 180 }),
    );
    expect(anime.animate).toHaveBeenCalledWith(
      fill,
      expect.objectContaining({ scaleX: [0.225, 0.5], duration: 180 }),
    );
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 22.5 }),
      expect.objectContaining({ value: 50, duration: 180 }),
    );
  });

  it('restores the final visual ratio when amount visibility interrupts number motion', () => {
    const { rerender } = render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={allocation}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );
    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={changedAllocation}
        preferences={{ showAmounts: false, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );
    const goldRow = screen.getByRole('heading', { name: '금' }).closest('li')!;
    const visualRatio = goldRow.querySelector<HTMLElement>('[data-allocation-ratio-visual]')!;
    const numberCallIndex = anime.animate.mock.calls.findIndex(([, options]) => (
      typeof options === 'object' && options !== null && 'value' in options
    ));
    const numberState = anime.animate.mock.calls[numberCallIndex][0] as { value: number };
    const numberOptions = anime.animate.mock.calls[numberCallIndex][1] as { onUpdate(): void };
    const cancel = (anime.animate.mock.results[numberCallIndex].value as { cancel(): void }).cancel;
    numberState.value = 22.5;
    numberOptions.onUpdate();
    expect(visualRatio).toHaveTextContent('22.5%');
    anime.animate.mockClear();

    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={changedAllocation}
        preferences={{ showAmounts: true, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );

    expect(goldRow.querySelector('.portfolio-allocation-row__ratio')).toHaveAccessibleName('30%');
    expect(visualRatio).toHaveTextContent('30%');
    expect(cancel).toHaveBeenCalledOnce();
    expect(anime.animate).not.toHaveBeenCalled();

    anime.animate.mockClear();
    const latestAllocation: MaterializedAllocation = {
      ...changedAllocation,
      items: [{
        ...changedAllocation.items[0], shareUnits: 500_000, amountWon: 400_000, percentage: 50,
      }, changedAllocation.items[1], changedAllocation.items[2]],
    };
    rerender(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={latestAllocation}
        preferences={{ showAmounts: true, sortMode: 'input' }}
        onEdit={() => undefined}
      />,
    );
    expect(anime.animate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 30 }),
      expect.objectContaining({ value: 50, duration: 180 }),
    );
  });

  it('uses the first item in the current view when investments tie for the largest ratio', () => {
    const tied: MaterializedAllocation = {
      items: [{
        id: 'later', name: '두번째 입력', order: 1,
        shareUnits: 400_000, amountWon: 320_000, percentage: 40,
        classification: 'growth', classificationOrigin: 'automatic',
      }, {
        id: 'first', name: '첫번째 입력', order: 0,
        shareUnits: 400_000, amountWon: 320_000, percentage: 40,
        classification: 'stable', classificationOrigin: 'user',
      }],
      cashAmountWon: 160_000,
      cashPercentage: 20,
      totalAmountWon: 800_000,
    };

    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={tied}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['첫번째 입력', '두번째 입력', '현금']);
    expect(screen.getByText('첫번째 입력에 40%를 배분해요')).toBeVisible();
  });

  it('prefers an investment over cash when both share the largest ratio', () => {
    const cashTie: MaterializedAllocation = {
      items: [{
        id: 'index', name: '글로벌 인덱스', order: 0,
        shareUnits: 500_000, amountWon: 400_000, percentage: 50,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
      cashAmountWon: 400_000,
      cashPercentage: 50,
      totalAmountWon: 800_000,
    };

    render(
      <PortfolioSummary
        investmentWon={800_000}
        allocation={cashTie}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onEdit={() => undefined}
      />,
    );

    expect(visibleRowNames()).toEqual(['글로벌 인덱스', '현금']);
    expect(screen.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
  });
});
