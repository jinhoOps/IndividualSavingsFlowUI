import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { GraphNode } from './mapLayout';
import { animateModalToNode, animateNodeToModal, type AnimationHandle } from './motion';

export interface AccountMapModalRelatedItem {
  label: string;
  amountWon: number;
  status: 'active' | 'suspended';
  linkId?: string;
  purposeId?: string;
  locationId?: string;
  remainder?: boolean;
  replacementCandidate?: boolean;
}

export interface AccountMapModalProps {
  node: GraphNode;
  related: AccountMapModalRelatedItem[];
  sourceElement: HTMLElement | null;
  fallbackElement: HTMLElement | null;
  reducedMotion: boolean;
  onClose(): void;
  onArchiveLocation?(locationId: string, replacementRemainderByPurpose: Record<string, string | null>): Promise<boolean> | boolean;
  onRestoreLocation?(locationId: string, restoreLinkIds: string[], remainderByPurpose: Record<string, string | null>): Promise<boolean> | boolean;
}

export function AccountMapModal({ node, related, sourceElement, fallbackElement, reducedMotion, onClose, onArchiveLocation, onRestoreLocation }: AccountMapModalProps): JSX.Element {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationHandle | null>(null);
  const [mode, setMode] = useState<'read' | 'edit' | 'archive' | 'restore'>('read');
  const [replacementByPurpose, setReplacementByPurpose] = useState<Record<string, string | null>>({});
  const [restoreLinkIds, setRestoreLinkIds] = useState<string[]>([]);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [animating, setAnimating] = useState(true);
  const closingRef = useRef(false);

  useEffect(() => {
    const modal = modalRef.current;
    if (modal === null) return;
    const sourceRect = sourceElement?.isConnected === true
      ? sourceElement.getBoundingClientRect()
      : modal.getBoundingClientRect();
    animationRef.current = animateNodeToModal(sourceRect, modal, {
      reducedMotion,
      onComplete: () => setAnimating(false),
    });
    modal.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    return () => animationRef.current?.cancel();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  function finishClose() {
    onClose();
    const focusTarget = sourceElement?.isConnected === true ? sourceElement : fallbackElement;
    if (focusTarget !== null) {
      if (focusTarget.tabIndex < 0) focusTarget.tabIndex = -1;
      focusTarget.focus();
    }
  }

  function requestClose(force = false) {
    if (closingRef.current || animating || (actionPending && !force)) return;
    closingRef.current = true;
    setAnimating(true);
    const modal = modalRef.current;
    if (modal === null) { finishClose(); return; }
    const targetRect = sourceElement?.isConnected === true
      ? sourceElement.getBoundingClientRect()
      : fallbackElement?.getBoundingClientRect() ?? modal.getBoundingClientRect();
    animationRef.current = animateModalToNode(modal, targetRect, { reducedMotion, onComplete: finishClose });
  }

  const locationId = node.kind === 'location' ? node.id.replace(/^location:/u, '') : null;
  const directRelated = related.filter(({ replacementCandidate }) => replacementCandidate !== true);
  const archiveImpacts = directRelated.filter(({ status }) => status === 'active');
  const remainderPurposes = [...new Set(archiveImpacts.filter(({ remainder }) => remainder === true).map(({ purposeId }) => purposeId).filter((id): id is string => id !== undefined))];
  const replacementMissing = remainderPurposes.some((purposeId) => {
    const candidates = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId);
    return candidates.length > 0 && !replacementByPurpose[purposeId];
  });

  return (
    <div className="account-map-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={modalRef} className="account-map-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={animating || undefined}>
        <header><div><p>{node.kind === 'purpose' ? '목적' : node.kind === 'location' ? '계좌·보관처' : '전체 상태'}</p><h2 id={titleId}>{mode === 'read' ? `${node.label} 상세` : mode === 'edit' ? `${node.label} 편집` : mode === 'archive' ? `${node.label} 보관` : `${node.label} 복원`}</h2></div><button type="button" className="account-map-modal__close" aria-label="닫기" disabled={animating || actionPending} onClick={() => requestClose()}>×</button></header>
        <div className="account-map-modal__body">
          {node.amountWon === undefined ? null : <div className="account-map-modal__amount"><span>월 기준</span><strong>{formatWon(node.amountWon)}</strong></div>}
          {mode === 'read' ? <div className="account-map-modal__connections"><h3>연결</h3>{directRelated.length === 0 ? <p>연결된 항목이 없습니다.</p> : directRelated.map((item, index) => <div key={`${item.label}:${index}`}><span>{item.label}</span><strong>{formatWon(item.amountWon)}</strong>{item.status === 'suspended' ? <small>중지됨</small> : null}</div>)}</div> : null}
          {mode === 'edit' ? <div className="account-map-modal__edit"><p>금액과 연결 변경은 이 화면 안에서 이어집니다.</p>{directRelated.map((item, index) => <label key={`${item.label}:${index}`}>{item.label}<input inputMode="numeric" defaultValue={item.amountWon} aria-label={`${item.label} 월 금액`} /></label>)}</div> : null}
          {mode === 'archive' ? <div className="account-map-modal__impact"><p>보관하면 다음 연결이 중지됩니다.</p>{archiveImpacts.map((item, index) => <p key={`${item.linkId}:${index}`}>{`${item.label} ${formatWon(item.amountWon)} 연결이 중지됩니다`}</p>)}{remainderPurposes.map((purposeId) => {
            const candidates = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId);
            return candidates.length === 0 ? null : <label key={purposeId}>새 나머지 계좌<select required aria-label="새 나머지 계좌" value={replacementByPurpose[purposeId] ?? ''} onChange={(event) => setReplacementByPurpose((current) => ({ ...current, [purposeId]: event.target.value || null }))}><option value="">선택해 주세요</option>{candidates.map((item) => <option key={item.linkId} value={item.linkId}>{item.label}</option>)}</select></label>;
          })}</div> : null}
          {mode === 'restore' ? <div className="account-map-modal__restore"><p>다시 연결할 항목만 선택해 주세요.</p>{directRelated.filter(({ status }) => status === 'suspended').map((item) => <label key={item.linkId}><input type="checkbox" checked={item.linkId !== undefined && restoreLinkIds.includes(item.linkId)} onChange={(event) => { if (item.linkId === undefined) return; setRestoreLinkIds((current) => event.target.checked ? [...current, item.linkId!] : current.filter((id) => id !== item.linkId)); }} />{item.label} · {formatWon(item.amountWon)}</label>)}</div> : null}
          {actionError ? <p className="account-map-modal__error" role="alert">저장하지 못했습니다. 선택은 유지했습니다. 다시 시도해 주세요.</p> : null}
        </div>
        <footer>
          {mode === 'read' ? <>{node.kind === 'location' && node.status === 'suspended' && onRestoreLocation !== undefined ? <button type="button" className="ui-button ui-button--secondary" onClick={() => setMode('restore')}>복원</button> : null}{node.kind === 'location' && node.status !== 'suspended' && onArchiveLocation !== undefined ? <button type="button" className="ui-button ui-button--secondary account-map-modal__archive" onClick={() => setMode('archive')}><TrashIcon />보관</button> : null}<button type="button" className="ui-button ui-button--primary" disabled={animating} onClick={() => setMode('edit')}>편집</button></> : null}
          {mode === 'edit' ? <><button type="button" className="ui-button ui-button--secondary" onClick={() => setMode('read')}>취소</button><button type="button" className="ui-button ui-button--primary">저장</button></> : null}
          {mode === 'archive' ? <><button type="button" className="ui-button ui-button--secondary" onClick={() => setMode('read')}>취소</button><button type="button" className="ui-button ui-button--primary" disabled={replacementMissing || actionPending} onClick={() => {
            if (locationId === null || onArchiveLocation === undefined) return;
            setActionError(false);
            setActionPending(true);
            void Promise.resolve(onArchiveLocation(locationId, replacementByPurpose)).then((saved) => { if (saved) requestClose(true); else setActionError(true); }, () => setActionError(true)).finally(() => setActionPending(false));
          }}>{actionError ? '다시 시도' : '보관하기'}</button></> : null}
          {mode === 'restore' ? <><button type="button" className="ui-button ui-button--secondary" onClick={() => setMode('read')}>취소</button><button type="button" className="ui-button ui-button--primary" disabled={restoreLinkIds.length === 0 || actionPending} onClick={() => {
            if (locationId === null || onRestoreLocation === undefined) return;
            setActionError(false);
            setActionPending(true);
            void Promise.resolve(onRestoreLocation(locationId, restoreLinkIds, {})).then((saved) => { if (saved) requestClose(true); else setActionError(true); }, () => setActionError(true)).finally(() => setActionPending(false));
          }}>{actionError ? '다시 시도' : '선택 복원'}</button></> : null}
        </footer>
      </div>
    </div>
  );
}

function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }

function TrashIcon(): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M18 7l-1 13H7L6 7M10 11v5M14 11v5" /></svg>;
}
