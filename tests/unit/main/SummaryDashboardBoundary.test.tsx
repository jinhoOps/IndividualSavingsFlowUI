import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';

vi.mock('../../../src/main/domain/sankey', () => ({
  buildSankeyGraph: () => {
    throw new Error('chart failed');
  },
}));

import { SummaryDashboard } from '../../../src/main/ui/dashboard/SummaryDashboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SummaryDashboard chart boundary', () => {
  it('retains the summary and editor controls when Sankey rendering fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const data: MainData = {
      schemaVersion: 1,
      updatedAt: 1,
      incomes: [{ id: 'salary', name: '급여', amountWon: 3_000_000, allocations: [] }],
      expenses: [],
      savings: [],
      investments: [],
      accounts: [],
    };

    render(
      <SummaryDashboard
        applied={data}
        draft={data}
        dirty={false}
        issues={[]}
        saveStatus="idle"
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText('현금흐름 차트를 표시하지 못했습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '수입 편집' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '항목별 요약' })).toBeVisible();
  });
});
