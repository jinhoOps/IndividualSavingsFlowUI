import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { GraphNode } from './mapLayout';
import { animateModalToNode, animateNodeToModal, type AnimationHandle } from './motion';

export interface AccountMapModalRelatedItem {
  label: string;
  amountWon: number;
  status: 'active' | 'suspended';
}

export interface AccountMapModalProps {
  node: GraphNode;
  related: AccountMapModalRelatedItem[];
  sourceElement: HTMLElement | null;
  fallbackElement: HTMLElement | null;
  reducedMotion: boolean;
  onClose(): void;
}

export function AccountMapModal({ node, related, sourceElement, fallbackElement, reducedMotion, onClose }: AccountMapModalProps): JSX.Element {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationHandle | null>(null);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
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

  function requestClose() {
    if (closingRef.current || animating) return;
    closingRef.current = true;
    setAnimating(true);
    const modal = modalRef.current;
    if (modal === null) { finishClose(); return; }
    const targetRect = sourceElement?.isConnected === true
      ? sourceElement.getBoundingClientRect()
      : fallbackElement?.getBoundingClientRect() ?? modal.getBoundingClientRect();
    animationRef.current = animateModalToNode(modal, targetRect, { reducedMotion, onComplete: finishClose });
  }

  return (
    <div className="account-map-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={modalRef} className="account-map-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={animating || undefined}>
        <header><div><p>{node.kind === 'purpose' ? '목적' : node.kind === 'location' ? '계좌·보관처' : '전체 상태'}</p><h2 id={titleId}>{mode === 'read' ? `${node.label} 상세` : `${node.label} 편집`}</h2></div><button type="button" className="account-map-modal__close" aria-label="닫기" disabled={animating} onClick={requestClose}>×</button></header>
        <div className="account-map-modal__body">
          {node.amountWon === undefined ? null : <div className="account-map-modal__amount"><span>월 기준</span><strong>{formatWon(node.amountWon)}</strong></div>}
          {mode === 'read' ? (
            <div className="account-map-modal__connections"><h3>연결</h3>{related.length === 0 ? <p>연결된 항목이 없습니다.</p> : related.map((item, index) => <div key={`${item.label}:${index}`}><span>{item.label}</span><strong>{formatWon(item.amountWon)}</strong>{item.status === 'suspended' ? <small>중지됨</small> : null}</div>)}</div>
          ) : (
            <div className="account-map-modal__edit"><p>금액과 연결 변경은 이 화면 안에서 이어집니다.</p>{related.map((item, index) => <label key={`${item.label}:${index}`}>{item.label}<input inputMode="numeric" defaultValue={item.amountWon} aria-label={`${item.label} 월 금액`} /></label>)}</div>
          )}
        </div>
        <footer>{mode === 'read' ? <button type="button" className="ui-button ui-button--primary" disabled={animating} onClick={() => setMode('edit')}>편집</button> : <><button type="button" className="ui-button ui-button--secondary" onClick={() => setMode('read')}>취소</button><button type="button" className="ui-button ui-button--primary">저장</button></>}</footer>
      </div>
    </div>
  );
}

function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
