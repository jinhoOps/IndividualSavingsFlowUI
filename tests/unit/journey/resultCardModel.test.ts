import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import { buildResultCardModel } from '../../../src/journey/result-card/model';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { formatWon } from '../../../src/simulation/ui/format';
import { renderResultCardSvg } from '../../../src/journey/result-card/renderResultCardSvg';

function readyWorkspace() {
  const workspace = createEmptyWorkspace(Date.UTC(2026, 8, 21));
  workspace.revision = 7;
  workspace.main.applied = {
    schemaVersion: 2,
    updatedAt: 1_000,
    monthlyNetIncomeWon: 3_200_000,
    monthlyHousingWon: 800_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 800_000,
  };
  workspace.simulation.draft = {
    schemaVersion: 3,
    source: { monthlySavingsWon: 300_000, monthlyInvestmentWon: 800_000, mainUpdatedAt: 1_000 },
    initialInvestmentWon: 15_000_000,
    targetAmountWon: null,
    years: 5,
    expectedAnnualReturnPercent: 9,
    baseRatePercent: 3,
    inflationOffsetPercentPoints: -0.25,
    amountMode: 'nominal',
    updatedAt: 1_100,
  };
  workspace.portfolio.plans = [{
    schemaVersion: 2,
    scope: { type: 'aggregate' },
    items: [{
      id: 'index', name: '글로벌 인덱스', shareUnits: 500_000, order: 0,
      classification: 'growth', classificationOrigin: 'automatic',
    }, {
      id: 'bond', name: '채권', shareUnits: 250_000, order: 1,
      classification: 'stable', classificationOrigin: 'automatic',
    }, {
      id: 'gold', name: '금', shareUnits: 150_000, order: 2,
      classification: 'stable', classificationOrigin: 'automatic',
    }],
    cashShareUnits: 100_000,
    cashMode: 'automatic',
    syncedInvestmentWon: 800_000,
    appliedAt: 1_200,
    updatedAt: 1_200,
  }];
  return workspace;
}

describe('result card model', () => {
  it.each(['nominal', 'real'] as const)('uses %s amounts consistently in growth KPIs', (amountMode) => {
    const workspace = readyWorkspace();
    workspace.simulation.draft!.amountMode = amountMode;
    const projection = projectCompoundGrowth(workspace.simulation.draft!);
    const final = projection.points.at(-1)!;
    const principal = amountMode === 'real' ? final.contributedPrincipalRealWon : final.contributedPrincipalWon;
    const built = buildResultCardModel(workspace, { includeAmounts: true });
    expect(built.kind).toBe('ready');
    if (built.kind !== 'ready') return;
    expect(built.model.growth.headline).toBe(formatWon(projection.finalCurrentPlanWon));
    expect(built.model.growth.rows).toEqual([
      { label: '납입원금', value: formatWon(principal) },
      { label: '예상 수익', value: `+${formatWon(projection.finalCurrentPlanWon - principal)}` },
      { label: '전부 저축 시', value: formatWon(projection.finalAllSavingsWon) },
      { label: '전부 저축 대비', value: `+${formatWon(projection.advantageOverAllSavingsWon)}` },
    ]);
    expect(built.model.growth).not.toHaveProperty('points');
    expect(renderResultCardSvg(built.model)).not.toContain('<path');
    expect(built.model.allocation.groups.map(({label, percentage}) => [label, percentage])).toEqual([
      ['주식', '50%'], ['현물', '15%'], ['채권', '25%'], ['현금', '10%'],
    ]);
  });

  it('keeps losses signed and handles a zero principal without infinities', () => {
    const workspace = readyWorkspace();
    workspace.simulation.draft!.expectedAnnualReturnPercent = -10;
    const loss = buildResultCardModel(workspace, { includeAmounts: true });
    expect(loss.kind).toBe('ready');
    if (loss.kind !== 'ready') return;
    expect(loss.model.growth.rows.find(row => row.label === '예상 수익')!.value).toMatch(/^-/);
    expect(loss.model.growth.rows.find(row => row.label === '전부 저축 대비')!.value).toMatch(/^-/);
    workspace.simulation.draft!.years = 0;
    workspace.simulation.draft!.initialInvestmentWon = 0;
    const zero = buildResultCardModel(workspace, { includeAmounts: false });
    expect(zero.kind).toBe('ready');
    if (zero.kind !== 'ready') return;
    expect(zero.model.growth.headline).toBe('미설정');
    expect(zero.model.growth.rows[0].value).toBe('미설정');
    expect(JSON.stringify(zero.model)).not.toMatch(/Infinity|NaN/);
  });

  it('blocks a card when its simulation has not adopted the applied Main values', () => {
    const workspace = readyWorkspace();
    workspace.simulation.draft!.source.monthlyInvestmentWon = 700_000;

    expect(buildResultCardModel(workspace, { includeAmounts: true })).toEqual({
      kind: 'blocked', reason: 'source-mismatch',
    });
  });

  it('removes financial amounts from the model and rendered SVG in ratio mode', () => {
    const workspace = readyWorkspace();
    const built = buildResultCardModel(workspace, { includeAmounts: false });

    expect(built.kind).toBe('ready');
    if (built.kind !== 'ready') return;
    expect(built.model.mode).toBe('ratios');
    expect([built.model.growth.headline, ...built.model.growth.rows.map(row => row.value)].join('')).not.toContain('원');
    expect(built.model.growth.headline).toMatch(/배$/);
    expect(built.model.growth).not.toHaveProperty('points');
    expect(JSON.stringify(built.model)).not.toContain('3,200,000');
    expect(JSON.stringify(built.model)).not.toContain('320만');
    expect(built.model.allocation.rows.every(row => row.amount === undefined)).toBe(true);
    const svg = renderResultCardSvg(built.model);
    expect(svg).toContain('1080');
    expect(svg).toContain('1440');
    expect(svg).not.toContain('3,200,000');
    expect(svg).not.toContain('800,000');
    expect(svg).toContain('글로벌 인덱스');
  });

  it('keeps the maximum ten targets plus cash inside the allocation area', () => {
    const workspace = readyWorkspace();
    workspace.portfolio.plans![0]!.items = Array.from({length: 10}, (_, index) => ({
      id: `asset-${index}`, name: `장기 투자 대상 ${index + 1}`, shareUnits: 90_000, order: index,
      classification: index % 2 === 0 ? 'growth' as const : 'stable' as const,
      classificationOrigin: 'automatic' as const,
    }));
    const built = buildResultCardModel(workspace, {includeAmounts: true});

    expect(built.kind).toBe('ready');
    if (built.kind !== 'ready') return;
    const svg = renderResultCardSvg(built.model);
    expect(svg).toContain('장기 투자 대상 10');
    expect(svg).toContain('현금');
    expect(svg).toContain('y="1322"');
    expect(svg).toContain('y="1348"');
  });
});
