import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useLoungeNotifications} from '../../../src/lounge/ui/useLoungeNotifications';
import type {ConversationRepository} from '../../../src/lounge/infrastructure/conversationRepository';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',time='2026-09-28T01:00:00Z';
const item={id,postId:id,commentId:id,kind:'reply' as const,actor:{publicId:id,nickname:'투자자'},preview:'답글',createdAt:time,read:false};
const page={items:[item],nextCursor:null,unreadCount:1,readCutoff:time,readIds:[id]};
let poll:()=>Promise<void>;
vi.mock('../../../src/lounge/ui/useLoungeRefresh',()=>({useLoungeRefresh:(handler:()=>Promise<void>)=>{poll=handler;}}));
afterEach(cleanup);
function fixture(){return {getUnreadCount:vi.fn().mockResolvedValue({unreadCount:1,readCutoff:time}),listNotifications:vi.fn().mockResolvedValue(page),readNotifications:vi.fn().mockResolvedValue({unreadCount:1,readCutoff:time})};}
it('keeps a newly created test badge when an older count or read request finishes late',async()=>{
  const repo=fixture();let resolveCount!:(value:unknown)=>void,resolveRead!:(value:unknown)=>void;
  repo.getUnreadCount.mockImplementation(()=>new Promise(resolve=>{resolveCount=resolve;}));
  const {result}=renderHook(()=>useLoungeNotifications(repo as unknown as ConversationRepository,true));
  await waitFor(()=>expect(result.current.items).toHaveLength(1));
  act(()=>result.current.acceptUnreadState({unreadCount:2,readCutoff:time}));
  await act(async()=>{resolveCount({unreadCount:0,readCutoff:time});});expect(result.current.unreadCount).toBe(2);
  repo.readNotifications.mockImplementation(()=>new Promise(resolve=>{resolveRead=resolve;}));
  let reading!:Promise<boolean>;act(()=>{reading=result.current.markRead(id);});
  act(()=>result.current.acceptUnreadState({unreadCount:1,readCutoff:time}));
  await act(async()=>{resolveRead({unreadCount:0,readCutoff:time});await reading;});
  expect(result.current.unreadCount).toBe(1);expect(result.current.items[0].read).toBe(true);
});
it('only loads the inbox when visible and marks the observed snapshot without losing a newer unread count',async()=>{
  const repo=fixture();const {result,rerender}=renderHook(({open})=>useLoungeNotifications(repo as unknown as ConversationRepository,open),{initialProps:{open:false}});
  await waitFor(()=>expect(result.current.unreadCount).toBe(1));expect(repo.listNotifications).not.toHaveBeenCalled();
  rerender({open:true});await waitFor(()=>expect(result.current.items).toHaveLength(1));expect(repo.readNotifications).not.toHaveBeenCalled();
  await act(async()=>{await result.current.markAllRead();});
  expect(repo.readNotifications).toHaveBeenCalledWith([id],time);expect(result.current.unreadCount).toBe(1);
  expect(result.current.items[0].read).toBe(true);
});
it('ignores a late unread response after marking read and ignores the old account after replacement',async()=>{
  let resolveCount!:(value:unknown)=>void;const repo=fixture();repo.getUnreadCount.mockImplementation(()=>new Promise(resolve=>{resolveCount=resolve;}));
  repo.readNotifications.mockResolvedValue({unreadCount:0,readCutoff:time});
  const second=fixture();second.getUnreadCount.mockResolvedValue({unreadCount:3,readCutoff:time});second.listNotifications.mockResolvedValue({...page,unreadCount:3});
  const {result,rerender}=renderHook(({repository})=>useLoungeNotifications(repository as unknown as ConversationRepository,true),{initialProps:{repository:repo}});
  await waitFor(()=>expect(result.current.items).toHaveLength(1));
  await act(async()=>{await result.current.markRead(id);resolveCount({unreadCount:99,readCutoff:time});});
  expect(result.current.unreadCount).toBe(0);
  rerender({repository:second});await waitFor(()=>expect(result.current.unreadCount).toBe(3));
  expect(result.current.error).toBe('');
});
it('serializes reads and keeps failed reads retryable',async()=>{
  const repo=fixture();repo.readNotifications.mockRejectedValueOnce(new Error('offline'));
  const {result}=renderHook(()=>useLoungeNotifications(repo as unknown as ConversationRepository,true));
  await waitFor(()=>expect(result.current.items).toHaveLength(1));
  await act(async()=>{await result.current.markRead(id);});expect(result.current.items[0].read).toBe(false);expect(result.current.error).not.toBe('');
  await act(async()=>{await Promise.all([result.current.markRead(id),result.current.markRead(id)]);});
  expect(repo.readNotifications).toHaveBeenCalledTimes(2);expect(result.current.items[0].read).toBe(true);
});
it('keeps an old account write from replacing the new account badge',async()=>{
  const first=fixture(),second=fixture();let finish!:(value:{unreadCount:number;readCutoff:string})=>void;
  first.readNotifications.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  second.getUnreadCount.mockResolvedValue({unreadCount:3,readCutoff:time});second.listNotifications.mockResolvedValue({...page,unreadCount:3});
  const {result,rerender}=renderHook(({repository})=>useLoungeNotifications(repository as unknown as ConversationRepository,true),{initialProps:{repository:first}});
  await waitFor(()=>expect(result.current.items).toHaveLength(1));
  let write!:Promise<boolean>;act(()=>{write=result.current.markRead(id);});rerender({repository:second});
  await waitFor(()=>expect(result.current.unreadCount).toBe(3));await act(async()=>{finish({unreadCount:0,readCutoff:time});await write;});
  expect(result.current.unreadCount).toBe(3);
});
it('removes explicitly read items from the unread filter',async()=>{
  const repo=fixture();const {result}=renderHook(()=>useLoungeNotifications(repo as unknown as ConversationRepository,true));
  await waitFor(()=>expect(result.current.items).toHaveLength(1));act(()=>result.current.changeFilter(true));
  await waitFor(()=>expect(repo.listNotifications).toHaveBeenLastCalledWith(true,undefined));
  await act(async()=>{await result.current.markRead(id);});expect(result.current.items).toEqual([]);
});

