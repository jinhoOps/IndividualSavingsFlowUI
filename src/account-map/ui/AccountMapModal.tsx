import { useEffect, useId, useRef, useState, type JSX } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '../../components/common/Button';
import { formatWonInput, normalizeMoneyEdit, parseWonInput } from '../../core/domain/moneyInput';
import type { GraphNode } from './mapLayout';
import { animateModalToNode, animateNodeToModal, type AnimationHandle } from './motion';
import type { RecoveryState } from '../application/reducer';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import { AccountMapLocationPicker } from './AccountMapLocationPicker';

export interface AccountMapModalRelatedItem {
  label: string;
  amountWon: number;
  status: 'active' | 'suspended';
  suspendedReason?: 'location-archived' | 'user';
  linkId?: string;
  purposeId?: string;
  locationId?: string;
  remainder?: boolean;
  replacementCandidate?: boolean;
  purposeTargetWon?: number;
}

export interface AccountMapModalProps {
  node: Omit<GraphNode, 'connectionCount'> & { connectionCount?: number };
  related: AccountMapModalRelatedItem[];
  sourceElement: HTMLElement | null;
  fallbackElement: HTMLElement | null;
  reducedMotion: boolean;
  recovery: RecoveryState;
  recoveryPending: boolean;
  saveFailed: boolean;
  onClose(): void;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
  onSaveEdit?(input: AccountMapNodeEditInput): Promise<boolean> | boolean;
  locations?: FinancialLocation[];
  onConnectLocation?(locationId: string, amount?: number): Promise<boolean> | boolean;
  onCreateAndConnectLocation?(location: FinancialLocation, amount?: number): Promise<boolean> | boolean;
  initialMode?: AccountMapModalMode;
  purposeParentLabel?: string;
  purposeTargetCapacityWon?: number;
  onArchivePurpose?(purposeId: `custom:${string}`): Promise<boolean> | boolean;
  onRestorePurpose?(purposeId: `custom:${string}`, targetMonthlyWon: number): Promise<boolean> | boolean;
  onArchiveLocation?(locationId: string, replacementRemainderByPurpose: Record<string, string | null>): Promise<boolean> | boolean;
  onRestoreLocation?(locationId: string, restoreLinkIds: string[], remainderByPurpose: Record<string, string | null>): Promise<boolean> | boolean;
}

export type AccountMapModalMode = 'read' | 'edit' | 'connect' | 'archive-location' | 'restore-location' | 'archive-purpose' | 'restore-purpose';

export interface AccountMapNodeEditInput {
  label?: string;
  targetMonthlyWon?: number;
  links: Array<{ id: string; monthlyAmountWon: number; status: 'active' | 'suspended' | 'removed'; remainder: boolean }>;
}

