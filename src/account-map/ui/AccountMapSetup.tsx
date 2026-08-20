import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { RecoveryState } from '../application/reducer';
import {
  SYSTEM_PURPOSE_IDS,
  type AccountMapDraft,
  type OutflowPurposeId,
  type PurposeId,
  type SystemPurposeId,
} from '../domain/model';
import {
  customPurposeTargetCapacity,
  mainPurposeReferences,
  reconcilePurpose,
} from '../domain/reconciliation';
import { AccountMapLocationPicker } from './AccountMapLocationPicker';

const purposeMeta = {
  'system:income': { title: '수입', prompt: '어디로 들어오나요?' },
  'system:housing': { title: '주거', prompt: '어디에서 나가나요?' },
  'system:living': { title: '생활비', prompt: '어디에서 쓰나요?' },
  'system:saving': { title: '저축', prompt: '어디에 모으나요?' },
  'system:investing': { title: '투자', prompt: '어디에 두나요?' },
} as const;

export type AccountMapDraftSaveResult =
  | { status: 'saved' }
  | { status: 'recovery' }
  | { status: 'field-error'; field: 'name' | 'amount'; message: string }
  | { status: 'failed'; message: string };

export interface AccountMapSetupProps {
  workspace: WorkspaceDocument;
  main: MainData;
  draft: AccountMapDraft | null;
  step: AccountMapDraft['step'];
  mainChanged: boolean;
  saveFailed: boolean;
  recoveryPending: boolean;
  recovery: RecoveryState;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
  onCommitConnection(input: {
    purposeId: PurposeId;
    locationId: string;
    newLocation?: FinancialLocation;
    monthlyAmountWon?: number;
    restoreLocation?: boolean;
  }): Promise<boolean>;
  onSaveDraft(draft: AccountMapDraft): Promise<AccountMapDraftSaveResult>;
  onReview(): void;
  onBack(): void;
  onApply(): void;
  onExit(): void;
  onCancelSetup(): void;
}

