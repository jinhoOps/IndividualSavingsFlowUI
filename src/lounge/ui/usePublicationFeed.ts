import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {DEFAULT_FEED_QUERY,feedQueryFromSearch,feedSearchParams,feedQueryKey,parseFeedQuery,parseFeedCursor,type FeedQuery,type FeedCursor} from '../domain/discovery';
import type {Publication} from '../domain/publication';
import {publicationQuery} from '../domain/publication';
import {loungeErrorMessage,type LoungeRepository} from '../infrastructure/loungeRepository';

type Restore={starts:Array<FeedCursor|undefined>;batch:number;count:number;scroll:number};
export function usePublicationFeed(repository:LoungeRepository) {
  const [query,setQuery]=useState(()=>feedQueryFromSearch(location.search));
  const [posts,setPosts]=useState<Publication[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [stale,setStale]=useState<'cursor-expired'|'ranking-unavailable'|null>(null),[rankedAt,setRankedAt]=useState<string|null>(null);
  const [nextCursor,setNextCursor]=useState<FeedCursor|null>(null),[batchIndex,setBatchIndex]=useState(0);
  const generation=useRef(0),busy=useRef(false),currentQuery=useRef(query),currentPosts=useRef(posts),cursor=useRef(nextCursor),batch=useRef(0);
  const starts=useRef<Array<FeedCursor|undefined>>([undefined]),restore=useRef<Restore|null>(null),mounted=useRef(true);
  const previousRepository=useRef(repository);
  const dataKey=useRef<string|null>(null),pendingScroll=useRef<number|null>(null);
  currentPosts.current=posts;cursor.current=nextCursor;
  const savePosition=useCallback(()=>{
    if(dataKey.current!==feedQueryKey(currentQuery.current))return;
    history.replaceState({...history.state,isfLounge:{key:feedQueryKey(currentQuery.current),starts:starts.current,batch:batch.current,count:currentPosts.current.length,scroll:pendingScroll.current??window.scrollY}},'',location.href);
  },[]);
  const perform=useCallback(async(q:FeedQuery,start:FeedCursor|undefined,append:boolean,targetBatch:number,count=12,scroll?:number)=>{
    const token=++generation.current;busy.current=true;setLoading(true);setError('');setStale(null);
    let collected:Publication[]=[],after=start,ranked:string|null=null,next:FeedCursor|null=null;
    try {
      while(collected.length<count){
        const page=await repository.search(q,after);if(!mounted.current || token!==generation.current)return;
        if(page.status!=='ok'){setStale(page.status);return;}
        collected.push(...page.items.filter(item=>!collected.some(p=>p.id===item.id)));next=page.nextCursor;ranked=page.rankedAt;
        if(!next || page.items.length===0)break;after=next;
      }
      if(!mounted.current || token!==generation.current)return;
      dataKey.current=feedQueryKey(q);pendingScroll.current=scroll??null;
      setPosts(old=>append?[...old,...collected.filter(item=>!old.some(p=>p.id===item.id))].slice(0,120):collected.slice(0,120));
      setNextCursor(next);setRankedAt(ranked);setBatchIndex(targetBatch);batch.current=targetBatch;
      if(scroll!==undefined)requestAnimationFrame(()=>{if(mounted.current && token===generation.current){window.scrollTo({top:scroll});pendingScroll.current=null;}});
    }catch(error){if(mounted.current && token===generation.current)setError(loungeErrorMessage(error));}
    finally{if(mounted.current && token===generation.current){busy.current=false;setLoading(false);}}
  },[repository]);
  useEffect(()=>{
    mounted.current=true;currentQuery.current=query;
    if(previousRepository.current!==repository){previousRepository.current=repository;setPosts([]);setNextCursor(null);dataKey.current=null;restore.current=null;}
    const target=restore.current;restore.current=null;
    if(target){starts.current=target.starts;void perform(query,target.starts[target.batch],false,target.batch,target.count,target.scroll);}
    else{starts.current=[undefined];batch.current=0;setBatchIndex(0);void perform(query,undefined,false,0);}
    return()=>{generation.current++;};
  },[query,perform,repository]);
  useLayoutEffect(()=>{if(!loading && !error && !stale)savePosition();},[posts,loading,error,stale,savePosition]);
  useEffect(()=>{
    const old=history.scrollRestoration;history.scrollRestoration='manual';
    function onPop(){
      const q=feedQueryFromSearch(location.search),saved=history.state?.isfLounge;
      if(saved?.key===feedQueryKey(q) && Array.isArray(saved.starts) && saved.starts.length<=42 && Number.isInteger(saved.batch)
        && saved.batch>=0 && saved.batch<saved.starts.length && Number.isInteger(saved.count) && saved.count>=0 && saved.count<=120 && Number.isFinite(saved.scroll)){
        const parsed=saved.starts.map((value:unknown,index:number)=>index===0?undefined:parseFeedCursor(value)??undefined);
        if(parsed.slice(1).every(Boolean))restore.current={starts:parsed,batch:saved.batch,count:Math.max(12,saved.count),scroll:Math.max(0,saved.scroll)};
      }
      generation.current++;currentQuery.current=q;setQuery(q);
    }
    let scrollTimer:number|undefined;
    function onScroll(){clearTimeout(scrollTimer);scrollTimer=window.setTimeout(savePosition,200);}
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('popstate',onPop);
    return()=>{mounted.current=false;generation.current++;history.scrollRestoration=old;clearTimeout(scrollTimer);window.removeEventListener('scroll',onScroll);window.removeEventListener('popstate',onPop);};
  },[savePosition]);
  function apply(value:FeedQuery){
    const safe=parseFeedQuery(value);if(!safe || feedQueryKey(safe)===feedQueryKey(currentQuery.current))return;
    savePosition();generation.current++;currentQuery.current=safe;restore.current=null;
    const params=feedSearchParams(safe),post=publicationQuery(location.search),comment=publicationQuery(location.search,'comment');
    if(post){params.set('post',post);if(comment)params.set('comment',comment);}
    const search=params.toString();history.pushState(null,'',`${location.pathname}${search?`?${search}`:''}`);setQuery(safe);
  }
  async function refresh(){
    starts.current=[undefined];await perform(currentQuery.current,undefined,false,0,12,0);
  }
  async function loadMore(){
    if(busy.current || !cursor.current || currentPosts.current.length>=120 || stale || error)return;
    await perform(currentQuery.current,cursor.current,true,batch.current);
  }
  async function nextBatch(){
    if(busy.current || !cursor.current || stale || error)return;
    const next=batch.current+1;starts.current=starts.current.slice(0,next);starts.current[next]=cursor.current;
    await perform(currentQuery.current,cursor.current,false,next,12,0);
  }
  async function previousBatch(){
    if(busy.current || batch.current===0 || stale || error)return;
    const previous=batch.current-1;await perform(currentQuery.current,starts.current[previous],false,previous,120,0);
  }
  async function quietRefresh(canApply:()=>boolean){
    if(busy.current || stale || error || batch.current!==0 || currentPosts.current.length>12
      || feedQueryKey(currentQuery.current)!==feedQueryKey(DEFAULT_FEED_QUERY) || !canApply())return;
    const token=generation.current;
    try {
      const page=await repository.search(currentQuery.current);
      if(!mounted.current || token!==generation.current || busy.current || !canApply() || page.status!=='ok')return;
      setPosts(old=>JSON.stringify(old)===JSON.stringify(page.items)?old:page.items);setNextCursor(page.nextCursor);setRankedAt(page.rankedAt);
    }catch{/* Preserve the currently visible feed on background failure. */}
  }
  return {query,posts,setPosts,loading,error,stale,rankedAt,nextCursor,batchIndex,apply,refresh,loadMore,nextBatch,previousBatch,quietRefresh,savePosition};
}
