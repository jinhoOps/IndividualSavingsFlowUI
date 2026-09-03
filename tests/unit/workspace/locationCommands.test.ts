import { describe, expect, it } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { FinancialLocation, FinancialRole } from '../../../src/workspace/domain/financialLocation';
import {
  archiveLocation,
  createLocation,
  renameLocation,
  restoreLocation,
  setLocationRoles,
} from '../../../src/workspace/domain/locationCommands';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

const aggregatePlan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [],
  cashShareUnits: 1_000_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 300,
  updatedAt: 300,
};

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

function workspaceWith(locations: FinancialLocation[]): WorkspaceDocument {
  return {
    ...createEmptyWorkspace(100),
    locations,
    portfolio: { plans: [aggregatePlan], draft: null },
  };
}

describe('Shared location commands', () => {
  it('creates a normalized display location with stable injected identity and timestamps', () => {
    const result = createLocation(createEmptyWorkspace(100), {
      shortName: '  Toss   ISA  ',
      institution: { id: 'toss', name: '  Toss   Bank  ' },
      kind: 'brokerage',
      roles: ['saving', 'investing'],
    }, {
      createId: () => 'location-stable',
      now: () => 500,
    });

    expect(result).toMatchObject({
      ok: true,
      location: {
        id: 'location-stable',
        shortName: 'Toss ISA',
        institution: { id: 'toss', name: 'Toss Bank' },
        kind: 'brokerage',
        roles: ['saving', 'investing'],
        createdAt: 500,
        updatedAt: 500,
      },
      workspace: { schemaVersion: 3, updatedAt: 500 },
    });
  });

  it('rejects a case-folded active duplicate without mutating the input', () => {
    const workspace = workspaceWith([location('existing', 'Toss ISA', ['investing'])]);
    const before = structuredClone(workspace);

    const result = createLocation(workspace, {
      shortName: '  toss   isa ',
      kind: 'brokerage',
      roles: ['investing'],
    }, { createId: () => 'new', now: () => 500 });

    expect(result).toEqual({ ok: false, reason: 'duplicate-name' });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['unsupported name characters', { shortName: 'ISA!', kind: 'brokerage', roles: ['investing'] }],
    ['null name', { shortName: null, kind: 'brokerage', roles: ['investing'] }],
    ['empty roles', { shortName: 'ISA', kind: 'brokerage', roles: [] }],
    ['duplicate roles', { shortName: 'ISA', kind: 'brokerage', roles: ['investing', 'investing'] }],
    ['unknown role', { shortName: 'ISA', kind: 'brokerage', roles: ['retirement'] }],
    ['invalid institution', {
      shortName: 'ISA', institution: { name: '   ' }, kind: 'brokerage', roles: ['investing'],
    }],
  ])('returns invalid-input without mutation for create with %s', (_name, input) => {
    const workspace = createEmptyWorkspace(100);
    const before = structuredClone(workspace);
    expect(createLocation(workspace, input as never, {
      createId: () => 'new',
      now: () => 500,
    })).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it('accepts the tenth active location for a purpose and rejects the eleventh', () => {
    const workspace = workspaceWith(Array.from({ length: 9 }, (_, index) => (
      location(`location-${index}`, `I${index}`, ['income'])
    )));
    workspace.portfolio.plans = [];

    const tenth = createLocation(workspace, {
      shortName: 'I9', kind: 'bank', roles: ['income'],
    }, { createId: () => 'location-9', now: () => 500 });
    expect(tenth.ok).toBe(true);
    if (!tenth.ok) throw new Error('expected tenth location to be accepted');

    expect(createLocation(tenth.workspace, {
      shortName: 'I10', kind: 'bank', roles: ['income'],
    }, { createId: () => 'location-10', now: () => 600 }))
      .toEqual({ ok: false, reason: 'purpose-capacity' });
  });

  it('renames a location without changing the aggregate Portfolio slice', () => {
    const current = location('location-isa', 'ISA', ['investing']);
    const workspace = workspaceWith([current]);

    const result = renameLocation(workspace, current.id, '  New   ISA ', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected rename to succeed');
    expect(result.location).toMatchObject({ id: current.id, shortName: 'New ISA', updatedAt: 500 });
    expect(result.workspace.portfolio).toEqual(workspace.portfolio);
  });

  it('archives a location without changing the aggregate Portfolio slice', () => {
    const current = location('location-isa', 'ISA', ['investing']);
    const workspace = workspaceWith([current]);

    const result = archiveLocation(workspace, current.id, 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected archive to succeed');
    expect(result.location).toMatchObject({ archivedAt: 500, updatedAt: 500 });
    expect(result.workspace.portfolio).toEqual(workspace.portfolio);
  });

  it('removes investing role without changing the aggregate Portfolio slice', () => {
    const current = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace = workspaceWith([current]);

    const result = setLocationRoles(workspace, current.id, ['saving'], 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected role update to succeed');
    expect(result.location).toMatchObject({ roles: ['saving'], updatedAt: 500 });
    expect(result.workspace.portfolio).toEqual(workspace.portfolio);
  });

  it.each([
    ['empty roles', []],
    ['duplicate roles', ['saving', 'saving']],
    ['unknown role', ['retirement']],
  ])('validates %s without mutating current state', (_name, roles) => {
    const current = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace = workspaceWith([current]);
    const before = structuredClone(workspace);

    expect(setLocationRoles(workspace, current.id, roles as FinancialRole[], 500))
      .toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it('restores an archived location when its normalized active name is unique', () => {
    const workspace = workspaceWith([
      location('active', 'Savings', ['saving']),
      location('archived', 'ISA', ['investing'], 200),
    ]);

    const result = restoreLocation(workspace, 'archived', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected restore to succeed');
    expect(result.location).toEqual({
      id: 'archived',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 100,
      updatedAt: 500,
    });
  });

  it('rejects restoring an archived duplicate without mutating the input', () => {
    const workspace = workspaceWith([
      location('active', 'Toss ISA', ['investing']),
      location('archived', '  toss   isa ', ['investing'], 200),
    ]);
    const before = structuredClone(workspace);

    expect(restoreLocation(workspace, 'archived', 500))
      .toEqual({ ok: false, reason: 'duplicate-name' });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['rename timestamp', () => renameLocation(workspaceWith([location('isa', 'ISA', ['investing'])]), 'isa', 'New', -1)],
    ['archive timestamp', () => archiveLocation(workspaceWith([location('isa', 'ISA', ['investing'])]), 'isa', -1)],
    ['restore timestamp', () => restoreLocation(workspaceWith([location('isa', 'ISA', ['investing'], 10)]), 'isa', -1)],
  ])('rejects an invalid %s', (_name, run) => {
    expect(run()).toEqual({ ok: false, reason: 'invalid-input' });
  });
});
