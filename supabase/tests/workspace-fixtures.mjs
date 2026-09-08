export const empty = {
  main: { applied: null, setupProgress: null }, simulation: { draft: null },
  portfolio: { plans: [], draft: null }, locations: [], accountMap: { applied: null, draft: null },
};
export const full = structuredClone(empty);
full.main.applied = { schemaVersion: 2, updatedAt: 100, monthlyNetIncomeWon: 500,
  monthlyHousingWon: 100, monthlyLivingWon: 100, monthlySavingWon: 100, monthlyInvestmentWon: 100 };
full.simulation.draft = { schemaVersion: 3, source: { monthlySavingsWon: 100, monthlyInvestmentWon: 100, mainUpdatedAt: 100 },
  initialInvestmentWon: 0, targetAmountWon: 100000000, years: 20, expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75, inflationOffsetPercentPoints: -0.25, amountMode: 'nominal', updatedAt: 100 };
full.portfolio.plans = [{ schemaVersion: 2, scope: { type: 'aggregate' }, items: [{ id: 'asset', name: 'ETF',
  shareUnits: 400000, order: 0, classification: 'growth', classificationOrigin: 'automatic' }],
  cashShareUnits: 600000, cashMode: 'automatic', syncedInvestmentWon: 100, appliedAt: 100, updatedAt: 100 }];
full.locations = [{ id: 'bank', shortName: ' 저축   통장 ', institution: { id: 'custom:bank', name: ' My Bank ' },
  kind: 'bank', roles: ['saving'], createdAt: 100, updatedAt: 100 }];
full.accountMap.applied = { schemaVersion: 2, sourceMainUpdatedAt: 100, customPurposes: [
  { id: 'custom:holiday', parentId: 'system:saving', name: ' 여행  저축 ', targetMonthlyWon: 50, createdAt: 100, updatedAt: 100 }],
  links: [{ id: 'link', purposeId: 'custom:holiday', locationId: 'bank', monthlyAmountWon: 50,
    remainder: false, status: 'active', createdAt: 100, updatedAt: 100 }], setupCompletedAt: 100, updatedAt: 100 };

