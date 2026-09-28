import {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Bell, Plus} from 'lucide-react';
import {AppShell} from '../../components/common/AppShell';
import {AppContentFrame} from '../../components/common/AppContentFrame';
import {AppManagementMenu} from '../../journey/ui/AppManagementMenu';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {appPath} from '../../journey/routes';
import type {PortfolioPlan} from '../../portfolio/domain/model';
import {allocationFromPlan, publicationQuery, type Publication} from '../domain/publication';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';
import {AllocationSummary} from './AllocationSummary';
import type {AssetBand} from '../domain/assetBand';
import {AssetBandBadge} from './AssetBandBadge';
import {PublicationEditor} from './PublicationEditor';
import {NicknameChangeDialog} from './NicknameChangeDialog';
import {CommunityBar} from './CommunityBar';
import {PublicationComments, type CommentNavigation} from './PublicationComments';
import {useLoungeCommunity} from './useLoungeCommunity';
import {useLoungeRefresh} from './useLoungeRefresh';
import {NotificationInbox,type InboxPosition} from './NotificationInbox';
import {useLoungeNotifications} from './useLoungeNotifications';
import type {LoungeNotification} from '../domain/notifications';
import type {CommentContext} from '../domain/conversation';
import {DiscoveryToolbar} from './DiscoveryToolbar';
import {usePublicationFeed} from './usePublicationFeed';
import {DEFAULT_FEED_QUERY} from '../domain/discovery';