it('reconciles deleted and remotely read notifications across all bounded pages without inserting new rows',async()=>{
  const repo=fixture();let records=Array.from({length:25},(_,i)=>({...item,id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`}));
  repo.listNotifications.mockImplementation(async(unreadOnly:boolean,cursor?:{id:string;createdAt:string})=>{
    const all=records.filter(r=>!unreadOnly || !r.read),start=cursor?all.findIndex(r=>r.id===cursor.id)+1:0,items=all.slice(start,start+20),last=items.at(-1);
    return {...page,items,nextCursor:all.length>start+20 && last?{id:last.id,createdAt:time}:null};
  });
  const {result,rerender}=renderHook(({open})=>useLoungeNotifications(repo as unknown as ConversationRepository,open),{initialProps:{open:true}});
  await waitFor(()=>expect(result.current.items).toHaveLength(20));await act(async()=>{await result.current.loadMore();});expect(result.current.items).toHaveLength(25);
  const last=records.at(-1)!;records=records.slice(1);records[0]={...records[0],read:true};
  records.unshift({...item,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  await act(async()=>{await poll();});
  expect(result.current.items).toHaveLength(24);expect(result.current.items.at(-1)?.id).toBe(last.id);expect(result.current.items[0].read).toBe(true);expect(result.current.hasNew).toBe(true);
  act(()=>result.current.changeFilter(true));await waitFor(()=>expect(result.current.items[0].id).toBe(records[0].id));
  records[0]={...records[0],read:true};await act(async()=>{await poll();});expect(result.current.items.some(r=>r.id===records[0].id)).toBe(false);
  rerender({open:false});records=[];rerender({open:true});await waitFor(()=>expect(result.current.items).toEqual([]));
});
