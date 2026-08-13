import { describe, expect, it } from 'vitest';
import { applyAccountMapCommand, type AccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapApplied, AccountMapDraft, PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

describe('Account Map commands', () => {
  it.each([
    ['create-location', { type: 'create-location', location: location('new', '새계좌') }],
    ['save-draft', { type: 'save-draft', draft: draft() }],
    ['apply-map', { type: 'apply-map', applied: validApplied() }],
    ['edit-map-node', { type: 'edit-map-node', applied: validApplied() }],
    ['reset-map', { type: 'reset-map' }],
  ] satisfies [string, AccountMapCommand][])('%s preserves protected slices byte-for-byte', (_name, command) => {
    const before = workspace();
    if (command.type === 'edit-map-node') before.accountMap.applied = validApplied();
    const result = applyAccountMapCommand(before, command, 20);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.main).toEqual(before.main);
    expect(result.workspace.simulation).toEqual(before.simulation);
    expect(JSON.stringify(result.workspace.portfolio)).toBe(JSON.stringify(before.portfolio));
  });

  it('rejects duplicate location identity and adds roles without removing existing roles', () => {
    const before = workspace();
    const duplicate = applyAccountMapCommand(before, {
      type: 'create-location',
      location: location('duplicate', '생활비', { id: 'hana', name: '하나' }),
    }, 20);
    expect(duplicate).toMatchObject({ ok: false, reason: 'duplicate-location-active' });

    const update = applyAccountMapCommand(before, {
      type: 'update-location',
      locationId: 'checking',
      institution: { id: 'hana', name: '하나은행' },
      shortName: '생활비',
      addRoles: ['saving'],
    }, 20);
    expect(update.ok).toBe(true);
    if (update.ok) expect(update.workspace.locations[0]?.roles).toEqual(['income', 'spending', 'saving']);

    const sameAliasAtAnotherInstitution = applyAccountMapCommand(before, {
      type: 'create-location',
      location: location('other-bank', '생활비', { id: 'woori', name: '우리은행' }),
    }, 20);
    expect(sameAliasAtAnotherInstitution.ok).toBe(true);
  });

  it('archives a location, suspends its links, and atomically moves remainder', () => {
    const before = workspace();
    before.accountMap.applied = applied([
      link('old', 'checking', 700_000, true),
      link('next', 'savings', 300_000),
    ]);

    const result = applyAccountMapCommand(before, {
      type: 'archive-location',
      locationId: 'checking',
      replacementRemainderByPurpose: { 'system:living': 'next' },
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.locations.find(({ id }) => id === 'checking')?.archivedAt).toBe(20);
    expect(result.workspace.accountMap.applied?.links).toMatchObject([
      { id: 'old', status: 'suspended', remainder: false, suspendedReason: 'location-archived' },
      { id: 'next', status: 'active', remainder: true },
    ]);
    expect(JSON.stringify(result.workspace.portfolio)).toBe(JSON.stringify(before.portfolio));
  });

  it('restores only selected links and can atomically replace remainder', () => {
    const before = workspace();
    before.locations[0] = { ...before.locations[0]!, archivedAt: 10 };
    before.accountMap.applied = applied([
      { ...link('old', 'checking', 700_000), status: 'suspended', remainder: false, suspendedReason: 'location-archived' },
      link('next', 'savings', 300_000, true),
    ]);

    const result = applyAccountMapCommand(before, {
      type: 'restore-location',
      locationId: 'checking',
      restoreLinkIds: ['old'],
      remainderByPurpose: { 'system:living': 'old' },
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied?.links).toMatchObject([
      { id: 'old', status: 'active', remainder: true },
      { id: 'next', status: 'active', remainder: false },
    ]);
    expect(JSON.stringify(result.workspace.portfolio)).toBe(JSON.stringify(before.portfolio));
  });

  it('rejects a restored excess until a remainder correction is selected', () => {
    const before = workspace();
    before.locations.push({ ...location('archived', '보관계좌'), archivedAt: 10 });
    before.accountMap.applied = validApplied();
    before.accountMap.applied.links.push(
      { ...link('old', 'archived', 800_000), status: 'suspended', remainder: false, suspendedReason: 'location-archived' },
      link('next', 'savings', 500_000, true),
    );
    expect(applyAccountMapCommand(before, {
      type: 'restore-location', locationId: 'archived', restoreLinkIds: ['old'], remainderByPurpose: {},
    }, 20)).toMatchObject({ ok: false, reason: 'fixed-links-exceed-target' });
  });

  it('edits a location and applied links atomically without touching protected slices', () => {
    const before = workspace();
    before.accountMap.applied = validApplied();
    const edited = { ...before.accountMap.applied, links: before.accountMap.applied.links.map((item) => ({ ...item, monthlyAmountWon: 2_000_000 })), updatedAt: 20 };
    const result = applyAccountMapCommand(before, {
      type: 'edit-map-node', applied: edited,
      location: { locationId: 'checking', shortName: '주계좌', institution: { id: 'hana', name: '하나은행' } },
    }, 20);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.locations.find(({ id }) => id === 'checking')?.shortName).toBe('주계좌');
    expect(result.workspace.main).toEqual(before.main);
    expect(result.workspace.simulation).toEqual(before.simulation);
    expect(result.workspace.portfolio).toEqual(before.portfolio);
  });

  it('allows an edit that reduces existing excess after Main changes', () => {
    const before = workspace();
    before.accountMap.applied = validApplied();
    before.main.applied!.monthlyNetIncomeWon = 1_500_000;
    const corrected = { ...before.accountMap.applied, links: before.accountMap.applied.links.map((item) => ({ ...item, monthlyAmountWon: 1_700_000 })), updatedAt: 20 };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: corrected }, 20).ok).toBe(true);
    const worse = { ...corrected, links: corrected.links.map((item) => ({ ...item, monthlyAmountWon: 2_100_000 })) };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: worse }, 20)).toMatchObject({ ok: false, reason: 'purpose-excess' });
  });

  it('allows a custom target correction but rejects a larger parent-capacity excess', () => {
    const before = workspace();
    const over = { id: 'custom:telecom' as const, parentId: 'system:living' as const, name: '통신비', targetMonthlyWon: 1_100_000, createdAt: 1, updatedAt: 1 };
    before.accountMap.applied = { ...validApplied(), customPurposes: [over] };
    before.main.applied!.monthlyLivingWon = 900_000;
    const corrected = { ...before.accountMap.applied, customPurposes: [{ ...over, targetMonthlyWon: 1_000_000, updatedAt: 20 }], updatedAt: 20 };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: corrected }, 20).ok).toBe(true);
    const worse = { ...corrected, customPurposes: [{ ...over, targetMonthlyWon: 1_200_000, updatedAt: 20 }] };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: worse }, 20)).toMatchObject({ ok: false, reason: 'custom-target-capacity' });
  });

  it('requires a replacement when editing away an active remainder', () => {
    const before = workspace();
    before.accountMap.applied = validApplied();
    before.accountMap.applied.links.push(link('next', 'savings', 300_000));
    const edited = { ...before.accountMap.applied, links: before.accountMap.applied.links.map((item) => item.id === 'income' ? { ...item, status: 'suspended' as const, remainder: false as const, suspendedReason: 'user' as const } : item), updatedAt: 20 };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: edited }, 20)).toMatchObject({ ok: false, reason: 'income-connection-required' });

    before.accountMap.applied = applied([
      { ...link('income', 'checking', 2_000_000, true), purposeId: 'system:income' },
      link('old', 'checking', 700_000, true),
      link('next', 'savings', 300_000),
    ]);
    const noRemainder = { ...before.accountMap.applied, links: before.accountMap.applied.links.map((item) => item.id === 'old' ? { ...item, status: 'suspended' as const, remainder: false as const, suspendedReason: 'user' as const } : item), updatedAt: 20 };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: noRemainder }, 20)).toMatchObject({ ok: false, reason: 'replacement-remainder-required' });
  });

  it('reset clears only current Account Map state', () => {
    const before = workspace();
    before.accountMap.applied = applied();
    before.accountMap.draft = draft();
    const legacy = before.accountMap.legacyPhaseA;

    const result = applyAccountMapCommand(before, { type: 'reset-map' }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap).toEqual({ applied: null, draft: null, legacyPhaseA: legacy });
    expect(result.workspace.locations).toEqual(before.locations);
  });

  it('requires exact income allocation and rejects purpose excess on apply', () => {
    const before = workspace();
    expect(applyAccountMapCommand(before, { type: 'apply-map', applied: applied() }, 20))
      .toMatchObject({ ok: false, reason: 'income-connection-required' });
    expect(applyAccountMapCommand(before, {
      type: 'apply-map',
      applied: applied([
        { ...link('income', 'checking', 2_000_000, true), purposeId: 'system:income' },
        link('excess', 'savings', 1_100_000),
      ]),
    }, 20)).toMatchObject({ ok: false, reason: 'purpose-excess' });
  });

  it('rejects a newly over-capacity custom target but permits correction after Main decreases', () => {
    const before = workspace();
    const over = draft();
    over.customPurposes = [{ id: 'custom:telecom', parentId: 'system:living', name: '통신비', targetMonthlyWon: 1_100_000, createdAt: 1, updatedAt: 1 }];
    expect(applyAccountMapCommand(before, { type: 'save-draft', draft: over }, 20))
      .toMatchObject({ ok: false, reason: 'custom-target-capacity' });

    before.accountMap.draft = structuredClone(over);
    before.main.applied!.monthlyLivingWon = 900_000;
    expect(applyAccountMapCommand(before, { type: 'save-draft', draft: { ...over, updatedAt: 2 } }, 20).ok)
      .toBe(true);
  });
});