export function AccountMapSetup(props: AccountMapSetupProps): JSX.Element {
  const [activePurposeId, setActivePurposeId] = useState<PurposeId | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const references = mainPurposeReferences(props.main);
  const visiblePurposeIds: PurposeId[] = [
    ...SYSTEM_PURPOSE_IDS,
    ...(props.draft?.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id }) => id) ?? []),
  ];

  if (props.step === 'review') {
    const draft = props.draft ?? emptyDraft(props.main.updatedAt);
    const income = reconcilePurpose('system:income', draft, props.workspace.locations, props.main);
    const purposeIds: PurposeId[] = [
      ...SYSTEM_PURPOSE_IDS,
      ...draft.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id }) => id),
    ];
    const hasExcess = purposeIds.some((id) => (
      reconcilePurpose(id, draft, props.workspace.locations, props.main).excessWon > 0
    ));
    const canApply = income.targetWon > 0
      && income.activeAllocatedWon === income.targetWon
      && !hasExcess;
    return (
      <section className="account-map-setup account-map-review" aria-labelledby="account-map-review-title">
        <header className="account-map-setup__header">
          <p className="account-map-eyebrow">마지막 확인</p>
          <h1 id="account-map-review-title">연결 검토</h1>
          <p>Main의 금액은 바꾸지 않고, 월 자금이 머무는 곳만 저장합니다.</p>
        </header>
        {props.mainChanged ? <p className="account-map-alert" role="status"><strong>Main의 월 금액이 바뀌었어요</strong><span>최신 금액으로 미배정과 초과 연결을 다시 계산했습니다.</span></p> : null}
        <div className="account-map-review__list">
          {purposeIds.map((purposeId) => {
            const status = reconcilePurpose(purposeId, draft, props.workspace.locations, props.main);
            const title = titleFor(purposeId, draft);
            const count = draft.links.filter((link) => link.purposeId === purposeId && link.status === 'active').length;
            return (
              <article key={purposeId} className="account-map-review__row">
                <div><h2>{title}</h2><p>{count === 0 ? '연결 없음' : `${count}곳 연결`}</p></div>
                <strong>{formatWon(status.targetWon)}</strong>
                {status.unassignedWon > 0 ? <small>연결 필요 {formatWon(status.unassignedWon)}</small> : null}
                {status.excessWon > 0 ? <small className="is-error">초과 연결 {formatWon(status.excessWon)}</small> : null}
              </article>
            );
          })}
        </div>
        {!canApply ? <p className="account-map-hint">수입은 전체 금액을 연결하고, 초과 연결은 먼저 조정해 주세요.</p> : null}
        {props.saveFailed ? <SaveFailure /> : null}
        {props.recovery.status === 'none' ? null : <RecoveryControls recovery={props.recovery} pending={props.recoveryPending} onReapply={props.onReapply} onKeepLatest={props.onKeepLatest} />}
        <footer className="account-map-actions">
          <button type="button" className="ui-button ui-button--secondary" disabled={props.recovery.status !== 'none'} onClick={props.onBack}>이전</button>
          <button type="button" className="ui-button ui-button--primary" disabled={!canApply || props.recovery.status !== 'none'} onClick={props.onApply}>지도 만들기</button>
        </footer>
      </section>
    );
  }

  return (
    <section className="account-map-setup" aria-labelledby="account-map-setup-title">
      <header className="account-map-setup__header">
        <p className="account-map-eyebrow">계좌 연결</p>
        <h1 id="account-map-setup-title">월 자금의 위치를 알려주세요</h1>
        <p>금액은 Main에서 가져옵니다. 여기서는 어디에 연결되는지만 정합니다.</p>
      </header>
      {props.mainChanged ? <p className="account-map-alert" role="status"><strong>Main의 월 금액이 바뀌었어요</strong><span>입력은 보존하고 최신 금액으로 상태만 다시 계산했습니다.</span></p> : null}
      <div className="account-map-purpose-grid">
        {visiblePurposeIds.map((purposeId) => {
          const links = props.draft?.links.filter((link) => link.purposeId === purposeId && link.status === 'active') ?? [];
          const root = rootPurpose(purposeId, props.draft);
          return (
            <article key={purposeId} className="account-map-purpose-card">
              <div className="account-map-purpose-card__top">
                <div><p>{purposeMeta[root].prompt}</p><h2>{titleFor(purposeId, props.draft)}</h2></div>
                <strong>{formatWon(purposeId.startsWith('custom:') ? props.draft?.customPurposes.find(({ id }) => id === purposeId)?.targetMonthlyWon ?? 0 : references[purposeId as SystemPurposeId])}</strong>
              </div>
              {links.length > 0 ? <p className="account-map-purpose-card__status">{links.length}곳 연결됨</p> : <p className="account-map-purpose-card__status is-empty">연결 필요</p>}
              <button type="button" className="account-map-purpose-card__action" disabled={props.recovery.status !== 'none'} onClick={() => setActivePurposeId(purposeId)}>
                {links.length === 0 ? '연결' : '다른 계좌 연결'}
              </button>
            </article>
          );
        })}
      </div>
      <button type="button" className="account-map-add-purpose" disabled={props.recovery.status !== 'none'} onClick={() => setCustomOpen(true)}><span aria-hidden="true">＋</span> 세부 목적 추가</button>
      {props.saveFailed && activePurposeId === null && !customOpen ? <SaveFailure /> : null}
      {props.recovery.status === 'none' || activePurposeId !== null || customOpen ? null : <RecoveryControls recovery={props.recovery} pending={props.recoveryPending} onReapply={props.onReapply} onKeepLatest={props.onKeepLatest} />}
      <footer className="account-map-actions">
        <button type="button" className="ui-button ui-button--quiet" disabled={props.recovery.status !== 'none'} onClick={props.onExit}>나가기</button>
        {props.draft !== null ? <button type="button" className="ui-button ui-button--secondary" disabled={props.recovery.status !== 'none'} onClick={props.onCancelSetup}>설정 취소</button> : null}
        <button type="button" className="ui-button ui-button--primary" disabled={props.recovery.status !== 'none'} onClick={props.onReview}>검토</button>
      </footer>
      {activePurposeId === null ? null : (
        <ConnectionDialog
          purposeId={activePurposeId}
          workspace={props.workspace}
          main={props.main}
          draft={props.draft}
          saveFailed={props.saveFailed}
          recoveryPending={props.recoveryPending}
          recovery={props.recovery}
          onReapply={props.onReapply}
          onKeepLatest={props.onKeepLatest}
          onCancel={() => setActivePurposeId(null)}
          onComplete={async (input) => {
            const saved = await props.onCommitConnection(input);
            if (saved) setActivePurposeId(null);
          }}
        />
      )}
      {!customOpen ? null : (
        <CustomPurposeDialog
          main={props.main}
          draft={props.draft}
          recovery={props.recovery}
          recoveryPending={props.recoveryPending}
          onReapply={props.onReapply}
          onKeepLatest={props.onKeepLatest}
          onCancel={() => setCustomOpen(false)}
          onSave={async (draft) => {
            const result = await props.onSaveDraft(draft);
            if (result.status === 'saved') setCustomOpen(false);
            return result;
          }}
        />
      )}
    </section>
  );
}

