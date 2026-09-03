import { describe, expect, it } from 'vitest';
import {
  rebaseAccountMapIntent,
  type AccountMapEditIntent,
  type EditableLinkFields,
  type EditableLocationFields,
  type EditablePurposeFields,
  type FieldEdit,
} from '../../../src/account-map/domain/editIntent';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type {
  AccountMapApplied,
  AccountMapDraft,
  PurposeLocationLink,
} from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

describe('Account Map edit intent rebasing', () => {
  it('rebases a link edit onto latest unrelated changes and preserves them in the command', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([
      incomeLink(),
      livingLink('living', 'checking', 100_000),
      livingLink('other', 'savings', 250_000),
    ]);
    latest.accountMap.applied.links[2] = {
      ...latest.accountMap.applied.links[2]!,
      monthlyAmountWon: 300_000,
    };
    const base: EditableLinkFields = {
      monthlyAmountWon: 100_000,
      status: 'active',
      remainder: false,
    };
    const edit: FieldEdit<EditableLinkFields> = {
      base,
      next: { ...base, monthlyAmountWon: 150_000 },
    };

    const result = rebaseAccountMapIntent(latest, { kind: 'link', id: 'living', edit });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const saved = applyAccountMapCommand(latest, result.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (!saved.ok) return;
    expect(saved.workspace.accountMap.applied?.links.find(({ id }) => id === 'living')?.monthlyAmountWon)
      .toBe(150_000);
    expect(saved.workspace.accountMap.applied?.links.find(({ id }) => id === 'other')?.monthlyAmountWon)
      .toBe(300_000);
  });

  it('rejects a same-field link change with the conflicting field name', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([
      incomeLink(),
      livingLink('living', 'checking', 120_000),
    ]);
    const intent: AccountMapEditIntent = {
      kind: 'link',
      id: 'living',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
      },
    };

    expect(rebaseAccountMapIntent(latest, intent)).toEqual({
      ok: false,
      reason: 'field-conflict',
      field: 'monthlyAmountWon',
    });
  });

  it('preserves a same-link status change while rebasing a monthly amount edit', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([
      incomeLink(),
      {
        ...livingLink('living', 'checking', 100_000),
        status: 'suspended',
        remainder: false,
        suspendedReason: 'user',
      },
    ]);

    const result = rebaseAccountMapIntent(latest, {
      kind: 'link',
      id: 'living',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
      },
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const saved = applyAccountMapCommand(latest, result.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (!saved.ok) return;
    expect(saved.workspace.accountMap.applied?.links.find(({ id }) => id === 'living')).toMatchObject({
      monthlyAmountWon: 150_000,
      status: 'suspended',
      suspendedReason: 'user',
      remainder: false,
    });
  });

  it('rejects an edit when its stable target was deleted', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([incomeLink()]);

    expect(rebaseAccountMapIntent(latest, {
      kind: 'link',
      id: 'deleted-link',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
      },
    })).toEqual({ ok: false, reason: 'target-missing' });
  });

  it('rejects an add-link intent when latest already has the purpose-location pair', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([
      incomeLink(),
      livingLink('existing', 'checking', 0),
    ]);
    const intent: AccountMapEditIntent = {
      kind: 'add-link',
      surface: 'applied',
      purposeId: 'system:living',
      locationId: 'checking',
      base: null,
      monthlyAmountWon: 50_000,
    };

    expect(rebaseAccountMapIntent(latest, intent)).toEqual({
      ok: false,
      reason: 'duplicate-link',
    });
  });

  it('emits field-scoped purpose and location commands without replacing latest unrelated fields', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([incomeLink()]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 100_000,
        createdAt: 1,
        updatedAt: 7,
      }],
    };
    const purposeBase: EditablePurposeFields = {
      name: '통신비',
      targetMonthlyWon: 100_000,
    };
    const purposeResult = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: { base: purposeBase, next: { ...purposeBase, name: '통신 요금' } },
    });
    expect(purposeResult).toMatchObject({ ok: true });
    if (purposeResult.ok) {
      const saved = applyAccountMapCommand(latest, purposeResult.command, 20);
      expect(saved).toMatchObject({ ok: true });
      if (saved.ok) {
        expect(saved.workspace.accountMap.applied?.customPurposes[0]).toMatchObject({
        name: '통신 요금',
        createdAt: 1,
        updatedAt: 20,
        });
      }
    }

    const locationBase: EditableLocationFields = {
      shortName: '생활비',
      institution: { id: 'hana', name: '하나은행' },
    };
    const locationResult = rebaseAccountMapIntent(latest, {
      kind: 'location',
      id: 'checking',
      edit: { base: locationBase, next: { ...locationBase, shortName: '주계좌' } },
    });
    expect(locationResult).toMatchObject({
      ok: true,
      command: {
        type: 'update-location',
        locationId: 'checking',
        shortName: '주계좌',
        addRoles: [],
      },
    });
  });

  it('preserves same-target purpose and location fields outside each intent write set', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([incomeLink()]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 120_000,
        createdAt: 1,
        updatedAt: 7,
      }],
    };
    latest.locations[0] = {
      ...latest.locations[0]!,
      institution: { id: 'shinhan', name: '신한은행' },
    };

    const purpose = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000 },
        next: { name: '통신 요금', targetMonthlyWon: 100_000 },
      },
    });
    expect(purpose).toMatchObject({ ok: true });
    if (purpose.ok) {
      const saved = applyAccountMapCommand(latest, purpose.command, 20);
      expect(saved).toMatchObject({ ok: true });
      if (saved.ok) expect(saved.workspace.accountMap.applied?.customPurposes[0]).toMatchObject({
        name: '통신 요금',
        targetMonthlyWon: 120_000,
      });
    }

    const location = rebaseAccountMapIntent(latest, {
      kind: 'location',
      id: 'checking',
      edit: {
        base: {
          shortName: '생활비',
          institution: { id: 'hana', name: '하나은행' },
        },
        next: {
          shortName: '주계좌',
          institution: { id: 'hana', name: '하나은행' },
        },
      },
    });
    expect(location).toMatchObject({
      ok: true,
      command: {
        type: 'update-location',
        shortName: '주계좌',
      },
    });
    if (location.ok) {
      const saved = applyAccountMapCommand(latest, location.command, 20);
      expect(saved).toMatchObject({ ok: true });
      if (saved.ok) {
        expect(saved.workspace.locations.find(({ id }) => id === 'checking')).toMatchObject({
          shortName: '주계좌',
          institution: { id: 'shinhan', name: '신한은행' },
        });
      }
    }
  });

  it('atomically switches and recalculates the latest remainder for a link intent', () => {
    const latest = workspace();
    latest.accountMap.applied = applied([
      incomeLink(),
      {
        ...(livingLink('old-remainder', 'checking', 700_000) as Extract<
          PurposeLocationLink,
          { status: 'active' }
        >),
        remainder: true,
      },
      livingLink('next-remainder', 'savings', 100_000),
    ]);

    const result = rebaseAccountMapIntent(latest, {
      kind: 'link',
      id: 'next-remainder',
      edit: {
        base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
        next: { monthlyAmountWon: 100_000, status: 'active', remainder: true },
      },
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const saved = applyAccountMapCommand(latest, result.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (!saved.ok) return;
    expect(saved.workspace.accountMap.applied?.links.filter(({ purposeId }) => purposeId === 'system:living')
      .map(({ id, monthlyAmountWon, remainder }) => ({ id, monthlyAmountWon, remainder }))).toEqual([
        { id: 'old-remainder', monthlyAmountWon: 700_000, remainder: false },
        { id: 'next-remainder', monthlyAmountWon: 300_000, remainder: true },
      ]);
  });

  it('rebases an explicitly removed institution instead of restoring the latest one', () => {
    const latest = workspace();
    const result = rebaseAccountMapIntent(latest, {
      kind: 'location',
      id: 'checking',
      edit: {
        base: {
          shortName: '생활비',
          institution: { id: 'hana', name: '하나은행' },
        },
        next: { shortName: '생활비', institution: undefined },
      },
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const applied = applyAccountMapCommand(latest, result.command, 20);
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.workspace.locations.find(({ id }) => id === 'checking'))
        .not.toHaveProperty('institution');
    }
  });

  it('rebases a purpose lifecycle field through the atomic archive command', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([incomeLink(), { ...livingLink('telecom', 'checking', 100_000), purposeId: 'custom:telecom' }]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 100_000,
        createdAt: 1,
        updatedAt: 1,
      }],
    };

    const result = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000 },
        next: { name: '통신비', targetMonthlyWon: 100_000, archivedAt: 10 },
      },
    });

    expect(result).toEqual({
      ok: true,
      command: {
        type: 'edit-custom-purpose',
        purposeId: 'custom:telecom',
        fields: { lifecycle: 'archive' },
      },
    });
    if (!result.ok) return;
    const archived = applyAccountMapCommand(latest, result.command, 20);
    expect(archived.ok).toBe(true);
    if (archived.ok) {
      expect(archived.workspace.accountMap.applied?.links.find(({ id }) => id === 'telecom'))
        .toMatchObject({ status: 'suspended', suspendedReason: 'user', remainder: false });
    }
  });

  it('restores with a concurrent latest target when only archivedAt was edited', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([incomeLink()]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 120_000,
        archivedAt: 10,
        createdAt: 1,
        updatedAt: 7,
      }],
    };

    const result = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000, archivedAt: 10 },
        next: { name: '통신비', targetMonthlyWon: 100_000 },
      },
    });
    expect(result).toEqual({
      ok: true,
      command: {
        type: 'edit-custom-purpose',
        purposeId: 'custom:telecom',
        fields: { lifecycle: 'restore' },
      },
    });
    if (!result.ok) return;
    const saved = applyAccountMapCommand(latest, result.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (saved.ok) {
      expect(saved.workspace.accountMap.applied?.customPurposes[0]?.targetMonthlyWon).toBe(120_000);
    }
  });

  it('treats an absent optional base field as undefined when latest added that field', () => {
    const locationLatest = workspace();
    locationLatest.locations[0] = {
      ...locationLatest.locations[0]!,
      institution: { id: 'shinhan', name: '신한은행' },
    };
    expect(rebaseAccountMapIntent(locationLatest, {
      kind: 'location',
      id: 'checking',
      edit: {
        base: { shortName: '생활비' },
        next: {
          shortName: '생활비',
          institution: { id: 'hana', name: '하나은행' },
        },
      },
    })).toEqual({ ok: false, reason: 'field-conflict', field: 'institution' });

    const purposeLatest = workspace();
    purposeLatest.accountMap.applied = {
      ...applied([incomeLink()]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 100_000,
        archivedAt: 10,
        createdAt: 1,
        updatedAt: 7,
      }],
    };
    expect(rebaseAccountMapIntent(purposeLatest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000 },
        next: { name: '통신비', targetMonthlyWon: 100_000, archivedAt: 20 },
      },
    })).toEqual({ ok: false, reason: 'field-conflict', field: 'archivedAt' });
  });

  it.each(['link', 'purpose'] as const)('%s intent preserves an unrelated latest draft', (kind) => {
    const latest = workspace();
    latest.accountMap.draft = draft();
    const draftBefore = JSON.stringify(latest.accountMap.draft);
    latest.accountMap.applied = kind === 'link'
      ? applied([incomeLink(), livingLink('living', 'checking', 100_000)])
      : {
          ...applied([incomeLink()]),
          customPurposes: [{
            id: 'custom:telecom',
            parentId: 'system:living',
            name: '통신비',
            targetMonthlyWon: 100_000,
            createdAt: 1,
            updatedAt: 1,
          }],
        };
    const rebased = kind === 'link'
      ? rebaseAccountMapIntent(latest, {
          kind: 'link',
          id: 'living',
          edit: {
            base: { monthlyAmountWon: 100_000, status: 'active', remainder: false },
            next: { monthlyAmountWon: 150_000, status: 'active', remainder: false },
          },
        })
      : rebaseAccountMapIntent(latest, {
          kind: 'purpose',
          id: 'custom:telecom',
          edit: {
            base: { name: '통신비', targetMonthlyWon: 100_000 },
            next: { name: '통신 요금', targetMonthlyWon: 100_000 },
          },
        });

    expect(rebased).toMatchObject({ ok: true });
    if (!rebased.ok) return;
    expect(rebased.command.type).not.toBe('edit-map-node');
    const saved = applyAccountMapCommand(latest, rebased.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (saved.ok) expect(JSON.stringify(saved.workspace.accountMap.draft)).toBe(draftBefore);
  });

  it('applies name and target together with archive lifecycle effects', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([
        incomeLink(),
        { ...livingLink('telecom', 'checking', 100_000), purposeId: 'custom:telecom' },
      ]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 100_000,
        createdAt: 1,
        updatedAt: 1,
      }],
    };

    const rebased = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000 },
        next: { name: '통신 요금', targetMonthlyWon: 150_000, archivedAt: 10 },
      },
    });

    expect(rebased).toMatchObject({ ok: true });
    if (!rebased.ok) return;
    const saved = applyAccountMapCommand(latest, rebased.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (!saved.ok) return;
    expect(saved.workspace.accountMap.applied?.customPurposes[0]).toMatchObject({
      name: '통신 요금',
      targetMonthlyWon: 150_000,
      archivedAt: 20,
    });
    expect(saved.workspace.accountMap.applied?.links.find(({ id }) => id === 'telecom'))
      .toMatchObject({ status: 'suspended', suspendedReason: 'user', remainder: false });
  });

  it('applies name and target together with restore while leaving links suspended', () => {
    const latest = workspace();
    latest.accountMap.applied = {
      ...applied([
        incomeLink(),
        {
          ...livingLink('telecom', 'checking', 100_000),
          purposeId: 'custom:telecom',
          status: 'suspended',
          remainder: false,
          suspendedReason: 'user',
        },
      ]),
      customPurposes: [{
        id: 'custom:telecom',
        parentId: 'system:living',
        name: '통신비',
        targetMonthlyWon: 100_000,
        archivedAt: 10,
        createdAt: 1,
        updatedAt: 1,
      }],
    };

    const rebased = rebaseAccountMapIntent(latest, {
      kind: 'purpose',
      id: 'custom:telecom',
      edit: {
        base: { name: '통신비', targetMonthlyWon: 100_000, archivedAt: 10 },
        next: { name: '통신 요금', targetMonthlyWon: 150_000 },
      },
    });

    expect(rebased).toMatchObject({ ok: true });
    if (!rebased.ok) return;
    const saved = applyAccountMapCommand(latest, rebased.command, 20);
    expect(saved).toMatchObject({ ok: true });
    if (!saved.ok) return;
    expect(saved.workspace.accountMap.applied?.customPurposes[0]).toMatchObject({
      name: '통신 요금',
      targetMonthlyWon: 150_000,
    });
    expect(saved.workspace.accountMap.applied?.customPurposes[0]).not.toHaveProperty('archivedAt');
    expect(saved.workspace.accountMap.applied?.links.find(({ id }) => id === 'telecom'))
      .toMatchObject({ status: 'suspended', suspendedReason: 'user', remainder: false });
  });
});

