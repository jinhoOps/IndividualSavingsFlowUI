// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveIndicator } from '../../../src/simulation/ui/SaveIndicator';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SaveIndicator', () => {
  it('renders no persistent indicator after a successful save', () => {
    render(<SaveIndicator state="saved" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
  });

  it('reveals saving feedback only when the save reaches 600ms', () => {
    vi.useFakeTimers();
    render(<SaveIndicator state="saving" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(599));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toHaveTextContent('저장 중');
  });

  it('announces an error immediately', () => {
    render(<SaveIndicator state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('자동 저장하지 못했어요');
  });
});