const fixtures = [{ name: 'empty', valid: true, payload: empty }, { name: 'full and normalized', valid: true, payload: full }];
function variant(name, valid, change) { const payload = structuredClone(full); change(payload); fixtures.push({ name, valid, payload }); }
variant('zero income applied', false, p => p.main.applied.monthlyNetIncomeWon = 0);
variant('incomplete Main draft', true, p => { p.main.setupProgress = { kind: 'initial', step: 'income', draft: { ...p.main.applied, monthlyNetIncomeWon: 0 }, savedAt: 0 }; });
variant('Main safe integer timestamp', true, p => p.main.applied.updatedAt = Number.MAX_SAFE_INTEGER);
variant('fraction amount', false, p => p.main.applied.monthlySavingWon = 0.5);
variant('numeric string', false, p => p.main.applied.monthlySavingWon = '1');
variant('unsafe amount', false, p => p.main.applied.monthlySavingWon = 9007199254740992);
variant('unknown key', false, p => p.userId = 'spoof');
variant('simulation null target high initial', true, p => { p.simulation.draft.initialInvestmentWon = 200000000; p.simulation.draft.targetAmountWon = null; });
variant('simulation null target low initial', false, p => p.simulation.draft.targetAmountWon = null);
variant('simulation zero years', true, p => p.simulation.draft.years = 0);
variant('simulation fractional return', false, p => p.simulation.draft.expectedAnnualReturnPercent = 1.234);
variant('simulation binary rounding reject', false, p => p.simulation.draft.expectedAnnualReturnPercent = 9.03);
variant('simulation inflation floor', false, p => p.simulation.draft.inflationOffsetPercentPoints = -102.75);
variant('simulation source timestamp zero', false, p => p.simulation.draft.source.mainUpdatedAt = 0);
variant('simulation tiny binary decimal tolerance', true, p => p.simulation.draft.expectedAnnualReturnPercent = 0.10000000000000002);
variant('simulation large exact scaled integer', true, p => p.simulation.draft.baseRatePercent = 45035996273704.97);
variant('portfolio partial manual draft', true, p => { const { appliedAt, ...draft } = p.portfolio.plans[0]; p.portfolio.draft = { ...draft, cashMode: 'manual', cashShareUnits: 0, inputMode: 'amount', isApplicable: false }; });
variant('portfolio incorrect applicability', false, p => { const { appliedAt, ...draft } = p.portfolio.plans[0]; p.portfolio.draft = { ...draft, inputMode: 'amount', isApplicable: false }; });
variant('portfolio duplicate scope', false, p => p.portfolio.plans.push(p.portfolio.plans[0]));
variant('portfolio shares unbalanced', false, p => p.portfolio.plans[0].cashShareUnits = 1);
variant('portfolio order gap', false, p => p.portfolio.plans[0].items[0].order = 1);
variant('portfolio duplicate normalized names', false, p => { p.portfolio.plans[0].items.push({ ...p.portfolio.plans[0].items[0], id: 'other', name: ' etf ', order: 1, shareUnits: 0 }); });
variant('location emoji', false, p => p.locations[0].shortName = '💰');
variant('location Latin extended', true, p => p.locations[0].shortName = 'Épargne');
variant('location duplicate roles', false, p => p.locations[0].roles.push('saving'));
variant('location duplicate normalized institution', false, p => p.locations.push({ ...p.locations[0], id: 'other', institution: { name: 'my bank' } }));
variant('location capacity', false, p => { for (let n = 0; n < 10; n++) p.locations.push({ ...p.locations[0], id: `id${n}`, shortName: `통장${n}` }); });
variant('missing link location', false, p => p.accountMap.applied.links[0].locationId = 'missing');
variant('missing custom purpose', false, p => p.accountMap.applied.links[0].purposeId = 'custom:missing');
variant('wrong active role', false, p => p.locations[0].roles = ['income']);
variant('archived active location', false, p => p.locations[0].archivedAt = 100);
variant('suspended archived link', true, p => { p.locations[0].archivedAt = 100; Object.assign(p.accountMap.applied.links[0], { status: 'suspended', suspendedReason: 'location-archived' }); });
variant('suspended remainder', false, p => Object.assign(p.accountMap.applied.links[0], { status: 'suspended', suspendedReason: 'user', remainder: true }));
variant('duplicate link pair', false, p => p.accountMap.applied.links.push({ ...p.accountMap.applied.links[0], id: 'other' }));
variant('custom target over current Main', false, p => p.accountMap.applied.customPurposes[0].targetMonthlyWon = 101);
variant('Main reduction permits stale overage', true, p => { p.main.applied.updatedAt = 101; p.main.applied.monthlySavingWon = 1; });
variant('future Main reference', false, p => p.accountMap.applied.sourceMainUpdatedAt = 101);
variant('Account Map requires Main', false, p => p.main.applied = null);
variant('draft state', true, p => { const { setupCompletedAt, ...state } = p.accountMap.applied; p.accountMap.draft = { ...state, schemaVersion: 1, step: 'connect' }; });
variant('custom name NFC', true, p => p.accountMap.applied.customPurposes[0].name = ' e\u0301  여행 ');
variant('custom name 25 points', false, p => p.accountMap.applied.customPurposes[0].name = 'a'.repeat(25));
// Every required scalar must reject JSON null, including enum strings whose SQL
// comparisons otherwise evaluate to UNKNOWN and can accidentally bypass an IF.
function requiredScalars(value, path = []) {
  if (value === null) return;
  if (typeof value !== 'object') {
    variant(`required scalar null: ${path.join('.')}`, false, p => {
      let owner = p; for (const key of path.slice(0, -1)) owner = owner[key]; owner[path.at(-1)] = null;
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) requiredScalars(child, [...path, key]);
}
requiredScalars(full);
function objectShapes(value, path = []) {
  if (value === null || typeof value !== 'object') return;
  variant(`wrong container type: ${path.join('.') || 'root'}`, false, p => {
    if (!path.length) { for (const key of Object.keys(p)) delete p[key]; return; }
    let owner = p; for (const key of path.slice(0, -1)) owner = owner[key]; owner[path.at(-1)] = Array.isArray(value) ? {} : [];
  });
  for (const [key, child] of Object.entries(value)) objectShapes(child, [...path, key]);
}
objectShapes(full);

export const flow = structuredClone(full);
flow.locations.push(
  { id: 'income', shortName: '급여', kind: 'cash', roles: ['income'], createdAt: 100, updatedAt: 100 },
  { id: 'living', shortName: '생활', kind: 'cash', roles: ['spending'], createdAt: 100, updatedAt: 100 },
);
flow.accountMap.applied = { ...flow.accountMap.applied, schemaVersion: 3, transfers: [
  { id: 'salary-living', sourceLocationId: 'income', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 100 }, status: 'active', createdAt: 100, updatedAt: 100 },
  { id: 'living-bank', sourceLocationId: 'living', targetLocationId: 'bank', allocation: { kind: 'sweep' }, status: 'active', createdAt: 100, updatedAt: 100 },
] };
function flowVariant(name, valid, change = () => {}) {
  const payload = structuredClone(flow); change(payload); fixtures.push({ name, valid, payload });
}
flowVariant('v4 fixed and sweep', true);
flowVariant('v4 zero fixed transfer', true, p => p.accountMap.applied.transfers[0].allocation.monthlyAmountWon = 0);
flowVariant('v4 safe integer fixed deficit', true, p => p.accountMap.applied.transfers[0].allocation.monthlyAmountWon = Number.MAX_SAFE_INTEGER);
for (const amount of [-1, 0.5, 9007199254740992, null, '1']) {
  flowVariant(`v4 invalid fixed ${amount}`, false, p => p.accountMap.applied.transfers[0].allocation.monthlyAmountWon = amount);
}
for (const step of ['basis', 'locations', 'transfers', 'review', 'connect', null]) {
  flowVariant(`v4 draft step ${step}`, step !== 'connect' && step !== null, p => {
    const { setupCompletedAt, ...state } = p.accountMap.applied;
    p.accountMap.draft = { ...state, schemaVersion: 2, step };
  });
}
flowVariant('v4 legacy draft with flow applied', true, p => {
  const { setupCompletedAt, ...state } = full.accountMap.applied;
  p.accountMap.draft = { ...state, schemaVersion: 1, step: 'connect' };
});
flowVariant('v4 duplicate transfer id across suspended', false, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[0], status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 duplicate active pair', false, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[0], id: 'duplicate' }));
flowVariant('v4 suspended duplicate pair permitted', true, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[0], id: 'suspended', status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 active self transfer', false, p => p.accountMap.applied.transfers[0].targetLocationId = 'income');
flowVariant('v4 suspended self transfer', false, p => Object.assign(p.accountMap.applied.transfers[0], { targetLocationId: 'income', status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 active missing endpoint', false, p => p.accountMap.applied.transfers[0].sourceLocationId = 'missing');
flowVariant('v4 suspended missing endpoint', false, p => Object.assign(p.accountMap.applied.transfers[0], { sourceLocationId: 'missing', status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 active archived endpoint', false, p => p.locations[1].archivedAt = 100);
flowVariant('v4 suspended archived endpoint', true, p => { p.locations[1].archivedAt = 100; Object.assign(p.accountMap.applied.transfers[0], { status: 'suspended', suspendedReason: 'location-archived' }); });
flowVariant('v4 suspended sweep', true, p => Object.assign(p.accountMap.applied.transfers[1], { status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 duplicate sweep source', false, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[1], id: 'sweep-2', targetLocationId: 'income' }));
flowVariant('v4 active directed cycle', false, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[0], id: 'return', sourceLocationId: 'bank', targetLocationId: 'income' }));
flowVariant('v4 suspended breaks cycle', true, p => p.accountMap.applied.transfers.push({ ...p.accountMap.applied.transfers[0], id: 'return', sourceLocationId: 'bank', targetLocationId: 'income', status: 'suspended', suspendedReason: 'user' }));
flowVariant('v4 sweep forbids amount', false, p => p.accountMap.applied.transfers[1].allocation.monthlyAmountWon = 0);
flowVariant('v4 active forbids suspended reason', false, p => p.accountMap.applied.transfers[0].suspendedReason = 'user');
flowVariant('v4 transfer timestamp ceiling', false, p => p.accountMap.applied.transfers[0].updatedAt = 8640000000000001);
flowVariant('v4 preserves decomposed custom name', true, p => p.accountMap.applied.customPurposes[0].name = ' e\u0301  여행 ');
flowVariant('v4 NFC equivalent custom names collide', false, p => {
  p.accountMap.applied.customPurposes[0].name = 'e\u0301';
  p.accountMap.applied.customPurposes.push({ ...p.accountMap.applied.customPurposes[0], id: 'custom:other', name: 'é' });
});
for (const key of Object.keys(flow.accountMap.applied.transfers[0])) {
  flowVariant(`v4 transfer null ${key}`, false, p => p.accountMap.applied.transfers[0][key] = null);
  flowVariant(`v4 transfer missing ${key}`, false, p => delete p.accountMap.applied.transfers[0][key]);
}
export { fixtures };
