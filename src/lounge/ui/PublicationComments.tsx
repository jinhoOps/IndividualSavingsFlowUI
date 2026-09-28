import { Button } from '../../components/common/Button';
import {useCallback,useContext,useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {ResponsiveDialogLayout,ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import type {CommunitySummary} from '../domain/community';
import type {CommentContext,ConversationCursor,ConversationPage} from '../domain/conversation';
import type {Publication} from '../domain/publication';
import {loungeErrorMessage,type LoungeRepository} from '../infrastructure/loungeRepository';
import {useLoungeRefresh} from './useLoungeRefresh';
import {CommentComposer,type ComposerHandle} from './CommentComposer';
import {CommentThread} from './CommentThread';

export interface CommentNavigation {canClose():boolean}
export function PublicationComments({repository,post,onSummary,onBack,onClose,requestClose,navigationRef,onBusyChange,initialCommentId,initialContext,count=0}: {
  repository:LoungeRepository;post:Publication;onSummary(summary:CommunitySummary):void;
  onBack():void;onClose():void;requestClose():void;navigationRef:Ref<CommentNavigation>;onBusyChange(busy:boolean):void;
  initialCommentId?:string;initialContext?:CommentContext;count?:number;
}) {
  const account=useContext(AccountManagementContext);
  const [page,setPage]=useState<ConversationPage|null>(null),[index,setIndex]=useState(0),[loading,setLoading]=useState(true);
  const [readError,setReadError]=useState(''),[writeError,setWriteError]=useState(''),[notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false),[composing,setComposing]=useState(false),[deleting,setDeleting]=useState(false);
  const [discard,setDiscard]=useState<'close'|'back'|null>(null),[context,setContext]=useState<CommentContext|undefined>(initialContext);
  const approved=useRef(false),lock=useRef(false),mounted=useRef(true),sequence=useRef(0);
  const cursors=useRef<Array<ConversationCursor|undefined>>([undefined]),attemptedPage=useRef(0),expanded=useRef(new Set<string>());
  const composer=useRef<ComposerHandle>(null),listRef=useRef<HTMLOListElement>(null),refreshBlocked=useRef(false);
  const pending=composing || deleting;
  refreshBlocked.current=loading || pending || dirty || Boolean(discard) || Boolean(readError) || index>0 || Boolean(context);
  const onExpanded=useCallback((id:string,open:boolean)=>{if(open)expanded.current.add(id);else expanded.current.delete(id);},[]);
  function canRefresh(){return !refreshBlocked.current && expanded.current.size===0 && document.visibilityState!=='hidden'
    && (listRef.current?.closest('[data-surface-body]')?.scrollTop??0)<=1 && !listRef.current?.contains(document.activeElement);}
  useLoungeRefresh(async()=>{
    if(!canRefresh())return;const token=sequence.current;
    try {const next=await repository.listThreads(post.id);
      if(mounted.current && token===sequence.current && canRefresh())setPage(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    }catch{/* Keep visible comments and drafts on background failure. */}
  });
  useUncommittedInput(dirty && !approved.current);
  useEffect(()=>{onBusyChange(pending);},[pending,onBusyChange]);
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  useEffect(()=>{
    mounted.current=true;void loadPage(0, false,initialCommentId);
    listRef.current?.closest('.responsive-dialog__layout')?.querySelector<HTMLButtonElement>('[data-dialog-initial-focus]')?.focus({preventScroll:true});
    return()=>{mounted.current=false;sequence.current++;};
  },[post.id,repository,initialCommentId]);
  useImperativeHandle(navigationRef,()=>({canClose(){
    if(pending || lock.current)return false;
    if(dirty && !approved.current){setDiscard('close');return false;}return true;
  }}));
  async function loadPage(nextIndex:number,focusList=false,targetId?:string):Promise<void>{
    const token=++sequence.current;attemptedPage.current=nextIndex;setLoading(true);setReadError('');
    try {
      const [result,target]=await Promise.all([repository.listThreads(post.id,cursors.current[nextIndex]),targetId?(initialContext?.targetId===targetId?initialContext:repository.getCommentContext(post.id,targetId)):undefined]);
      if(!mounted.current || token!==sequence.current)return;
      if(nextIndex>0 && result.comments.length===0){await loadPage(nextIndex-1,focusList);return;}
      setPage(result);setIndex(nextIndex);setContext(target??undefined);
      if(targetId && !target)setNotice('삭제되었거나 더 이상 볼 수 없는 댓글이에요.');
      if(focusList && !target)requestAnimationFrame(()=>{listRef.current?.closest('[data-surface-body]')?.scrollTo({top:0});listRef.current?.focus({preventScroll:true});});
    }catch(error){if(mounted.current && token===sequence.current)setReadError(loungeErrorMessage(error));}
    finally{if(mounted.current && token===sequence.current)setLoading(false);}
  }
  function back(){if(pending || lock.current)return;if(dirty){setDiscard('back');return;}onBack();}
  async function remove(id:string){
    if(lock.current || pending || account?.readOnly)return;
    lock.current=true;setDeleting(true);setWriteError('');setNotice('');
    try {
      const summary=await repository.removeConversationComment(post.id,id);if(!mounted.current)return;
      onSummary(summary);setNotice('댓글을 삭제했어요.');
      // Refresh the active reply window as well as its root after a deletion.
      await loadPage(index,true,context && context.targetId!==id?context.targetId:undefined);
    }catch(error){if(mounted.current)setWriteError(loungeErrorMessage(error));throw error;}
    finally{lock.current=false;if(mounted.current)setDeleting(false);}
  }
  const roots=page?.comments.map(root=>context?.root.id===root.id?context.root:root)??[];
  if(context && !roots.some(root=>root.id===context.root.id))roots.unshift(context.root);
  return <ResponsiveDialogLayout title={discard?'작성 중인 댓글을 닫을까요?':`댓글 ${count}`} titleId="lounge-detail-title" onClose={onClose}
    onBack={discard?()=>setDiscard(null):back} layout={discard?'confirm':'edit'} bodyClassName={discard?undefined:'community-comments-body'}
    context={!discard?<p className="community-post-title">{post.title}</p>:undefined}
    status={writeError?<p role="alert">{writeError}</p>:notice?<p role="status">{notice}</p>:undefined}
    footer={<><div hidden={Boolean(discard)}><CommentComposer composerRef={composer} repository={repository} postId={post.id} disabled={deleting || Boolean(account?.readOnly)}
      onDirtyChange={setDirty} onBusyChange={setComposing} onSaved={saved=>{
        onSummary(saved.summary);setNotice('댓글을 남겼어요.');setWriteError('');sequence.current++;setLoading(false);cursors.current=[undefined];setIndex(0);
        setContext(saved.context);setPage(previous=>({comments:saved.comment.rootId?previous?.comments??[]:[saved.comment,...(previous?.comments??[]).filter(c=>c.id!==saved.comment.id)].slice(0,20),nextCursor:previous?.nextCursor??null}));
        const token=sequence.current;void repository.listThreads(post.id).then(next=>{if(mounted.current && token===sequence.current)setPage(next);}).catch(()=>{});
      }}/></div>{discard?<ResponsiveDialogActionRow>
        <Button variant="secondary" onClick={()=>{setDiscard(null);requestAnimationFrame(()=>composer.current?.focus());}}>계속 작성</Button>
        <Button variant="primary" onClick={()=>{approved.current=true;if(discard==='back')onBack();else requestClose();}}>그만두기</Button>
      </ResponsiveDialogActionRow>:null}</>}>
    {discard?<p>아직 등록하지 않은 댓글이 사라져요.</p>:null}
    {/* Preserve reply pages and avoid replaying notification-target focus on resume. */}
    <div hidden={Boolean(discard)}>
      {loading?<p role="status" className="lounge-muted">댓글을 불러오고 있어요…</p>:null}
      {readError?<div role="alert"><p>{readError}</p><Button variant="secondary" disabled={loading} onClick={()=>void loadPage(attemptedPage.current)}>다시 불러오기</Button></div>:null}
      {!loading && !readError && roots.length===0?<p className="community-comments-empty">첫 댓글을 남겨 보세요.</p>:null}
      <ol ref={listRef} tabIndex={-1} className="community-comment-list" aria-label="댓글 목록" aria-busy={loading}>
        {roots.map(root=><CommentThread key={root.id} repository={repository} postId={post.id} root={root} context={context?.root.id===root.id?context:undefined}
          disabled={pending || Boolean(account?.readOnly)} onReply={comment=>composer.current?.replyTo(comment)} onRemove={remove} onExpanded={onExpanded}/>)}</ol>
      {page && (index>0 || page.nextCursor)?<nav className="community-pagination" aria-label="댓글 페이지">
        <Button variant="quiet" disabled={index===0 || loading || pending} onClick={()=>void loadPage(index-1,true)}>이전</Button>
        <span aria-label={`댓글 ${index+1}페이지`}>{index+1}</span>
        <Button variant="quiet" disabled={!page.nextCursor || loading || pending} onClick={()=>{
          if(!page.nextCursor)return;cursors.current[index+1]=page.nextCursor;void loadPage(index+1,true);
        }}>다음</Button></nav>:null}
    </div>
  </ResponsiveDialogLayout>;
}
