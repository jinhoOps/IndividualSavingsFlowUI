import {parseCommentBody, isEmojiId, type EmojiId, type CommunitySummary} from '../../src/lounge/domain/community';
import type {LoungeNotification} from '../../src/lounge/domain/notifications';
import type {CommentWrite,ConversationComment,ConversationCursor,MentionRange} from '../../src/lounge/domain/conversation';
import type {Publication} from '../../src/lounge/domain/publication';

export const COMMUNITY_OPERATIONS = ['get_lounge_community','set_lounge_reaction','list_lounge_comments','add_lounge_comment','delete_lounge_comment','list_lounge_threads_v2','list_lounge_replies_v2','get_lounge_comment_context','add_lounge_comment_v2','delete_lounge_comment_v2','find_lounge_mention_targets','get_lounge_unread_count','list_lounge_notifications','read_lounge_notifications'];
export function loungeCommunityFixture(publications:Map<string,{owner:string;post:Publication}>,profiles:Map<string,{nickname:string}>) {
  const notifications=new Map<string,LoungeNotification & {recipient:string}>();
  const reactions=new Map<string,Map<EmojiId,Set<string>>>();
  const comments=new Map<string,{postId:string;owner:string;body:string;createdAt:string;rootId?:string|null;replyToId?:string|null;mentions?:MentionRange[];deleted?:boolean}>();
  const requests:Array<{operation:string;args:Record<string,unknown>}> = [];
  const summary=(postId:string,user:string):CommunitySummary=>{
    const groups=[...(reactions.get(postId)??[])].filter(([,users])=>users.size>0);
    return {postId,reactions:groups.map(([emoji,users])=>({emoji,count:users.size,mine:users.has(user)})),
      uniqueReactors:new Set(groups.flatMap(([,users])=>[...users])).size,commentCount:[...comments.values()].filter(c=>c.postId===postId && !c.deleted).length};
  };
  const view=(id:string,comment:NonNullable<ReturnType<typeof comments.get>>,user:string)=>({id,nickname:profiles.get(comment.owner)!.nickname,
    body:comment.body,createdAt:comment.createdAt,isMine:comment.owner===user});
  const publicId=(owner:string)=>`f${owner.slice(1)}`;
  const viewV2=(id:string,c:NonNullable<ReturnType<typeof comments.get>>,user:string):ConversationComment=>({id,rootId:c.rootId??null,replyToId:c.replyToId??null,
    author:c.deleted?null:{publicId:publicId(c.owner),nickname:profiles.get(c.owner)!.nickname},body:c.deleted?'':c.body,
    mentions:(c.mentions??[]).map(m=>({...m,currentNickname:[...profiles].find(([owner])=>publicId(owner)===m.publicId)?.[1].nickname??m.label})),
    createdAt:c.createdAt,deleted:Boolean(c.deleted),isMine:!c.deleted && c.owner===user,replyCount:[...comments.values()].filter(v=>v.rootId===id && !v.deleted).length});
  const compare=([a,x]:[string,{createdAt:string}],[b,y]:[string,{createdAt:string}])=>x.createdAt.localeCompare(y.createdAt)||a.localeCompare(b);
  const context=(postId:string,id:string,user:string)=>{
    const c=comments.get(id);if(!c || c.deleted || c.postId!==postId)return null;
    const rootId=c.rootId??id,root=comments.get(rootId)!;
    const all=[...comments].filter(([,v])=>v.rootId===rootId).sort(compare);
    const index=all.findIndex(([key])=>key===id),start=index<0?0:Math.max(0,index-9),items=all.slice(start,index<0?10:index+1);
    const last=items.at(-1),first=items[0];
    return {postId,root:viewV2(rootId,root,user),page:{comments:items.map(([key,v])=>viewV2(key,v,user)),nextCursor:last && all.at(-1)?.[0]!==last[0]?{id:last[0],createdAt:last[1].createdAt}:null},targetId:id,
      previousCursor:start>0?{id:first[0],createdAt:first[1].createdAt}:null};
  };
  return {notifications,reactions,comments,requests,summary,readFailure:false,writeFailure:false,loseResponse:false,
    reply(operation:string,args:Record<string,unknown>,user:string):unknown {
      const unread=[...notifications.values()].filter(n=>n.recipient===user && !n.read);
      const unreadState={unreadCount:unread.length,readCutoff:new Date().toISOString()};
      if(operation==='get_lounge_unread_count')return unreadState;
      if(operation==='list_lounge_notifications'){
        const cursor=args.p_cursor as ConversationCursor|null;
        const all=[...notifications.values()].filter(n=>n.recipient===user && (!args.p_unread_only || !n.read))
          .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))
          .filter(n=>!cursor || n.createdAt<cursor.createdAt || n.createdAt===cursor.createdAt && n.id<cursor.id);
        const items=all.slice(0,20).map(({recipient:_,...item})=>item),last=items.at(-1);
        return {...unreadState,readIds:unread.map(n=>n.id),items,nextCursor:all.length>20 && last?{id:last.id,createdAt:last.createdAt}:null};
      }
      if(operation==='read_lounge_notifications'){
        for(const id of args.p_ids as string[]){const item=notifications.get(id);if(item?.recipient===user && (!args.p_cutoff || item.createdAt<=String(args.p_cutoff)))notifications.set(id,{...item,read:true});}
        return {...unreadState,unreadCount:[...notifications.values()].filter(n=>n.recipient===user && !n.read).length};
      }
      const write=args.p_input as CommentWrite|undefined;const postId=String(write?.postId??args.p_post_id);
      if(operation==='get_lounge_community') return (args.p_post_ids as string[]).filter(id=>publications.has(id)).map(id=>summary(id,user));
      if(!publications.has(postId)) return operation.startsWith('list_') || operation==='get_lounge_comment_context'?null:{status:'missing'};
      if(operation==='set_lounge_reaction') {
        if(!isEmojiId(args.p_emoji))return {status:'invalid'};
        const groups=reactions.get(postId)??new Map<EmojiId,Set<string>>();
        const users=groups.get(args.p_emoji)??new Set<string>();
        if(args.p_active && !groups.has(args.p_emoji) && groups.size>=8)return {status:'reaction-limit',summary:summary(postId,user)};
        if(args.p_active)users.add(user);else users.delete(user);
        if(users.size)groups.set(args.p_emoji,users);else groups.delete(args.p_emoji);
        reactions.set(postId,groups);return {status:'saved',summary:summary(postId,user)};
      }
      if(operation==='list_lounge_comments') {
        const list=[...comments].filter(([,c])=>c.postId===postId).sort(([a,x],[b,y])=>y.createdAt.localeCompare(x.createdAt)||b.localeCompare(a))
          .filter(([id,c])=>!args.p_before_time || c.createdAt<String(args.p_before_time) || (c.createdAt===args.p_before_time && id<String(args.p_before_id)));
        return {comments:list.slice(0,20).map(([id,c])=>view(id,c,user)),hasMore:list.length>20};
      }
      if(operation==='find_lounge_mention_targets')return [...profiles].filter(([,p])=>!args.p_query || p.nickname.toLowerCase().startsWith(String(args.p_query).toLowerCase())).slice(0,5).map(([owner,p])=>({publicId:publicId(owner),nickname:p.nickname}));
      if(operation==='list_lounge_threads_v2' || operation==='list_lounge_replies_v2'){
        const replies=operation==='list_lounge_replies_v2',older=args.p_direction==='older',cursor=args.p_cursor as ConversationCursor|null;
        let list=[...comments].filter(([,v])=>v.postId===postId && (replies?v.rootId===args.p_root_id:!v.rootId));
        list.sort(compare);if(!replies || older)list.reverse();
        if(cursor)list=list.filter(([id,v])=>{const delta=v.createdAt.localeCompare(cursor.createdAt)||id.localeCompare(cursor.id);return replies && !older?delta>0:delta<0;});
        const limit=replies?10:20,items=list.slice(0,limit),last=items.at(-1);
        if(replies && older)items.reverse();
        return {comments:items.map(([id,v])=>viewV2(id,v,user)),nextCursor:list.length>limit && last?{id:last[0],createdAt:last[1].createdAt}:null};
      }
      if(operation==='get_lounge_comment_context')return context(postId,String(args.p_comment_id),user);
      if(operation==='add_lounge_comment_v2' && write){
        const old=comments.get(write.id);
        if(write.replyToId && (!comments.has(write.replyToId) || comments.get(write.replyToId)?.deleted))return {status:'missing'};
        if(old && (old.owner!==user || old.body!==write.body || old.rootId!==write.rootId))return {status:'conflict'};
        const value=old??{postId,owner:user,body:write.body,createdAt:new Date().toISOString(),rootId:write.rootId,replyToId:write.replyToId,mentions:write.mentions};
        comments.set(write.id,value);return {status:'saved',comment:viewV2(write.id,value,user),summary:summary(postId,user),context:context(postId,write.id,user)};
      }
      if(operation==='delete_lounge_comment_v2'){
        const id=String(args.p_id),comment=comments.get(id);if(comment && comment.owner!==user)return {status:'forbidden'};
        if([...comments.values()].some(v=>v.rootId===id || v.replyToId===id)){if(comment)comments.set(id,{...comment,deleted:true,body:'',mentions:[]});}else comments.delete(id);
        return {status:'deleted',summary:summary(postId,user)};
      }
      const id=String(args.p_id);
      if(operation==='add_lounge_comment') {
        const body=parseCommentBody(args.p_body);if(!body)return {status:'invalid'};
        const current=comments.get(id);
        if(current && (current.owner!==user || current.postId!==postId || current.body!==body))return {status:'conflict'};
        const comment=current??{postId,owner:user,body,createdAt:new Date().toISOString()};
        comments.set(id,comment);return {status:'saved',comment:view(id,comment,user),summary:summary(postId,user)};
      }
      if(operation==='delete_lounge_comment') {
        const comment=comments.get(id);if(comment && comment.owner!==user)return {status:'forbidden'};
        comments.delete(id);return {status:'deleted',summary:summary(postId,user)};
      }
      throw new Error('Unknown community fixture operation');
    },
  };
}