export function AccountMapModal({ node, related, sourceElement, fallbackElement, reducedMotion, recovery, recoveryPending, saveFailed, onClose, onReapply, onKeepLatest, onSaveEdit, locations = [], onConnectLocation, onCreateAndConnectLocation, initialMode = 'read', purposeParentLabel, purposeTargetCapacityWon, onArchivePurpose, onRestorePurpose, onArchiveLocation, onRestoreLocation }: AccountMapModalProps): JSX.Element {
  const titleId = useId();
  const recoveryDescriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const previousModeRef = useRef<AccountMapModalMode>(initialMode);
  const animationRef = useRef<AnimationHandle | null>(null);
  const directRelated = related.filter(({ replacementCandidate }) => replacementCandidate !== true);
  const restorableRelated = directRelated.filter(({ status, suspendedReason }) => (
    status === 'suspended' && suspendedReason === 'location-archived'
  ));
  const [mode, setMode] = useState<AccountMapModalMode>(initialMode);
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [editLabel, setEditLabel] = useState(node.label);
  const [editTarget, setEditTarget] = useState(node.kind === 'purpose' && node.id.startsWith('custom:') ? formatWonInput(node.amountWon ?? 0, { zeroDisplay: 'zero' }) : '');
  const [editLinks, setEditLinks] = useState(() => directRelated.filter(({ linkId }) => linkId !== undefined).map((item) => ({
    id: item.linkId!,
    purposeId: item.purposeId,
    label: item.label,
    monthlyAmountWon: formatWonInput(item.amountWon, { zeroDisplay: 'zero' }),
    status: item.status as 'active' | 'suspended' | 'removed',
    remainder: item.remainder ?? false,
  })));
  const [editReplacementByPurpose, setEditReplacementByPurpose] = useState<Record<string, string | null>>({});
  const [replacementByPurpose, setReplacementByPurpose] = useState<Record<string, string | null>>({});
  const [restoreLinkIds, setRestoreLinkIds] = useState<string[]>([]);
  const [restoreRemainderByPurpose, setRestoreRemainderByPurpose] = useState<Record<string, string | null>>({});
  const [restorePurposeTarget, setRestorePurposeTarget] = useState(formatWonInput(node.amountWon ?? 0, { zeroDisplay: 'zero' }));
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [animating, setAnimating] = useState(true);
  const closingRef = useRef(false);
  const adoptLatestAfterCloseRef = useRef(false);
  const returnToFallbackRef = useRef(false);

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
    const focusInitialControl = () => modal.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus();
    focusInitialControl();
    const focusTimer = window.setTimeout(focusInitialControl, 0);
    return () => {
      window.clearTimeout(focusTimer);
      animationRef.current?.cancel();
    };
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

  useEffect(() => {
    if (recovery.status === 'manual') {
      replayRef.current?.focus();
      return;
    }
    if (recovery.status !== 'collision') return;
    const selector = recovery.intent.kind === 'link'
      ? `[data-recovery-field="${recovery.field}"][data-recovery-link-id="${recovery.intent.id}"]`
      : `[data-recovery-field="${recovery.field}"]`;
    const field = modalRef.current?.querySelector<HTMLElement>(selector);
    (field ?? replayRef.current)?.focus();
  }, [mode, recovery.status, recovery.status === 'collision' ? collisionIdentity(recovery) : '']);

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    modalRef.current?.querySelector<HTMLElement>('.account-map-modal__body button:not(:disabled), .account-map-modal__body input:not(:disabled), .account-map-modal__body select:not(:disabled), footer button:not(:disabled)')?.focus();
  }, [mode]);

  function finishClose() {
    if (adoptLatestAfterCloseRef.current) {
      restoreFocus();
      adoptLatestAfterCloseRef.current = false;
      flushSync(() => {
        onKeepLatest();
        onClose();
      });
      restoreFocus();
      return;
    }
    onClose();
    restoreFocus();
  }

  function restoreFocus() {
    const focusTarget = !returnToFallbackRef.current && sourceElement?.isConnected === true ? sourceElement : fallbackElement;
    if (focusTarget !== null) {
      if (focusTarget.tabIndex < 0) focusTarget.tabIndex = -1;
      focusTarget.focus();
    }
  }

  function requestClose(force = false) {
    if (closingRef.current || ((!force) && (actionPending || recoveryPending))) return;
    closingRef.current = true;
    adoptLatestAfterCloseRef.current = !force && recovery.status !== 'none';
    setAnimating(true);
    const modal = modalRef.current;
    if (modal === null) { finishClose(); return; }
    animationRef.current?.cancel();
    const targetRect = sourceElement?.isConnected === true
      ? sourceElement.getBoundingClientRect()
      : fallbackElement?.getBoundingClientRect() ?? modal.getBoundingClientRect();
    animationRef.current = animateModalToNode(modal, targetRect, { reducedMotion, onComplete: finishClose });
  }

  function commitConnection(action: (() => Promise<boolean> | boolean) | undefined): void {
    if (action === undefined || actionPending || recovery.status !== 'none') return;
    setActionError(false);
    setActionPending(true);
    void Promise.resolve(action()).then((saved) => {
      if (saved) requestClose(true);
      else setActionError(true);
    }, () => setActionError(true)).finally(() => setActionPending(false));
  }

  function commitPurposeLifecycle(action: (() => Promise<boolean> | boolean) | undefined, returnToFallback: boolean): void {
    if (action === undefined || actionPending || recovery.status !== 'none') return;
    setActionError(false);
    setActionPending(true);
    void Promise.resolve(action()).then((saved) => {
      if (saved) {
        returnToFallbackRef.current = returnToFallback;
        requestClose(true);
      } else setActionError(true);
    }, () => setActionError(true)).finally(() => setActionPending(false));
  }

  const locationId = node.kind === 'location' ? node.id.replace(/^location:/u, '') : null;
  const archiveImpacts = directRelated.filter(({ status }) => status === 'active');
  const remainderPurposes = [...new Set(archiveImpacts.filter(({ remainder }) => remainder === true).map(({ purposeId }) => purposeId).filter((id): id is string => id !== undefined))];
  const replacementMissing = remainderPurposes.some((purposeId) => {
    const candidates = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId);
    return candidates.length > 0 && !replacementByPurpose[purposeId];
  });
  const restoreExcessPurposes = [...new Set(restorableRelated.filter((item) => item.linkId !== undefined && restoreLinkIds.includes(item.linkId) && item.purposeId !== undefined).map((item) => item.purposeId!))].filter((purposeId) => {
    const target = restorableRelated.find((item) => item.purposeId === purposeId)?.purposeTargetWon;
    if (target === undefined) return false;
    const restoring = restorableRelated.filter((item) => item.purposeId === purposeId && item.linkId !== undefined && restoreLinkIds.includes(item.linkId)).reduce((sum, item) => sum + item.amountWon, 0);
    const active = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId).reduce((sum, item) => sum + item.amountWon, 0);
    return restoring + active > target;
  });
  const editRemainderPurposes = [...new Set(directRelated.filter((item) => {
    if (item.status !== 'active' || item.remainder !== true || item.purposeId === undefined || item.linkId === undefined) return false;
    const edited = editLinks.find(({ id }) => id === item.linkId);
    return edited === undefined || edited.status !== 'active' || !edited.remainder;
  }).map((item) => item.purposeId!))].filter((purposeId) => (
    editLinks.some((item) => item.purposeId === purposeId && item.status === 'active')
    || related.some((item) => item.replacementCandidate === true && item.purposeId === purposeId && item.status === 'active')
  ));
  const editReplacementMissing = editRemainderPurposes.some((purposeId) => (
    !editLinks.some((item) => item.purposeId === purposeId && item.status === 'active' && item.remainder)
    && !related.some((item) => item.replacementCandidate === true && item.purposeId === purposeId && item.status === 'active' && item.remainder)
    && !editReplacementByPurpose[purposeId]
  ));

  return (
    <div className="account-map-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={modalRef} className="account-map-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={animating || undefined}>
        <header><div><p>{node.kind === 'purpose' ? '목적' : node.kind === 'location' ? '계좌·보관처' : '전체 상태'}</p><h2 id={titleId}>{modalTitle(node.label, mode)}</h2></div><div className="account-map-modal__title-actions">{node.kind === 'purpose' && node.id.startsWith('custom:') && mode === 'read' ? <div className="account-map-modal__title-menu"><button type="button" className="account-map-modal__more" aria-label={`${node.label} 더보기`} aria-expanded={titleMenuOpen} onClick={() => setTitleMenuOpen((open) => !open)}>⋯</button>{titleMenuOpen ? <div role="menu"><button type="button" role="menuitem" disabled={recovery.status !== 'none'} onClick={() => { setTitleMenuOpen(false); setMode('archive-purpose'); }}>목적 보관</button></div> : null}</div> : null}<button type="button" className="account-map-modal__close" aria-label="닫기" disabled={animating || actionPending || recoveryPending} onClick={() => requestClose()}>×</button></div></header>
        <div className="account-map-modal__body">
          {node.amountWon === undefined ? null : <div className="account-map-modal__amount"><span>월 기준</span><strong>{formatWon(node.amountWon)}</strong></div>}
          {mode === 'read' ? <div className="account-map-modal__connections"><h3>연결</h3>{directRelated.length === 0 ? <p>연결된 항목이 없습니다.</p> : directRelated.map((item, index) => <div key={`${item.label}:${index}`}><span>{item.label}</span><strong>{formatWon(item.amountWon)}</strong>{item.status === 'suspended' ? <small>중지됨</small> : null}</div>)}</div> : null}
          {mode === 'edit' ? <div className="account-map-modal__edit"><p>이름, 금액과 연결 상태를 한 번에 저장합니다.</p>{node.kind === 'purpose' ? <button type="button" className="account-map-modal__secondary-action" aria-label="연결 추가" disabled={recovery.status !== 'none'} onClick={() => setMode('connect')}><ConnectionIcon /></button> : null}{node.kind === 'location' || node.id.startsWith('custom:') ? <label>표시 이름<input data-recovery-field={node.kind === 'location' ? 'shortName' : 'name'} aria-describedby={recovery.status === 'collision' && recovery.field === (node.kind === 'location' ? 'shortName' : 'name') ? recoveryDescriptionId : undefined} value={editLabel} maxLength={node.kind === 'location' ? 8 : 24} onChange={(event) => setEditLabel(event.target.value)} /></label> : null}{node.kind === 'purpose' && node.id.startsWith('custom:') ? <label>월 목표 금액<input data-recovery-field="targetMonthlyWon" aria-describedby={recovery.status === 'collision' && recovery.field === 'targetMonthlyWon' ? recoveryDescriptionId : undefined} inputMode="numeric" value={editTarget} onChange={(event) => setEditTarget(normalizeMoneyEdit(event.target.value, event.target.selectionStart ?? event.target.value.length, { zeroDisplay: 'zero' }).displayValue)} /></label> : null}{editLinks.map((item, index) => { const collides = recovery.status === 'collision' && recovery.intent.kind === 'link' && recovery.intent.id === item.id; return <fieldset key={item.id} className="account-map-modal__edit-link"><legend>{item.label}</legend><label>월 금액<input data-recovery-field="monthlyAmountWon" data-recovery-link-id={item.id} aria-describedby={collides && recovery.field === 'monthlyAmountWon' ? recoveryDescriptionId : undefined} inputMode="numeric" value={item.monthlyAmountWon} aria-label={`${item.label} 월 금액`} onChange={(event) => setEditLinks((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, monthlyAmountWon: normalizeMoneyEdit(event.target.value, event.target.selectionStart ?? event.target.value.length, { zeroDisplay: 'zero' }).displayValue } : row))} /></label><label>연결 상태<select data-recovery-field="status" data-recovery-link-id={item.id} aria-describedby={collides && recovery.field === 'status' ? recoveryDescriptionId : undefined} aria-label={`${item.label} 연결 상태`} value={item.status} onChange={(event) => setEditLinks((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: event.target.value as typeof item.status, remainder: event.target.value === 'active' ? row.remainder : false } : row))}><option value="active">연결됨</option><option value="suspended">중지</option><option value="removed">연결 제거</option></select></label>{item.status === 'active' ? <label className="account-map-modal__remainder"><input data-recovery-field="remainder" data-recovery-link-id={item.id} aria-describedby={collides && recovery.field === 'remainder' ? recoveryDescriptionId : undefined} type="checkbox" checked={item.remainder} onChange={(event) => setEditLinks((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, remainder: event.target.checked && row.id === item.id } : row))} />나머지 금액 자동 계산</label> : null}</fieldset>; })}{editRemainderPurposes.filter((purposeId) => !editLinks.some((item) => item.purposeId === purposeId && item.status === 'active' && item.remainder) && !related.some((item) => item.replacementCandidate === true && item.purposeId === purposeId && item.status === 'active' && item.remainder)).map((purposeId) => {
            const candidates = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId && item.status === 'active' && item.linkId !== undefined);
            return candidates.length === 0
              ? <p key={`edit-remainder:${purposeId}`} className="account-map-modal__error">다른 활성 연결을 나머지로 선택해 주세요.</p>
              : <label key={`edit-remainder:${purposeId}`}>새 나머지 연결<select required aria-label="편집 나머지 연결" value={editReplacementByPurpose[purposeId] ?? ''} onChange={(event) => setEditReplacementByPurpose((current) => ({ ...current, [purposeId]: event.target.value || null }))}><option value="">선택해 주세요</option>{candidates.map((item) => <option key={item.linkId} value={item.linkId}>{item.label}</option>)}</select></label>;
          })}</div> : null}
          {mode === 'connect' ? <div className="account-map-modal__connect"><AccountMapLocationPicker locations={locations} linkedLocationIds={new Set(directRelated.map(({ locationId: id }) => id).filter((id): id is string => id !== undefined))} amountRequired={directRelated.some(({ status }) => status === 'active')} disabled={recovery.status !== 'none' || actionPending || recoveryPending} cancelDisabled={actionPending || recoveryPending} onCancel={() => { if (recovery.status === 'none') setMode('edit'); else requestClose(); }} onSelect={(id, amount) => commitConnection(onConnectLocation === undefined ? undefined : () => onConnectLocation(id, amount))} onCreate={(location, amount) => commitConnection(onCreateAndConnectLocation === undefined ? undefined : () => onCreateAndConnectLocation(location, amount))} /></div> : null}
          {mode === 'archive-location' || mode === 'archive-purpose' ? <div className="account-map-modal__impact"><p>보관하면 다음 연결이 중지됩니다.</p>{archiveImpacts.map((item, index) => <p key={`${item.linkId}:${index}`}>{`${item.label} ${formatWon(item.amountWon)} 연결이 중지됩니다`}</p>)}{mode === 'archive-location' ? remainderPurposes.map((purposeId) => {
            const candidates = related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId);
            return candidates.length === 0 ? null : <label key={purposeId}>새 나머지 계좌<select required aria-label="새 나머지 계좌" value={replacementByPurpose[purposeId] ?? ''} onChange={(event) => setReplacementByPurpose((current) => ({ ...current, [purposeId]: event.target.value || null }))}><option value="">선택해 주세요</option>{candidates.map((item) => <option key={item.linkId} value={item.linkId}>{item.label}</option>)}</select></label>;
          }) : null}</div> : null}
          {mode === 'restore-location' ? <div className="account-map-modal__restore"><p>보관할 때 중지된 연결만 선택해 다시 연결할 수 있습니다. 선택하지 않으면 계좌·보관처만 복원합니다.</p>{restorableRelated.map((item) => <label key={item.linkId}><input type="checkbox" checked={item.linkId !== undefined && restoreLinkIds.includes(item.linkId)} onChange={(event) => { if (item.linkId === undefined) return; setRestoreLinkIds((current) => event.target.checked ? [...current, item.linkId!] : current.filter((id) => id !== item.linkId)); }} />{item.label} · {formatWon(item.amountWon)}</label>)}{restoreExcessPurposes.map((purposeId) => {
            const candidates = [...restorableRelated.filter((item) => item.purposeId === purposeId && item.linkId !== undefined && restoreLinkIds.includes(item.linkId)), ...related.filter((item) => item.replacementCandidate === true && item.purposeId === purposeId)];
            return <label key={`restore:${purposeId}`} className="account-map-modal__restore-correction">초과 금액을 맞출 나머지 연결<select required aria-label="복원 나머지 연결" value={restoreRemainderByPurpose[purposeId] ?? ''} onChange={(event) => setRestoreRemainderByPurpose((current) => ({ ...current, [purposeId]: event.target.value || null }))}><option value="">선택해 주세요</option>{candidates.map((item) => <option key={item.linkId} value={item.linkId}>{item.label}</option>)}</select></label>;
          })}</div> : null}
          {mode === 'restore-purpose' ? <div className="account-map-modal__restore-purpose">
            {purposeParentLabel === undefined ? null : <p>큰 목적 · {purposeParentLabel}</p>}
            <label>월 목표 금액<input data-recovery-field="targetMonthlyWon" aria-describedby={recovery.status === 'collision' && recovery.field === 'targetMonthlyWon' ? recoveryDescriptionId : undefined} inputMode="numeric" value={restorePurposeTarget} onChange={(event) => setRestorePurposeTarget(normalizeMoneyEdit(event.target.value, event.target.selectionStart ?? event.target.value.length, { zeroDisplay: 'zero' }).displayValue)} /></label>
            {purposeTargetCapacityWon === undefined ? null : <p className="account-map-hint">복원 가능 {formatWon(purposeTargetCapacityWon)}</p>}
            {purposeTargetCapacityWon !== undefined && parseWonInput(restorePurposeTarget) > purposeTargetCapacityWon ? <p className="account-map-modal__error">최신 큰 목적의 월 금액을 넘을 수 없습니다.</p> : null}
            {directRelated.some(({ status }) => status === 'suspended') ? <p>목적만 복원하며 중지된 연결은 자동으로 재개하지 않습니다.</p> : null}
          </div> : null}
          {actionError && recovery.status === 'none' ? <p className="account-map-modal__error" role="alert">저장하지 못했습니다. 선택은 유지했습니다. 다시 시도해 주세요.</p> : null}
          {saveFailed && recovery.status !== 'none' ? <p className="account-map-modal__error" role="alert">저장하지 못했습니다. 편집 중인 입력은 그대로 두었습니다.</p> : null}
          {recovery.status === 'none' ? null : <div className="account-map-modal__error" role={recovery.status === 'collision' || recovery.status === 'manual' ? 'alert' : 'status'}><p id={recoveryDescriptionId}>{modalRecoveryMessage(recovery)}</p><div className="account-map-actions"><Button ref={replayRef} variant="primary" type="button" aria-describedby={recoveryDescriptionId} disabled={recoveryPending} onClick={() => { void onReapply().then((saved) => { if (saved) { if (mode === 'archive-purpose') returnToFallbackRef.current = true; requestClose(true); } }); }}>{recovery.status === 'manual' ? '최신 상태에서 다시 검토' : '최신 상태에서 다시 적용'}</Button><Button variant="secondary" type="button" disabled={recoveryPending} onClick={() => requestClose()}>최신 값 유지</Button></div></div>}
        </div>
        <footer>
          {mode === 'read' ? <>{node.kind === 'location' && node.status === 'suspended' && onRestoreLocation !== undefined ? <Button variant="secondary" type="button" disabled={recovery.status !== 'none'} onClick={() => setMode('restore-location')}>복원</Button> : null}{node.kind === 'location' && node.status !== 'suspended' && onArchiveLocation !== undefined ? <Button variant="secondary" className="account-map-modal__archive" type="button" disabled={recovery.status !== 'none'} onClick={() => setMode('archive-location')}><TrashIcon />보관</Button> : null}<Button variant="primary" type="button" disabled={animating || recovery.status !== 'none'} onClick={() => setMode('edit')}>편집</Button></> : null}
          {mode === 'edit' ? <><Button variant="secondary" type="button" disabled={actionPending || recoveryPending} onClick={() => { if (recovery.status === 'none') setMode('read'); else requestClose(); }}>취소</Button><Button variant="primary" type="button" disabled={recovery.status !== 'none' || actionPending || editReplacementMissing || editLabel.trim() === '' || editLinks.some((item) => item.status === 'active' && !Number.isSafeInteger(parseWonInput(item.monthlyAmountWon)))} onClick={() => {
            if (onSaveEdit === undefined) return;
            setActionError(false);
            setActionPending(true);
            void Promise.resolve(onSaveEdit({
              ...(node.kind === 'location' || node.id.startsWith('custom:') ? { label: editLabel.trim() } : {}),
              ...(node.kind === 'purpose' && node.id.startsWith('custom:') ? { targetMonthlyWon: parseWonInput(editTarget) } : {}),
              links: [
                ...editLinks.map((item) => ({ id: item.id, monthlyAmountWon: parseWonInput(item.monthlyAmountWon), status: item.status, remainder: item.remainder })),
                ...Object.values(editReplacementByPurpose).flatMap((linkId) => {
                  const item = related.find((candidate) => candidate.linkId === linkId);
                  return item?.linkId === undefined ? [] : [{ id: item.linkId, monthlyAmountWon: item.amountWon, status: 'active' as const, remainder: true }];
                }),
              ],
            })).then((saved) => { if (saved) requestClose(true); else setActionError(true); }, () => setActionError(true)).finally(() => setActionPending(false));
          }}>{actionError && recovery.status === 'none' ? '다시 시도' : '저장'}</Button></> : null}
          {mode === 'archive-location' ? <><Button variant="secondary" type="button" disabled={actionPending || recoveryPending} onClick={() => { if (recovery.status === 'none') setMode('read'); else requestClose(); }}>취소</Button><Button variant="primary" type="button" disabled={recovery.status !== 'none' || replacementMissing || actionPending} onClick={() => {
            if (locationId === null || onArchiveLocation === undefined) return;
            setActionError(false);
            setActionPending(true);
            void Promise.resolve(onArchiveLocation(locationId, replacementByPurpose)).then((saved) => { if (saved) { returnToFallbackRef.current = true; requestClose(true); } else setActionError(true); }, () => setActionError(true)).finally(() => setActionPending(false));
          }}>{actionError ? '다시 시도' : '보관하기'}</Button></> : null}
          {mode === 'restore-location' ? <><Button variant="secondary" type="button" disabled={actionPending || recoveryPending} onClick={() => { if (recovery.status === 'none' && initialMode === 'read') setMode('read'); else requestClose(); }}>취소</Button><Button variant="primary" type="button" disabled={recovery.status !== 'none' || restoreExcessPurposes.some((purposeId) => !restoreRemainderByPurpose[purposeId]) || actionPending} onClick={() => {
            if (locationId === null || onRestoreLocation === undefined) return;
            setActionError(false);
            setActionPending(true);
            void Promise.resolve(onRestoreLocation(locationId, restoreLinkIds, restoreRemainderByPurpose)).then((saved) => { if (saved) requestClose(true); else setActionError(true); }, () => setActionError(true)).finally(() => setActionPending(false));
          }}>{actionError ? '다시 시도' : '선택 복원'}</Button></> : null}
          {mode === 'archive-purpose' ? <><Button variant="secondary" type="button" disabled={actionPending || recoveryPending} onClick={() => { if (recovery.status === 'none') setMode('read'); else requestClose(); }}>취소</Button><Button variant="primary" type="button" disabled={recovery.status !== 'none' || actionPending || !node.id.startsWith('custom:')} onClick={() => commitPurposeLifecycle(node.id.startsWith('custom:') && onArchivePurpose !== undefined ? () => onArchivePurpose(node.id as `custom:${string}`) : undefined, true)}>{actionError ? '다시 시도' : '보관하기'}</Button></> : null}
          {mode === 'restore-purpose' ? <><Button variant="secondary" type="button" disabled={actionPending || recoveryPending} onClick={() => { if (recovery.status === 'none' && initialMode === 'read') setMode('read'); else requestClose(); }}>취소</Button><Button variant="primary" type="button" disabled={recovery.status !== 'none' || actionPending || !node.id.startsWith('custom:') || !Number.isSafeInteger(parseWonInput(restorePurposeTarget)) || parseWonInput(restorePurposeTarget) < 0 || (purposeTargetCapacityWon !== undefined && parseWonInput(restorePurposeTarget) > purposeTargetCapacityWon)} onClick={() => commitPurposeLifecycle(node.id.startsWith('custom:') && onRestorePurpose !== undefined ? () => onRestorePurpose(node.id as `custom:${string}`, parseWonInput(restorePurposeTarget)) : undefined, true)}>{actionError ? '다시 시도' : '목적 복원'}</Button></> : null}
        </footer>
      </div>
    </div>
  );
}

