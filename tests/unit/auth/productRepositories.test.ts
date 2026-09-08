import { describe, expect, it, vi } from 'vitest';
import { accountMapJourneyRepositories } from '../../../src/auth/productRepositories';
import type { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';

describe('accountMapJourneyRepositories', () => {
  it('keeps Account Map writes scoped separately from the Main overlay repository', () => {
    const scope = vi.fn<(name: string) => object>(() => ({}));
    const session = { scope } as unknown as AccountWorkspaceSession;

    const result = accountMapJourneyRepositories(session);

    expect(result.repositories.accountMap).toBeDefined();
    expect(result.repositories.main).toBeDefined();
    expect(result.mainRepository).toBeDefined();
    expect(scope.mock.calls.map(([name]) => name)).toEqual(['account-map', 'account-map', 'main']);
  });
});
