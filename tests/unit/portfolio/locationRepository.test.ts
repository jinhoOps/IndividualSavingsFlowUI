import { describe, expect, it, vi } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import {
  BrowserInvestmentLocationRepository,
} from '../../../src/portfolio/infrastructure/locationRepository';
import type {
  FinancialLocation,
  FinancialRole,
} from '../../../src/workspace/domain/financialLocation';
import {
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../../../src/workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';
import { MemoryStorage } from '../simulation/MemoryStorage';

function location(
  id: string,
  shortName: string,
  roles: FinancialRole[],
  archivedAt?: number,
): FinancialLocation {
  return {
    id,
    shortName,
    kind: 'brokerage',
    roles,
    ...(archivedAt === undefined ? {} : { archivedAt }),
    createdAt: 100,
    updatedAt: 100,
  };
}

function scopedPlan(locationId: string): PortfolioPlan {
  return {
    schemaVersion: 2,
    scope: { type: 'location', locationId },
    items: [],
    cashShareUnits: 1_000_000,
    cashMode: 'automatic',
    syncedInvestmentWon: 200_000,
    appliedAt: 100,
    updatedAt: 100,
  };
}

function setup(initial: Partial<WorkspaceDocument> = {}) {
  const storage = new MemoryStorage();
  const workspace = { ...createEmptyWorkspace(100), ...initial };
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  const workspaceRepository = new BrowserWorkspaceRepository(storage, { now: () => 500 });
  const repository = new BrowserInvestmentLocationRepository(workspaceRepository, {
    createId: () => 'location-new',
    now: () => 400,
  });
  return { repository, storage, workspaceRepository };
}

function persisted(storage: MemoryStorage): WorkspaceDocument {
  return JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
}

describe('BrowserInvestmentLocationRepository', () => {
  it('lists only active investing locations in normalized display order', () => {
    const { repository } = setup({
      locations: [
        location('saving', '저축', ['saving']),
        location('zulu', 'zulu', ['investing']),
        location('alpha', ' Alpha ', ['investing']),
        location('archived', 'ISA', ['investing'], 200),
      ],
    });

    expect(repository.list().map(({ id }) => id)).toEqual(['alpha', 'zulu']);
  });

  it('creates one shared investing identity and commits its latest workspace revision', async () => {
    const { repository, storage } = setup();

    await expect(repository.create({
      shortName: '  Toss   ISA ',
      institution: { name: ' 토스 증권 ' },
      kind: 'brokerage',
    })).resolves.toMatchObject({
      status: 'saved',
      location: {
        id: 'location-new',
        shortName: 'Toss ISA',
        institution: { name: '토스 증권' },
        roles: ['investing'],
      },
    });
    expect(persisted(storage)).toMatchObject({
      revision: 1,
      locations: [{ id: 'location-new', roles: ['investing'] }],
    });
  });

  it('maps normalized duplicates, investing capacity, and invalid input distinctly', async () => {
    const duplicate = setup({ locations: [location('existing', 'Toss ISA', ['investing'])] });
    await expect(duplicate.repository.create({
      shortName: ' toss   isa ',
      kind: 'brokerage',
    })).resolves.toEqual({ status: 'duplicate-name' });

    const full = setup({
      locations: Array.from({ length: 10 }, (_, index) => (
        location(`location-${index}`, `ISA ${index}`, ['investing'])
      )),
    });
    await expect(full.repository.create({
      shortName: '추가',
      kind: 'brokerage',
    })).resolves.toEqual({ status: 'purpose-capacity' });

    await expect(full.repository.rename('location-0', 'ISA!'))
      .resolves.toEqual({ status: 'invalid-input' });
  });

  it('maps workspace conflict and unavailable outcomes distinctly', async () => {
    const workspace = createEmptyWorkspace(100);
    const conflictRepository: WorkspaceRepository = {
      load: () => ({ status: 'found', workspace }),
      update: async () => ({ status: 'conflict', currentRevision: 2 }),
      replace: async () => ({ status: 'conflict', currentRevision: 2 }),
      resetInvalid: async () => ({ status: 'changed' }),
      subscribe: () => () => undefined,
    };
    const unavailableRepository: WorkspaceRepository = {
      ...conflictRepository,
      load: () => ({ status: 'unavailable' }),
    };

    await expect(new BrowserInvestmentLocationRepository(conflictRepository).create({
      shortName: 'ISA',
      kind: 'brokerage',
    })).resolves.toEqual({ status: 'conflict' });
    await expect(new BrowserInvestmentLocationRepository(unavailableRepository).create({
      shortName: 'ISA',
      kind: 'brokerage',
    })).resolves.toEqual({ status: 'unavailable' });
  });

  it('publishes active investing locations after a same-tab committed change', async () => {
    const { repository, workspaceRepository } = setup();
    const subscriber = new BrowserInvestmentLocationRepository(workspaceRepository);
    const listener = vi.fn();
    const unsubscribe = subscriber.subscribe(listener);

    await repository.create({ shortName: 'ISA', kind: 'brokerage' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'location-new', shortName: 'ISA' }),
    ]);
    unsubscribe();
  });

  it('requires reference confirmation, then preserves a scoped plan by default disposition', async () => {
    const target = location('location-isa', 'ISA', ['investing']);
    const plan = scopedPlan(target.id);
    const { repository, storage } = setup({
      locations: [target],
      portfolio: { plans: [plan], draft: null },
    });

    await expect(repository.archive(target.id)).resolves.toEqual({
      status: 'portfolio-reference',
      referencedScopes: ['location:location-isa'],
    });
    expect(persisted(storage).locations[0]).not.toHaveProperty('archivedAt');

    await expect(repository.archive(target.id, 'preserve')).resolves.toMatchObject({
      status: 'saved',
      location: { id: target.id, archivedAt: 400 },
    });
    expect(persisted(storage).portfolio.plans).toEqual([plan]);
    expect(repository.list()).toEqual([]);
  });

  it('deletes only matching location-scoped Portfolio data after explicit disposition', async () => {
    const target = location('location-isa', 'ISA', ['investing']);
    const other = location('location-other', '기타', ['investing']);
    const aggregate = { ...scopedPlan(target.id), scope: { type: 'aggregate' } as const };
    const { repository, storage } = setup({
      locations: [target, other],
      portfolio: {
        plans: [aggregate, scopedPlan(target.id), scopedPlan(other.id)],
        draft: null,
      },
    });

    await repository.archive(target.id, 'delete');

    expect(persisted(storage).portfolio.plans.map(({ scope }) => scope)).toEqual([
      { type: 'aggregate' },
      { type: 'location', locationId: other.id },
    ]);
  });
});
