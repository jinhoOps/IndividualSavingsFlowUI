import { describe, expect, it } from 'vitest';
import type { PortfolioDraft, PortfolioPlan } from '../../../src/portfolio/domain/model';
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

function scopedPlan(locationId: string, appliedAt: number = 300): PortfolioPlan {
  return {
    ...aggregatePlan,
    scope: { type: 'location', locationId },
    appliedAt,
    updatedAt: appliedAt,
  };
}

function scopedDraft(locationId: string): PortfolioDraft {
  const { appliedAt: _appliedAt, ...common } = scopedPlan(locationId);
  return {
    ...common,
    inputMode: 'amount',
    isApplicable: true,
  };
}

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
  return { ...createEmptyWorkspace(100), locations };
}

describe('Shared location commands', () => {
  it('creates a normalized display location with stable injected identity and timestamps', () => {
    const workspace = createEmptyWorkspace(100);

    const result = createLocation(workspace, {
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
      workspace: { updatedAt: 500 },
    });
    expect(result.ok && result.workspace.locations).toHaveLength(1);
  });

  it('rejects a case-folded active duplicate without mutating the input', () => {
    const workspace = workspaceWith([
      location('location-existing', 'Toss ISA', ['investing']),
    ]);
    const before = structuredClone(workspace);

    const result = createLocation(workspace, {
      shortName: '  toss   isa ',
      kind: 'brokerage',
      roles: ['investing'],
    }, {
      createId: () => 'location-new',
      now: () => 500,
    });

    expect(result).toEqual({ ok: false, reason: 'duplicate-name' });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['unsupported name characters', {
      shortName: 'ISA!', kind: 'brokerage', roles: ['investing'],
    }],
    ['null name', {
      shortName: null, kind: 'brokerage', roles: ['investing'],
    }],
    ['empty roles', {
      shortName: 'ISA', kind: 'brokerage', roles: [],
    }],
    ['duplicate roles', {
      shortName: 'ISA', kind: 'brokerage', roles: ['investing', 'investing'],
    }],
    ['unknown role', {
      shortName: 'ISA', kind: 'brokerage', roles: ['retirement'],
    }],
    ['invalid institution', {
      shortName: 'ISA', institution: { name: '   ' }, kind: 'brokerage', roles: ['investing'],
    }],
  ])('returns invalid-input without mutation for create with %s', (_name, input) => {
    const workspace = createEmptyWorkspace(100);
    const before = structuredClone(workspace);

    const result = createLocation(workspace, input as never, {
      createId: () => 'location-new',
      now: () => 500,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it('accepts the tenth active location for a purpose and rejects the eleventh', () => {
    const workspace = workspaceWith(Array.from({ length: 9 }, (_, index) => (
      location(`location-${index}`, `I${index}`, ['income'])
    )));

    const tenth = createLocation(workspace, {
      shortName: 'I9',
      kind: 'bank',
      roles: ['income'],
    }, {
      createId: () => 'location-9',
      now: () => 500,
    });

    expect(tenth.ok).toBe(true);
    if (!tenth.ok) throw new Error('expected tenth location to be accepted');

    const eleventh = createLocation(tenth.workspace, {
      shortName: 'I10',
      kind: 'bank',
      roles: ['income'],
    }, {
      createId: () => 'location-10',
      now: () => 600,
    });

    expect(eleventh).toEqual({ ok: false, reason: 'purpose-capacity' });
  });

  it('counts one multi-role identity once in every selected purpose group', () => {
    const roles: FinancialRole[] = ['income', 'spending', 'saving', 'investing'];
    const workspace = workspaceWith(Array.from({ length: 9 }, (_, index) => (
      location(`location-${index}`, `L${index}`, roles)
    )));

    const tenth = createLocation(workspace, {
      shortName: 'L9',
      kind: 'bank',
      roles,
    }, {
      createId: () => 'location-9',
      now: () => 500,
    });

    expect(tenth.ok).toBe(true);
    if (!tenth.ok) throw new Error('expected multi-role location to be accepted');
    expect(tenth.workspace.locations.filter(({ roles: value }) => value.includes('income'))).toHaveLength(10);
    expect(tenth.workspace.locations.filter(({ roles: value }) => value.includes('spending'))).toHaveLength(10);
    expect(tenth.workspace.locations.filter(({ roles: value }) => value.includes('saving'))).toHaveLength(10);
    expect(tenth.workspace.locations.filter(({ roles: value }) => value.includes('investing'))).toHaveLength(10);

    expect(createLocation(tenth.workspace, {
      shortName: 'L10',
      kind: 'bank',
      roles,
    }, {
      createId: () => 'location-10',
      now: () => 600,
    })).toEqual({ ok: false, reason: 'purpose-capacity' });
  });

  it('renames the shared identity while location-scoped plans keep only its ID', () => {
    const sharedLocation = location('location-isa', 'ISA', ['investing']);
    const plan = scopedPlan(sharedLocation.id);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [plan], draft: null },
    };

    const result = renameLocation(workspace, sharedLocation.id, '  New   ISA ', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected rename to succeed');
    expect(result.location).toMatchObject({
      id: sharedLocation.id,
      shortName: 'New ISA',
      updatedAt: 500,
    });
    expect(result.workspace.portfolio.plans[0]?.scope)
      .toEqual({ type: 'location', locationId: sharedLocation.id });
    expect(result.workspace.portfolio.plans[0]).not.toHaveProperty('locationName');
  });

  it.each([
    ['null name', (workspace: WorkspaceDocument) => (
      renameLocation(workspace, 'location-isa', null as never, 500)
    )],
    ['invalid archive disposition', (workspace: WorkspaceDocument) => (
      archiveLocation(workspace, 'location-isa', 'discard' as never, 500)
    )],
    ['invalid restore timestamp', (workspace: WorkspaceDocument) => (
      restoreLocation(workspace, 'location-isa', -1)
    )],
  ])('returns invalid-input without mutation for %s', (_name, run) => {
    const sharedLocation = location('location-isa', 'ISA', ['investing'], 200);
    const workspace = workspaceWith([sharedLocation]);
    const before = structuredClone(workspace);

    const result = run(workspace);

    expect(result).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['create', (workspace: WorkspaceDocument) => createLocation(workspace, {
      shortName: 'ISA', kind: 'brokerage', roles: ['investing'],
    }, { createId: () => 'location-new', now: () => 500 })],
    ['rename', (workspace: WorkspaceDocument) => (
      renameLocation(workspace, 'location-isa', 'New ISA', 500)
    )],
    ['set roles', (workspace: WorkspaceDocument) => (
      setLocationRoles(workspace, 'location-isa', ['saving'], 'preserve', 500)
    )],
    ['archive', (workspace: WorkspaceDocument) => (
      archiveLocation(workspace, 'location-isa', 'preserve', 500)
    )],
    ['restore', (workspace: WorkspaceDocument) => (
      restoreLocation(workspace, 'location-isa', 500)
    )],
  ])('returns invalid-input without mutation when %s receives a malformed workspace', (_name, run) => {
    const workspace = {
      ...workspaceWith([location('location-isa', 'ISA', ['investing'], 200)]),
      schemaVersion: 999,
    } as unknown as WorkspaceDocument;
    const before = structuredClone(workspace);

    const result = run(workspace);

    expect(result).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it('requires an explicit archive disposition and reports referenced scope keys', () => {
    const sharedLocation = location('location-isa', 'ISA', ['investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: {
        plans: [aggregatePlan, scopedPlan(sharedLocation.id)],
        draft: scopedDraft(sharedLocation.id),
      },
    };
    const before = structuredClone(workspace);

    const result = archiveLocation(workspace, sharedLocation.id, undefined, 500);

    expect(result).toEqual({
      ok: false,
      reason: 'portfolio-reference',
      referencedScopes: ['location:location-isa'],
    });
    expect(workspace).toEqual(before);
  });

  it('requires archive confirmation for a matching draft without a matching plan', () => {
    const sharedLocation = location('location-isa', 'ISA', ['investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [aggregatePlan], draft: scopedDraft(sharedLocation.id) },
    };
    const before = structuredClone(workspace);

    const result = archiveLocation(workspace, sharedLocation.id, undefined, 500);

    expect(result).toEqual({
      ok: false,
      reason: 'portfolio-reference',
      referencedScopes: ['location:location-isa'],
    });
    expect(workspace).toEqual(before);
  });

  it('archives a referenced location with preserve while retaining its plan and draft', () => {
    const sharedLocation = location('location-isa', 'ISA', ['investing']);
    const plan = scopedPlan(sharedLocation.id);
    const draft = scopedDraft(sharedLocation.id);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [aggregatePlan, plan], draft },
    };

    const result = archiveLocation(workspace, sharedLocation.id, 'preserve', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected preserved archive to succeed');
    expect(result.location).toMatchObject({ archivedAt: 500, updatedAt: 500 });
    expect(result.workspace.portfolio.plans).toEqual([aggregatePlan, plan]);
    expect(result.workspace.portfolio.draft).toEqual(draft);
  });

  it('archives with delete by removing only matching location-scoped Portfolio data', () => {
    const target = location('location-isa', 'ISA', ['investing']);
    const other = location('location-other', 'Pension', ['investing']);
    const otherPlan = scopedPlan(other.id, 400);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([target, other]),
      portfolio: {
        plans: [aggregatePlan, scopedPlan(target.id), otherPlan],
        draft: scopedDraft(target.id),
      },
    };

    const result = archiveLocation(workspace, target.id, 'delete', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected deleting archive to succeed');
    expect(result.workspace.portfolio).toEqual({
      plans: [aggregatePlan, otherPlan],
      draft: null,
    });
    expect(result.workspace.locations.find(({ id }) => id === other.id)).toEqual(other);
  });

  it('preserves a nonmatching location draft when deleting a matching location plan', () => {
    const target = location('location-isa', 'ISA', ['investing']);
    const other = location('location-other', 'Pension', ['investing']);
    const otherDraft = scopedDraft(other.id);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([target, other]),
      portfolio: {
        plans: [aggregatePlan, scopedPlan(target.id)],
        draft: otherDraft,
      },
    };

    const result = archiveLocation(workspace, target.id, 'delete', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected deleting archive to succeed');
    expect(result.workspace.portfolio).toEqual({ plans: [aggregatePlan], draft: otherDraft });
  });

  it('blocks investing-role removal with a plan until a disposition is supplied', () => {
    const sharedLocation = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [scopedPlan(sharedLocation.id)], draft: null },
    };
    const before = structuredClone(workspace);

    const result = setLocationRoles(workspace, sharedLocation.id, ['saving'], undefined, 500);

    expect(result).toEqual({
      ok: false,
      reason: 'portfolio-reference',
      referencedScopes: ['location:location-isa'],
    });
    expect(workspace).toEqual(before);
  });

  it('blocks investing-role removal for a matching draft without a matching plan', () => {
    const sharedLocation = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [aggregatePlan], draft: scopedDraft(sharedLocation.id) },
    };
    const before = structuredClone(workspace);

    const result = setLocationRoles(workspace, sharedLocation.id, ['saving'], undefined, 500);

    expect(result).toEqual({
      ok: false,
      reason: 'portfolio-reference',
      referencedScopes: ['location:location-isa'],
    });
    expect(workspace).toEqual(before);
  });

  it.each([
    ['empty roles', []],
    ['duplicate roles', ['saving', 'saving']],
    ['unknown role', ['retirement']],
  ])('validates %s before investing-reference confirmation', (_name, roles) => {
    const sharedLocation = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [scopedPlan(sharedLocation.id)], draft: null },
    };
    const before = structuredClone(workspace);

    const result = setLocationRoles(
      workspace,
      sharedLocation.id,
      roles as FinancialRole[],
      undefined,
      500,
    );

    expect(result).toEqual({ ok: false, reason: 'invalid-input' });
    expect(workspace).toEqual(before);
  });

  it('removes investing with preserve while retaining referenced Portfolio data', () => {
    const sharedLocation = location('location-isa', 'ISA', ['saving', 'investing']);
    const plan = scopedPlan(sharedLocation.id);
    const draft = scopedDraft(sharedLocation.id);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: { plans: [aggregatePlan, plan], draft },
    };

    const result = setLocationRoles(workspace, sharedLocation.id, ['saving'], 'preserve', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected preserved role removal to succeed');
    expect(result.location).toMatchObject({ roles: ['saving'], updatedAt: 500 });
    expect(result.workspace.portfolio.plans).toEqual([aggregatePlan, plan]);
    expect(result.workspace.portfolio.draft).toEqual(draft);
  });

  it('removes investing with delete by removing matching plan and draft only', () => {
    const sharedLocation = location('location-isa', 'ISA', ['saving', 'investing']);
    const workspace: WorkspaceDocument = {
      ...workspaceWith([sharedLocation]),
      portfolio: {
        plans: [aggregatePlan, scopedPlan(sharedLocation.id)],
        draft: scopedDraft(sharedLocation.id),
      },
    };

    const result = setLocationRoles(workspace, sharedLocation.id, ['saving'], 'delete', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected deleting role removal to succeed');
    expect(result.workspace.portfolio).toEqual({ plans: [aggregatePlan], draft: null });
  });

  it('restores an archived location when its normalized active name is unique', () => {
    const workspace = workspaceWith([
      location('location-active', 'Savings', ['saving']),
      location('location-archived', 'ISA', ['investing'], 200),
    ]);

    const result = restoreLocation(workspace, 'location-archived', 500);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected restore to succeed');
    expect(result.location).toEqual({
      id: 'location-archived',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 100,
      updatedAt: 500,
    });
  });

  it('rejects restoring an archived duplicate without mutating the input', () => {
    const workspace = workspaceWith([
      location('location-active', 'Toss ISA', ['investing']),
      location('location-archived', '  toss   isa ', ['investing'], 200),
    ]);
    const before = structuredClone(workspace);

    const result = restoreLocation(workspace, 'location-archived', 500);

    expect(result).toEqual({ ok: false, reason: 'duplicate-name' });
    expect(workspace).toEqual(before);
  });
});
