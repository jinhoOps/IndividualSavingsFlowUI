import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { FlowContextSummary } from '../../../src/main/ui/setup/FlowContextSummary';

afterEach(cleanup);

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

function setMeterRect(meter: HTMLElement) {
  Object.defineProperty(meter, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ bottom: 6, height: 6, left: 10, right: 210, top: 0, width: 200, x: 10, y: 0 }),
  });
}

function movePointer(meter: HTMLElement, clientX: number) {
  fireEvent(meter, new MouseEvent('pointermove', { bubbles: true, clientX }));
}

describe('FlowContextSummary', () => {
  it('renders only a compact flow meter instead of the verbose context copy', () => {
    render(<FlowContextSummary data={cashflowFixture} />);

    expect(screen.queryByText('월 수입 320만 원')).not.toBeInTheDocument();
    expect(screen.queryByText('현재 계획 230만 원')).not.toBeInTheDocument();
    expect(screen.queryByText('남는 돈 90만 원')).not.toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveClass('flow-bar');
  });

  it('positions the percentage tooltip from a clamped pointer coordinate', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

    fireEvent.pointerEnter(meter, { clientX: 40 });
    movePointer(meter, 40);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '15%' });

    movePointer(meter, -20);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '0%' });
    movePointer(meter, 300);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '100%' });
  });

  it('keeps pointer, focus, and tap tooltip state independent', () => {
    render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

    fireEvent.pointerEnter(meter, { clientX: 40 });
    fireEvent.focus(meter);
    fireEvent.pointerLeave(meter);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '71.875%' });

    fireEvent.blur(meter);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(meter, { clientX: 40 });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^71\.9%$/);
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
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

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
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

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
    const meter = screen.getByRole('meter');
    const outside = screen.getByRole('button', { name: 'outside' });
    setMeterRect(meter);

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
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

    fireEvent.click(meter, { clientX: 40 });
    fireEvent.click(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('removes the document click listener when unmounted with a tap tooltip open', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<FlowContextSummary data={cashflowFixture} />);
    const meter = screen.getByRole('meter');
    setMeterRect(meter);

    fireEvent.click(meter, { clientX: 40 });
    const clickAwayListener = addEventListener.mock.calls.find(([type]) => type === 'click')?.[1];
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('click', clickAwayListener);
  });

  it('keeps unavailable income and deficit details in meter ARIA attributes', () => {
    const { rerender } = render(<FlowContextSummary data={emptyFixture} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '수입을 먼저 입력해주세요.');
    expect(screen.queryByText('수입을 먼저 입력해주세요.')).not.toBeInTheDocument();

    rerender(<FlowContextSummary data={deficitFixture} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuetext', '125.0%');
    expect(meter.firstElementChild).toHaveStyle({ width: '100%' });
  });
});
