import {useCallback, useEffect, useRef, useState} from 'react';
import type {CommunitySummary, EmojiId} from '../domain/community';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';

export interface CommunityEntry {summary?: CommunitySummary; loading?: boolean; pending?: boolean; error?: string}
export function useLoungeCommunity(repository: LoungeRepository) {
  const [entries,setEntries] = useState<Record<string,CommunityEntry>>({});
  const tokens = useRef<Record<string,number>>({});
  const sequence = useRef(0);
  const locks = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;tokens.current={};};},[]);
  const next = (id:string) => tokens.current[id]=++sequence.current;
  const load = useCallback(async (ids:string[])=>{
    const requested = [...new Set(ids)].filter(id=>!locks.current.has(id));
    if (!requested.length) return;
    const current = new Map(requested.map(id=>[id,next(id)]));
    setEntries(previous=>{
      const result={...previous};for(const id of requested) result[id]={...result[id],pending:false,loading:true,error:''};return result;
    });
    // Publication pages contain 12 IDs; explicitly bound batches for other callers.
    for(let offset=0;offset<requested.length;offset+=24) {
      const batch=requested.slice(offset,offset+24);
      try {
        const summaries=await repository.getCommunity(batch);
        if (!mounted.current) return;
        setEntries(previous=>{
          const result={...previous};
          for(const id of batch) if(tokens.current[id]===current.get(id)) {
            const summary=summaries.find(s=>s.postId===id);
            result[id]=summary?{summary}:{error:'삭제되었거나 더 이상 볼 수 없는 게시물이에요.'};
          }
          return result;
        });
      } catch(error) {
        if (!mounted.current) return;
        setEntries(previous=>{
          const result={...previous};for(const id of batch) if(tokens.current[id]===current.get(id)) result[id]={...result[id],loading:false,error:loungeErrorMessage(error)};return result;
        });
      }
    }
  },[repository]);
  const accept = useCallback((summary:CommunitySummary)=>{
    next(summary.postId);
    if (!mounted.current) return;
    setEntries(previous=>({...previous,[summary.postId]:{summary,pending:locks.current.has(summary.postId)}}));
    // A delayed comment response can also arrive after a newer reaction response.
    // Read after it settles; an in-flight reaction performs its own final read.
    if(!locks.current.has(summary.postId)) void load([summary.postId]);
  },[load]);
  const react = useCallback(async (postId:string,emoji:EmojiId,active:boolean) => {
    if (locks.current.has(postId)) return false;
    locks.current.add(postId); const token=next(postId);
    let reconcile=false;
    setEntries(previous=>({...previous,[postId]:{...previous[postId],pending:true,error:''}}));
    try {
      const result=await repository.setReaction(postId,emoji,active);
      if (!mounted.current) return false;
      if (tokens.current[postId]!==token) {
        // A comment may have committed before or after this reaction. Neither
        // response order nor the two summaries can establish the final state.
        reconcile=true;
        return result.status==='saved';
      }
      setEntries(previous=>({...previous,[postId]:{summary:result.summary,
        error:result.status==='reaction-limit'?'이미 8가지 이모지가 있어요. 표시된 이모지에 공감해 주세요.':''}}));
      return result.status==='saved';
    } catch(error) {
      reconcile=mounted.current && tokens.current[postId]!==token;
      if (mounted.current && tokens.current[postId]===token) setEntries(previous=>({...previous,[postId]:{...previous[postId],pending:false,error:loungeErrorMessage(error)}}));
      return false;
    } finally {
      locks.current.delete(postId);
      if(reconcile && mounted.current) await load([postId]);
    }
  },[repository,load]);
  return {entries,load,accept,react};
}