function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }

function modalTitle(label: string, mode: AccountMapModalMode): string {
  if (mode === 'read') return `${label} 상세`;
  if (mode === 'edit') return `${label} 편집`;
  if (mode === 'connect') return `${label} 연결 추가`;
  if (mode === 'archive-location' || mode === 'archive-purpose') return `${label} 보관`;
  return `${label} 복원`;
}

function modalRecoveryMessage(recovery: Exclude<RecoveryState, { status: 'none' }>): string {
  if (recovery.status === 'stale') return '다른 곳에서 변경된 최신 상태를 불러왔습니다. 편집 중인 입력은 그대로 두었습니다.';
  if (recovery.status === 'manual') return recovery.reason === 'removal'
    ? '연결 제거가 포함되어 최신 상태에 자동으로 다시 적용하지 않습니다. 입력을 검토한 뒤 다시 저장해 주세요.'
    : recovery.reason === 'target-missing'
      ? '편집 대상이 최신 상태에 없습니다. 입력을 유지하거나 최신 값을 선택해 주세요.'
    : '여러 항목을 함께 편집해 최신 상태에 자동으로 다시 적용하지 않습니다. 입력을 검토한 뒤 다시 저장해 주세요.';
  if (recovery.reason === 'duplicate-link') return '최신 상태에 같은 연결이 이미 있습니다. 최신 값을 유지하거나 입력을 다시 확인해 주세요.';
  if (recovery.reason === 'target-missing') return '편집 대상이 최신 상태에 없습니다. 최신 값을 유지하거나 입력을 다시 확인해 주세요.';
  return `${modalFieldLabel(recovery.field)} 항목이 최신 상태에서도 변경되어 자동으로 적용할 수 없습니다.`;
}

function modalFieldLabel(field: string): string {
  return field === 'shortName' || field === 'name' ? '표시 이름'
    : field === 'targetMonthlyWon' ? '월 목표 금액'
      : field === 'monthlyAmountWon' ? '월 금액'
        : field === 'status' ? '연결 상태'
          : field === 'remainder' ? '나머지 금액 설정'
            : field;
}

function collisionIdentity(recovery: Extract<RecoveryState, { status: 'collision' }>): string {
  const target = recovery.intent.kind === 'add-link'
    ? `${recovery.intent.purposeId}:${recovery.intent.locationId}`
    : recovery.intent.id;
  return `${recovery.field}:${recovery.intent.kind}:${target}`;
}

function TrashIcon(): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M18 7l-1 13H7L6 7M10 11v5M14 11v5" /></svg>;
}

function ConnectionIcon(): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
