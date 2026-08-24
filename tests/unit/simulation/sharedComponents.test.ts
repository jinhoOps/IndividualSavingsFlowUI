import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const buttonFiles = [
  'src/simulation/ui/AdvancedSettings.tsx',
  'src/simulation/ui/ExpectedReturnStep.tsx',
  'src/simulation/ui/GoalAmountStep.tsx',
  'src/simulation/ui/SimulationControls.tsx',
  'src/simulation/ui/SimulationApp.tsx',
  'src/simulation/ui/StartingPrincipalStep.tsx',
];

const surfaceFiles = [
  'src/simulation/ui/AdvancedSettings.tsx',
  'src/simulation/ui/ExpectedReturnStep.tsx',
  'src/simulation/ui/GrowthChart.tsx',
  'src/simulation/ui/GoalAmountStep.tsx',
  'src/simulation/ui/SimulationControls.tsx',
  'src/simulation/ui/StartingPrincipalStep.tsx',
];

describe('Simulation shared component architecture', () => {
  it('delegates app chrome and canvas to AppShell', () => {
    const simulationCss = source('src/simulation/ui/simulation.css');
    const portfolioCss = source('src/portfolio/ui/portfolio.css');
    const portfolioSource = source('src/portfolio/ui/PortfolioApp.tsx');

    expect(simulationCss).not.toMatch(/\.simulation-shell[^}]*background:/s);
    expect(portfolioCss).not.toMatch(/\.portfolio-shell[^}]*background:/s);
    expect(portfolioSource).not.toContain('portfolio-launcher');
  });

  it.each(buttonFiles)('uses Button instead of direct ui-button markup in %s', (file) => {
    const contents = source(file);

    expect(contents).not.toMatch(/<button[^>]+className="ui-button/);
    expect(contents).toMatch(/components\/common\/Button/);
  });

  it.each(surfaceFiles)('uses Surface instead of direct ui-surface sections in %s', (file) => {
    const contents = source(file);

    expect(contents).not.toMatch(/<section[^>]+ui-surface/);
    expect(contents).toMatch(/components\/common\/Surface/);
  });

  it('uses AppContentFrame for its reading-width surface frame while retaining recovery surface styling', () => {
    const contents = source('src/simulation/ui/SimulationApp.tsx');

    expect(contents).toMatch(/components\/common\/AppContentFrame/);
    expect(contents).toMatch(/<AppContentFrame\s+as="section"\s+className="ui-surface simulation-recovery"/s);
  });
});
