import { describe, expect, it, vi } from 'vitest';
import { BrowserAccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import type { WorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';

describe('Account Map repository', () => {
  it('rejects a stale revision without writing', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source);

    const result = await repository.save(5, { type: 'reset-map' });

    expect(result).toEqual({ status: 'conflict', currentRevision: 0 });
    expect(source.replace).not.toHaveBeenCalled();
  });

  it('returns domain rejection and storage failure explicitly', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source);
    expect(await repository.save(0, {
      type: 'archive-location', locationId: 'missing', replacementRemainderByPurpose: {},
    })).toEqual({ status: 'rejected', reason: 'location-not-found' });

    source.replace.mockResolvedValueOnce({ status: 'unavailable' });
    expect(await repository.save(0, { type: 'reset-map' })).toEqual({ status: 'unavailable' });
  });

  it('delegates migration and persists a valid command at the expected revision', async () => {
    const workspace = createEmptyWorkspace(1);
    const source = fakeWorkspaceRepository(workspace);
    const repository = new BrowserAccountMapRepository(source, () => 20);

    expect(await repository.migrate(0)).toMatchObject({ status: 'saved' });
    expect(source.migrate).toHaveBeenCalledWith(0);
    expect(await repository.save(0, { type: 'reset-map' })).toMatchObject({ status: 'saved' });
    expect(source.replace).toHaveBeenCalledWith(0, expect.objectContaining({ accountMap: expect.any(Object) }));
  });
});

function fakeWorkspaceRepository(workspace: ReturnType<typeof createEmptyWorkspace>) {
  return {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    migrate: vi.fn(async () => ({ status: 'saved' as const, workspace })),
    update: vi.fn(),
    replace: vi.fn<WorkspaceRepository['replace']>(async () => ({ status: 'saved', workspace })),
    resetInvalid: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  } satisfies WorkspaceRepository;
}