function ConnectionDialog({ purposeId, workspace, main, draft, saveFailed, recoveryPending, recovery, onReapply, onKeepLatest, onCancel, onComplete }: {
  purposeId: PurposeId;
  workspace: WorkspaceDocument;
  main: MainData;
  draft: AccountMapDraft | null;
  saveFailed: boolean;
  recoveryPending: boolean;
  recovery: RecoveryState;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
  onCancel(): void;
  onComplete(input: { purposeId: PurposeId; locationId: string; newLocation?: FinancialLocation; monthlyAmountWon?: number; restoreLocation?: boolean }): Promise<void>;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  const onKeepLatestRef = useRef(onKeepLatest);
  const recoveryRef = useRef(recovery);
  const recoveryPendingRef = useRef(recoveryPending);
  const pendingRef = useRef(false);
  onCancelRef.current = onCancel;
  onKeepLatestRef.current = onKeepLatest;
  recoveryRef.current = recovery;
  recoveryPendingRef.current = recoveryPending;
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  pendingRef.current = pending;
  const links = draft?.links.filter((link) => link.purposeId === purposeId && link.status === 'active') ?? [];
  const linkedIds = new Set(links.map(({ locationId }) => locationId));
  dirtyRef.current = dirty;
  const additional = links.length > 0;

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (pendingRef.current || recoveryPendingRef.current) return;
        if (recoveryRef.current.status !== 'none') {
          onKeepLatestRef.current();
          onCancelRef.current();
        } else if (!dirtyRef.current || window.confirm('입력 중인 내용을 취소할까요?')) onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocus?.focus(); };
  }, []);

  function requestClose() {
    if (pending || recoveryPending) return;
    if (recovery.status !== 'none') {
      onKeepLatest();
      onCancel();
    } else if (!dirty || window.confirm('입력 중인 내용을 취소할까요?')) onCancel();
  }

  return (
    <div className="account-map-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={panelRef} className="account-map-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><div><p>{purposeMeta[rootPurpose(purposeId, draft)].prompt}</p><h2 id={titleId}>{titleFor(purposeId, draft)} 연결</h2></div></header>
        <div className="account-map-sheet__body">
          {!additional ? <p className="account-map-hint">첫 연결에는 {formatWon(reconcilePurpose(purposeId, draft ?? emptyDraft(main.updatedAt), workspace.locations, main).targetWon)} 전체가 자동으로 들어갑니다.</p> : null}
          <AccountMapLocationPicker
            locations={workspace.locations}
            linkedLocationIds={linkedIds}
            amountRequired={additional}
            disabled={pending || recoveryPending || recovery.status !== 'none'}
            cancelDisabled={pending || recoveryPending}
            onDirtyChange={setDirty}
            onCancel={requestClose}
            onSelect={(locationId, amount) => {
              const location = workspace.locations.find(({ id }) => id === locationId);
              setPending(true);
              void onComplete({ purposeId, locationId, ...(location?.archivedAt === undefined ? {} : { restoreLocation: true }), ...(amount === undefined ? {} : { monthlyAmountWon: amount }) }).finally(() => setPending(false));
            }}
            onCreate={(newLocation, amount) => {
              setPending(true);
              void onComplete({ purposeId, locationId: newLocation.id, newLocation, ...(amount === undefined ? {} : { monthlyAmountWon: amount }) }).finally(() => setPending(false));
            }}
          />
          {saveFailed ? <SaveFailure /> : null}
          {recovery.status === 'none' ? null : <RecoveryControls recovery={recovery} pending={recoveryPending} onReapply={async () => { const saved = await onReapply(); if (saved) onCancel(); return saved; }} onKeepLatest={() => { onKeepLatest(); onCancel(); }} />}
        </div>
      </div>
    </div>
  );
}

