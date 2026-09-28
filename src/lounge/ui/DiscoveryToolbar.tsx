import { Button } from '../../components/common/Button';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Search,SlidersHorizontal,X} from 'lucide-react';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout,ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {ASSET_BANDS,assetBandLabel} from '../domain/assetBand';
import {parseFeedQuery,type FeedQuery} from '../domain/discovery';
export function DiscoveryToolbar({query,loading,rankedAt,onApply}:{query:FeedQuery;loading:boolean;rankedAt:string|null;onApply(query:FeedQuery):void}) {
  const [text,setText]=useState(query.q),[composing,setComposing]=useState(false),[open,setOpen]=useState(false);
  const [draft,setDraft]=useState(query);
  const apply=useRef(onApply),current=useRef(query),filter=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);
  apply.current=onApply;current.current=query;
  const debounce=useRef<number|undefined>(undefined);
  function cancelSearch(){clearTimeout(debounce.current);debounce.current=undefined;}
  useLayoutEffect(()=>{
    cancelSearch();
    setText(old=>parseFeedQuery({...query,q:old})?.q===query.q?old:query.q);
  },[query.q]);
  const valid=parseFeedQuery({...query,q:text});
  useEffect(()=>{
    cancelSearch();
    const applied=current.current.q;
    if(composing || parseFeedQuery({...current.current,q:text})?.q===applied)return;
    debounce.current=window.setTimeout(()=>{
      if(current.current.q!==applied)return;
      const next=parseFeedQuery({...current.current,q:text});if(next)apply.current(next);
    },350);
    return cancelSearch;
  },[text,composing]);
  function search(){cancelSearch();const next=parseFeedQuery({...query,q:text});if(next)onApply(next);}
  const chips:Array<{label:string;clear():void}>=[
    ...(query.period!=='all'?[{label:query.period==='7d'?'최근 7일':'최근 30일',clear:()=>onApply({...query,period:'all'})}]:[]),
    ...(query.hasCash?[{label:'현금 포함',clear:()=>onApply({...query,hasCash:false})}]:[]),
    ...query.assetBands.map(code=>({label:code==='hidden'?'자산 규모 미공개':assetBandLabel(code),clear:()=>onApply({...query,assetBands:query.assetBands.filter(value=>value!==code)})})),
  ];
  return <section className="lounge-discovery" aria-label="포트폴리오 탐색">
    <div className="lounge-search"><Search size={18} aria-hidden="true"/><input ref={input} type="search" aria-label="포트폴리오 검색" placeholder="제목 · 종목 · 닉네임 검색" value={text} maxLength={160}
      aria-invalid={!valid} onChange={event=>setText(event.target.value)} onCompositionStart={()=>{cancelSearch();setComposing(true);}} onCompositionEnd={()=>setComposing(false)}
      onKeyDown={event=>{if(event.key==='Enter' && !event.nativeEvent.isComposing){event.preventDefault();search();}}}/>
      {text?<button className="responsive-dialog__icon-button" aria-label="검색 지우기" onClick={()=>{cancelSearch();setText('');onApply({...query,q:''});input.current?.focus();}}><X size={18}/></button>:null}
      {loading?<span className="lounge-search-status" role="status">검색 중</span>:null}</div>
    {!valid?<p className="lounge-muted" role="alert">검색어는 80자 이내로 입력해 주세요.</p>:null}
    <div className="lounge-toolbar"><div className="lounge-tabs" aria-label="게시물 범위">{['all','mine'].map(scope=><button key={scope} aria-pressed={query.scope===scope}
      onClick={()=>onApply({...query,scope:scope as FeedQuery['scope']})}>{scope==='mine'?'내 공유':'전체'}</button>)}</div>
      <div className="lounge-discovery-actions"><select aria-label="정렬" value={query.sort} onChange={event=>onApply({...query,sort:event.target.value as FeedQuery['sort']})}>
          <option value="updated">최근 수정순</option><option value="reactions">공감 많은 순</option><option value="comments">댓글 많은 순</option></select>
        <button ref={filter} className="responsive-dialog__icon-button" aria-label="필터" onClick={()=>{setDraft({...query,assetBands:[...query.assetBands]});setOpen(true);}}><SlidersHorizontal size={19}/></button></div></div>
    {query.sort!=='updated' && rankedAt?<p className="lounge-ranking-time">15분 단위 집계 · {new Date(rankedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 기준</p>:null}
    {chips.length?<div className="lounge-filter-chips" aria-label="적용된 필터">{chips.map(chip=><button key={chip.label} aria-label={`${chip.label} 필터 해제`} onClick={chip.clear}>{chip.label}<X size={12} aria-hidden="true"/></button>)}
      <button onClick={()=>onApply({...query,period:'all',hasCash:false,assetBands:[]})}>조건 초기화</button></div>:null}
    {open?<ResponsiveDialog open labelledBy="lounge-filter-title" returnFocusRef={filter} onRequestClose={()=>true} onClosed={()=>setOpen(false)}>
      {({requestClose})=><ResponsiveDialogLayout title="필터" titleId="lounge-filter-title" onClose={()=>setOpen(false)}
        footer={<ResponsiveDialogActionRow><Button variant="quiet" onClick={()=>setDraft({...draft,period:'all',hasCash:false,assetBands:[]})}>초기화</Button>
          <Button variant="primary" onClick={()=>{onApply({...query,period:draft.period,hasCash:draft.hasCash,assetBands:draft.assetBands});requestClose('button');}}>필터 적용</Button></ResponsiveDialogActionRow>}>
        <div className="lounge-filter-fields"><fieldset><legend>최근 수정</legend><div className="lounge-period-options">{(['all','7d','30d'] as const).map(period=><label key={period}>
          <span>{period==='all'?'전체':period==='7d'?'7일':'30일'}</span><input type="radio" name="lounge-period" value={period} checked={draft.period===period} onChange={()=>setDraft({...draft,period})}/></label>)}</div></fieldset>
          <label className="lounge-cash-filter"><span>현금 포함</span><input type="checkbox" checked={draft.hasCash} onChange={event=>setDraft({...draft,hasCash:event.target.checked})}/></label>
          <fieldset><legend>공개 자산 규모</legend><div className="lounge-band-options">{[...ASSET_BANDS,['hidden','자산 규모 미공개'] as const].map(([code,label])=><label key={code}>
            <span>{label}</span><input type="checkbox" checked={draft.assetBands.includes(code)} onChange={event=>setDraft({...draft,assetBands:event.target.checked?[...draft.assetBands,code]:draft.assetBands.filter(value=>value!==code)})}/></label>)}</div></fieldset>
        </div>
      </ResponsiveDialogLayout>}
    </ResponsiveDialog>:null}
  </section>;
}
