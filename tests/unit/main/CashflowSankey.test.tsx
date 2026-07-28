import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { CashflowSankey } from '../../../src/main/ui/dashboard/CashflowSankey';
import type { SankeyGraph } from '../../../src/main/domain/sankey';

afterEach(cleanup);

const graph: SankeyGraph = {
  nodes: [
    { id: 'income:salary', label: '급여', kind: 'income' },
    { id: 'total-income', label: '총수입', kind: 'aggregate' },
    { id: 'category:expense', label: '지출', kind: 'expense' },
    { id: 'category:saving', label: '저축', kind: 'saving' },
  ],
  links: [
    { source: 'income:salary', target: 'total-income', valueWon: 5_000_000 },
    { source: 'total-income', target: 'category:expense', valueWon: 3_000_000 },
    { source: 'total-income', target: 'category:saving', valueWon: 2_000_000 },
  ],
};

describe('CashflowSankey', () => {
  it('renders graph node labels in a responsive SVG', () => {
    const { container } = render(<CashflowSankey graph={graph} />);

    expect(screen.getByText('급여')).toBeTruthy();
    expect(screen.getByText('총수입')).toBeTruthy();
    expect(screen.getByText('지출')).toBeTruthy();
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 960 420');
    expect(container.querySelector('svg')).toHaveAttribute('width', '100%');
  });

  it('renders an empty-state message for an empty graph', () => {
    render(<CashflowSankey graph={{ nodes: [], links: [] }} />);

    expect(screen.getByText('표시할 현금흐름이 없습니다')).toBeTruthy();
  });

  it('renders user-provided labels as text instead of HTML', () => {
    const label = '<img data-testid="executed-markup" src=x onerror="alert(1)">';
    const unsafeGraph: SankeyGraph = {
      nodes: [
        { id: 'income:unsafe', label, kind: 'income' },
        { id: 'total-income', label: '총수입', kind: 'aggregate' },
      ],
      links: [{ source: 'income:unsafe', target: 'total-income', valueWon: 1 }],
    };

    const { container } = render(<CashflowSankey graph={unsafeGraph} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(container.querySelector('[data-testid="executed-markup"]')).toBeNull();
  });
});
