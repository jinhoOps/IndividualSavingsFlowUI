import { describe, expect, it } from 'vitest';
import { applyAccountMapCommand, type AccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapApplied, AccountMapDraft, PurposeLocationLink } from '../../../src/account-map/domain/model';
import type { MainData } from '../../../src/main/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

describe('Account Map commands', () => {
  it('connects a location by adding its required role and one link in one candidate', () => {
    const before = workspace();
    before.accountMap.applied = validApplied();
    const protectedBefore = {
      main: JSON.stringify(before.main),
      simulation: JSON.stringify(before.simulation),
      portfolio: JSON.stringify(before.portfolio),
    };

    const result = applyAccountMapCommand(before, {
      type: 'connect-location',
      surface: 'applied',
      purposeId: 'system:investing',
      locationId: 'savings',
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.locations.find(({ id }) => id === 'savings')).toMatchObject({
      roles: ['spending', 'saving', 'investing'],
      shortName: '저축',
      institution: { id: 'shinhan', name: '신한은행' },
    });
    expect(result.workspace.accountMap.applied?.links.filter((item) => (
      item.purposeId === 'system:investing' && item.locationId === 'savings'
    ))).toEqual([expect.objectContaining({
      monthlyAmountWon: 200_000,
      remainder: true,
      status: 'active',
      createdAt: 20,
      updatedAt: 20,
    })]);
    expect(JSON.stringify(result.workspace.main)).toBe(protectedBefore.main);
    expect(JSON.stringify(result.workspace.simulation)).toBe(protectedBefore.simulation);
    expect(JSON.stringify(result.workspace.portfolio)).toBe(protectedBefore.portfolio);
  });

  it('does not partially add a role when connection capacity or duplicate validation fails', () => {
    const capacityBefore = workspace();
    capacityBefore.accountMap.applied = validApplied();
    capacityBefore.locations.push(...Array.from({ length: 10 }, (_, index) => ({
      ...location(`broker-${index}`, `투자${index}`),
      roles: ['investing' as const],
    })));
    const capacityJson = JSON.stringify(capacityBefore);

    expect(applyAccountMapCommand(capacityBefore, {
      type: 'connect-location',
      surface: 'applied',
      purposeId: 'system:investing',
      locationId: 'savings',
    }, 20)).toMatchObject({ ok: false, reason: 'purpose-capacity' });
    expect(JSON.stringify(capacityBefore)).toBe(capacityJson);

    const duplicateBefore = workspace();
    duplicateBefore.accountMap.applied = validApplied();
    duplicateBefore.accountMap.applied.links.push({
      ...link('existing-investing', 'savings', 0),
      purposeId: 'system:investing',
      status: 'suspended',
      remainder: false,
      suspendedReason: 'user',
    });
    const duplicateJson = JSON.stringify(duplicateBefore);

    expect(applyAccountMapCommand(duplicateBefore, {
      type: 'connect-location',
      surface: 'applied',
      purposeId: 'system:investing',
      locationId: 'savings',
    }, 20)).toMatchObject({ ok: false, reason: 'duplicate-link' });
    expect(JSON.stringify(duplicateBefore)).toBe(duplicateJson);
  });

  it('recalculates the existing remainder when adding another connection', () => {
    const before = workspace();
    before.locations[0] = {
      ...before.locations[0]!,
      roles: [...before.locations[0]!.roles, 'investing'],
    };
    before.accountMap.applied = {
      ...validApplied(),
      links: [
        ...validApplied().links,
        { ...link('investing-remainder', 'checking', 200_000, true), purposeId: 'system:investing' },
      ],
    };

    const result = applyAccountMapCommand(before, {
      type: 'connect-location',
      surface: 'applied',
      purposeId: 'system:investing',
      locationId: 'savings',
      monthlyAmountWon: 50_000,
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied?.links.filter(({ purposeId }) => (
      purposeId === 'system:investing'
    )).map(({ locationId, monthlyAmountWon, remainder }) => ({
      locationId,
      monthlyAmountWon,
      remainder,
    }))).toEqual([
      { locationId: 'checking', monthlyAmountWon: 150_000, remainder: true },
      { locationId: 'savings', monthlyAmountWon: 50_000, remainder: false },
    ]);
  });

  it('creates and connects a location atomically', () => {
    const before = workspace();
    before.accountMap.draft = draft();

    const result = applyAccountMapCommand(before, {
      type: 'create-and-connect-location',
      surface: 'draft',
      purposeId: 'system:saving',
      location: location('new-saving', '새저축'),
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.locations.find(({ id }) => id === 'new-saving')?.roles).toEqual([
      'spending',
      'saving',
    ]);
    expect(result.workspace.accountMap.draft?.links).toEqual([
      expect.objectContaining({
        purposeId: 'system:saving',
        locationId: 'new-saving',
        monthlyAmountWon: 300_000,
        remainder: true,
        status: 'active',
      }),
    ]);
  });

  it('archives a custom purpose and suspends its active links without changing locations or Portfolio', () => {
    const before = workspace();
    const custom = customPurpose('custom:telecom', 200_000);
    before.accountMap.applied = {
      ...validApplied(),
      customPurposes: [custom],
      links: [
        ...validApplied().links,
        { ...link('telecom', 'checking', 200_000, true), purposeId: custom.id },
      ],
    };
    const locationsBefore = JSON.stringify(before.locations);
    const portfolioBefore = JSON.stringify(before.portfolio);

    const result = applyAccountMapCommand(before, {
      type: 'archive-custom-purpose',
      purposeId: custom.id,
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied?.customPurposes[0]).toMatchObject({
      id: custom.id,
      archivedAt: 20,
      updatedAt: 20,
    });
    expect(result.workspace.accountMap.applied?.links.find(({ id }) => id === 'telecom')).toMatchObject({
      status: 'suspended',
      suspendedReason: 'user',
      remainder: false,
      updatedAt: 20,
    });
    expect(JSON.stringify(result.workspace.locations)).toBe(locationsBefore);
    expect(JSON.stringify(result.workspace.portfolio)).toBe(portfolioBefore);
  });

  it('rejects a custom purpose lifecycle command when applied and draft disagree', () => {
    const before = workspace();
    before.accountMap.applied = {
      ...validApplied(),
      customPurposes: [customPurpose('custom:telecom', 200_000)],
    };
    before.accountMap.draft = {
      ...draft(),
      customPurposes: [{ ...customPurpose('custom:telecom', 200_000), archivedAt: 10 }],
    };
    const beforeJson = JSON.stringify(before);

    expect(applyAccountMapCommand(before, {
      type: 'archive-custom-purpose',
      purposeId: 'custom:telecom',
    }, 20)).toMatchObject({ ok: false, reason: 'invalid-input' });
    expect(JSON.stringify(before)).toBe(beforeJson);
  });

  it('restores only a custom purpose and leaves its links suspended', () => {
    const before = workspace();
    const custom = { ...customPurpose('custom:telecom', 200_000), archivedAt: 10 };
    before.accountMap.applied = {
      ...validApplied(),
      customPurposes: [custom],
      links: [
        ...validApplied().links,
        {
          ...link('telecom', 'checking', 200_000),
          purposeId: custom.id,
          status: 'suspended',
          remainder: false,
          suspendedReason: 'user',
        },
      ],
    };

    const result = applyAccountMapCommand(before, {
      type: 'restore-custom-purpose',
      purposeId: custom.id,
      targetMonthlyWon: 200_000,
    }, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied?.customPurposes[0]).toEqual({
      ...customPurpose('custom:telecom', 200_000),
      updatedAt: 20,
    });
    expect(result.workspace.accountMap.applied?.links.find(({ id }) => id === 'telecom')).toEqual(
      before.accountMap.applied.links.find(({ id }) => id === 'telecom'),
    );
  });

  it('atomically rejects a custom purpose restore that exceeds current parent capacity', () => {
    const before = workspace();
    const archived = { ...customPurpose('custom:telecom', 200_000), archivedAt: 10 };
    const active = customPurpose('custom:food', 900_000);
    before.accountMap.applied = {
      ...validApplied(),
      customPurposes: [archived, active],
    };
    const beforeJson = JSON.stringify(before);

    expect(applyAccountMapCommand(before, {
      type: 'restore-custom-purpose',
      purposeId: archived.id,
      targetMonthlyWon: 200_000,
    }, 20)).toMatchObject({ ok: false, reason: 'custom-target-capacity' });
    expect(JSON.stringify(before)).toBe(beforeJson);
  });

  it.each([
    ['create-location', { type: 'create-location', location: location('new', '새계좌') }],
    ['connect-location', {
      type: 'connect-location',
      surface: 'applied',
      purposeId: 'system:investing',
      locationId: 'savings',
    }],
    ['create-and-connect-location', {
      type: 'create-and-connect-location',
      surface: 'draft',
      purposeId: 'system:saving',
      location: location('new-saving', '새저축'),
    }],
    ['archive-custom-purpose', {
      type: 'archive-custom-purpose',
      purposeId: 'custom:telecom',
    }],
    ['restore-custom-purpose', {
      type: 'restore-custom-purpose',
      purposeId: 'custom:telecom',
      targetMonthlyWon: 200_000,
    }],
    ['update-location', {
      type: 'update-location',
      locationId: 'checking',
      shortName: '주계좌',
      addRoles: ['saving'],
    }],
    ['save-draft', { type: 'save-draft', draft: draft() }],
    ['apply-map', { type: 'apply-map', applied: validApplied() }],
    ['edit-map-node', { type: 'edit-map-node', applied: validApplied() }],
    ['archive-location', {
      type: 'archive-location',
      locationId: 'savings',
      replacementRemainderByPurpose: {},
    }],
    ['restore-location', {
      type: 'restore-location',
      locationId: 'savings',
      restoreLinkIds: [],
      remainderByPurpose: {},
    }],
    ['reset-map', { type: 'reset-map' }],
  ] satisfies [string, AccountMapCommand][])('%s preserves protected slices byte-for-byte', (_name, command) => {
    const before = workspace();
    if (command.type === 'edit-map-node') before.accountMap.applied = validApplied();
    if (command.type === 'connect-location') before.accountMap.applied = validApplied();
    if (command.type === 'create-and-connect-location') before.accountMap.draft = draft();
    if (command.type === 'archive-custom-purpose') {
      before.accountMap.applied = {
        ...validApplied(),
        customPurposes: [customPurpose('custom:telecom', 200_000)],
      };
    }
    if (command.type === 'restore-custom-purpose') {
      before.accountMap.applied = {
        ...validApplied(),
        customPurposes: [{ ...customPurpose('custom:telecom', 200_000), archivedAt: 10 }],
      };
    }
    if (command.type === 'restore-location') before.locations[1] = {
      ...before.locations[1]!,
      archivedAt: 10,
    };
    const result = applyAccountMapCommand(before, command, 20);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.workspace.main)).toBe(JSON.stringify(before.main));
    expect(JSON.stringify(result.workspace.simulation)).toBe(JSON.stringify(before.simulation));
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
    before.main.applied = { ...main(), monthlyLivingWon: 900_000, updatedAt: 10 };
    const corrected = { ...before.accountMap.applied, customPurposes: [{ ...over, targetMonthlyWon: 1_000_000, updatedAt: 20 }], updatedAt: 20 };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: corrected }, 20).ok).toBe(true);
    const worse = { ...corrected, customPurposes: [{ ...over, targetMonthlyWon: 1_200_000, updatedAt: 20 }] };
    expect(applyAccountMapCommand(before, { type: 'edit-map-node', applied: worse }, 20)).toMatchObject({ ok: false, reason: 'custom-target-capacity' });
  });

  it('keeps stale applied source after partial correction and advances it after full correction', () => {
    const before = workspace();
    before.main.applied = { ...main(), monthlyLivingWon: 900_000, updatedAt: 10 };
    const stalePurpose = {
      id: 'custom:telecom' as const,
      parentId: 'system:living' as const,
      name: '통신비',
      targetMonthlyWon: 1_100_000,
      createdAt: 1,
      updatedAt: 1,
    };
    before.accountMap.applied = {
      ...validApplied(),
      sourceMainUpdatedAt: 1,
      customPurposes: [stalePurpose],
    };
    const partialCorrection = {
      ...before.accountMap.applied,
      sourceMainUpdatedAt: 10,
      customPurposes: [{ ...stalePurpose, targetMonthlyWon: 1_000_000, updatedAt: 20 }],
      updatedAt: 20,
    };

    const partial = applyAccountMapCommand(before, {
      type: 'edit-map-node',
      applied: partialCorrection,
    }, 20);

    expect(partial.ok).toBe(true);
    if (!partial.ok || partial.workspace.accountMap.applied === null) return;
    expect(partial.workspace.accountMap.applied.sourceMainUpdatedAt).toBe(1);

    const complete = applyAccountMapCommand(partial.workspace, {
      type: 'edit-map-node',
      applied: {
        ...partial.workspace.accountMap.applied,
        sourceMainUpdatedAt: 1,
        customPurposes: [{ ...stalePurpose, targetMonthlyWon: 900_000, updatedAt: 21 }],
        updatedAt: 21,
      },
    }, 21);

    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.workspace.accountMap.applied?.sourceMainUpdatedAt).toBe(10);
  });

  it('keeps stale draft source after partial correction and advances it after full correction', () => {
    const before = workspace();
    before.main.applied = { ...main(), monthlyLivingWon: 900_000, updatedAt: 10 };
    const stalePurpose = {
      id: 'custom:telecom' as const,
      parentId: 'system:living' as const,
      name: '통신비',
      targetMonthlyWon: 1_100_000,
      createdAt: 1,
      updatedAt: 1,
    };
    before.accountMap.draft = {
      ...draft(),
      sourceMainUpdatedAt: 1,
      customPurposes: [stalePurpose],
    };

    const partial = applyAccountMapCommand(before, {
      type: 'save-draft',
      draft: {
        ...before.accountMap.draft,
        sourceMainUpdatedAt: 10,
        customPurposes: [{ ...stalePurpose, targetMonthlyWon: 1_000_000, updatedAt: 20 }],
        updatedAt: 20,
      },
    }, 20);

    expect(partial.ok).toBe(true);
    if (!partial.ok || partial.workspace.accountMap.draft === null) return;
    expect(partial.workspace.accountMap.draft.sourceMainUpdatedAt).toBe(1);

    const complete = applyAccountMapCommand(partial.workspace, {
      type: 'save-draft',
      draft: {
        ...partial.workspace.accountMap.draft,
        sourceMainUpdatedAt: 1,
        customPurposes: [{ ...stalePurpose, targetMonthlyWon: 900_000, updatedAt: 21 }],
        updatedAt: 21,
      },
    }, 21);

    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.workspace.accountMap.draft?.sourceMainUpdatedAt).toBe(10);
  });

  it.each([
    ['apply-map', (_before: WorkspaceDocument) => (
      { type: 'apply-map', applied: validApplied() } satisfies AccountMapCommand
    )],
    ['archive-location', (before: WorkspaceDocument) => {
      before.accountMap.applied = validApplied();
      before.accountMap.draft = draft();
      return {
        type: 'archive-location',
        locationId: 'savings',
        replacementRemainderByPurpose: {},
      } satisfies AccountMapCommand;
    }],
    ['restore-location', (before: WorkspaceDocument) => {
      before.locations[1] = { ...before.locations[1]!, archivedAt: 5 };
      before.accountMap.applied = validApplied();
      before.accountMap.draft = draft();
      return {
        type: 'restore-location',
        locationId: 'savings',
        restoreLinkIds: [],
        remainderByPurpose: {},
      } satisfies AccountMapCommand;
    }],
  ] as const)('advances fitting applied and draft sources after %s writes', (_name, arrange) => {
    const before = workspace();
    before.main.applied = { ...main(), updatedAt: 10 };
    const command = arrange(before);

    const result = applyAccountMapCommand(before, command, 20);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspace.accountMap.applied?.sourceMainUpdatedAt).toBe(10);
    if (_name !== 'apply-map') {
      expect(result.workspace.accountMap.draft?.sourceMainUpdatedAt).toBe(10);
    }
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
    before.main.applied = { ...main(), monthlyLivingWon: 900_000, updatedAt: 10 };
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

function customPurpose(id: `custom:${string}`, targetMonthlyWon: number) {
  return {
    id,
    parentId: 'system:living' as const,
    name: id.endsWith('food') ? '식비' : '통신비',
    targetMonthlyWon,
    createdAt: 1,
    updatedAt: 1,
  };
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