function workspace(): WorkspaceDocument {
  const value = createEmptyWorkspace(1);
  value.main.applied = main();
  value.locations = [
    location('checking', '생활비', ['income', 'spending'], { id: 'hana', name: '하나은행' }),
    location('savings', '저축', ['spending', 'saving'], { id: 'shinhan', name: '신한은행' }),
  ];
  return value;
}

function main(): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 1,
    monthlyNetIncomeWon: 2_000_000,
    monthlyHousingWon: 500_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 200_000,
  };
}

function location(
  id: string,
  shortName: string,
  roles: FinancialLocation['roles'],
  institution?: FinancialLocation['institution'],
): FinancialLocation {
  return {
    id,
    shortName,
    ...(institution === undefined ? {} : { institution }),
    kind: 'bank',
    roles,
    createdAt: 1,
    updatedAt: 1,
  };
}

function applied(links: PurposeLocationLink[]): AccountMapApplied {
  return {
    schemaVersion: 2,
    sourceMainUpdatedAt: 1,
    customPurposes: [],
    links,
    setupCompletedAt: 1,
    updatedAt: 1,
  };
}

function draft(): AccountMapDraft {
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: 1,
    customPurposes: [],
    links: [],
    step: 'connect',
    updatedAt: 1,
  };
}

function incomeLink(): PurposeLocationLink {
  return {
    id: 'income',
    purposeId: 'system:income',
    locationId: 'checking',
    monthlyAmountWon: 2_000_000,
    remainder: true,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}

function livingLink(id: string, locationId: string, monthlyAmountWon: number): PurposeLocationLink {
  return {
    id,
    purposeId: 'system:living',
    locationId,
    monthlyAmountWon,
    remainder: false,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  };
}
