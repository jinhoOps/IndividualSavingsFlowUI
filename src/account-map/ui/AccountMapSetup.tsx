import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation, FinancialRole } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { RecoveryState } from '../application/reducer';
import { findLocationDuplicate, INSTITUTIONS } from '../domain/institutions';
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

const purposeMeta = {
  'system:income': { title: '수입', prompt: '어디로 들어오나요?' },
  'system:housing': { title: '주거', prompt: '어디에서 나가나요?' },
  'system:living': { title: '생활비', prompt: '어디에서 쓰나요?' },
  'system:saving': { title: '저축', prompt: '어디에 모으나요?' },
  'system:investing': { title: '투자', prompt: '어디에 두나요?' },
} as const;

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
  onSaveDraft(draft: AccountMapDraft): Promise<boolean>;
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
      {props.saveFailed && activePurposeId === null ? <SaveFailure /> : null}
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
            if (await props.onSaveDraft(draft)) setCustomOpen(false);
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
  const [mode, setMode] = useState<'choose' | 'create'>('choose');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [customInstitution, setCustomInstitution] = useState('');
  const [shortName, setShortName] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  pendingRef.current = pending;
  const links = draft?.links.filter((link) => link.purposeId === purposeId && link.status === 'active') ?? [];
  const linkedIds = new Set(links.map(({ locationId }) => locationId));
  const role = roleFor(purposeId, draft);
  const available = workspace.locations.filter((location) => location.archivedAt === undefined
    && location.roles.includes(role) && !linkedIds.has(location.id));
  const dirty = selectedLocationId !== null || institutionId !== null || shortName.trim() !== '' || customInstitution.trim() !== '' || amount !== '';
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

  const institution = INSTITUTIONS.find(([id]) => id === institutionId);
  const preview = mode === 'create' && shortName.trim() !== ''
    && (institution !== undefined || (institutionId === 'custom' && customInstitution.trim() !== ''))
    ? createLocation(shortName, institutionId, institution, customInstitution, role)
    : null;
  const duplicate = preview === null ? { kind: 'none' as const } : findLocationDuplicate(workspace.locations, preview);
  const canComplete = mode === 'choose'
    ? selectedLocationId !== null
    : shortName.trim() !== '' && (institution !== undefined || (institutionId === 'custom' && customInstitution.trim() !== ''));

  return (
    <div className="account-map-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={panelRef} className="account-map-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><div><p>{purposeMeta[rootPurpose(purposeId, draft)].prompt}</p><h2 id={titleId}>{titleFor(purposeId, draft)} 연결</h2></div></header>
        <div className="account-map-sheet__body">
          {mode === 'choose' ? (
            <>
              {available.length > 0 ? <div className="account-map-location-list">{available.map((location) => (
                <button key={location.id} type="button" className={selectedLocationId === location.id ? 'is-selected' : ''} onClick={() => setSelectedLocationId(location.id)}>
                  <strong>{location.shortName}</strong><span>{location.institution?.name ?? '기관 없음'}</span>
                </button>
              ))}</div> : <p className="account-map-empty-copy">바로 고를 수 있는 기존 항목이 없습니다.</p>}
              <button type="button" className="account-map-new-location" onClick={() => { setMode('create'); setSelectedLocationId(null); }}><span aria-hidden="true">＋</span><strong>새 계좌·보관처 추가</strong></button>
            </>
          ) : (
            <>
              <fieldset><legend>기관 빠른 선택</legend><div className="account-map-institutions">{INSTITUTIONS.map(([id, name]) => <button key={id} type="button" className={institutionId === id ? 'is-selected' : ''} onClick={() => setInstitutionId(id)}>{name}</button>)}<button type="button" className={institutionId === 'custom' ? 'is-selected' : ''} onClick={() => setInstitutionId('custom')}>직접 입력</button></div></fieldset>
              {institutionId === 'custom' ? <label>기관 이름<input value={customInstitution} onChange={(event) => setCustomInstitution(event.target.value)} /></label> : null}
              <label>표시 이름<input value={shortName} maxLength={8} placeholder="예: 급여통장" onChange={(event) => setShortName(event.target.value)} /></label>
              {duplicate.kind === 'none' ? null : <div className="account-map-duplicate"><p>{duplicate.kind === 'archived' ? '보관된 같은 항목이 있어요.' : '이미 같은 항목이 있어요.'}</p><button type="button" className="ui-button ui-button--secondary" disabled={pending || recovery.status !== 'none' || (additional && Number(amount) <= 0)} onClick={() => {
                setPending(true);
                void onComplete({ purposeId, locationId: duplicate.location.id, ...(duplicate.kind === 'archived' ? { restoreLocation: true } : {}), ...(additional ? { monthlyAmountWon: Number(amount) } : {}) }).finally(() => setPending(false));
              }}>{duplicate.kind === 'archived' ? '기존 항목 복원해서 연결' : '기존 항목 연결'}</button></div>}
            </>
          )}
          {additional ? <label>이 계좌에 둘 월 금액<input inputMode="numeric" value={amount} placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/\D/gu, ''))} /><span>원</span></label> : <p className="account-map-hint">첫 연결에는 {formatWon(reconcilePurpose(purposeId, draft ?? emptyDraft(main.updatedAt), workspace.locations, main).targetWon)} 전체가 자동으로 들어갑니다.</p>}
          {saveFailed ? <SaveFailure /> : null}
          {recovery.status === 'none' ? null : <RecoveryControls recovery={recovery} pending={recoveryPending} onReapply={async () => { const saved = await onReapply(); if (saved) onCancel(); return saved; }} onKeepLatest={() => { onKeepLatest(); onCancel(); }} />}
        </div>
        <footer><button type="button" className="ui-button ui-button--secondary" disabled={pending || recoveryPending} onClick={requestClose}>취소</button><button type="button" className="ui-button ui-button--primary" disabled={!canComplete || pending || recovery.status !== 'none' || duplicate.kind !== 'none' || (additional && Number(amount) <= 0)} onClick={() => {
          const newLocation = mode === 'create' ? createLocation(shortName, institutionId, institution, customInstitution, role) : undefined;
          const locationId = newLocation?.id ?? selectedLocationId;
          if (locationId === null) return;
          setPending(true);
          void onComplete({ purposeId, locationId, ...(newLocation ? { newLocation } : {}), ...(additional ? { monthlyAmountWon: Number(amount) } : {}) }).finally(() => setPending(false));
        }}>완료</button></footer>
      </div>
    </div>
  );
}

