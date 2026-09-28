import { Button } from '../../components/common/Button';
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {X} from 'lucide-react';
import {parseCommentBody} from '../domain/community';
import type {CommentWrite,ConversationComment,MentionCandidate,MentionRange} from '../domain/conversation';
import type {ConversationRepository} from '../infrastructure/conversationRepository';
import {LoungeError,loungeErrorMessage} from '../infrastructure/loungeErrors';

type Draft={body:string;mentions:MentionRange[]};
/** Reconcile a text edit in codepoints; an edited mention becomes ordinary text. */
export function editMentionDraft(draft:Draft,body:string):Draft {
  const old=[...draft.body],next=[...body];let start=0,end=old.length,nextEnd=next.length;
  while(start<end && start<nextEnd && old[start]===next[start])start++;
  while(end>start && nextEnd>start && old[end-1]===next[nextEnd-1]){end--;nextEnd--;}
  const shift=nextEnd-end;
  return {body,mentions:draft.mentions.flatMap(m=>{
    if(m.end<=start)return [m];
    if(m.start>=end)return [{...m,start:m.start+shift,end:m.end+shift}];
    return [];
  })};
}
export function insertMention(draft:Draft,startUtf16:number,endUtf16:number,candidate:MentionCandidate):Draft {
  const before=draft.body.slice(0,startUtf16).normalize('NFC'),after=draft.body.slice(endUtf16).normalize('NFC');
  const label=`@${candidate.nickname}`,body=`${before}${label} ${after}`;
  const edited=editMentionDraft(draft,body);
  return {body,mentions:[...edited.mentions.filter(m=>m.publicId!==candidate.publicId),
    {start:[...before].length,end:[...before+label].length,publicId:candidate.publicId,label:candidate.nickname}].sort((a,b)=>a.start-b.start)};
}
export interface ComposerHandle {replyTo(comment:ConversationComment):void;focus():void}
export function CommentComposer({repository,postId,disabled,onDirtyChange,onBusyChange,onSaved,composerRef}: {
  repository:ConversationRepository;postId:string;disabled:boolean;onDirtyChange(dirty:boolean):void;onBusyChange(busy:boolean):void;
  onSaved(result:Awaited<ReturnType<ConversationRepository['addConversationComment']>>):void;composerRef?:Ref<ComposerHandle>;
}) {
  const [draft,setDraft]=useState<Draft>({body:'',mentions:[]});
  const [target,setTarget]=useState<ConversationComment|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [picker,setPicker]=useState(false),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
  const [candidates,setCandidates]=useState<MentionCandidate[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState('');
  const [active,setActive]=useState(0);
  const input=useRef<HTMLTextAreaElement>(null),search=useRef<HTMLInputElement>(null);
  const selection=useRef({start:0,end:0}),attempt=useRef<CommentWrite|null>(null),lock=useRef(false),mounted=useRef(true),generation=useRef(0);
  const textComposing=useRef(false);
  useEffect(()=>{onBusyChange(pending);},[pending,onBusyChange]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  useImperativeHandle(composerRef,()=>({replyTo(comment){setTarget(comment);setError('');input.current?.focus();},focus(){input.current?.focus();}}));
  useEffect(()=>{
    const node=input.current;if(!node)return;node.style.height='auto';node.style.height=`${Math.min(116,Math.max(68,node.scrollHeight))}px`;
  },[draft.body]);
  useEffect(()=>{
    const token=++generation.current;setCandidates([]);setActive(0);setSearchError('');
    if(!picker || composing || query.length>20 || query.trim()!=='' && [...query.trim()].length<2){setSearching(false);return;}
    setSearching(true);
    const timer=window.setTimeout(()=>{void repository.findMentionTargets(postId,query).then(items=>{
      if(mounted.current && token===generation.current){setCandidates(items);setSearching(false);}
    }).catch(error=>{if(mounted.current && token===generation.current){setSearchError(loungeErrorMessage(error));setSearching(false);}});},300);
    return()=>{clearTimeout(timer);generation.current++;};
  },[repository,postId,picker,query,composing]);
  function openPicker(start=input.current?.selectionStart??draft.body.length,end=input.current?.selectionEnd??start){
    selection.current={start,end};setQuery('');setPicker(true);requestAnimationFrame(()=>search.current?.focus());
  }
  function select(candidate:MentionCandidate){
    if(draft.mentions.length>=3 && !draft.mentions.some(m=>m.publicId===candidate.publicId))return;
    const next=insertMention(draft,selection.current.start,selection.current.end,candidate);
    const cursor=draft.body.slice(0,selection.current.start).normalize('NFC').length+candidate.nickname.length+2;
    setDraft(next);onDirtyChange(next.body.trim().length>0);setPicker(false);setError('');
    requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(cursor,cursor);});
  }
  async function submit(){
    const normalized=editMentionDraft(draft,draft.body.normalize('NFC')),safe=parseCommentBody(normalized.body);
    if(!safe || lock.current || disabled || textComposing.current)return;
    const offset=[...normalized.body].length-[...normalized.body.trimStart()].length;
    const value={postId,rootId:target?(target.rootId??target.id):null,replyToId:target?.id??null,body:safe,
      mentions:normalized.mentions.map(m=>({...m,start:m.start-offset,end:m.end-offset}))};
    const old=attempt.current;
    if(!old || JSON.stringify({...old,id:undefined})!==JSON.stringify(value))attempt.current={...value,id:crypto.randomUUID()};
    lock.current=true;setPending(true);setError('');
    try {
      const result=await repository.addConversationComment(attempt.current!);
      if(!mounted.current)return;
      setDraft({body:'',mentions:[]});setTarget(null);setPicker(false);attempt.current=null;onDirtyChange(false);onSaved(result);
    } catch(error){if(mounted.current){setError(loungeErrorMessage(error));
      if(error instanceof LoungeError && error.code==='missing' && target)setError('답글 대상이 사라졌어요. 내용은 유지했어요. 대상을 취소하거나 다른 댓글을 선택해 주세요.');
      if(error instanceof LoungeError && error.code==='mention-changed')setDraft(current=>({...current,mentions:[]}));
    }} finally {lock.current=false;if(mounted.current)setPending(false);}
  }
  return <form className="community-compose" onSubmit={event=>{event.preventDefault();void submit();}}>
    {target?<div className="community-reply-target"><div><strong>{target.author?.nickname??'탈퇴한 사용자'}님에게 답글</strong><p>{target.body}</p></div>
      <button type="button" className="responsive-dialog__icon-button" aria-label="답글 취소" disabled={pending} onClick={()=>setTarget(null)}><X size={16}/></button></div>:null}
    {picker?<div className="community-mention-picker">
      <div><input ref={search} role="combobox" aria-label="멘션할 닉네임 검색" placeholder="닉네임 검색" aria-autocomplete="list" aria-controls="mention-options" aria-expanded="true"
        aria-activedescendant={candidates[active]?`mention-option-${active}`:undefined} value={query} maxLength={40}
        onCompositionStart={()=>setComposing(true)} onCompositionEnd={event=>{setComposing(false);setQuery(event.currentTarget.value.normalize('NFC'));}}
        onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{
          if(event.nativeEvent.isComposing)return;
          if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPicker(false);input.current?.focus();}
          if(event.key==='ArrowDown' || event.key==='ArrowUp'){event.preventDefault();setActive(i=>Math.max(0,Math.min(candidates.length-1,i+(event.key==='ArrowDown'?1:-1))));}
          if(event.key==='Enter'){event.preventDefault();if(candidates[active])select(candidates[active]);}
        }}/><button type="button" className="responsive-dialog__icon-button" aria-label="멘션 검색 닫기" onClick={()=>{setPicker(false);input.current?.focus();}}><X size={16}/></button></div>
      <ul id="mention-options" role="listbox" aria-label="멘션 후보">{candidates.map((candidate,i)=><li role="option" aria-selected={active===i} id={`mention-option-${i}`} key={candidate.publicId}
        onPointerDown={event=>event.preventDefault()} onClick={()=>select(candidate)}>{candidate.nickname}</li>)}</ul>
      {searchError?<p role="alert">{searchError}</p>:searching?<p role="status">찾는 중…</p>:!candidates.length?<p>{query && [...query].length<2?'두 글자부터 검색해요.':'일치하는 사용자가 없어요.'}</p>:null}
    </div>:null}
    <label className="sr-only" htmlFor="lounge-comment-input">댓글 남기기</label>
    <textarea ref={input} id="lounge-comment-input" value={draft.body} rows={2} maxLength={1000} disabled={pending || disabled} placeholder="댓글을 남겨 보세요"
      aria-describedby="lounge-comment-length" onCompositionStart={()=>{textComposing.current=true;}}
      onCompositionEnd={event=>{textComposing.current=false;const value=event.currentTarget.value.normalize('NFC');setDraft(current=>editMentionDraft(current,value));}}
      onChange={event=>{const value=event.target.value,caret=event.target.selectionStart;
        setDraft(current=>editMentionDraft(current,value));onDirtyChange(value.trim().length>0);setError('');
        if(!textComposing.current && value.length===draft.body.length+1 && value[caret-1]==='@' && (caret===1 || /\s/.test(value[caret-2])))openPicker(caret-1,caret);
      }} />
    {error?<p role="alert" className="community-write-error">{error}</p>:null}
    <div className="community-compose-actions"><button type="button" className="responsive-dialog__icon-button" aria-label="사용자 멘션"
      disabled={pending || disabled || draft.mentions.length>=3} onClick={()=>openPicker()}>@</button>
      <span id="lounge-comment-length" className="lounge-muted">{[...draft.body].length} / 500</span>
      <Button type="submit" variant="primary" disabled={pending || disabled || !parseCommentBody(draft.body)}>{pending?'저장 중…':'등록'}</Button></div>
  </form>;
}