function workspace(): WorkspaceDocument {
  const value = createEmptyWorkspace(1);
  value.main.applied = main();
  value.locations = [
    { ...location('checking', '생활비', { id: 'hana', name: '하나은행' }), roles: ['income', 'spending'] },
    { ...location('savings', '저축', { id: 'shinhan', name: '신한은행' }), roles: ['spending', 'saving'] },
  ];
  return value;
}

function main(): MainData {
  return { schemaVersion: 2, updatedAt: 1, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}

function location(id: string, shortName: string, institution?: FinancialLocation['institution']): FinancialLocation {
  return { id, shortName, ...(institution ? { institution } : {}), kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 };
}

function link(id: string, locationId: string, amount: number, remainder = false): PurposeLocationLink {
  return { id, purposeId: 'system:living', locationId, monthlyAmountWon: amount, remainder, status: 'active', createdAt: 1, updatedAt: 1 };
}

function applied(links: PurposeLocationLink[] = []): AccountMapApplied {
  return { schemaVersion: 1, sourceMainUpdatedAt: 1, customPurposes: [], links, layout: 'purpose', setupCompletedAt: 1, updatedAt: 1 };
}

function validApplied(): AccountMapApplied {
  return applied([{ ...link('income', 'checking', 2_000_000, true), purposeId: 'system:income' }]);
}

function draft(): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt: 1, customPurposes: [], links: [], step: 'connect', updatedAt: 1 };
}