function CustomPurposeDialog({ main, draft, recovery, recoveryPending, onReapply, onKeepLatest, onCancel, onSave }: { main: MainData; draft: AccountMapDraft | null; recovery: RecoveryState; recoveryPending: boolean; onReapply(): Promise<boolean>; onKeepLatest(): void; onCancel(): void; onSave(draft: AccountMapDraft): Promise<void> }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
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
  pendingRef.current = pending;
  const capacity = customPurposeTargetCapacity(parentId, draft?.customPurposes ?? [], main);
  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (pendingRef.current || recoveryPendingRef.current) return;
      if (recoveryRef.current.status !== 'none') onKeepLatestRef.current();
      onCancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocus?.focus(); };
  }, []);

  function requestClose() {
    if (pending || recoveryPending) return;
    if (recovery.status !== 'none') onKeepLatest();
    onCancel();
  }

  return <div className="account-map-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}><div ref={panelRef} className="account-map-sheet account-map-sheet--compact" role="dialog" aria-modal="true" aria-labelledby={titleId}><header><h2 id={titleId}>세부 목적 추가</h2></header><div className="account-map-sheet__body"><label>큰 목적<select value={parentId} onChange={(event) => setParentId(event.target.value as OutflowPurposeId)}><option value="system:housing">주거</option><option value="system:living">생활비</option><option value="system:saving">저축</option><option value="system:investing">투자</option></select></label><label>목적 이름<input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} /></label><label>월 금액<input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/gu, ''))} /></label><p className="account-map-hint">추가 가능 {formatWon(capacity)}</p>{Number(amount) > capacity ? <p className="account-map-error">큰 목적의 월 금액을 넘을 수 없습니다.</p> : null}{recovery.status === 'none' ? null : <RecoveryControls recovery={recovery} pending={pending || recoveryPending} onReapply={onReapply} onKeepLatest={() => { onKeepLatest(); onCancel(); }} />}</div><footer><button type="button" className="ui-button ui-button--secondary" disabled={pending || recoveryPending} onClick={requestClose}>취소</button><button type="button" className="ui-button ui-button--primary" disabled={pending || recovery.status !== 'none' || name.trim() === '' || Number(amount) <= 0 || Number(amount) > capacity} onClick={() => {
    const now = Date.now();
    const current = draft ?? emptyDraft(main.updatedAt);
    const next: AccountMapDraft = { ...current, customPurposes: [...current.customPurposes, { id: `custom:${createId()}`, parentId, name: name.trim(), targetMonthlyWon: Number(amount), createdAt: now, updatedAt: now }], updatedAt: now };
    setPending(true);
    void onSave(next).finally(() => setPending(false));
  }}>추가</button></footer></div></div>;
}

function emptyDraft(sourceMainUpdatedAt: number): AccountMapDraft {
  return { schemaVersion: 1, sourceMainUpdatedAt, customPurposes: [], links: [], step: 'connect', updatedAt: Date.now() };
}

function createLocation(shortName: string, institutionId: string | null, known: readonly [string, string] | undefined, customName: string, role: FinancialRole): FinancialLocation {
  const now = Date.now();
  const uuid = createId();
  return { id: `location:${uuid}`, shortName: shortName.trim(), institution: known === undefined ? { id: `custom:${uuid}`, name: customName.trim() } : { id: known[0], name: known[1] }, kind: 'bank', roles: [role], createdAt: now, updatedAt: now };
}

function createId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function roleFor(id: PurposeId, draft: AccountMapDraft | null): FinancialRole { const root = rootPurpose(id, draft); return root === 'system:income' ? 'income' : root === 'system:saving' ? 'saving' : root === 'system:investing' ? 'investing' : 'spending'; }
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
