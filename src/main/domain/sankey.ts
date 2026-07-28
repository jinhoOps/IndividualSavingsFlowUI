import { calculateCashflow } from './cashflow';
import type { MainData } from './model';

export interface SankeyNode {
  id: string;
  label: string;
  kind: 'income' | 'aggregate' | 'expense' | 'saving' | 'investment' | 'available' | 'deficit';
}

export interface SankeyLink {
  source: string;
  target: string;
  valueWon: number;
}

export interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export function buildSankeyGraph(data: MainData): SankeyGraph {
  const summary = calculateCashflow(data);
  const hasCashflow = summary.incomeWon > 0 || summary.plannedOutflowWon > 0;
  if (!hasCashflow) return { nodes: [], links: [] };

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const addNode = (id: string, label: string, kind: SankeyNode['kind']) => {
    nodes.push({ id, label, kind });
  };
  const addLink = (source: string, target: string, valueWon: number) => {
    if (valueWon > 0) links.push({ source, target, valueWon });
  };

  data.incomes.forEach((income) => {
    const valueWon = Math.max(0, income.amountWon);
    if (valueWon <= 0) return;

    const id = `income:${income.id}`;
    addNode(id, income.name, 'income');
    addLink(id, 'total-income', valueWon);
  });

  if (summary.deficitWon > 0) addNode('deficit', '부족분', 'deficit');
  addNode('total-income', '총수입', 'aggregate');
  addLink('deficit', 'total-income', summary.deficitWon);

  const categories: Array<{
    id: string;
    label: string;
    kind: Extract<SankeyNode['kind'], 'expense' | 'saving' | 'investment'>;
    valueWon: number;
  }> = [
    { id: 'category:expense', label: '지출', kind: 'expense', valueWon: summary.expenseWon },
    { id: 'category:saving', label: '저축', kind: 'saving', valueWon: summary.savingWon },
    { id: 'category:investment', label: '투자', kind: 'investment', valueWon: summary.investmentWon },
  ];

  categories.forEach(({ id, label, kind, valueWon }) => {
    if (valueWon <= 0) return;
    addNode(id, label, kind);
    addLink('total-income', id, valueWon);
  });

  if (summary.availableWon > 0) {
    addNode('available', '남은 금액', 'available');
    addLink('total-income', 'available', summary.availableWon);
  }

  return { nodes, links };
}
