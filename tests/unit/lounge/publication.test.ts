import {describe, expect, it} from 'vitest';
import {allocationFromPlan, draftFromPublication, parsePublication, parsePublicationInput, parseSharedAllocation, publicationQuery} from '../../../src/lounge/domain/publication';
import {materializeAllocation} from '../../../src/portfolio/domain/allocation';
import {parsePortfolioDraft} from '../../../src/portfolio/domain/validation';
import {planFromDraft} from '../../../src/portfolio/application/portfolioReducer';
import {safeReturnPath} from '../../../src/auth/auth';
const allocation = {items:[{name:'SCHD',shareUnits:500000},{name:'금',shareUnits:300000}],cashShareUnits:200000};
const id = '12345678-1234-1234-1234-123456789012';
describe('Lounge privacy and copy contract', () => {
  it('exports only names and exact shares, dropping internal identifiers and all money', () => {
    const draft = draftFromPublication(allocation,900001,1000);
    const shared = allocationFromPlan(planFromDraft(draft,1001));
    expect(shared).toEqual(allocation);
    expect(JSON.stringify(shared)).not.toMatch(/900001|updatedAt|classification|syncedInvestment|lounge-/);
  });
  it('reconstructs a valid editable draft at the recipient budget including cash and rounding', () => {
    const draft = draftFromPublication(allocation,123457,2000);
    expect(parsePortfolioDraft(draft)).toEqual(draft);
    const amounts = materializeAllocation(draft,123457);
    expect(amounts.totalAmountWon).toBe(123457);
    expect(amounts.items.reduce((s,i)=>s+i.amountWon,amounts.cashAmountWon)).toBe(123457);
    expect(draft.items[1].classification).toBe('stable');
    expect(allocation.items).not.toHaveProperty('id');
  });
  it.each([
    {...allocation, monthlyInvestmentWon:50000}, {...allocation,cashShareUnits:-1}, {...allocation,cashShareUnits:200001},
    {...allocation,items:[{name:'SCHD',shareUnits:800000,amountWon:5000}]},
    {...allocation,items:[{name:'SCHD',shareUnits:400000},{name:' schd ',shareUnits:400000}]},
    {...allocation,items:[{name:'x'.repeat(41),shareUnits:800000}]},
    {...allocation,items:[{name:'SCHD\n500원',shareUnits:800000}]},
    {...allocation,items:[{name:'SCHD',shareUnits:799999.5}]}, null, [], {},
  ])('rejects malformed or privately enriched allocations %#', value => expect(parseSharedAllocation(value)).toBeNull());
  it('accepts all-cash but rejects zero-weight and oversized target lists', () => {
    expect(parseSharedAllocation({items:[],cashShareUnits:1000000})).not.toBeNull();
    expect(parseSharedAllocation({items:[{name:'A',shareUnits:0}],cashShareUnits:1000000})).toBeNull();
    expect(parseSharedAllocation({items:Array.from({length:11},(_,i)=>({name:String(i),shareUnits:1})),cashShareUnits:999989})).toBeNull();
  });
  it('does not accept untrusted owner IDs, extra fields or invalid versions in responses', () => {
    const post = {id,title:'배당과 금',alias:'투자자',note:'',allocation,version:1,updatedAt:'2026-09-28T00:00:00Z',isMine:false};
    expect(parsePublication(post)).toEqual(post);
    for (const patch of [{owner_id:'secret'},{email:'private@example.com'},{version:0},{updatedAt:'invalid'}]) expect(parsePublication({...post,...patch})).toBeNull();
    expect(parsePublicationInput({title:' ',alias:'A',note:'',allocation})).toBeNull();
  });
  it('shares only an opted-in fixed band while retaining old publication compatibility', () => {
    const input = {title:'비율 공유',alias:'투자자',note:'',allocation};
    for (const assetBand of [null, 'under_10m', '20m', '100m', '1b_plus']) {
      expect(parsePublicationInput({...input,assetBand})).toEqual({...input,assetBand});
      const post={...input,id,version:1,updatedAt:'2026-09-28T00:00:00Z',isMine:false,assetBand};
      expect(parsePublication(post)).toEqual(post);
    }
    for (const assetBand of ['20123456', 20_123_456, '2천만원대', undefined]) expect(parsePublicationInput({...input,assetBand})).toBeNull();
    expect(parsePublicationInput({...input,initialInvestmentWon:20_123_456})).toBeNull();
  });
  it('keeps only validated publication IDs through Google return paths', () => {
    const base='/IndividualSavingsFlowUI/';
    expect(publicationQuery(`?post=${id}`)).toBe(id);
    expect(publicationQuery('?post=evil')).toBeNull();
    expect(safeReturnPath(`${base}apps/lounge/?post=${id}&token=secret`,base)).toBe(`${base}apps/lounge/?post=${id}`);
    expect(safeReturnPath(`${base}apps/portfolio/index.html?publication=${id}`,base)).toBe(`${base}apps/portfolio/?publication=${id}`);
    expect(safeReturnPath(`${base}apps/lounge/?post=evil`,base)).toBe(`${base}apps/lounge/`);
    expect(safeReturnPath('https://evil.example/apps/lounge/',base)).toBe(`${base}apps/main/`);
  });
});
