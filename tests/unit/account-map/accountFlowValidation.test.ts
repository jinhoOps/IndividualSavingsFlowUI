import { describe, expect, it } from 'vitest';
import { validateAccountTransfers } from '../../../src/account-map/domain/accountFlowValidation';
import type { AccountTransferLink } from '../../../src/account-map/domain/model';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

const locations: FinancialLocation[] = [location('salary'), location('spending'), location('brokerage')];

describe('account transfer topology validation', () => {
  it('accepts an acyclic graph with one sweep per source', () => {
    expect(validateAccountTransfers([
      transfer('fixed', 'salary', 'spending'),
      transfer('sweep', 'spending', 'brokerage', { kind: 'sweep' }),
    ], locations)).toEqual({ valid: true });
  });

  it.each([
    ['self-transfer', [transfer('self', 'salary', 'salary')]],
    ['duplicate-transfer', [transfer('a', 'salary', 'spending'), transfer('b', 'salary', 'spending')]],
    ['cycle', [transfer('a', 'salary', 'spending'), transfer('b', 'spending', 'salary')]],
    ['multiple-sweeps', [transfer('a', 'salary', 'spending', { kind: 'sweep' }), transfer('b', 'salary', 'brokerage', { kind: 'sweep' })]],
    ['endpoint-not-found', [transfer('missing', 'unknown', 'spending')]],
    ['endpoint-archived', [transfer('archived', 'salary', 'archived')]],
    ['invalid-amount', [transfer('invalid', 'salary', 'spending', { kind: 'fixed', monthlyAmountWon: -1 })]],
  ] as const)('rejects %s', (code, transfers) => {
    const allLocations = code === 'endpoint-archived'
      ? [...locations, { ...location('archived'), archivedAt: 100 }]
      : locations;
    const result = validateAccountTransfers(transfers, allLocations);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it('keeps suspended links readable when a location is archived', () => {
    const result = validateAccountTransfers([
      { ...transfer('suspended', 'salary', 'archived'), status: 'suspended', suspendedReason: 'location-archived' },
    ], [...locations, { ...location('archived'), archivedAt: 100 }]);
    expect(result).toEqual({ valid: true });
  });
});

function transfer(
  id: string,
  sourceLocationId: string,
  targetLocationId: string,
  allocation: AccountTransferLink['allocation'] = { kind: 'fixed', monthlyAmountWon: 100 },
): AccountTransferLink {
  return { id, sourceLocationId, targetLocationId, allocation, status: 'active', createdAt: 1, updatedAt: 2 };
}

function location(id: string): FinancialLocation {
  return {
    id,
    shortName: id,
    kind: 'bank',
    roles: ['income', 'spending', 'saving', 'investing'],
    createdAt: 1,
    updatedAt: 1,
  };
}