function CustomPurposeDialog({ main, draft, recovery, recoveryPending, onReapply, onKeepLatest, onCancel, onSave }: { main: MainData; draft: AccountMapDraft | null; recovery: RecoveryState; recoveryPending: boolean; onReapply(): Promise<boolean>; onKeepLatest(): void; onCancel(): void; onSave(draft: AccountMapDraft): Promise<AccountMapDraftSaveResult> }) {
  const titleId = useId();
  const nameErrorId = useId();
  const amountErrorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const onCancelRef = useRef(onCancel);
  const onKeepLatestRef = useRef(onKeepLatest);
  const recoveryRef = useRef(recovery);
  const recoveryPendingRef = useRef(recoveryPending);
  const pendingRef = useRef(false);
  onCancelRef.current = onCancel;
  onKeepLatestRef.current = onKeepLatest;
  recoveryRef.current = recovery;
  recoveryPendingRef.current = recoveryPending;
  const [parentId, setParentId] = useState<OutflowPurposeId>('system:living');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Exclude<AccountMapDraftSaveResult, { status: 'saved' | 'recovery' }> | null>(null);
  pendingRef.current = pending;
  const capacity = customPurposeTargetCapacity(parentId, draft?.customPurposes ?? [], main);
  const amountOverCapacity = Number(amount) > capacity;
  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (pendingRef.current || recoveryPendingRef.current) return;
        if (recoveryRef.current.status !== 'none') onKeepLatestRef.current();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocus?.focus(); };
  }, []);

  useEffect(() => {
    if (feedback === null) return;
    if (feedback.status === 'field-error') {
      (feedback.field === 'name' ? nameRef.current : amountRef.current)?.focus();
      return;
    }
    alertRef.current?.focus();
  }, [feedback]);

  function requestClose() {
    if (pending || recoveryPending) return;
    if (recovery.status !== 'none') onKeepLatest();
    onCancel();
  }

  const nameFeedback = feedback?.status === 'field-error' && feedback.field === 'name' ? feedback : null;
  const amountFeedback = feedback?.status === 'field-error' && feedback.field === 'amount' ? feedback : null;
  return (
    <div className="account-map-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={panelRef} className="account-map-sheet account-map-sheet--compact" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><h2 id={titleId}>세부 목적 추가</h2></header>
        <div className="account-map-sheet__body">
          <label>큰 목적<select value={parentId} onChange={(event) => { setParentId(event.target.value as OutflowPurposeId); setFeedback(null); }}><option value="system:housing">주거</option><option value="system:living">생활비</option><option value="system:saving">저축</option><option value="system:investing">투자</option></select></label>
          <label>목적 이름<input ref={nameRef} value={name} maxLength={24} aria-invalid={nameFeedback !== null || undefined} aria-describedby={nameFeedback === null ? undefined : nameErrorId} onChange={(event) => { setName(event.target.value); setFeedback(null); }} /></label>
          {nameFeedback === null ? null : <p id={nameErrorId} className="account-map-error" role="alert">{nameFeedback.message}</p>}
          <label>월 금액<input ref={amountRef} inputMode="numeric" value={amount} aria-invalid={amountFeedback !== null || amountOverCapacity || undefined} aria-describedby={amountFeedback !== null ? amountErrorId : amountOverCapacity ? amountErrorId : undefined} onChange={(event) => { setAmount(event.target.value.replace(/\D/gu, '')); setFeedback(null); }} /></label>
          <p className="account-map-hint">추가 가능 {formatWon(capacity)}</p>
          {amountFeedback !== null ? <p id={amountErrorId} className="account-map-error" role="alert">{amountFeedback.message}</p> : amountOverCapacity ? <p id={amountErrorId} className="account-map-error">큰 목적의 월 금액을 넘을 수 없습니다.</p> : null}
          {feedback?.status !== 'failed' ? null : <p ref={alertRef} className="account-map-error" role="alert" tabIndex={-1}>{feedback.message}</p>}
          {recovery.status === 'none' ? null : <RecoveryControls recovery={recovery} pending={pending || recoveryPending} onReapply={onReapply} onKeepLatest={() => { onKeepLatest(); onCancel(); }} />}
        </div>
        <footer>
          <button type="button" className="ui-button ui-button--secondary" disabled={pending || recoveryPending} onClick={requestClose}>취소</button>
          <button type="button" className="ui-button ui-button--primary" disabled={pending || recovery.status !== 'none' || name.trim() === '' || Number(amount) <= 0 || amountOverCapacity} onClick={() => {
            const now = Date.now();
            const current = draft ?? emptyDraft(main.updatedAt);
            const next: AccountMapDraft = { ...current, customPurposes: [...current.customPurposes, { id: `custom:${createId()}`, parentId, name: name.trim(), targetMonthlyWon: Number(amount), createdAt: now, updatedAt: now }], updatedAt: now };
            setFeedback(null);
            setPending(true);
            void onSave(next).then((result) => {
              if (result.status !== 'saved' && result.status !== 'recovery') setFeedback(result);
            }, () => setFeedback({ status: 'failed', message: '저장하지 못했어요. 입력은 그대로 두었습니다.' })).finally(() => setPending(false));
          }}>추가</button>
        </footer>
      </div>
    </div>
  );
}

