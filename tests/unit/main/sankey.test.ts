import { describe, expect, it } from 'vitest';
import { buildSankeyGraph } from '../../../src/main/domain/sankey';
import type { MainData } from '../../../src/main/domain/model';

const data: MainData = {
  schemaVersion: 1,
  updatedAt: 0,
  incomes: [{ id: 'salary', name: '급여', amountWon: 5_000_000, allocations: [] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 2_000_000 }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 800_000 }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 700_000 }],
  accounts: [],
};

describe('buildSankeyGraph', () => {
  it('routes income through total income to every outflow category', () => {
    const graph = buildSankeyGraph(data);

    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'income:salary',
      'total-income',
      'category:expense',
      'category:saving',
      'category:investment',
      'available',
    ]));
    expect(graph.links).toContainEqual({
      source: 'income:salary',
      target: 'total-income',
      valueWon: 5_000_000,
    });
    expect(graph.links).toEqual(expect.arrayContaining([
      { source: 'total-income', target: 'category:expense', valueWon: 2_000_000 },
      { source: 'total-income', target: 'category:saving', valueWon: 800_000 },
      { source: 'total-income', target: 'category:investment', valueWon: 700_000 },
      { source: 'total-income', target: 'available', valueWon: 1_500_000 },
    ]));
  });

  it('adds no zero-value links and represents a deficit as supplemental income', () => {
    const graph = buildSankeyGraph({
      ...data,
      incomes: [{ ...data.incomes[0], amountWon: 1_000_000 }],
      savings: [],
      investments: [],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'income:salary',
      'total-income',
      'category:expense',
      'deficit',
    ]));
    expect(graph.nodes.map((node) => node.id)).not.toContain('category:saving');
    expect(graph.nodes.map((node) => node.id)).not.toContain('category:investment');
    expect(graph.links).toContainEqual({
      source: 'deficit',
      target: 'total-income',
      valueWon: 1_000_000,
    });
    expect(graph.links.every((link) => link.valueWon > 0)).toBe(true);
  });

  it('returns an empty graph when there is no cashflow to display', () => {
    expect(buildSankeyGraph({
      ...data,
      incomes: [],
      expenses: [],
      savings: [],
      investments: [],
    })).toEqual({ nodes: [], links: [] });
  });
});
