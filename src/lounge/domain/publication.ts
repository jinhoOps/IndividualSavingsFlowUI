import {isAssetBand, type AssetBand} from './assetBand';
import {recommendClassification, normalizePortfolioName} from '../../portfolio/domain/classification';
import {SHARE_SCALE, type PortfolioDraft, type PortfolioPlan} from '../../portfolio/domain/model';

export interface SharedAllocation {items: Array<{name: string; shareUnits: number}>; cashShareUnits: number}
export interface PublicationInput {title: string; note: string; allocation: SharedAllocation; assetBand?: AssetBand | null}
export interface Publication extends PublicationInput {alias: string; id: string; version: number; updatedAt: string; isMine: boolean}
export const PUBLICATION_PAGE_SIZE = 12;
export const publicationId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).sort().join(',') === [...expected].sort().join(',');
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && (empty || v.trim().length > 0) && [...v].length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const share = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= SHARE_SCALE;

export function parseSharedAllocation(value: unknown): SharedAllocation | null {
  if (!record(value) || !keys(value, ['items', 'cashShareUnits']) || !share(value.cashShareUnits)
    || !Array.isArray(value.items) || value.items.length > 10) return null;
  const items: SharedAllocation['items'] = [];
  const names = new Set<string>();
  let total = value.cashShareUnits;
  for (const item of value.items) {
    if (!record(item) || !keys(item, ['name', 'shareUnits']) || !text(item.name, 40) || !share(item.shareUnits) || item.shareUnits === 0) return null;
    const normalized = normalizePortfolioName(item.name);
    if (names.has(normalized)) return null;
    names.add(normalized); total += item.shareUnits;
    items.push({name: item.name, shareUnits: item.shareUnits});
  }
  if (total !== SHARE_SCALE || new TextEncoder().encode(JSON.stringify(value)).length > 4096) return null;
  return {items, cashShareUnits: value.cashShareUnits};
}
export function parsePublicationInput(value: unknown): PublicationInput | null {
  if (!record(value) || !keys(value, ['title', 'note', 'allocation', ...('assetBand' in value ? ['assetBand'] : [])]) || !text(value.title, 40) || !text(value.note, 160, true)) return null;
  if ('assetBand' in value && value.assetBand !== null && !isAssetBand(value.assetBand)) return null;
  const allocation = parseSharedAllocation(value.allocation);
  return allocation ? {title: value.title, note: value.note, allocation, ...('assetBand' in value ? {assetBand: value.assetBand as AssetBand | null} : {})} : null;
}
export function parsePublication(value: unknown): Publication | null {
  if (!record(value) || !keys(value, ['id', 'title', 'alias', 'note', 'allocation', 'version', 'updatedAt', 'isMine', ...('assetBand' in value ? ['assetBand'] : [])])
    || !text(value.alias, 20) || !publicationId(value.id) || !Number.isSafeInteger(value.version) || Number(value.version) < 1
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.isMine !== 'boolean') return null;
  const input = parsePublicationInput({title: value.title, note: value.note, allocation: value.allocation, ...('assetBand' in value ? {assetBand: value.assetBand} : {})});
  return input ? {...input, alias: value.alias, id: value.id, version: Number(value.version), updatedAt: value.updatedAt, isMine: value.isMine} : null;
}
export function allocationFromPlan(plan: PortfolioPlan): SharedAllocation | null {
  return parseSharedAllocation({items: [...plan.items].sort((a,b) => a.order - b.order).filter(i => i.shareUnits > 0)
    .map(({name, shareUnits}) => ({name, shareUnits})), cashShareUnits: plan.cashShareUnits});
}
export function draftFromPublication(allocation: SharedAllocation, investmentWon: number, now: number): PortfolioDraft {
  const parsed = parseSharedAllocation(allocation);
  if (!parsed || !Number.isSafeInteger(investmentWon) || investmentWon <= 0 || !Number.isSafeInteger(now) || now < 0) throw new Error('invalid-shared-allocation');
  return {schemaVersion: 2, scope: {type: 'aggregate'}, items: parsed.items.map((item, order) => ({...item,
    id: `lounge-${order}`, order, classification: recommendClassification(item.name), classificationOrigin: 'automatic'})),
    cashShareUnits: parsed.cashShareUnits, cashMode: 'automatic', inputMode: 'percentage', syncedInvestmentWon: investmentWon, updatedAt: now, isApplicable: true};
}
export function publicationQuery(search: string, key = 'post'): string | null {
  const id = new URLSearchParams(search).get(key);
  return publicationId(id) ? id : null;
}
