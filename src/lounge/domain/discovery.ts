import {ASSET_BANDS,isAssetBand,type AssetBand} from './assetBand';
import {parsePublication,publicationId,type Publication} from './publication';
export interface FeedQuery {
  q:string;scope:'all'|'mine';period:'all'|'7d'|'30d';hasCash:boolean;
  assetBands:Array<AssetBand|'hidden'>;sort:'updated'|'reactions'|'comments';
}
export interface FeedCursor {
  v:1;queryKey:string;asOf:string;epoch:string|null;
  last:{id:string;updatedAt:string;score:number|null};
}
export type FeedPage={status:'ok';items:Publication[];nextCursor:FeedCursor|null;asOf:string;rankedAt:string|null}
  |{status:'cursor-expired'|'ranking-unavailable'};
export const DEFAULT_FEED_QUERY:FeedQuery={q:'',scope:'all',period:'all',hasCash:false,assetBands:[],sort:'updated'};
const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==='object' && !Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).sort().join(',')===[...expected].sort().join(',');
const time=(v:unknown):v is string=>typeof v==='string' && Number.isFinite(Date.parse(v));
const band=(v:unknown):v is AssetBand|'hidden'=>v==='hidden' || isAssetBand(v);
export function parseFeedQuery(value:unknown):FeedQuery|null {
  if(!record(value) || !keys(value,['q','scope','period','hasCash','assetBands','sort']) || typeof value.q!=='string'
    || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value.q) || value.q.length>400
    || !['all','mine'].includes(String(value.scope)) || !['all','7d','30d'].includes(String(value.period))
    || typeof value.hasCash!=='boolean' || !['updated','reactions','comments'].includes(String(value.sort))
    || !Array.isArray(value.assetBands) || value.assetBands.length>ASSET_BANDS.length+1 || !value.assetBands.every(band)
    || new Set(value.assetBands).size!==value.assetBands.length)return null;
  const q=value.q.normalize('NFC').toLowerCase().trim().replace(/\s+/g,' ');if([...q].length>80)return null;
  return {q,scope:value.scope as FeedQuery['scope'],period:value.period as FeedQuery['period'],hasCash:value.hasCash,
    assetBands:[...value.assetBands].sort(),sort:value.sort as FeedQuery['sort']};
}
export function feedQueryFromSearch(search:string):FeedQuery {
  const params=new URLSearchParams(search),query={...DEFAULT_FEED_QUERY,assetBands:[] as FeedQuery['assetBands']};
  const q=parseFeedQuery({...query,q:params.get('q')??''})?.q??'';
  return {...query,q,scope:params.get('scope')==='mine'?'mine':'all',period:params.get('period')==='7d'?'7d':params.get('period')==='30d'?'30d':'all',
    hasCash:params.get('cash')==='1',assetBands:[...new Set(params.getAll('band').filter(band))].sort(),
    sort:params.get('sort')==='reactions'?'reactions':params.get('sort')==='comments'?'comments':'updated'};
}
export function feedSearchParams(query:FeedQuery):URLSearchParams {
  const safe=parseFeedQuery(query);if(!safe)throw new Error('invalid-feed-query');const params=new URLSearchParams();
  if(safe.q)params.set('q',safe.q);if(safe.scope!=='all')params.set('scope',safe.scope);if(safe.period!=='all')params.set('period',safe.period);
  if(safe.hasCash)params.set('cash','1');for(const code of safe.assetBands)params.append('band',code);
  if(safe.sort!=='updated')params.set('sort',safe.sort);return params;
}
/** Plain, length-delimited fingerprint; the server repeats validation and never treats this as authorization. */
export function feedQueryKey(query:FeedQuery):string {
  const safe=parseFeedQuery(query);if(!safe)throw new Error('invalid-feed-query');
  return `1:${[...safe.q].length}:${safe.q}|${safe.scope}|${safe.period}|${safe.hasCash?1:0}|${safe.assetBands.join(',')}|${safe.sort}`;
}
export function parseFeedCursor(value:unknown):FeedCursor|null {
  if(!record(value) || !keys(value,['v','queryKey','asOf','epoch','last']) || value.v!==1 || typeof value.queryKey!=='string'
    || value.queryKey.length>1000 || !value.queryKey.startsWith('1:') || !time(value.asOf) || value.epoch!==null && !time(value.epoch)
    || !record(value.last) || !keys(value.last,['id','updatedAt','score']) || !publicationId(value.last.id) || !time(value.last.updatedAt)
    || (value.epoch===null?value.last.score!==null:!Number.isSafeInteger(value.last.score) || Number(value.last.score)<0 || Number(value.last.score)>100000)
    || Date.parse(value.last.updatedAt)>Date.parse(value.asOf) || value.epoch!==null && Date.parse(value.epoch)>Date.parse(value.asOf))return null;
  return {v:1,queryKey:value.queryKey,asOf:value.asOf,epoch:value.epoch as string|null,
    last:{id:value.last.id,updatedAt:value.last.updatedAt,score:value.last.score as number|null}};
}
export function parseFeedPage(value:unknown):FeedPage|null {
  if(!record(value))return null;
  if(value.status==='cursor-expired' || value.status==='ranking-unavailable')return keys(value,['status'])?{status:value.status}:null;
  if(value.status!=='ok' || !keys(value,['status','items','nextCursor','asOf','rankedAt']) || !Array.isArray(value.items)
    || value.items.length>12 || !time(value.asOf) || value.rankedAt!==null && !time(value.rankedAt))return null;
  const items=value.items.map(parsePublication),cursor=value.nextCursor===null?null:parseFeedCursor(value.nextCursor);
  if(items.some(v=>!v) || new Set(items.map(v=>v?.id)).size!==items.length || value.nextCursor!==null && !cursor
    || items.some(v=>Date.parse(v!.updatedAt)>Date.parse(value.asOf as string))
    || cursor && (cursor.asOf!==value.asOf || cursor.epoch!==value.rankedAt || cursor.last.id!==items.at(-1)?.id || cursor.last.updatedAt!==items.at(-1)?.updatedAt))return null;
  return {status:'ok',items:items as Publication[],nextCursor:cursor,asOf:value.asOf,rankedAt:value.rankedAt as string|null};
}
