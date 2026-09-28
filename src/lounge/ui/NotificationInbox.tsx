import {useEffect,useRef,type MutableRefObject} from 'react';
import {ResponsiveDialogLayout} from '../../components/common/ResponsiveDialogLayout';
import type {LoungeNotification} from '../domain/notifications';
import type {LoungeNotifications} from './useLoungeNotifications';
export interface InboxPosition {id:string|null;scroll:number}
export function NotificationInbox({notifications,onClose,onOpen,position,error,opening}: {
  notifications:LoungeNotifications;onClose():void;onOpen(item:LoungeNotification):Promise<void>;
  position:MutableRefObject<InboxPosition>;error:string;opening:boolean;
}) {
  const list=useRef<HTMLOListElement>(null);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      const body=list.current?.closest('[data-surface-body]');if(body)body.scrollTop=position.current.scroll;
      const button=position.current.id?list.current?.querySelector<HTMLButtonElement>(`[data-notification-id="${position.current.id}"]`):null;
      (button??(position.current.id?list.current?.querySelector<HTMLButtonElement>('[data-notification-id]'):null)??list.current?.closest('.responsive-dialog__layout')?.querySelector<HTMLButtonElement>('[data-dialog-initial-focus]'))?.focus({preventScroll:true});
    });return()=>cancelAnimationFrame(frame);
  },[position]);
  const pending=opening || notifications.writing;
  return <ResponsiveDialogLayout title="알림함" titleId="lounge-notification-title" onClose={onClose} layout="preview"
    context={<div className="community-inbox-tools"><div className="lounge-tabs" aria-label="알림 범위">
      <button aria-pressed={!notifications.unreadOnly} disabled={pending} onClick={()=>notifications.changeFilter(false)}>전체</button>
      <button aria-pressed={notifications.unreadOnly} disabled={pending} onClick={()=>notifications.changeFilter(true)}>읽지 않음</button></div>
      <button className="community-text-action" disabled={pending || !notifications.unreadCount} onClick={()=>void notifications.markAllRead()}>모두 읽음</button></div>}
    status={error || notifications.error?<p role="alert">{error || notifications.error}</p>:undefined}
    footer={<div className="community-inbox-footer"><span>최대 30일 · 최근 100개</span>
      <button className="community-text-action" disabled={pending || notifications.loading} onClick={()=>{position.current={id:null,scroll:0};void notifications.refresh();}}>{notifications.hasNew?'새 알림 확인':'새로고침'}</button></div>}>
    {notifications.loading?<p role="status" className="lounge-muted">알림을 불러오는 중…</p>:null}
    {!notifications.loading && !notifications.error && !notifications.items.length?<p className="community-comments-empty">{notifications.unreadOnly?(notifications.unreadCount?'새 알림을 불러오려면 새로고침해 주세요.':'모든 알림을 읽었어요.'):'아직 받은 알림이 없어요.'}</p>:null}
    <ol ref={list} className="community-notifications" aria-label="알림 목록">{notifications.items.map(item=><li key={item.id}>
      <button type="button" data-notification-id={item.id} disabled={pending} data-unread={!item.read || undefined} onClick={()=>{
        position.current={id:item.id,scroll:list.current?.closest('[data-surface-body]')?.scrollTop??0};void onOpen(item);
      }}><span className="community-notification-heading"><strong>{item.actor.nickname}</strong><span>{item.kind==='mention'?'님이 나를 멘션했어요':'님이 답글을 남겼어요'}</span>
        {!item.read?<i aria-label="읽지 않음"/>:null}</span><p>{item.preview}</p>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></button></li>)}</ol>
    {notifications.nextCursor?<button className="ui-button ui-button--quiet lounge-more" disabled={pending || notifications.loading} onClick={()=>void notifications.loadMore()}>알림 더 보기</button>:null}
  </ResponsiveDialogLayout>;
}
