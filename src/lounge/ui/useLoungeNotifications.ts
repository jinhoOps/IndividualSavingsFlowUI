import {useCallback,useEffect,useRef,useState} from 'react';
import type {ConversationRepository} from '../infrastructure/conversationRepository';
import type {ConversationCursor} from '../domain/conversation';
import type {LoungeNotification,NotificationPage,UnreadState} from '../domain/notifications';
import {loungeErrorMessage} from '../infrastructure/loungeErrors';
import {useLoungeRefresh} from './useLoungeRefresh';

export function useLoungeNotifications(repository:ConversationRepository,visible:boolean) {
  const [items,setItems]=useState<LoungeNotification[]>([]),[unreadCount,setUnreadCount]=useState(0);
  const [unreadOnly,setUnreadOnly]=useState(false),[loading,setLoading]=useState(false),[writing,setWriting]=useState(false),[error,setError]=useState('');
  const [nextCursor,setNextCursor]=useState<ConversationCursor|null>(null),[hasNew,setHasNew]=useState(false);
  const snapshot=useRef<Pick<NotificationPage,'readIds'|'readCutoff'>>({readIds:[],readCutoff:''});
  const loaded=useRef(false),generation=useRef(0),countGeneration=useRef(0),changeGeneration=useRef(0),scope=useRef(0);
  const countLock=useRef<number|null>(null),writeLock=useRef<number|null>(null),listLock=useRef<number|null>(null);
  const cursor=useRef(nextCursor);cursor.current=nextCursor;
  const currentItems=useRef(items);currentItems.current=items;
  const refreshCount=useCallback(async()=>{
    if(countLock.current!==null || writeLock.current!==null)return;
    const token=++countGeneration.current;countLock.current=token;
    try {const state=await repository.getUnreadCount();if(token===countGeneration.current)setUnreadCount(state.unreadCount);}
    catch{/* Keep the last badge on background failure. */}
    finally{if(countLock.current===token)countLock.current=null;}
  },[repository]);
  const load=useCallback(async(append=false,quiet=false)=>{
    if(writeLock.current!==null || quiet && listLock.current!==null)return;
    const token=++generation.current,change=changeGeneration.current,countToken=++countGeneration.current;
    listLock.current=token;if(!quiet){setLoading(true);setError('');}
    try {
      const page=await repository.listNotifications(unreadOnly,append?cursor.current??undefined:undefined);
      const current=[...page.items];
      if(quiet){
        let after=page.nextCursor;
        // The server retains at most 100 notifications: five bounded reads can
        // distinguish removed rows from valid rows beyond the first page.
        for(let pages=1;after && pages<5;pages++){
          if(token!==generation.current || change!==changeGeneration.current)return;
          const more=await repository.listNotifications(unreadOnly,after);
          current.push(...more.items);after=more.nextCursor;
        }
        if(after)return;
      }
      if(token!==generation.current || change!==changeGeneration.current)return;
      if(countToken===countGeneration.current)setUnreadCount(page.unreadCount);
      snapshot.current={readIds:page.readIds,readCutoff:page.readCutoff};loaded.current=true;
      if(quiet){
        setHasNew(current.some(item=>!currentItems.current.some(v=>v.id===item.id)));
        const byId=new Map(current.map(item=>[item.id,item]));
        setItems(old=>old.flatMap(item=>{const updated=byId.get(item.id);return updated?[updated]:[];}));
      }else{
        setItems(old=>append?[...old,...page.items.filter(item=>!old.some(v=>v.id===item.id))].slice(0,100):page.items);
        setNextCursor(page.nextCursor);setHasNew(false);
      }
    }catch(error){if(token===generation.current && !quiet)setError(loungeErrorMessage(error));}
    finally{if(listLock.current===token){listLock.current=null;setLoading(false);}}
  },[repository,unreadOnly]);
  useEffect(()=>{
    scope.current++;generation.current++;countGeneration.current++;changeGeneration.current++;
    countLock.current=null;writeLock.current=null;listLock.current=null;loaded.current=false;
    setItems([]);setNextCursor(null);setUnreadCount(0);setError('');setWriting(false);setLoading(false);setHasNew(false);
    snapshot.current={readIds:[],readCutoff:''};void refreshCount();
    return()=>{scope.current++;generation.current++;countGeneration.current++;changeGeneration.current++;};
  },[repository,refreshCount]);
  useEffect(()=>{if(visible)void load(false,loaded.current);},[visible,load]);
  const changeFilter=useCallback((value:boolean)=>{
    if(value===unreadOnly)return;generation.current++;loaded.current=false;setUnreadOnly(value);setNextCursor(null);
  },[unreadOnly]);
  useLoungeRefresh(async()=>{
    await refreshCount();if(visible && loaded.current)await load(false,true);
  });
  async function mark(ids:string[],cutoff:string|null){
    if(writeLock.current!==null || !ids.length)return false;
    const token=++changeGeneration.current,account=scope.current;writeLock.current=token;
    generation.current++;const countToken=++countGeneration.current;setWriting(true);setError('');
    try {
      const state=await repository.readNotifications(ids,cutoff);
      if(account!==scope.current || token!==changeGeneration.current)return false;
      if(countToken===countGeneration.current)setUnreadCount(state.unreadCount);
      setItems(old=>old.map(item=>ids.includes(item.id)?{...item,read:true}:item).filter(item=>!unreadOnly || !item.read));
      snapshot.current={...snapshot.current,readIds:snapshot.current.readIds.filter(id=>!ids.includes(id))};return true;
    }catch(error){if(account===scope.current && token===changeGeneration.current)setError(loungeErrorMessage(error));return false;}
    finally{if(writeLock.current===token){writeLock.current=null;setWriting(false);}}
  }
  return {items,unreadCount,unreadOnly,changeFilter,loading,writing,error,nextCursor,hasNew,
    acceptUnreadState(state:UnreadState){countGeneration.current++;setUnreadCount(state.unreadCount);},
    refresh:()=>load(),loadMore:()=>load(true),markRead:(id:string)=>mark([id],null),
    markAllRead:()=>mark([...snapshot.current.readIds],snapshot.current.readCutoff||null)};
}
export type LoungeNotifications=ReturnType<typeof useLoungeNotifications>;
