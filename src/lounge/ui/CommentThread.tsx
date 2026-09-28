import {useEffect,useRef,useState,type ReactNode} from 'react';
import {MoreHorizontal} from 'lucide-react';
import type {CommentContext,ConversationComment,ConversationCursor,ConversationPage} from '../domain/conversation';
import type {ConversationRepository} from '../infrastructure/conversationRepository';
import {loungeErrorMessage} from '../infrastructure/loungeErrors';

function CommentBody({comment}:{comment:ConversationComment}) {
  const chars=[...comment.body],parts:ReactNode[]=[];let at=0;
  for(const mention of [...comment.mentions].sort((a,b)=>a.start-b.start)){
    parts.push(chars.slice(at,mention.start).join(''));
    parts.push(<span className="community-mention" key={mention.publicId}>@{mention.currentNickname}</span>);at=mention.end;
  }
  parts.push(chars.slice(at).join(''));return <p data-comment-body="">{parts}</p>;
}
function CommentRow({comment,disabled,onReply,onRemove,highlight,replyLabel}: {
  comment:ConversationComment;disabled:boolean;onReply(comment:ConversationComment):void;onRemove(id:string):Promise<void>;highlight:boolean;replyLabel?:string;
}) {
  const [menu,setMenu]=useState(false),[confirm,setConfirm]=useState(false);
  return <article id={`comment-${comment.id}`} tabIndex={-1} className="community-comment" data-highlight={highlight || undefined} aria-label={comment.deleted?'삭제된 댓글':`${comment.author?.nickname} 댓글`}>
    {comment.deleted?<p className="lounge-muted">삭제된 댓글이에요.</p>:<>
      <div className="community-comment-meta"><strong>{comment.author?.nickname}</strong>
        <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>
        <button type="button" className="community-text-action" disabled={disabled} onClick={()=>onReply(comment)}>답글</button>
        {comment.isMine?<div className="community-comment-more"><button type="button" className="responsive-dialog__icon-button" aria-label={`${comment.author?.nickname} 댓글 더보기`}
          aria-expanded={menu} disabled={disabled} onClick={()=>{setMenu(!menu);setConfirm(false);}}><MoreHorizontal size={16}/></button>
          {menu?<div className="community-comment-menu">{confirm?<><span>댓글을 삭제할까요?</span>
            <button type="button" className="community-text-action" disabled={disabled} onClick={()=>setMenu(false)}>유지</button>
            <button type="button" className="community-text-action" disabled={disabled} onClick={()=>void onRemove(comment.id).then(()=>setMenu(false)).catch(()=>{})}>삭제하기</button>
          </>:<button type="button" className="community-text-action" disabled={disabled} onClick={()=>setConfirm(true)}>댓글 삭제</button>}</div>:null}</div>:null}
      </div>
      {replyLabel?<span className="community-reply-name">{replyLabel}</span>:null}
      <CommentBody comment={comment}/>
    </>}
  </article>;
}
export function CommentThread({repository,postId,root,context,disabled,onReply,onRemove,onExpanded}: {
  repository:ConversationRepository;postId:string;root:ConversationComment;context?:CommentContext;disabled:boolean;
  onReply(comment:ConversationComment):void;onRemove(id:string):Promise<void>;onExpanded?(id:string,open:boolean):void;
}) {
  const [expanded,setExpanded]=useState(Boolean(context && context.targetId!==root.id));
  const [page,setPage]=useState<ConversationPage|null>(context?.page??null),[previous,setPrevious]=useState<ConversationCursor|null>(context?.previousCursor??null);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const sequence=useRef(0),node=useRef<HTMLLIElement>(null);
  useEffect(()=>()=>{sequence.current++;},[]);
  useEffect(()=>{if(!context)return;
    sequence.current++;setLoading(false);setError('');setPage(context.page);setPrevious(context.previousCursor);
    if(context.targetId!==root.id)setExpanded(true);
    const frame=requestAnimationFrame(()=>{
      const target=node.current?.querySelector<HTMLElement>(`#comment-${context.targetId}`);
      target?.scrollIntoView({block:'nearest'});target?.focus({preventScroll:true});
    });return()=>cancelAnimationFrame(frame);
  },[context,root.id]);
  useEffect(()=>{onExpanded?.(root.id,expanded);return()=>onExpanded?.(root.id,false);},[expanded,root.id,onExpanded]);
  async function load(cursor?:ConversationCursor,direction:'older'|'newer'='newer'){
    const token=++sequence.current;setLoading(true);setError('');
    try {const result=await repository.listReplies(postId,root.id,cursor,direction);
      if(token!==sequence.current)return;
      setPage(result);setPrevious(direction==='older'?result.nextCursor:cursor && result.comments.length?{id:result.comments[0].id,createdAt:result.comments[0].createdAt}:null);
      // Older windows report an older cursor; the newer page begins after the window's last item.
      if(direction==='older')setPage({...result,nextCursor:result.comments.length?{id:result.comments.at(-1)!.id,createdAt:result.comments.at(-1)!.createdAt}:null});
    }catch(error){if(token===sequence.current)setError(loungeErrorMessage(error));}
    finally{if(token===sequence.current)setLoading(false);}
  }
  async function remove(id:string){await onRemove(id);if(expanded)await load();}
  function toggle(){const next=!expanded;setExpanded(next);if(next && !page)void load();}
  return <li ref={node} className="community-thread">
    <CommentRow comment={root} disabled={disabled} onReply={onReply} onRemove={remove} highlight={context?.targetId===root.id}/>
    {root.replyCount>0 || expanded?<button type="button" className="community-text-action community-thread-toggle" aria-expanded={expanded} onClick={toggle}>
      {expanded?'답글 접기':`답글 ${root.replyCount}개 보기`}</button>:null}
    {expanded?<div className="community-replies" aria-label="답글 목록" aria-busy={loading}>
      {loading?<p className="lounge-muted" role="status">답글을 불러오는 중…</p>:null}
      {error?<div role="alert">{error}<button type="button" className="community-text-action" onClick={()=>void load()}>다시 불러오기</button></div>:null}
      {previous?<button type="button" className="community-text-action" disabled={loading} onClick={()=>void load(previous,'older')}>이전 답글</button>:null}
      {page?.comments.map(comment=><CommentRow key={comment.id} comment={comment} disabled={disabled} onReply={onReply} onRemove={remove} highlight={context?.targetId===comment.id}
        replyLabel={comment.replyToId!==root.id?(comment.replyToAuthor?`${comment.replyToAuthor.nickname}님에게 답글`:'삭제된 댓글에 답글'):undefined}/>)}
      {page?.nextCursor?<button type="button" className="community-text-action" disabled={loading} onClick={()=>void load(page.nextCursor!)}>다음 답글</button>:null}
    </div>:null}
  </li>;
}
