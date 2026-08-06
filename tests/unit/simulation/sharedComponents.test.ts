import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const buttonFiles = [
  'src/simulation/ui/AdvancedSettings.tsx',
  'src/simulation/ui/ScenarioSetupStep.tsx',
  'src/simulation/ui/SimulationControls.tsx',
  'src/simulation/ui/SimulationApp.tsx',
  'src/simulation/ui/StartingPrincipalStep.tsx',
];

const surfaceFiles = [
  'src/simulation/ui/AdvancedSettings.tsx',
  'src/simulation/ui/GrowthChart.tsx',
  'src/simulation/ui/ScenarioSetupStep.tsx',
  'src/simulation/ui/SimulationControls.tsx',
  'src/simulation/ui/SimulationApp.tsx',
  'src/simulation/ui/StartingPrincipalStep.tsx',
];

describe('Simulation shared component architecture', () => {
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
});
