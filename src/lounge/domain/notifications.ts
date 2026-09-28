import {parseConversationCursor,parseMentionCandidate,type ConversationCursor,type MentionCandidate} from './conversation';
import {publicationId} from './publication';
interface NotificationContent {
  id:string; actor:MentionCandidate;
  preview:string; createdAt:string; read:boolean;
}
export type LoungeNotification = NotificationContent & (
  {postId:string;commentId:string;kind:'reply'|'mention'} | {postId:null;commentId:null;kind:'test'}
);
export interface UnreadState {unreadCount:number; readCutoff:string}
export interface NotificationPage extends UnreadState {
  items:LoungeNotification[]; nextCursor:ConversationCursor|null; readIds:string[];
}
const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==='object' && !Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).sort().join(',')===[...expected].sort().join(',');
const time=(v:unknown):v is string=>typeof v==='string' && Number.isFinite(Date.parse(v));
export function parseUnreadState(value:unknown):UnreadState|null {
  if(!record(value) || !keys(value,['unreadCount','readCutoff']) || !Number.isSafeInteger(value.unreadCount)
    || Number(value.unreadCount)<0 || Number(value.unreadCount)>100 || !time(value.readCutoff))return null;
  return {unreadCount:Number(value.unreadCount),readCutoff:value.readCutoff};
}
export function parseNotificationPage(value:unknown):NotificationPage|null {
  if(!record(value) || !keys(value,['items','nextCursor','unreadCount','readCutoff','readIds'])
    || !Array.isArray(value.items) || value.items.length>20 || !Array.isArray(value.readIds)
    || value.readIds.length>100 || !value.readIds.every(publicationId) || new Set(value.readIds).size!==value.readIds.length)return null;
  const state=parseUnreadState({unreadCount:value.unreadCount,readCutoff:value.readCutoff});
  const cursor=value.nextCursor===null?null:parseConversationCursor(value.nextCursor);
  if(!state || state.unreadCount!==value.readIds.length || value.nextCursor!==null && !cursor)return null;
  const items:LoungeNotification[]=[];
  for(const item of value.items) {
    if(!record(item) || !keys(item,['id','postId','commentId','kind','actor','preview','createdAt','read'])
      || !publicationId(item.id) || !['reply','mention','test'].includes(String(item.kind))
      || (item.kind==='test' ? item.postId!==null || item.commentId!==null : !publicationId(item.postId) || !publicationId(item.commentId))
      || !time(item.createdAt) || typeof item.read!=='boolean'
      || typeof item.preview!=='string' || [...item.preview].length>80 || items.some(i=>i.id===item.id))return null;
    const actor=parseMentionCandidate(item.actor);if(!actor)return null;
    items.push({id:item.id,postId:item.postId,commentId:item.commentId,kind:item.kind,actor,
      preview:item.preview,createdAt:item.createdAt,read:item.read} as LoungeNotification);
  }
  if(cursor && !items.some(i=>i.id===cursor.id && i.createdAt===cursor.createdAt))return null;
  return {...state,items,nextCursor:cursor,readIds:value.readIds as string[]};
}
