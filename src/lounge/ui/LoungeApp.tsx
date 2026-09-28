import {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Plus} from 'lucide-react';
import {AppShell} from '../../components/common/AppShell';
import {AppContentFrame} from '../../components/common/AppContentFrame';
import {AppManagementMenu} from '../../journey/ui/AppManagementMenu';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {appPath} from '../../journey/routes';
import type {PortfolioPlan} from '../../portfolio/domain/model';
import {allocationFromPlan, publicationQuery, PUBLICATION_PAGE_SIZE, type Publication} from '../domain/publication';
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
import {refreshPublications} from './refreshPublications';

export function LoungeApp({repository, nickname, plan, suggestedAssetBand = null}: {repository: LoungeRepository; nickname: string; plan: PortfolioPlan | null; suggestedAssetBand?: AssetBand | null}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef=useRef<HTMLDivElement>(null);
  const managementTrigger = useRef<HTMLButtonElement>(null);
  const [currentNickname, setCurrentNickname] = useState(nickname);
  const [changingNickname, setChangingNickname] = useState(false);
  useEffect(() => {headingRef.current?.focus();}, []);
  const [mine, setMine] = useState(false);
  const [posts, setPosts] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const mounted = useRef(true);
  const detailGeneration = useRef(0);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<Publication | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMode,setDetailMode] = useState<'allocation'|'comments'>('allocation');
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
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; generation.current++;};}, []);
  const load = useCallback(async (before?: Publication) => {
    const token = ++generation.current; setLoading(true); setError('');
    try {
      const result = await repository.list(mine, before);
      if (!mounted.current || token !== generation.current) return;
      setPosts(previous => before ? [...previous, ...result.filter(p => !previous.some(old => old.id === p.id))] : result);
      setMore(result.length === PUBLICATION_PAGE_SIZE);
      void community.load(result.map(post=>post.id));
    } catch(error) {if (mounted.current && token === generation.current) setError(loungeErrorMessage(error));}
    finally {if (mounted.current && token === generation.current) setLoading(false);}
  }, [repository, mine, community.load]);
  useEffect(() => {setPosts([]); void load();}, [load]);
  const loadDetail = useCallback(async (id: string, mode:'allocation'|'comments'='allocation') => {
    const token = ++detailGeneration.current;
    setCopied(false);
    const url = new URL(window.location.href); url.searchParams.set('post', id); history.replaceState(null, '', `${url.pathname}${url.search}`);
    setDetail(null); setDetailError(''); setDetailLoading(true); setDetailOpen(true); setDeleteConfirm(false);
    setDetailMode(mode);void community.load([id]);
    try {
      const post = await repository.get(id);
      if (!mounted.current || token !== detailGeneration.current) return;
      if (post) setDetail(post); else setDetailError('삭제되었거나 더 이상 볼 수 없는 포트폴리오예요.');
    } catch(error) {if (mounted.current && token === detailGeneration.current) setDetailError(loungeErrorMessage(error));}
    finally {if (mounted.current && token === detailGeneration.current) setDetailLoading(false);}
  }, [repository, community.load]);
  useEffect(() => {const id = publicationQuery(window.location.search); if (id) void loadDetail(id);}, [loadDetail]);
  function closeDetail() {
    detailGeneration.current++;
    setDetailOpen(false); setDeleteConfirm(false);
    const url = new URL(window.location.href); url.searchParams.delete('post');
    history.replaceState(null, '', `${url.pathname}${url.search}`);
  }
  async function openEditor() {
    if (editorLock.current) return;
    editorLock.current = true; setOpeningEditor(true); setError('');
    try {
      const own = await repository.list(true);
      if (mounted.current) setEditor({existing: own[0] ?? null});
    } catch(error) {if (mounted.current) setError(loungeErrorMessage(error));}
    finally {editorLock.current = false; if (mounted.current) setOpeningEditor(false);}
  }
  const refreshBlocked=useRef(false);
  refreshBlocked.current=loading || Boolean(error) || detailOpen || Boolean(editor) || openingEditor || changingNickname;
  function canRefreshFeed() {
    return !refreshBlocked.current && document.visibilityState!=='hidden' && window.scrollY<=1 &&
      !gridRef.current?.contains(document.activeElement) && !document.querySelector('[role="dialog"],[role="menu"],.community-picker');
  }
  useLoungeRefresh(async()=>{
    const visible=[...(gridRef.current?.querySelectorAll<HTMLElement>('[data-post-id]')??[])].filter(card=>{
      const box=card.getBoundingClientRect();
      return box.bottom>0 && box.top<innerHeight && !card.querySelector('.community')?.contains(document.activeElement);
    }).map(card=>card.dataset.postId!);
    if(detailOpen && detail) visible.push(detail.id);
    const summaries=community.load(visible,true,()=>!document.activeElement?.closest('.community'));
    if(canRefreshFeed()) {
      const token=generation.current;
      try {
        const latest=await repository.list(mine);
        if(mounted.current && token===generation.current && canRefreshFeed()) {
          const next=refreshPublications(posts,latest);
          setPosts(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
          if(next.length<=PUBLICATION_PAGE_SIZE) setMore(latest.length===PUBLICATION_PAGE_SIZE);
          void community.load(latest.filter(post=>!community.entries[post.id]).map(post=>post.id));
        }
      } catch { /* A background failure keeps the current view until the next poll. */ }
    }
    await summaries;
  });
  return <AppShell currentApp="lounge" managementMenu={<AppManagementMenu triggerRef={managementTrigger}
    items={[{kind:'action',id:'change-nickname',label:'닉네임 변경',onSelect:() => setChangingNickname(true)}]} />}>
    <AppContentFrame className="lounge-page">
      <h1 className="lounge-heading" ref={headingRef} tabIndex={-1}>포트폴리오 라운지</h1>
      <header className="lounge-header"><p className="lounge-muted" aria-label="내 라운지 닉네임">{currentNickname}</p>
        {allocation ? <button ref={publishTrigger} className="ui-button ui-button--primary" onClick={openEditor} disabled={openingEditor}><Plus size={18} aria-hidden="true" />{openingEditor ? '불러오는 중' : '내 포트폴리오 공유'}</button>
          : <a className="ui-button ui-button--secondary" href={appPath('portfolio')}>{plan ? '투자 대상 이름 확인' : '내 포트폴리오 만들기'}</a>}
      </header>
      {plan && !allocation ? <p role="status" className="lounge-muted">공유하려면 투자 대상 이름을 40자 이내로 정리해 주세요.</p> : null}
      <div className="lounge-toolbar"><div className="lounge-tabs" aria-label="게시물 범위">{[false,true].map(value => <button key={String(value)} aria-pressed={mine===value} onClick={() => setMine(value)}>{value ? '내 공유' : '전체'}</button>)}</div><span className="lounge-muted">최근 공유순</span></div>
      <div aria-live="polite">{notice ? <p className="lounge-notice">{notice}</p> : null}{loading ? <p className="lounge-muted" role="status">포트폴리오를 불러오고 있어요…</p> : null}</div>
      {error ? <div className="lounge-empty" role="alert"><p>{error}</p><button className="ui-button ui-button--secondary" onClick={() => void load()}>다시 불러오기</button></div> : null}
      {!loading && !error && posts.length===0 ? <section className="lounge-empty"><h2>{mine ? '아직 공유한 포트폴리오가 없어요' : '첫 포트폴리오를 공유해 보세요'}</h2><p>종목과 비율로 서로의 투자 구성을 살펴봐요.</p>{!allocation ? <a className="ui-button ui-button--quiet" href={appPath('portfolio')}>투자 배분 시작하기 <ArrowUpRight size={18} /></a> : null}</section> : null}
      <div ref={gridRef} className="lounge-grid">{posts.map(post => <article key={post.id} className="lounge-card" data-post-id={post.id}>
        <button className="lounge-card__open" aria-label={`${post.title} 상세 보기`} aria-describedby={post.assetBand ? `lounge-asset-${post.id}` : undefined} onClick={event => {trigger.current=event.currentTarget; void loadDetail(post.id);}}>
          <span className="lounge-card__meta"><span>{post.alias}{post.isMine ? ' · 내 공유' : ''}</span><time dateTime={post.updatedAt}>{new Date(post.updatedAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</time></span>
          <span className="lounge-card__title">{post.title}<ArrowUpRight size={20} aria-hidden="true" /></span>
        <AssetBandBadge id={`lounge-asset-${post.id}`} band={post.assetBand} /></button><AllocationSummary allocation={post.allocation} compact />
        <CommunityBar entry={community.entries[post.id]} onReact={(emoji,active)=>community.react(post.id,emoji,active)}
          onComments={button=>{trigger.current=button;void loadDetail(post.id,'comments');}} onRetry={()=>void community.load([post.id])} />
      </article>)}</div>
      {more ? <button className="ui-button ui-button--secondary lounge-more" disabled={loading} onClick={() => void load(posts.at(-1))}>더 보기</button> : null}
      <p className="lounge-footnote">사용자가 공유한 투자 구성입니다. 실제 수익률이나 추천 순위가 아니에요.</p>
    </AppContentFrame>
    {changingNickname ? <NicknameChangeDialog repository={repository} returnFocusRef={managementTrigger} onCurrentNickname={setCurrentNickname}
      onChanged={() => {setNotice('닉네임을 저장했어요.'); void load();}} onClose={() => setChangingNickname(false)} /> : null}
    {detailOpen ? <ResponsiveDialog open labelledBy="lounge-detail-title" returnFocusRef={trigger} busy={deleting || commentsBusy}
      onRequestClose={() => !deletingRef.current && (commentNavigationRef.current?.canClose() ?? true)} onClosed={closeDetail}>
      {({requestClose}) => detail && detailMode==='comments' ? <PublicationComments key={detail.id} repository={repository} post={detail}
        onSummary={community.accept} onClose={closeDetail} requestClose={()=>requestClose('button')} navigationRef={commentNavigationRef} onBusyChange={setCommentsBusy}
        onBack={()=>{setDetailMode('allocation');requestAnimationFrame(()=>detailCommentsRef.current?.focus());}} />
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
        {detail ? deleteConfirm ? <p>라운지에서 사라지고 기존 게시물 링크도 열 수 없어요. 내 투자 배분은 유지돼요.</p> : <div className="lounge-detail">
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
      onSaved={() => {setEditor(null); setNotice('라운지에 공유했어요.'); void load();}} /> : null}
  </AppShell>;
}
