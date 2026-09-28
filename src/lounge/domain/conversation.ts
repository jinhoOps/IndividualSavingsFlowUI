import {parseCommentBody} from './community';
import {parseNickname} from './profile';
import {publicationId} from './publication';

export interface MentionRange {start:number; end:number; publicId:string; label:string}
export interface MentionCandidate {publicId:string; nickname:string}
export interface ResolvedMention extends MentionRange {currentNickname:string}
export interface CommentWrite {
  id:string; postId:string; rootId:string|null; replyToId:string|null;
  body:string; mentions:MentionRange[];
}
export interface ConversationComment {
  id:string; rootId:string|null; replyToId:string|null; author:MentionCandidate|null;
  body:string; mentions:ResolvedMention[]; createdAt:string; deleted:boolean; isMine:boolean; replyCount:number;
}
export interface ConversationCursor {id:string; createdAt:string}
export interface ConversationPage {comments:ConversationComment[]; nextCursor:ConversationCursor|null}
export interface CommentContext {
  postId:string; root:ConversationComment; page:ConversationPage; targetId:string;
  previousCursor:ConversationCursor|null;
}
const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==='object' && !Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).sort().join(',')===[...expected].sort().join(',');
const timestamp=(v:unknown):v is string=>typeof v==='string' && Number.isFinite(Date.parse(v));
const nullableId=(v:unknown):v is string|null=>v===null || publicationId(v);

export function parseMentionCandidate(value:unknown):MentionCandidate|null {
  if(!record(value) || !keys(value,['publicId','nickname']) || !publicationId(value.publicId)
    || typeof value.nickname!=='string' || parseNickname(value.nickname)!==value.nickname)return null;
  return {publicId:value.publicId,nickname:value.nickname};
}
export function parseMentionCandidates(value:unknown):MentionCandidate[]|null {
  if(!Array.isArray(value) || value.length>5)return null;
  const parsed=value.map(parseMentionCandidate);
  if(parsed.some(v=>!v) || new Set(parsed.map(v=>v?.publicId)).size!==parsed.length)return null;
  return parsed as MentionCandidate[];
}
export function parseConversationCursor(value:unknown):ConversationCursor|null {
  if(!record(value) || !keys(value,['id','createdAt']) || !publicationId(value.id) || !timestamp(value.createdAt))return null;
  return {id:value.id,createdAt:value.createdAt};
}
function mentions(value:unknown,body:string,resolved:false):MentionRange[]|null;
function mentions(value:unknown,body:string,resolved:true):ResolvedMention[]|null;
function mentions(value:unknown,body:string,resolved:boolean):Array<MentionRange|ResolvedMention>|null {
  if(!Array.isArray(value) || value.length>3 || new TextEncoder().encode(JSON.stringify(value)).length>1024)return null;
  const result:Array<MentionRange|ResolvedMention>=[];
  const chars=[...body];
  for(const item of value) {
    if(!record(item) || !keys(item,['start','end','publicId','label',...(resolved?['currentNickname']:[])])
      || !Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end)
      || Number(item.start)<0 || Number(item.end)<=Number(item.start) || Number(item.end)>chars.length
      || !publicationId(item.publicId) || typeof item.label!=='string' || parseNickname(item.label)!==item.label
      || chars.slice(Number(item.start),Number(item.end)).join('')!==`@${item.label}`
      || result.some(old=>old.publicId===item.publicId || Number(item.start)<old.end && Number(item.end)>old.start))return null;
    if(resolved && (typeof item.currentNickname!=='string' || parseNickname(item.currentNickname)!==item.currentNickname))return null;
    result.push({start:Number(item.start),end:Number(item.end),publicId:item.publicId,label:item.label,
      ...(resolved?{currentNickname:item.currentNickname as string}:{})});
  }
  return result;
}
export function parseCommentWrite(value:unknown):CommentWrite|null {
  if(!record(value) || !keys(value,['id','postId','rootId','replyToId','body','mentions'])
    || !publicationId(value.id) || !publicationId(value.postId) || !nullableId(value.rootId) || !nullableId(value.replyToId)
    || (value.rootId===null)!==(value.replyToId===null) || value.id===value.rootId || value.id===value.replyToId
    || typeof value.body!=='string' || parseCommentBody(value.body)!==value.body)return null;
  const parsed=mentions(value.mentions,value.body,false);
  return parsed?{id:value.id,postId:value.postId,rootId:value.rootId,replyToId:value.replyToId,body:value.body,mentions:parsed}:null;
}
export function parseConversationComment(value:unknown):ConversationComment|null {
  if(!record(value) || !keys(value,['id','rootId','replyToId','author','body','mentions','createdAt','deleted','isMine','replyCount'])
    || !publicationId(value.id) || !nullableId(value.rootId) || !nullableId(value.replyToId)
    || (value.rootId===null)!==(value.replyToId===null) || value.rootId===value.id || value.replyToId===value.id
    || !timestamp(value.createdAt) || typeof value.deleted!=='boolean' || typeof value.isMine!=='boolean'
    || !Number.isSafeInteger(value.replyCount) || Number(value.replyCount)<0 || Number(value.replyCount)>500
    || (value.rootId!==null && value.replyCount!==0) || typeof value.body!=='string')return null;
  const author=value.author===null?null:parseMentionCandidate(value.author);
  if(value.deleted) {
    if(value.body!=='' || value.author!==null || value.isMine || !Array.isArray(value.mentions) || value.mentions.length)return null;
  } else if(!author || !parseCommentBody(value.body) || [...value.body].length>500 || new TextEncoder().encode(value.body).length>2000)return null;
  const parsed=mentions(value.mentions,value.body,true);
  if(!parsed)return null;
  return {id:value.id,rootId:value.rootId,replyToId:value.replyToId,author,body:value.body,mentions:parsed,
    createdAt:value.createdAt,deleted:value.deleted,isMine:value.isMine,replyCount:Number(value.replyCount)};
}
export function parseConversationPage(value:unknown,max=20):ConversationPage|null {
  if(!record(value) || !keys(value,['comments','nextCursor']) || !Array.isArray(value.comments) || value.comments.length>max)return null;
  const comments=value.comments.map(parseConversationComment);
  const cursor=value.nextCursor===null?null:parseConversationCursor(value.nextCursor);
  if(comments.some(v=>!v) || new Set(comments.map(v=>v?.id)).size!==comments.length || value.nextCursor!==null && !cursor)return null;
  if(cursor && !comments.some(c=>c?.id===cursor.id && c.createdAt===cursor.createdAt))return null;
  return {comments:comments as ConversationComment[],nextCursor:cursor};
}
export function parseCommentContext(value:unknown):CommentContext|null {
  if(!record(value) || !keys(value,['postId','root','page','targetId','previousCursor'])
    || !publicationId(value.postId) || !publicationId(value.targetId))return null;
  const root=parseConversationComment(value.root),page=parseConversationPage(value.page,10);
  const previous=value.previousCursor===null?null:parseConversationCursor(value.previousCursor);
  if(!root || root.rootId!==null || !page || value.previousCursor!==null && !previous
    || page.comments.some(c=>c.rootId!==root.id)
    || (value.targetId===root.id?root.deleted:!page.comments.some(c=>c.id===value.targetId && !c.deleted)))return null;
  return {postId:value.postId,root,page,targetId:value.targetId,previousCursor:previous};
}
