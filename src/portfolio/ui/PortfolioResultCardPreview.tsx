import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { getBrowserClient, readSupabaseConfig } from '../../auth/auth';
import type { AccountWorkspaceSession } from '../../workspace/infrastructure/accountWorkspaceSession';
import { downloadResultCard, renderResultCardPng } from '../../journey/result-card/files';
import { buildResultCardModel, type ResultCardBuild } from '../../journey/result-card/model';
import { renderResultCardSvg } from '../../journey/result-card/renderResultCardSvg';
import { createResultCardShareClient, ResultCardShareError } from '../../journey/result-card/shareClient';
import { resultCardShareUrl } from '../../journey/result-card/shareUrl';

type Intent = 'save' | 'share';

export function PortfolioResultCardPreview({
  open,
  intent,
  session,
  initialIncludeAmounts,
  returnFocusRef,
  onClose,
}: {
  open: boolean;
  intent: Intent;
  session: AccountWorkspaceSession | null;
  initialIncludeAmounts: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
}) {
  const [includeAmounts, setIncludeAmounts] = useState(initialIncludeAmounts);
  const [build, setBuild] = useState<ResultCardBuild | null>(null);
  const [png, setPng] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const staleRef = useRef(false);
  const requestId = useRef('');
  const shareToken = useRef('');
  const title = intent === 'save' ? '계획 이미지 저장' : '계획 이미지 공유';

  useEffect(() => {
    if (!open) return;
    setIncludeAmounts(initialIncludeAmounts);
    setStale(false); setShareUrl(null); setExpiresAt(null); setNotice('');
  }, [initialIncludeAmounts, open]);

  useEffect(() => {
    if (!open) return;
    const current = ++generation.current;
    staleRef.current = false;
    requestId.current = crypto.randomUUID();
    shareToken.current = newShareToken();
    // Keep the current image's space while regenerating so the footer cannot jump under a tap.
    setPng(null); setShareUrl(null); setExpiresAt(null); setNotice('');
    const workspace = session?.snapshot;
    if (!workspace || session?.status !== 'ready' || session.pending !== null) {
      setBuild({kind: 'blocked', reason: 'main-required'});
      return;
    }
    const next = buildResultCardModel(structuredClone(workspace), {includeAmounts});
    setBuild(next);
    if (next.kind !== 'ready') return;
    void renderResultCardPng(renderResultCardSvg(next.model)).then(blob => {
      if (generation.current !== current) return;
      setPng(blob); setPreviewUrl(URL.createObjectURL(blob));
    }).catch(() => {
      if (generation.current === current) setNotice('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
    });
    return () => { generation.current++; };
  }, [includeAmounts, open, session]);

  useEffect(() => {
    if (!open || !session || build?.kind !== 'ready') return;
    return session.subscribe(() => {
      if (session.snapshot?.revision !== build.model.revision || session.status !== 'ready' || session.pending !== null) {
        staleRef.current = true;
        setStale(true);
      }
    });
  }, [build, open, session]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const ready = build?.kind === 'ready' && png !== null && !stale;
  const blockedCopy = useMemo(() => build?.kind === 'blocked' ? blockedMessage(build.reason) : '', [build]);
  const filename = `ISF-plan-${new Date().toISOString().slice(0, 10)}.png`;

  function save() {
    if (!png || stale) return;
    setNotice(downloadResultCard(png, filename) ? '다운로드를 요청했어요.' : '이미지를 저장하지 못했습니다. 다시 시도해 주세요.');
  }
  async function createShare() {
    if (!png || build?.kind !== 'ready' || stale || sharing) return;
    const currentGeneration = generation.current;
    const sourceRevision = build.model.revision;
    setSharing(true); setNotice('');
    try {
      const config = readSupabaseConfig(import.meta.env);
      const client = getBrowserClient(config);
      const share = createResultCardShareClient({
        supabaseUrl: config.url,
        accessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      });
      const result = await share.create(png, requestId.current, shareToken.current, new AbortController().signal);
      if (
        generation.current !== currentGeneration
        || staleRef.current
        || session?.snapshot?.revision !== sourceRevision
      ) return;
      const url = resultCardShareUrl(window.location.origin, import.meta.env.BASE_URL, result.token);
      setShareUrl(url); setExpiresAt(result.expiresAt);
    } catch (error) {
      if (generation.current !== currentGeneration) return;
      if (error instanceof ResultCardShareError && error.code === 'share_expired') {
        requestId.current = crypto.randomUUID();
        shareToken.current = newShareToken();
      }
      setNotice(error instanceof Error ? error.message : '공유 링크를 만들지 못했습니다.');
    } finally { if (generation.current === currentGeneration) setSharing(false); }
  }
  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setNotice('링크를 복사했어요.'); }
    catch { setNotice('링크를 복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.'); }
  }
  async function shareLink() {
    if (!shareUrl) return;
    if (typeof navigator.share !== 'function') { await copyLink(); return; }
    try { await navigator.share({url: shareUrl}); }
    catch (error) { if ((error as {name?: string}).name !== 'AbortError') setNotice('링크를 공유하지 못했습니다. 복사해서 전달해 주세요.'); }
  }

  return <ResponsiveDialog open={open} labelledBy="result-card-preview-title" size="wide" mobileHeight="full"
    mobileEntranceMotion busy={sharing} returnFocusRef={returnFocusRef} onRequestClose={() => !sharing} onClosed={onClose}>
    {({ requestClose }) => <ResponsiveDialogLayout
      title={title}
      titleId="result-card-preview-title"
      eyebrow="나의 자금 계획"
      layout="preview"
      bodyClassName="result-card-preview__body"
      footerClassName="result-card-preview__footer"
      onClose={() => requestClose('button')}
      footer={<>
        {intent === 'share' ? <Button type="button" variant="secondary" disabled={!ready || sharing} onClick={save}>이미지 저장</Button> : null}
        {intent === 'save' ? <Button type="button" variant="primary" disabled={!ready} onClick={save}>이미지 저장</Button> : <Button type="button" variant="primary" disabled={!ready || sharing || shareUrl !== null} onClick={() => void createShare()}>{sharing ? '링크 만드는 중…' : '공유 링크 만들기'}</Button>}
      </>}
    >
      {previewUrl ? <img className="result-card-preview__image" src={previewUrl} alt="저장하거나 공유할 나의 자금 계획 이미지" /> : null}
      {build?.kind === 'blocked' ? <p role="alert">{blockedCopy}</p> : null}
      {!previewUrl && build?.kind === 'ready' && !notice ? <p role="status">이미지를 준비하고 있어요.</p> : null}
      <label className="result-card-preview__amounts"><span><strong>금액 포함</strong><small>공유할 이미지에 원화 금액을 표시합니다.</small></span><input type="checkbox" role="switch" checked={includeAmounts} disabled={sharing} onChange={event => {
        setPng(null);
        setIncludeAmounts(event.target.checked);
      }} /></label>
      {intent === 'share' ? <p className="result-card-preview__privacy">링크를 가진 사람은 누구나 이 이미지를 볼 수 있어요.<br />공유 링크는 최대 2일 동안 열 수 있어요. 정확한 만료 시각은 생성 후 표시돼요.</p> : null}
      {stale ? <p role="alert">계획이 변경됐어요. 미리보기를 닫고 다시 만들어 주세요.</p> : null}
      {notice ? <p role={notice.includes('못했') ? 'alert' : 'status'}>{notice}</p> : null}
      {shareUrl ? <section className="result-card-preview__link" aria-label="공유 링크"><strong>{expiresAt ? `${new Date(expiresAt).toLocaleString('ko-KR')}까지 볼 수 있어요.` : '공유 링크를 만들었어요.'}</strong><input aria-label="공유 링크" value={shareUrl} readOnly /><div><Button type="button" variant="secondary" onClick={() => void copyLink()}><Copy size={18} aria-hidden="true" />링크 복사</Button><Button type="button" variant="primary" onClick={() => void shareLink()}><Share2 size={18} aria-hidden="true" />링크 공유</Button></div></section> : null}
    </ResponsiveDialogLayout>}
  </ResponsiveDialog>;
}

function blockedMessage(reason: Exclude<ResultCardBuild, {kind: 'ready'}>['reason']): string {
  if (reason === 'main-required') return '로그인한 계정의 적용된 Main 계획이 필요해요.';
  if (reason === 'simulation-required') return '종합 이미지를 만들려면 Simulation 조건을 먼저 적용해 주세요.';
  if (reason === 'portfolio-required') return '종합 이미지를 만들려면 Portfolio 배분을 먼저 적용해 주세요.';
  if (reason === 'source-mismatch') return 'Main이 변경됐어요. Simulation과 Portfolio에서 최신 기준을 적용한 뒤 다시 만들어 주세요.';
  return '현재 계획으로는 이미지를 만들 수 없어요. 입력값을 확인해 주세요.';
}

function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
