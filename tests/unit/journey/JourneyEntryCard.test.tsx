import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JourneyEntryCard } from '../../../src/journey/ui/JourneyEntryCard';

afterEach(cleanup);

describe('JourneyEntryCard', () => {
  it('keeps the CTA visible but disabled before a Main plan exists', () => {
    render(<JourneyEntryCard enabled={false} onContinue={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
    expect(screen.getByText('Main 계획을 먼저 입력해 주세요.')).toBeVisible();
  });

  it('enables the CTA after a Main plan exists', () => {
    const onContinue = vi.fn();
    render(<JourneyEntryCard enabled onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
