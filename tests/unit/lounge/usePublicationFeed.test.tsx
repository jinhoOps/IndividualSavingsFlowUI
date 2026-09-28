import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {usePublicationFeed} from '../../../src/lounge/ui/usePublicationFeed';
import {DEFAULT_FEED_QUERY,feedQueryKey,type FeedCursor,type FeedPage,type FeedQuery} from '../../../src/lounge/domain/discovery';
import type {LoungeRepository} from '../../../src/lounge/infrastructure/loungeRepository';
const time='2026-09-28T03:00:00Z';
const posts=Array.from({length:132},(_,i)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`,title:`구성 ${i}`,alias:'가나',note:'',allocation:{items:[],cashShareUnits:1000000},version:1,updatedAt:'2026-09-28T01:00:00Z',isMine:false}));
const page=(q:FeedQuery,cursor?:FeedCursor):FeedPage=>{
  const start=cursor?posts.findIndex(p=>p.id===cursor.last.id)+1:0,items=posts.slice(start,start+12),last=items.at(-1)!;
  return {status:'ok',items,nextCursor:start+12<posts.length?{v:1,queryKey:feedQueryKey(q),asOf:time,epoch:null,last:{id:last.id,updatedAt:last.updatedAt,score:null}}:null,asOf:time,rankedAt:null};
};
beforeEach(()=>{history.replaceState(null,'','/apps/lounge/');vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('retains visible cards while searching and ignores a late response from an earlier query',async()=>{
  let old!:(value:FeedPage)=>void;const search=vi.fn().mockImplementationOnce(page).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve;})).mockImplementation(page);
  const {result}=renderHook(usePublicationFeed,{initialProps:{search} as unknown as LoungeRepository});
  await waitFor(()=>expect(result.current.posts).toHaveLength(12));
  act(()=>result.current.apply({...DEFAULT_FEED_QUERY,q:'금'}));await waitFor(()=>expect(search).toHaveBeenCalledTimes(2));
  expect(result.current.posts).toHaveLength(12);act(()=>result.current.apply({...DEFAULT_FEED_QUERY,q:'VOO'}));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{old({status:'ok',items:[],nextCursor:null,asOf:time,rankedAt:null});});
  expect(result.current.query.q).toBe('voo');expect(result.current.posts).toHaveLength(12);expect(location.search).toBe('?q=voo');
});
it('caps the DOM batch at 120, reads the next batch and restores the previous batch from its cursor',async()=>{
  const search=vi.fn(page),{result}=renderHook(usePublicationFeed,{initialProps:{search} as unknown as LoungeRepository});
  await waitFor(()=>expect(result.current.posts).toHaveLength(12));
  for(let i=0;i<9;i++)await act(async()=>{await result.current.loadMore();});
  expect(result.current.posts).toHaveLength(120);await act(async()=>{await result.current.nextBatch();});
  expect(result.current.posts).toHaveLength(12);expect(result.current.posts[0].id).toBe(posts[120].id);expect(result.current.batchIndex).toBe(1);
  await act(async()=>{await result.current.previousBatch();});expect(result.current.posts).toHaveLength(120);expect(result.current.posts[0].id).toBe(posts[0].id);
});
it('preserves cards on failure or cursor expiration and restarts only on request',async()=>{
  const search=vi.fn().mockImplementationOnce(page).mockResolvedValueOnce({status:'cursor-expired'}).mockRejectedValueOnce(new Error('offline')).mockImplementation(page);
  const {result}=renderHook(usePublicationFeed,{initialProps:{search} as unknown as LoungeRepository});await waitFor(()=>expect(result.current.posts).toHaveLength(12));
  await act(async()=>{await result.current.loadMore();});expect(result.current.stale).toBe('cursor-expired');expect(result.current.posts).toHaveLength(12);expect(search).toHaveBeenCalledTimes(2);
  await act(async()=>{await result.current.refresh();});expect(result.current.error).not.toBe('');expect(result.current.posts).toHaveLength(12);
  await act(async()=>{await result.current.refresh();});expect(result.current.stale).toBeNull();expect(result.current.error).toBe('');
});
it('never quietly replaces a searched or expanded list and discards a refresh after interaction begins',async()=>{
  let finish!:(value:FeedPage)=>void;const search=vi.fn().mockImplementationOnce(page).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockImplementation(page);
  const {result}=renderHook(usePublicationFeed,{initialProps:{search} as unknown as LoungeRepository});await waitFor(()=>expect(result.current.posts).toHaveLength(12));
  let safe=true;let request!:Promise<void>;act(()=>{request=result.current.quietRefresh(()=>safe);});safe=false;
  await act(async()=>{finish({status:'ok',items:[],nextCursor:null,asOf:time,rankedAt:null});await request;});expect(result.current.posts).toHaveLength(12);
  await act(async()=>{await result.current.loadMore();});const calls=search.mock.calls.length;
  await act(async()=>{await result.current.quietRefresh(()=>true);});expect(search).toHaveBeenCalledTimes(calls);
});
it('restores the previous query batch and scroll position through browser back',async()=>{
  const search=vi.fn(page),{result}=renderHook(usePublicationFeed,{initialProps:{search} as unknown as LoungeRepository});
  await waitFor(()=>expect(result.current.posts).toHaveLength(12));await act(async()=>{await result.current.loadMore();});
  vi.stubGlobal('scrollY',900);act(()=>result.current.apply({...DEFAULT_FEED_QUERY,q:'금'}));await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.posts).toHaveLength(12);await act(async()=>{await result.current.loadMore();});act(()=>history.back());
  await waitFor(()=>expect(result.current.query.q).toBe(''));await waitFor(()=>expect(result.current.posts).toHaveLength(24));
  await waitFor(()=>expect(window.scrollTo).toHaveBeenLastCalledWith({top:900}));
  act(()=>history.forward());await waitFor(()=>expect(result.current.query.q).toBe('금'));await waitFor(()=>expect(result.current.posts).toHaveLength(24));vi.unstubAllGlobals();
});
it('clears the previous account feed if the new account read fails',async()=>{
  const first={search:vi.fn(page)} as unknown as LoungeRepository,second={search:vi.fn().mockRejectedValue(new Error('new account offline'))} as unknown as LoungeRepository;
  const {result,rerender}=renderHook(usePublicationFeed,{initialProps:first});await waitFor(()=>expect(result.current.posts).toHaveLength(12));
  rerender(second);await waitFor(()=>expect(result.current.error).not.toBe(''));expect(result.current.posts).toEqual([]);
});
