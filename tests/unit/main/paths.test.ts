import { describe, expect, it } from 'vitest';
import { createAppPaths } from '../../../src/main/infrastructure/paths';

describe('createAppPaths', () => {
  it('keeps every route under the repository base', () => {
    const paths = createAppPaths('/IndividualSavingsFlowUI/');

    expect(paths.main).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(paths.simulation).toBe('/IndividualSavingsFlowUI/apps/simulation/');
    expect(paths.portfolio).toBe('/IndividualSavingsFlowUI/apps/portfolio/');
    expect(paths.accountMap).toBe('/IndividualSavingsFlowUI/apps/account-map/');
    expect(Object.values(paths).every((path) => !path.startsWith('/apps/'))).toBe(true);
  });
});
