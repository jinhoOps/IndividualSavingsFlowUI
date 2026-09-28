import {describe,expect,it} from 'vitest';
import {DEFAULT_FEED_QUERY,feedQueryFromSearch,feedSearchParams,feedQueryKey,parseFeedQuery,parseFeedPage,parseFeedCursor} from '../../../src/lounge/domain/discovery';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',time='2026-09-28T01:00:00Z';
const post={id,title:'금 비율',alias:'가나',note:'',allocation:{items:[],cashShareUnits:1000000},version:1,updatedAt:time,isMine:false,assetBand:null};
describe('feed query contract',()=>{
  it('normalizes NFC, case and spaces while treating SQL and wildcards as plain text',()=>{
    expect(parseFeedQuery({...DEFAULT_FEED_QUERY,q:'  금   VOO  '})?.q).toBe('금 voo');
    for(const q of ['금','a@b',"%_\\'; DROP TABLE x; --",'<b>VOO</b>'])expect(parseFeedQuery({...DEFAULT_FEED_QUERY,q})).not.toBeNull();
    for(const bad of [{q:'x'.repeat(81)},{q:'a\nb'},{q:'a\u202eb'},{sort:'return-rate'},{scope:'others'},{hasCash:'yes'},{assetBands:['secret']},{extra:true}])
      expect(parseFeedQuery({...DEFAULT_FEED_QUERY,...bad})).toBeNull();
  });
  it('roundtrips only allowed URL conditions and drops tokens and invalid values independently',()=>{
    const query={...DEFAULT_FEED_QUERY,q:'금 %_',scope:'mine' as const,period:'7d' as const,hasCash:true,assetBands:['20m','hidden'] as const,sort:'comments' as const};
    expect(feedQueryFromSearch(feedSearchParams({...query,assetBands:[...query.assetBands]}).toString())).toEqual({...query,assetBands:[...query.assetBands]});
    const safe=feedQueryFromSearch('?q=금&sort=return-rate&cash=true&band=20m&band=secret&access_token=secret&post='+id);
    expect(safe).toEqual({...DEFAULT_FEED_QUERY,q:'금',assetBands:['20m']});
    expect(feedSearchParams(safe).toString()).toBe('q=%EA%B8%88&band=20m');
  });
  it('has the same fingerprint for normalized conditions and every filter contributes',()=>{
    const a={...DEFAULT_FEED_QUERY,q:'😀',assetBands:['hidden','20m'] as Array<'hidden'|'20m'>};
    const b={...a,assetBands:[...a.assetBands].reverse()};
    expect(feedQueryKey(a)).toBe(feedQueryKey(b));expect(feedQueryKey(a)).toContain('1:😀');
    expect(feedQueryKey(a)).not.toBe(feedQueryKey({...a,scope:'mine'}));
    expect(feedQueryKey(a)).not.toBe(feedQueryKey({...a,sort:'comments'}));
  });
});
describe('feed response contract',()=>{
  const cursor={v:1,queryKey:feedQueryKey(DEFAULT_FEED_QUERY),asOf:time,epoch:null,last:{id,updatedAt:time,score:null}};
  const page={status:'ok',items:[post],nextCursor:cursor,asOf:time,rankedAt:null};
  it('bounds pages and rejects private data, mismatched cursor and duplicate items',()=>{
    expect(parseFeedPage(page)).toEqual(page);
    for(const bad of [{...page,items:Array(13).fill(post)},{...page,items:[post,post]}, {...page,items:[{...post,user_id:id}]},
      {...page,nextCursor:{...cursor,last:{...cursor.last,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}},
      {...page,nextCursor:{...cursor,asOf:'2026-09-28T02:00:00Z'}},{...page,extra:true}])expect(parseFeedPage(bad)).toBeNull();
  });
  it('distinguishes explicit cursor expiration and enforces ranking cursor shape',()=>{
    expect(parseFeedPage({status:'cursor-expired'})).toEqual({status:'cursor-expired'});
    expect(parseFeedPage({status:'ranking-unavailable'})).toEqual({status:'ranking-unavailable'});
    expect(parseFeedPage({status:'cursor-expired',items:[]})).toBeNull();
    expect(parseFeedCursor({...cursor,last:{...cursor.last,score:2}})).toBeNull();
    expect(parseFeedCursor({...cursor,epoch:time,last:{...cursor.last,score:2}})).not.toBeNull();
    expect(parseFeedCursor({...cursor,epoch:'infinity',last:{...cursor.last,score:2}})).toBeNull();
  });
});
