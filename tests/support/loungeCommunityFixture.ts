import {parseCommentBody, isEmojiId, type EmojiId, type CommunitySummary} from '../../src/lounge/domain/community';
import type {Publication} from '../../src/lounge/domain/publication';

export const COMMUNITY_OPERATIONS = ['get_lounge_community','set_lounge_reaction','list_lounge_comments','add_lounge_comment','delete_lounge_comment'];
export function loungeCommunityFixture(publications:Map<string,{owner:string;post:Publication}>,profiles:Map<string,{nickname:string}>) {
  const reactions=new Map<string,Map<EmojiId,Set<string>>>();
  const comments=new Map<string,{postId:string;owner:string;body:string;createdAt:string}>();
  const requests:Array<{operation:string;args:Record<string,unknown>}> = [];
  const summary=(postId:string,user:string):CommunitySummary=>{
    const groups=[...(reactions.get(postId)??[])].filter(([,users])=>users.size>0);
    return {postId,reactions:groups.map(([emoji,users])=>({emoji,count:users.size,mine:users.has(user)})),
      uniqueReactors:new Set(groups.flatMap(([,users])=>[...users])).size,commentCount:[...comments.values()].filter(c=>c.postId===postId).length};
  };
  const view=(id:string,comment:NonNullable<ReturnType<typeof comments.get>>,user:string)=>({id,nickname:profiles.get(comment.owner)!.nickname,
    body:comment.body,createdAt:comment.createdAt,isMine:comment.owner===user});
  return {reactions,comments,requests,summary,readFailure:false,writeFailure:false,loseResponse:false,
    reply(operation:string,args:Record<string,unknown>,user:string):unknown {
      const postId=String(args.p_post_id);
      if(operation==='get_lounge_community') return (args.p_post_ids as string[]).filter(id=>publications.has(id)).map(id=>summary(id,user));
      if(!publications.has(postId)) return operation==='list_lounge_comments'?null:{status:'missing'};
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
