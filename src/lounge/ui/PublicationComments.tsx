import {useContext, useEffect, useImperativeHandle, useRef, useState, type Ref} from 'react';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import {parseCommentBody, type CommentCursor, type CommentPage, type CommunitySummary} from '../domain/community';
import type {Publication} from '../domain/publication';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';
import {useLoungeRefresh} from './useLoungeRefresh';

export interface CommentNavigation {canClose():boolean}
export function PublicationComments({repository,post,onSummary,onBack,onClose,requestClose,navigationRef,onBusyChange}: {
  repository:LoungeRepository; post:Publication; onSummary(summary:CommunitySummary):void;
  onBack():void; onClose():void; requestClose():void; navigationRef:Ref<CommentNavigation>; onBusyChange(busy:boolean):void;
}) {
  const account=useContext(AccountManagementContext);
  const [page,setPage]=useState<CommentPage|null>(null);
  const [index,setIndex]=useState(0);
  const [loading,setLoading]=useState(true);
  const [readError,setReadError]=useState('');
  const [writeError,setWriteError]=useState('');
  const [notice,setNotice]=useState('');
  const [body,setBody]=useState('');
  const [pending,setPending]=useState(false);
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [discard,setDiscard]=useState<'close'|'back'|null>(null);
  const approved=useRef(false);
  const lock=useRef(false);
  const mounted=useRef(true);
  const sequence=useRef(0);
  const cursors=useRef<Array<CommentCursor|undefined>>([undefined]);
  const attemptedPage=useRef(0);
  const attempt=useRef<{id:string;body:string}|null>(null);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const listRef=useRef<HTMLOListElement>(null);
  const dirty=body.trim().length>0;
  const refreshBlocked=useRef(false);
  refreshBlocked.current=loading || pending || dirty || Boolean(deleteId) || Boolean(discard) || Boolean(readError) || index>0;
  function canRefresh() {
    return !refreshBlocked.current && document.visibilityState!=='hidden' &&
      (listRef.current?.closest('[data-surface-body]')?.scrollTop??0)<=1 && !listRef.current?.contains(document.activeElement);
  }
  useLoungeRefresh(async()=>{
    if(!canRefresh())return;
    const token=sequence.current;
    try {
      const next=await repository.listComments(post.id);
      if(mounted.current && token===sequence.current && canRefresh()) {
        setPage(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
      }
    } catch { /* Preserve the visible page and draft when a background read fails. */ }
  });
  useUncommittedInput(dirty && !approved.current);
  useEffect(()=>{onBusyChange(pending);},[pending,onBusyChange]);
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  useEffect(()=>{
    mounted.current=true;void loadPage(0);
    inputRef.current?.closest('.responsive-dialog__layout')?.querySelector<HTMLButtonElement>('[data-dialog-initial-focus]')?.focus({preventScroll:true});
    return()=>{mounted.current=false;sequence.current++;};
  },[post.id,repository]);
  useImperativeHandle(navigationRef,()=>({canClose(){
    if(lock.current) return false;
    if(dirty && !approved.current){setDiscard('close');return false;}
    return true;
  }}));
  async function loadPage(nextIndex:number,focusList=false):Promise<void> {
    const token=++sequence.current;attemptedPage.current=nextIndex;setLoading(true);setReadError('');
    try {
      const result=await repository.listComments(post.id,cursors.current[nextIndex]);
      if(!mounted.current || token!==sequence.current) return;
      if(nextIndex>0 && result.comments.length===0){await loadPage(nextIndex-1,focusList);return;}
      setPage(result);setIndex(nextIndex);
      if(focusList) requestAnimationFrame(()=>{
        listRef.current?.closest('[data-surface-body]')?.scrollTo({top:0});
        listRef.current?.focus({preventScroll:true});
      });
    } catch(error){if(mounted.current && token===sequence.current) setReadError(loungeErrorMessage(error));}
    finally{if(mounted.current && token===sequence.current) setLoading(false);}
  }
  function back(){if(lock.current)return;if(dirty){setDiscard('back');return;}onBack();}
  async function submit(){
    const safe=parseCommentBody(body);
    if(lock.current || !safe || account?.readOnly)return;
    if(attempt.current?.body!==safe) attempt.current={id:crypto.randomUUID(),body:safe};
    lock.current=true;setPending(true);setWriteError('');setNotice('');
    try {
      const saved=await repository.addComment(post.id,attempt.current.id,safe);
      if(!mounted.current)return;
      onSummary(saved.summary);setBody('');attempt.current=null;setNotice('댓글을 남겼어요.');
      cursors.current=[undefined];await loadPage(0,true);
      requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true}));
    } catch(error){if(mounted.current)setWriteError(loungeErrorMessage(error));}
    finally{lock.current=false;if(mounted.current)setPending(false);}
  }
  async function remove(id:string){
    if(lock.current || account?.readOnly)return;
    lock.current=true;setPending(true);setWriteError('');setNotice('');
    try {
      const summary=await repository.removeComment(post.id,id);
      if(!mounted.current)return;
      onSummary(summary);setDeleteId(null);setNotice('댓글을 삭제했어요.');await loadPage(index,true);
    } catch(error){if(mounted.current)setWriteError(loungeErrorMessage(error));}
    finally{lock.current=false;if(mounted.current)setPending(false);}
  }
  return <ResponsiveDialogLayout title={discard?'작성 중인 댓글을 닫을까요?':'댓글'} titleId="lounge-detail-title"
    onClose={onClose} onBack={discard?()=>setDiscard(null):back} layout={discard?'confirm':'edit'}
    context={!discard?<p className="community-post-title">{post.title}</p>:undefined}
    status={writeError?<p role="alert">{writeError}</p>:notice?<p role="status">{notice}</p>:undefined}
    footer={discard?<ResponsiveDialogActionRow>
      <button className="ui-button ui-button--secondary" onClick={()=>{setDiscard(null);requestAnimationFrame(()=>inputRef.current?.focus());}}>계속 작성</button>
      <button className="ui-button ui-button--primary" onClick={()=>{approved.current=true;if(discard==='back')onBack();else requestClose();}}>그만두기</button>
    </ResponsiveDialogActionRow>:<form className="community-compose" onSubmit={event=>{event.preventDefault();void submit();}}>
      <label htmlFor="lounge-comment-input">댓글 남기기</label>
      <textarea ref={inputRef} id="lounge-comment-input" value={body} rows={2} maxLength={1000} disabled={pending || account?.readOnly}
        aria-describedby="lounge-comment-length" onChange={event=>{setBody(event.target.value);setNotice('');}} />
      <div><span id="lounge-comment-length" className="lounge-muted">{[...body].length} / 500</span>
        <button type="submit" className="ui-button ui-button--primary" disabled={pending || !parseCommentBody(body) || account?.readOnly}>{pending?'저장 중…':'등록'}</button></div>
    </form>}>
    {discard?<p>아직 등록하지 않은 댓글이 사라져요.</p>:<>
      {loading?<p role="status" className="lounge-muted">댓글을 불러오고 있어요…</p>:null}
      {readError?<div role="alert"><p>{readError}</p><button className="ui-button ui-button--secondary" disabled={loading} onClick={()=>void loadPage(attemptedPage.current)}>다시 불러오기</button></div>:null}
      {!loading && !readError && page?.comments.length===0?<p className="community-comments-empty">첫 댓글을 남겨 보세요.</p>:null}
      <ol ref={listRef} tabIndex={-1} className="community-comment-list" aria-label="댓글 목록" aria-busy={loading}>
        {page?.comments.map(comment=><li key={comment.id}>
          <div className="community-comment-meta"><strong>{comment.nickname}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>
          <p>{comment.body}</p>
          {comment.isMine?<div className="community-comment-actions">{deleteId===comment.id?<>
            <span>댓글을 삭제할까요?</span><button className="ui-button ui-button--quiet" disabled={pending} onClick={()=>setDeleteId(null)}>유지</button>
            <button className="ui-button ui-button--quiet" disabled={pending || account?.readOnly} onClick={()=>void remove(comment.id)}>삭제하기</button>
          </>:<button className="ui-button ui-button--quiet" disabled={pending || account?.readOnly} aria-label={`${comment.nickname} 댓글 삭제`} onClick={()=>setDeleteId(comment.id)}>삭제</button>}</div>:null}
        </li>)}
      </ol>
      {page && (index>0 || page.hasMore)?<nav className="community-pagination" aria-label="댓글 페이지">
        <button className="ui-button ui-button--quiet" disabled={index===0 || loading || pending} onClick={()=>void loadPage(index-1,true)}>이전</button>
        <span aria-label={`댓글 ${index+1}페이지`}>{index+1}</span>
        <button className="ui-button ui-button--quiet" disabled={!page.hasMore || loading || pending} onClick={()=>{
          const last=page.comments.at(-1);if(!last)return;cursors.current[index+1]={id:last.id,createdAt:last.createdAt};void loadPage(index+1,true);
        }}>다음</button>
      </nav>:null}
    </>}
  </ResponsiveDialogLayout>;
}
