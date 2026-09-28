import {parseCommentWrite,parseConversationComment,parseConversationPage,parseCommentContext,parseConversationCursor,parseMentionCandidates,
  type CommentWrite,type ConversationComment,type ConversationPage,type ConversationCursor,type CommentContext,type MentionCandidate} from '../domain/conversation';
import {parseNotificationPage,parseUnreadState,type NotificationPage,type UnreadState} from '../domain/notifications';
import {parseCommunitySummary,type CommunitySummary} from '../domain/community';
import {publicationId} from '../domain/publication';
import {LoungeError} from './loungeErrors';

export interface ConversationRepository {
  listThreads(postId:string,cursor?:ConversationCursor):Promise<ConversationPage>;
  listReplies(postId:string,rootId:string,cursor?:ConversationCursor,direction?:'older'|'newer'):Promise<ConversationPage>;
  getCommentContext(postId:string,commentId:string):Promise<CommentContext|null>;
  addConversationComment(input:CommentWrite):Promise<{comment:ConversationComment;summary:CommunitySummary;context:CommentContext}>;
  removeConversationComment(postId:string,id:string):Promise<CommunitySummary>;
  findMentionTargets(postId:string,query:string):Promise<MentionCandidate[]>;
  listNotifications(unreadOnly:boolean,cursor?:ConversationCursor):Promise<NotificationPage>;
  getUnreadCount():Promise<UnreadState>;
  readNotifications(ids:string[],cutoff:string|null):Promise<UnreadState>;
}
const required=<T>(value:T|null):T=>{if(value===null)throw new LoungeError('invalid');return value;};
function validateIds(...ids:string[]){if(!ids.every(publicationId))throw new LoungeError('invalid');}
function cursorValue(cursor?:ConversationCursor){return cursor===undefined?null:required(parseConversationCursor(cursor));}
function failure(status:unknown):never {
  throw new LoungeError(status==='missing' || status==='forbidden' || status==='conflict' || status==='full' || status==='rate-limited'
    || status==='comment-limit' || status==='profile-required' || status==='mention-changed'?status:'invalid');
}
export function createConversationRepository(rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>):ConversationRepository {
  const summary=(value:unknown,postId:string)=>{
    const parsed=required(parseCommunitySummary(value));if(parsed.postId!==postId)throw new LoungeError('invalid');return parsed;
  };
  return {
    async listThreads(postId,cursor){
      validateIds(postId);const data=await rpc('list_lounge_threads_v2',{p_post_id:postId,p_cursor:cursorValue(cursor)});
      if(data===null)throw new LoungeError('missing');
      const page=required(parseConversationPage(data));if(page.comments.some(c=>c.rootId!==null))throw new LoungeError('invalid');return page;
    },
    async listReplies(postId,rootId,cursor,direction='newer'){
      validateIds(postId,rootId);if(!['older','newer'].includes(direction))throw new LoungeError('invalid');
      const data=await rpc('list_lounge_replies_v2',{p_post_id:postId,p_root_id:rootId,p_cursor:cursorValue(cursor),p_direction:direction});
      if(data===null)throw new LoungeError('missing');
      const page=required(parseConversationPage(data,10));if(page.comments.some(c=>c.rootId!==rootId))throw new LoungeError('invalid');return page;
    },
    async getCommentContext(postId,commentId){
      validateIds(postId,commentId);const data=await rpc('get_lounge_comment_context',{p_post_id:postId,p_comment_id:commentId});
      if(data===null)return null;
      const context=required(parseCommentContext(data));
      if(context.postId!==postId || context.targetId!==commentId)throw new LoungeError('invalid');return context;
    },
    async addConversationComment(input){
      const safe=required(parseCommentWrite(input));
      const data=await rpc('add_lounge_comment_v2',{p_input:safe}) as {status?:unknown;comment?:unknown;summary?:unknown;context?:unknown};
      if(data?.status!=='saved')return failure(data?.status);
      const comment=required(parseConversationComment(data.comment)),context=required(parseCommentContext(data.context));
      if(comment.id!==safe.id || !comment.isMine || comment.rootId!==safe.rootId || comment.replyToId!==safe.replyToId
        || context.postId!==safe.postId || context.targetId!==comment.id)throw new LoungeError('invalid');
      return {comment,summary:summary(data.summary,safe.postId),context};
    },
    async removeConversationComment(postId,id){
      validateIds(postId,id);const data=await rpc('delete_lounge_comment_v2',{p_post_id:postId,p_id:id}) as {status?:unknown;summary?:unknown};
      if(data?.status!=='deleted')return failure(data?.status);return summary(data.summary,postId);
    },
    async findMentionTargets(postId,query){
      validateIds(postId);if(typeof query!=='string' || [...query].length>20 || /[\u0000-\u001f\u007f]/.test(query))throw new LoungeError('invalid');
      return required(parseMentionCandidates(await rpc('find_lounge_mention_targets',{p_post_id:postId,p_query:query.normalize('NFC').trim()})));
    },
    async listNotifications(unreadOnly,cursor){
      if(typeof unreadOnly!=='boolean')throw new LoungeError('invalid');
      return required(parseNotificationPage(await rpc('list_lounge_notifications',{p_unread_only:unreadOnly,p_cursor:cursorValue(cursor)})));
    },
    async getUnreadCount(){return required(parseUnreadState(await rpc('get_lounge_unread_count',{})));},
    async readNotifications(ids,cutoff){
      if(!Array.isArray(ids) || ids.length>100 || new Set(ids).size!==ids.length || !ids.every(publicationId)
        || cutoff!==null && (typeof cutoff!=='string' || !Number.isFinite(Date.parse(cutoff))))throw new LoungeError('invalid');
      return required(parseUnreadState(await rpc('read_lounge_notifications',{p_ids:ids,p_cutoff:cutoff})));
    },
  };
}