export function LoungeApp({repository, nickname, plan, suggestedAssetBand = null}: {repository: LoungeRepository; nickname: string; plan: PortfolioPlan | null; suggestedAssetBand?: AssetBand | null}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef=useRef<HTMLDivElement>(null);
  const managementTrigger = useRef<HTMLButtonElement>(null);
  const [currentNickname, setCurrentNickname] = useState(nickname);
  const [changingNickname, setChangingNickname] = useState(false);
  useEffect(() => {headingRef.current?.focus();}, []);
  const feed=usePublicationFeed(repository);
  const {posts,setPosts,loading}=feed;
  const mine=feed.query.scope==='mine';
  const [actionError,setActionError]=useState('');
  const error=actionError||feed.error;
  const [notice,setNotice]=useState('');
  const mounted = useRef(true);
  const detailGeneration = useRef(0);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<Publication | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMode,setDetailMode] = useState<'notifications'|'allocation'|'comments'>('allocation');
  const [fromInbox,setFromInbox]=useState(false),[notificationOpening,setNotificationOpening]=useState(false),[notificationError,setNotificationError]=useState('');
  const [commentId,setCommentId]=useState<string|undefined>(),[commentContext,setCommentContext]=useState<CommentContext|undefined>();
  const inboxPosition=useRef<InboxPosition>({id:null,scroll:0}),notificationLock=useRef(false);
  const notifications=useLoungeNotifications(repository,detailOpen && detailMode==='notifications');
  const [commentsBusy,setCommentsBusy] = useState(false);
  const commentNavigationRef=useRef<CommentNavigation>(null);
  const detailCommentsRef=useRef<HTMLButtonElement|null>(null);
  const community=useLoungeCommunity(repository);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const publishTrigger = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<{existing: Publication | null} | null>(null);
  const [openingEditor, setOpeningEditor] = useState(false);
  const editorLock = useRef(false);
  const allocation = plan ? allocationFromPlan(plan) : null;
  useEffect(() => {mounted.current=true;return()=>{mounted.current=false;};},[]);
  const postIds=posts.map(post=>post.id).join(',');
  useEffect(()=>{void community.load(postIds?postIds.split(','):[]);},[postIds,community.load]);
  const loadDetail = useCallback(async (id: string, mode:'allocation'|'comments'='allocation',targetId?:string) => {
    const token = ++detailGeneration.current;
    setCopied(false);setFromInbox(false);setCommentId(targetId);setCommentContext(undefined);
    const url = new URL(window.location.href); url.searchParams.set('post', id);if(targetId)url.searchParams.set('comment',targetId);else url.searchParams.delete('comment'); history.replaceState(history.state, '', `${url.pathname}${url.search}`);
    setDetail(null); setDetailError(''); setDetailLoading(true); setDetailOpen(true); setDeleteConfirm(false);
    setDetailMode(mode);void community.load([id]);
    try {
      const post = await repository.get(id);
      if (!mounted.current || token !== detailGeneration.current) return;
      if (post) setDetail(post); else setDetailError('삭제되었거나 더 이상 볼 수 없는 포트폴리오예요.');
    } catch(error) {if (mounted.current && token === detailGeneration.current) setDetailError(loungeErrorMessage(error));}
    finally {if (mounted.current && token === detailGeneration.current) setDetailLoading(false);}
  }, [repository, community.load]);
  useEffect(() => {const id = publicationQuery(window.location.search); if (id){const targetId=publicationQuery(window.location.search,'comment')??undefined;void loadDetail(id,targetId?'comments':'allocation',targetId);}}, [loadDetail]);
  function closeDetail() {
    detailGeneration.current++;
    setDetailOpen(false); setDeleteConfirm(false);setFromInbox(false);setCommentId(undefined);setCommentContext(undefined);setNotificationError('');
    const url = new URL(window.location.href); url.searchParams.delete('post');url.searchParams.delete('comment');
    history.replaceState(history.state, '', `${url.pathname}${url.search}`);
  }
  function openInbox(button:HTMLButtonElement){
    trigger.current=button;setDetail(null);setDetailOpen(true);setDetailMode('notifications');setFromInbox(true);setNotificationError('');inboxPosition.current={id:null,scroll:0};
  }
  async function openNotification(item:LoungeNotification){
    if(notificationLock.current)return;notificationLock.current=true;setNotificationOpening(true);setNotificationError('');
    const token=++detailGeneration.current;
    try {
      const [post,context]=await Promise.all([repository.get(item.postId),repository.getCommentContext(item.postId,item.commentId)]);
      if(!mounted.current || token!==detailGeneration.current)return;
      if(!post || !context){setNotificationError('삭제되었거나 더 이상 볼 수 없는 댓글이에요.');return;}
      if(!item.read && !await notifications.markRead(item.id))return;
      if(!mounted.current || token!==detailGeneration.current)return;
      setDetail(post);setCommentId(item.commentId);setCommentContext(context);setDetailMode('comments');void community.load([post.id]);
      const url=new URL(location.href);url.searchParams.set('post',post.id);url.searchParams.set('comment',item.commentId);history.replaceState(history.state,'',`${url.pathname}${url.search}`);
    }catch(error){if(mounted.current && token===detailGeneration.current)setNotificationError(loungeErrorMessage(error));}
    finally{notificationLock.current=false;if(mounted.current)setNotificationOpening(false);}
  }
  function backFromComments(){
    const url=new URL(location.href);url.searchParams.delete('comment');if(fromInbox)url.searchParams.delete('post');history.replaceState(history.state,'',`${url.pathname}${url.search}`);
    setCommentId(undefined);setCommentContext(undefined);setDetailMode(fromInbox?'notifications':'allocation');
    if(!fromInbox)requestAnimationFrame(()=>detailCommentsRef.current?.focus());
  }
  async function openEditor() {
    if (editorLock.current) return;
    editorLock.current = true; setOpeningEditor(true); setActionError('');
    try {
      const own = await repository.list(true);
      if (mounted.current) setEditor({existing: own[0] ?? null});
    } catch(error) {if (mounted.current) setActionError(loungeErrorMessage(error));}
    finally {editorLock.current = false; if (mounted.current) setOpeningEditor(false);}
  }
  const refreshBlocked=useRef(false);
  refreshBlocked.current=loading || Boolean(error) || detailOpen || Boolean(editor) || openingEditor || changingNickname;
  function canRefreshFeed() {
    return !refreshBlocked.current && document.visibilityState!=='hidden' && window.scrollY<=1 &&
      !gridRef.current?.contains(document.activeElement) && !document.activeElement?.closest('.lounge-discovery') && !document.querySelector('[role="dialog"],[role="menu"],.community-picker');
  }
  useLoungeRefresh(async()=>{
    const visible=[...(gridRef.current?.querySelectorAll<HTMLElement>('[data-post-id]')??[])].filter(card=>{
      const box=card.getBoundingClientRect();
      return box.bottom>0 && box.top<innerHeight && !card.querySelector('.community')?.contains(document.activeElement);
    }).map(card=>card.dataset.postId!);
    if(detailOpen && detail) visible.push(detail.id);
    const summaries=community.load(visible,true,()=>!document.activeElement?.closest('.community'));
    await feed.quietRefresh(canRefreshFeed);
    await summaries;
  });
  return <AppShell currentApp="lounge" managementMenu={<AppManagementMenu triggerRef={managementTrigger}
    items={[{kind:'action',id:'change-nickname',label:'닉네임 변경',onSelect:() => setChangingNickname(true)}]} />}>
    <AppContentFrame className="lounge-page">
      <h1 className="lounge-heading" ref={headingRef} tabIndex={-1}>커뮤니티 (Lounge)</h1>
      <header className="lounge-header"><p className="lounge-muted" aria-label="내 커뮤니티 닉네임">{currentNickname}</p>
        <div className="lounge-header-actions"><button type="button" className="responsive-dialog__icon-button community-notification-bell" aria-label={notifications.unreadCount?`알림함 · 읽지 않은 알림 ${notifications.unreadCount}개`:'알림함'} onClick={event=>openInbox(event.currentTarget)}><Bell size={20} aria-hidden="true"/>{notifications.unreadCount?<span aria-hidden="true">{notifications.unreadCount}</span>:null}</button>
        {allocation ? <button ref={publishTrigger} className="ui-button ui-button--primary" onClick={openEditor} disabled={openingEditor} aria-label="내 포트폴리오 공유"><Plus size={18} aria-hidden="true" /><span className="lounge-share-label">{openingEditor ? '불러오는 중' : '내 포트폴리오 공유'}</span><span className="lounge-share-short" aria-hidden="true">공유</span></button>
          : <a className="ui-button ui-button--secondary" href={appPath('portfolio')}>{plan ? '투자 대상 이름 확인' : '내 포트폴리오 만들기'}</a>}</div>
      </header>
      {plan && !allocation ? <p role="status" className="lounge-muted">공유하려면 투자 대상 이름을 40자 이내로 정리해 주세요.</p> : null}
      <DiscoveryToolbar query={feed.query} loading={loading} rankedAt={feed.rankedAt} onApply={query=>{setActionError('');feed.apply(query);}}/>
      <div aria-live="polite">{notice ? <p className="lounge-notice">{notice}</p> : null}{loading && posts.length===0 ? <p className="lounge-muted" role="status">포트폴리오를 불러오고 있어요…</p> : null}</div>
      {error ? <div className="lounge-empty" role="alert"><p>{error}</p><button className="ui-button ui-button--secondary" onClick={() => {setActionError('');void feed.refresh();}}>다시 불러오기</button></div> : null}
      {feed.stale?<div className="lounge-empty" role="status"><p>{feed.stale==='cursor-expired'?'목록의 기준 시각이 만료됐어요. 읽던 카드는 그대로 두었어요.':'아직 정렬 집계를 불러올 수 없어요.'}</p><button className="ui-button ui-button--secondary" onClick={()=>feed.stale==='ranking-unavailable'?feed.apply({...feed.query,sort:'updated'}):void feed.refresh()}>{feed.stale==='ranking-unavailable'?'최근 수정순으로 보기':'최신 순서로 다시 보기'}</button></div>:null}
      {!loading && !error && !feed.stale && posts.length===0 ? <section className="lounge-empty"><h2>{feed.query.q?'검색 결과가 없어요':feed.query.period!=='all' || feed.query.hasCash || feed.query.assetBands.length?'조건에 맞는 포트폴리오가 없어요':mine?'아직 공유한 포트폴리오가 없어요':'첫 포트폴리오를 공유해 보세요'}</h2><p>종목과 비율로 서로의 투자 구성을 살펴봐요.</p>{feed.query.q || feed.query.period!=='all' || feed.query.hasCash || feed.query.assetBands.length?<button className="ui-button ui-button--quiet" onClick={()=>feed.apply({...DEFAULT_FEED_QUERY})}>전체 보기</button>:null}{!allocation ? <a className="ui-button ui-button--quiet" href={appPath('portfolio')}>투자 배분 시작하기 <ArrowUpRight size={18} /></a> : null}</section> : null}
      <div ref={gridRef} className="lounge-grid">{posts.map(post => <article key={post.id} className="lounge-card" data-post-id={post.id}>
        <button className="lounge-card__open" aria-label={`${post.title} 상세 보기`} aria-describedby={post.assetBand ? `lounge-asset-${post.id}` : undefined} onClick={event => {trigger.current=event.currentTarget;feed.savePosition();void loadDetail(post.id);}}>
          <span className="lounge-card__meta"><span>{post.alias}{post.isMine ? ' · 내 공유' : ''}</span><time dateTime={post.updatedAt}>{new Date(post.updatedAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</time></span>
          <span className="lounge-card__title">{post.title}<ArrowUpRight size={20} aria-hidden="true" /></span>
        <AssetBandBadge id={`lounge-asset-${post.id}`} band={post.assetBand} /></button><AllocationSummary allocation={post.allocation} compact />
        <CommunityBar entry={community.entries[post.id]} onReact={(emoji,active)=>community.react(post.id,emoji,active)}
          onComments={button=>{trigger.current=button;feed.savePosition();void loadDetail(post.id,'comments');}} onRetry={()=>void community.load([post.id])} />
      </article>)}</div>
      <nav className="lounge-feed-pages" aria-label="포트폴리오 목록 이동">{feed.batchIndex>0?<button className="ui-button ui-button--quiet" disabled={loading || Boolean(error) || Boolean(feed.stale)} onClick={()=>void feed.previousBatch()}>이전 묶음 보기</button>:null}
        {feed.nextCursor?<button className="ui-button ui-button--secondary" disabled={loading || Boolean(error) || Boolean(feed.stale)} onClick={()=>posts.length>=120?void feed.nextBatch():void feed.loadMore()}>{posts.length>=120?'다음 묶음 보기':'더 보기'}</button>:null}</nav>
      <p className="lounge-footnote">사용자가 공유한 투자 구성입니다. 실제 수익률이나 추천 순위가 아니에요.</p>
    </AppContentFrame>
    {changingNickname ? <NicknameChangeDialog repository={repository} returnFocusRef={managementTrigger} onCurrentNickname={setCurrentNickname}
      onChanged={() => {setNotice('닉네임을 저장했어요.'); void feed.refresh();}} onClose={() => setChangingNickname(false)} /> : null}
    {detailOpen ? <ResponsiveDialog open labelledBy={detailMode==='notifications'?'lounge-notification-title':'lounge-detail-title'} returnFocusRef={trigger} busy={deleting || commentsBusy || notificationOpening}
      onRequestClose={() => !deletingRef.current && (commentNavigationRef.current?.canClose() ?? true)} onClosed={closeDetail}>
      {({requestClose}) => detailMode==='notifications'?<NotificationInbox notifications={notifications} onClose={closeDetail} onOpen={openNotification} position={inboxPosition} error={notificationError} opening={notificationOpening}/> : detail && detailMode==='comments' ? <PublicationComments key={detail.id} repository={repository} post={detail}
        initialCommentId={commentId} initialContext={commentContext} count={community.entries[detail.id]?.summary?.commentCount??0} onSummary={community.accept} onClose={closeDetail} requestClose={()=>requestClose('button')} navigationRef={commentNavigationRef} onBusyChange={setCommentsBusy}
        onBack={backFromComments} />
        : <ResponsiveDialogLayout title={deleteConfirm ? '공유를 삭제할까요?' : detail?.title ?? '공유 포트폴리오'} titleId="lounge-detail-title" onClose={closeDetail} layout="preview"
        status={detailError ? <p role="alert">{detailError}</p> : undefined}
        footer={detail ? <ResponsiveDialogActionRow>{deleteConfirm ? <>
          <button className="ui-button ui-button--secondary" disabled={deleting} onClick={() => setDeleteConfirm(false)}>유지하기</button>
          <button className="ui-button ui-button--primary" disabled={deleting} onClick={async () => {
            if (deletingRef.current) return; deletingRef.current=true; setDeleting(true); setDetailError('');
            try {await repository.remove(detail); if (!mounted.current) return; setPosts(p => p.filter(item => item.id !== detail.id)); setNotice('공유를 삭제했어요.'); deletingRef.current=false; setDeleting(false); requestClose('button');}
            catch(error) {if (mounted.current) {setDetailError(loungeErrorMessage(error)); deletingRef.current=false; setDeleting(false);}}
          }}>{deleting ? '삭제 중…' : '공유 삭제'}</button>
        </> : <>
          {detail.isMine ? <button className="ui-button ui-button--quiet" onClick={() => setDeleteConfirm(true)}>공유 삭제</button> : null}
          <a className="ui-button ui-button--primary" href={`${appPath('portfolio')}?publication=${detail.id}`}>이 비율로 시작하기</a>
        </>}</ResponsiveDialogActionRow> : undefined}>
        {detailLoading ? <p role="status">불러오는 중…</p> : null}
        {detail ? deleteConfirm ? <p>커뮤니티에서 사라지고 기존 게시물 링크도 열 수 없어요. 내 투자 배분은 유지돼요.</p> : <div className="lounge-detail">
          <p className="lounge-muted">{detail.alias} · {new Date(detail.updatedAt).toLocaleDateString('ko-KR')}</p>
          <AssetBandBadge band={detail.assetBand} /><AllocationSummary allocation={detail.allocation} />{detail.note ? <p className="lounge-note">{detail.note}</p> : null}
          <CommunityBar entry={community.entries[detail.id]} commentButtonRef={detailCommentsRef} onReact={(emoji,active)=>community.react(detail.id,emoji,active)}
            onComments={()=>setDetailMode('comments')} onRetry={()=>void community.load([detail.id])} />
          <button className="ui-button ui-button--quiet" onClick={async () => {
            try {await navigator.clipboard.writeText(`${window.location.origin}${appPath('lounge')}?post=${detail.id}`); setCopied(true);}
            catch {setDetailError('링크를 복사하지 못했어요. 주소창의 링크를 복사해 주세요.');}
          }}>{copied ? '링크 복사 완료' : '게시물 링크 복사'}</button>
          <p className="lounge-muted">로그인한 사용자에게 공유된 비율이에요. 가져오기 전에 내 투자금 기준으로 확인할 수 있어요.</p>
        </div> : null}
      </ResponsiveDialogLayout>}
    </ResponsiveDialog> : null}
    {editor && allocation ? <PublicationEditor repository={repository} nickname={currentNickname} existing={editor.existing} allocation={allocation} suggestedAssetBand={suggestedAssetBand} returnFocusRef={publishTrigger} onClose={() => setEditor(null)}
      onSaved={() => {setEditor(null); setNotice('커뮤니티에 공유했어요.'); void feed.refresh();}} /> : null}
  </AppShell>;
}