function emptyDraft(sourceMainUpdatedAt: number): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt, customPurposes: [], links: [], step: 'connect', updatedAt: Date.now() };
}

function createId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function rootPurpose(id: PurposeId, draft: AccountMapDraft | null) { return id.startsWith('custom:') ? draft?.customPurposes.find((purpose) => purpose.id === id)?.parentId ?? 'system:living' : id as keyof typeof purposeMeta; }
function titleFor(id: PurposeId, draft: AccountMapDraft | null) { return id.startsWith('custom:') ? draft?.customPurposes.find((purpose) => purpose.id === id)?.name ?? '세부 목적' : purposeMeta[id as SystemPurposeId].title; }
function formatWon(value: number) { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
function SaveFailure() { return <p className="account-map-error" role="alert">저장하지 못했어요. 입력은 그대로 두었습니다.</p>; }

function RecoveryControls({ recovery, pending = false, onReapply, onKeepLatest }: {
  recovery: Exclude<RecoveryState, { status: 'none' }>;
  pending?: boolean;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
}) {
  const descriptionId = useId();
  const replayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (recovery.status === 'collision' || recovery.status === 'manual') replayRef.current?.focus();
  }, [recovery.status, recovery.status === 'collision' ? recovery.field : '']);
  const collision = recovery.status === 'collision';
  const manual = recovery.status === 'manual';
  return <div className="account-map-error" role={collision || manual ? 'alert' : 'status'}>
    <p id={descriptionId}>{collision ? recoveryMessage(recovery.reason, recovery.field) : manual ? '여러 변경을 최신 상태에 자동으로 다시 적용하지 않습니다. 입력을 검토한 뒤 다시 저장해 주세요.' : '다른 곳에서 변경된 최신 상태를 불러왔어요. 입력은 그대로 두었습니다.'}</p>
    <div className="account-map-actions">
      <button ref={replayRef} type="button" className="ui-button ui-button--primary" aria-describedby={descriptionId} disabled={pending} onClick={() => void onReapply()}>{manual ? '최신 상태에서 다시 검토' : '최신 상태에서 다시 적용'}</button>
      <button type="button" className="ui-button ui-button--secondary" disabled={pending} onClick={onKeepLatest}>최신 값 유지</button>
    </div>
  </div>;
}

function recoveryMessage(reason: string, field: string): string {
  if (reason === 'duplicate-link') return '최신 상태에 같은 연결이 이미 있습니다. 최신 값을 유지하거나 입력을 다시 확인해 주세요.';
  if (reason === 'target-missing') return '편집 대상이 최신 상태에 없습니다. 최신 값을 유지하거나 입력을 다시 확인해 주세요.';
  return `${field} 항목이 최신 상태에서도 변경되어 자동으로 적용할 수 없습니다.`;
}
