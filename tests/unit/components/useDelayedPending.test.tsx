import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedPending } from '../../../src/components/feedback/useDelayedPending';

function Probe({ pending }: { pending: boolean }) {
  const visiblePending = useDelayedPending(pending);

  return <div>{visiblePending ? '저장 중' : 'idle'}</div>;
}

describe('useDelayedPending', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reveals pending only after 600ms', () => {
    const { rerender } = render(<Probe pending={false} />);

    rerender(<Probe pending />);

    expect(screen.getByText('idle')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByText('idle')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('저장 중')).toBeInTheDocument();
  });

  it('hides pending immediately when the work completes', () => {
    const { rerender } = render(<Probe pending />);

    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText('저장 중')).toBeInTheDocument();

    rerender(<Probe pending={false} />);

    expect(screen.getByText('idle')).toBeInTheDocument();
  });
});
