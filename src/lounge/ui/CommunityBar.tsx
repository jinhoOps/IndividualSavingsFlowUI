import {useContext, useEffect, useId, useRef, useState, type Ref} from 'react';
import {MessageCircle, SmilePlus} from 'lucide-react';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {EMOJIS, MAX_REACTION_TYPES, type EmojiId} from '../domain/community';
import type {CommunityEntry} from './useLoungeCommunity';

export function CommunityBar({entry,onReact,onComments,onRetry,commentButtonRef}: {
  entry?: CommunityEntry; onReact(emoji:EmojiId,active:boolean):Promise<boolean>;
  onComments(trigger:HTMLButtonElement):void; onRetry():void;
  commentButtonRef?:Ref<HTMLButtonElement>;
}) {
  const account=useContext(AccountManagementContext);
  const [expanded,setExpanded]=useState(false);
  const [choosing,setChoosing]=useState(false);
  const addRef=useRef<HTMLButtonElement>(null);
  const chipRefs=useRef<Partial<Record<EmojiId,HTMLButtonElement|null>>>({});
  const pickerId=useId();
  const summary=entry?.summary;
  const atLimit=(summary?.reactions.length??0)>=MAX_REACTION_TYPES;
  const busy=Boolean(entry?.pending || entry?.loading || account?.readOnly);
  useEffect(()=>{
    if(atLimit && choosing) {
      setChoosing(false);
      requestAnimationFrame(()=>Object.values(chipRefs.current).find(Boolean)?.focus());
    }
  },[atLimit,choosing]);
  const sorted=EMOJIS.flatMap(emoji=>{
    const reaction=summary?.reactions.find(r=>r.emoji===emoji.id);
    return reaction?[{...reaction,...emoji}]:[];
  });
  return <div className="community" aria-label="게시물 공감과 댓글">
    <div className="community-bar" data-expanded={expanded}>
      <div className="community-reactions">
        {sorted.map(reaction=><button key={reaction.id} ref={element=>{chipRefs.current[reaction.id]=element;}}
          className="community-reaction" type="button" aria-pressed={reaction.mine} disabled={busy}
          aria-label={`${reaction.label} ${reaction.count}명`} onClick={async()=>{
            if(await onReact(reaction.id,!reaction.mine) && reaction.mine && reaction.count===1) requestAnimationFrame(()=>addRef.current?.focus());
          }}>
          <span aria-hidden="true">{reaction.symbol}</span><span aria-hidden="true">{compactCount(reaction.count)}</span>
        </button>)}
        {sorted.length>4 ? <button type="button" className="community-more" aria-expanded={expanded}
          aria-label={expanded?'이모지 접기':`나머지 이모지 ${sorted.length-4}개 보기`} onClick={()=>setExpanded(v=>!v)}>
          <span aria-hidden="true">{expanded?'접기':`… +${sorted.length-4}`}</span>
        </button> : null}
        {summary && !atLimit ? <button ref={addRef} type="button" className="community-add" aria-label="이모지 추가"
          aria-expanded={choosing} aria-controls={pickerId} disabled={busy} onClick={()=>setChoosing(v=>!v)}>
          <SmilePlus size={20} aria-hidden="true" />
        </button> : null}
        {!summary && !entry?.error ? <span className="community-loading" role="status">공감 불러오는 중…</span> : null}
      </div>
      <button ref={commentButtonRef} type="button" className="community-comments" aria-label={summary?`댓글 ${summary.commentCount}개 보기`:'댓글 보기'}
        onClick={event=>onComments(event.currentTarget)}><MessageCircle size={18} aria-hidden="true" />
        <span aria-hidden="true">{summary?compactCount(summary.commentCount):'–'}</span>
      </button>
    </div>
    {choosing && !atLimit ? <div id={pickerId} className="community-picker" role="group" aria-label="공감 이모지 선택"
      onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setChoosing(false);addRef.current?.focus();}}}>
      {EMOJIS.filter(emoji=>!summary?.reactions.some(r=>r.emoji===emoji.id)).map(emoji=><button key={emoji.id} type="button"
        disabled={busy} aria-label={emoji.label} onClick={async()=>{
          if(await onReact(emoji.id,true)) {
            setChoosing(false);setExpanded(true);
            requestAnimationFrame(()=>chipRefs.current[emoji.id]?.focus());
          }
        }}><span aria-hidden="true">{emoji.symbol}</span></button>)}
    </div> : null}
    {entry?.error ? <p role="alert" className="community-error">{entry.error} <button className="ui-button ui-button--quiet" disabled={busy} onClick={onRetry}>다시 불러오기</button></p> : null}
  </div>;
}
function compactCount(count:number) {return count>=1000?`${(count/1000).toFixed(count%1000===0?0:1)}k`:String(count);}
