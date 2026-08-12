import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { FlowContextSummary } from '../../../src/main/ui/setup/FlowContextSummary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cashflowFixture: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const emptyFixture: MainData = {
  ...cashflowFixture,
  monthlyNetIncomeWon: 0,
  monthlyHousingWon: 0,
  monthlyLivingWon: 0,
  monthlySavingWon: 0,
  monthlyInvestmentWon: 0,
};

const deficitFixture: MainData = {
  ...cashflowFixture,
  monthlyInvestmentWon: 1_900_000,
};

const liquidDeficitFixture: MainData = {
  ...cashflowFixture,
  monthlyInvestmentWon: 2_300_000,
};

let resizeObserverCallback: ResizeObserverCallback | undefined;

function mockBarViewport(initialClientWidth: number) {
  let clientWidth = initialClientWidth;
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => clientWidth);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isBar = this.getAttribute('role') === 'progressbar';
    const width = isBar ? 200 : 0;
    const left = 0;
    return {
      bottom: 44,
      height: 44,
      left,
      right: left + width,
      top: 0,
      width,
      x: left,
      y: 0,
      toJSON: () => ({}),
    };
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resizeObserverCallback = callback;
    }

    observe() {}
    disconnect() {}
  });

  return (nextClientWidth: number) => {
    clientWidth = nextClientWidth;
    act(() => resizeObserverCallback?.([], {} as ResizeObserver));
  };
}

function setProgressbarRect(progressbar: HTMLElement) {
  Object.defineProperty(progressbar, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ bottom: 6, height: 6, left: 10, right: 210, top: 0, width: 200, x: 10, y: 0 }),
  });
}

function movePointer(meter: HTMLElement, clientX: number) {
  fireEvent(meter, new MouseEvent('pointermove', { bubbles: true, clientX }));
}

describe('FlowContextSummary', () => {
  it('renders only a compact flow progressbar instead of verbose context copy', () => {
    render(<FlowContextSummary data={cashflowFixture} />);

    expect(screen.queryByText('월 수입 320만 원')).not.toBeInTheDocument();
    expect(screen.queryByText('현재 계획 230만 원')).not.toBeInTheDocument();
    expect(screen.queryByText('남는 돈 90만 원')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveClass('flow-bar');
  });

  it('positions the percentage tooltip from a clamped pointer coordinate', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.pointerEnter(meter, { clientX: 40 });
    movePointer(meter, 40);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^현재 계획 230만 원 · 수입의 71\.9%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '15%' });

    movePointer(meter, -20);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '0%' });
    movePointer(meter, 300);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '100%' });
  });

  it('keeps pointer, focus, and tap tooltip state independent', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.pointerEnter(meter, { clientX: 40 });
    fireEvent.focus(meter);
    fireEvent.pointerLeave(meter);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^현재 계획 230만 원 · 수입의 71\.9%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '71.875%' });

    fireEvent.blur(meter);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^현재 계획 230만 원 · 수입의 71\.9%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '15%' });
    fireEvent.pointerEnter(meter, { clientX: 80 });
    fireEvent.focus(meter);
    fireEvent.pointerLeave(meter);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '15%' });
    fireEvent.blur(meter, { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '15%' });
    fireEvent.click(meter, { clientX: 40 });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes on the second pointer tap when the meter retains focus', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.pointerDown(meter, { clientX: 40 });
    fireEvent.focus(meter);
    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(meter, { clientX: 40 });
    fireEvent.click(meter, { clientX: 40 });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes a tap tooltip when clicking outside the meter', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    render(<><FlowContextSummary data={cashflowFixture} /><button type="button">outside</button></>);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    const clickAwayListener = addEventListener.mock.calls.find(([type]) => type === 'click')?.[1];
    expect(clickAwayListener).toEqual(expect.any(Function));
    fireEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(removeEventListener).toHaveBeenCalledWith('click', clickAwayListener);
  });

  it('closes a tap tooltip when focus moves outside its wrapper', () => {
    render(<><FlowContextSummary data={cashflowFixture} /><button type="button">outside</button></>);
    const meter = screen.getByRole('progressbar');
    const outside = screen.getByRole('button', { name: 'outside' });
    setProgressbarRect(meter);

    fireEvent.pointerDown(meter, { clientX: 40 });
    fireEvent.focus(meter);
    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(meter, { relatedTarget: outside });
    fireEvent.focus(outside);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps a tapped tooltip open when the tooltip itself is clicked', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.click(meter, { clientX: 40 });
    fireEvent.click(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('removes the document click listener when unmounted with a tap tooltip open', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('progressbar');
    setProgressbarRect(meter);

    fireEvent.click(meter, { clientX: 40 });
    const clickAwayListener = addEventListener.mock.calls.find(([type]) => type === 'click')?.[1];
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('click', clickAwayListener);
  });

  it('keeps unavailable income and actual deficit details in progressbar ARIA attributes', () => {
    const { rerender } = render(<FlowContextSummary data={emptyFixture} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '수입을 먼저 입력해주세요.');
    expect(screen.queryByText('수입을 먼저 입력해주세요.')).not.toBeInTheDocument();

    rerender(<FlowContextSummary data={deficitFixture} />);
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAttribute('aria-valuetext', '현재 계획 400만 원 · 수입의 125.0%');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter.firstElementChild).toHaveStyle({ width: '100%' });
    expect(screen.getByRole('status')).toHaveTextContent('수입보다 80만 원 초과');
  });

  it('uses actual deficit geometry without a label when the overflow fits', () => {
    mockBarViewport(1_000);
    render(<FlowContextSummary data={liquidDeficitFixture} />);

    const track = screen.getByRole('progressbar');
    expect(track).toHaveAttribute('data-desired-end-percent', '137.5');
    expect(track).toHaveAttribute('data-visible-end-percent', '137.5');
    expect(track).toHaveAttribute('data-overflow-clipped', 'false');
    expect(screen.queryByText('+37.5% 초과')).not.toBeInTheDocument();
    expect(screen.getByText('수입보다 120만 원 초과')).toBeVisible();
  });

  it('shows the actual overflow label only after a ResizeObserver update clips the strip', () => {
    const resizeTo = mockBarViewport(1_000);
    render(<FlowContextSummary data={liquidDeficitFixture} />);
    const track = screen.getByRole('progressbar');

    expect(screen.queryByText('+37.5% 초과')).not.toBeInTheDocument();
    resizeTo(256);

    expect(track).toHaveAttribute('data-desired-end-percent', '137.5');
    expect(track).toHaveAttribute('data-visible-end-percent', '120');
    expect(track).toHaveAttribute('data-overflow-clipped', 'true');
    expect(screen.getByText('+37.5% 초과')).toBeVisible();
  });

  it('does not emit legacy overflow layout attributes for a deficit', () => {
    mockBarViewport(1_000);
    render(<FlowContextSummary data={liquidDeficitFixture} />);

    const track = screen.getByRole('progressbar');
    expect(track.closest('.flow-context-summary')).not.toHaveAttribute('data-overflow');
    expect(track.parentElement).not.toHaveAttribute('data-overflow');
  });
});
