import { describe, expect, it } from 'vitest';
import { appPath } from '../../../src/journey/routes';

describe('appPath', () => {
  it('keeps every destination under the configured base', () => {
    expect(appPath('main', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(appPath('simulation', '/IndividualSavingsFlowUI/')).toBe('/IndividualSavingsFlowUI/apps/simulation/');
    expect(appPath('portfolio', '/')).toBe('/apps/portfolio/');
  });

  it('normalizes missing base boundary slashes', () => {
    expect(appPath('portfolio', 'IndividualSavingsFlowUI')).toBe('/IndividualSavingsFlowUI/apps/portfolio/');
    expect(appPath('account-map', '/IndividualSavingsFlowUI')).toBe('/IndividualSavingsFlowUI/apps/account-map/');
  });
});
