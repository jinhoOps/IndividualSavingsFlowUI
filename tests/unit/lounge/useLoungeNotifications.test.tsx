import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useLoungeNotifications} from '../../../src/lounge/ui/useLoungeNotifications';
import type {ConversationRepository} from '../../../src/lounge/infrastructure/conversationRepository';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',time='2026-09-28T01:00:00Z';
const item={id,postId:id,commentId:id,kind:'reply' as const,actor:{publicId:id,nickname:'투자자'},preview:'답글',createdAt:time,read:false};
const page={items:[item],nextCursor:null,unreadCount:1,readCutoff:time,readIds:[id]};
afterEach(cleanup);
function fixture(){return {getUnreadCount:vi.fn().mockResolvedValue({unreadCount:1,readCutoff:time}),listNotifications:vi.fn().mockResolvedValue(page),readNotifications:vi.fn().mockResolvedValue({unreadCount:1,readCutoff:time})};}
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
