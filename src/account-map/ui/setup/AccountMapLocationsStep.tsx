import { useEffect, useRef, useState, type JSX } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { MainData } from '../../../main/domain/model';
import type { FinancialLocation } from '../../../workspace/domain/financialLocation';
import type { AccountMapDraftV2, PurposeId, PurposeLocationLink } from '../../domain/model';
import { reconcilePurpose } from '../../domain/reconciliation';
import { AccountMapLocationPicker, type PickerRecovery } from '../AccountMapLocationPicker';
import { AccountMapModal, type AccountMapNodeEditInput } from '../AccountMapModal';
import type { AccountMapDraftSaveResult } from '../AccountMapSetup';
import { recalculateRemainder } from '../../domain/reconciliation';
import type { RecoveryState } from '../../application/reducer';
import { Button } from '../../../components/common/Button';

const SYSTEM_PURPOSES: readonly { id: PurposeId; label: string; prompt: string }[] = [
  { id: 'system:income', label: '수입', prompt: '수입은 어느 계좌로 들어오나요?' },
  { id: 'system:housing', label: '주거', prompt: '주거비는 어느 계좌에서 나가나요?' },
  { id: 'system:living', label: '생활비', prompt: '생활비는 어느 계좌에서 쓰나요?' },
  { id: 'system:saving', label: '저축', prompt: '저축할 돈은 어디에 모으나요?' },
  { id: 'system:investing', label: '투자', prompt: '투자할 돈은 어디에 두나요?' },
];

export interface AccountMapLocationsStepProps {
  main: MainData;
  locations: readonly FinancialLocation[];
  draft: AccountMapDraftV2;
  disabled?: boolean;
  pending?: boolean;
  onCommitConnection(input: { purposeId: PurposeId; locationId: string; newLocation?: FinancialLocation; monthlyAmountWon?: number; restoreLocation?: boolean }): Promise<boolean>;
  onAddCustomPurpose(): void;
  onSaveDraft(draft: AccountMapDraftV2): Promise<AccountMapDraftSaveResult>;
  onContinue(): void;
  onBack(): void;
  recovery: RecoveryState;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
}

/** One purpose at a time; picker drafts remain scoped to that purpose across visits. */
export function AccountMapLocationsStep({ main, locations, draft, disabled = false, pending = false, onCommitConnection, onAddCustomPurpose, onSaveDraft, onContinue, onBack, recovery, onReapply, onKeepLatest }: AccountMapLocationsStepProps): JSX.Element {
  const purposes = [...SYSTEM_PURPOSES, ...draft.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id, name }) => ({ id, label: name, prompt: `${name}에 쓸 돈은 어디에 두나요?` }))];
  const pickerCache = useRef(new Map<string, PickerRecovery>());
  const [selectedId, setSelectedId] = useState<PurposeId>('system:income');
  const [pickerEpoch, setPickerEpoch] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const currentIndex = Math.max(0, purposes.findIndex(({ id }) => id === selectedId));
  const purpose = purposes[currentIndex]!;
  const status = reconcilePurpose(purpose.id, draft, locations, main);
  const links = draft.links.filter((link) => link.purposeId === purpose.id && link.status === 'active');
  const [pickerDirty, setPickerDirty] = useState(false);
  const showPicker = connecting || (links.length === 0 && status.targetWon > 0);
  const income = reconcilePurpose('system:income', draft, locations, main);
  const incomeMissing = !draft.links.some((link) => link.purposeId === 'system:income' && link.status === 'active') || income.unassignedWon > 0 || income.excessWon > 0;
  const last = currentIndex === purposes.length - 1;

  useEffect(() => { titleRef.current?.focus(); }, [selectedId]);
  function select(id: PurposeId): void { setSelectedId(id); setConnecting(false); setPickerDirty(false); setError(null); }
  async function connect(input: Parameters<AccountMapLocationsStepProps['onCommitConnection']>[0]): Promise<boolean> {
    setError(null);
    const saved = await onCommitConnection(input);
    if (saved) { setConnecting(false); setPickerDirty(false); titleRef.current?.focus(); }
    return saved;
  }
  async function saveAllocation(input: AccountMapNodeEditInput): Promise<boolean> {
    let updated = draft.links.flatMap<PurposeLocationLink>((link) => {
      const edit = input.links.find(({ id }) => id === link.id);
      if (edit === undefined) return [link];
      if (edit.status === 'removed') return [];
      const { suspendedReason: _reason, ...base } = { ...link, suspendedReason: undefined };
      return [edit.status === 'active'
        ? { ...base, monthlyAmountWon: edit.monthlyAmountWon, remainder: edit.remainder, status: 'active', updatedAt: Date.now() }
        : { ...base, monthlyAmountWon: edit.monthlyAmountWon, remainder: false, status: 'suspended', suspendedReason: 'user', updatedAt: Date.now() }];
    });
    const remainder = updated.find((link) => link.purposeId === purpose.id && link.status === 'active' && link.remainder);
    if (remainder !== undefined) {
      const result = recalculateRemainder(purpose.id, remainder.id, status.targetWon, updated);
      if (!result.ok) { setError('배정한 금액이 월 기준을 넘습니다. 금액을 줄여 주세요.'); return false; }
      updated = result.links;
    }
    if (reconcilePurpose(purpose.id, { ...draft, links: updated }, locations, main).excessWon > 0) { setError('배정한 금액이 월 기준을 넘습니다. 금액을 줄여 주세요.'); return false; }
    const result = await onSaveDraft({ ...draft, links: updated, updatedAt: Date.now() });
    if (result.status !== 'saved') { setError('저장하지 못했어요. 입력을 유지했습니다.'); return false; }
    return true;
  }

  return <div className="account-map-setup-step account-map-locations-step">
    <header><p className="account-map-eyebrow">2 / 4 · 계좌 연결</p><h1 id="account-map-setup-title">돈이 머무는 곳을 연결해요</h1><p>한 계좌를 여러 목적에 써도 괜찮아요. 실제 계좌번호는 필요하지 않습니다.</p></header>
    <nav className="account-map-purpose-steps" aria-label="연결할 목적">
      {purposes.map((item) => {
        const connected = draft.links.some((link) => link.purposeId === item.id && link.status === 'active');
        return <button type="button" key={item.id} aria-current={item.id === purpose.id ? 'step' : undefined} disabled={disabled || editing} onClick={() => select(item.id)}>{connected ? <Check size={14} aria-hidden="true" /> : null}{item.label}</button>;
      })}
    </nav>
    <article className="account-map-question" aria-label={`${purpose.label} 계좌 연결`}>
      <header><p className="account-map-eyebrow">{currentIndex + 1} / {purposes.length} · {purpose.label}{purpose.id === 'system:income' ? ' · 필수' : ''}</p><h2 ref={titleRef} tabIndex={-1}>{purpose.prompt}</h2><p className="account-map-question__amount">월 <strong>{formatWon(status.targetWon)}</strong></p></header>
      {links.length === 0 ? <p className="account-map-hint">{status.targetWon === 0 ? '현재 월 계획은 0원이에요. 계좌를 연결하거나 다음 목적으로 넘어갈 수 있어요.' : '아래에서 계좌를 고르면 이 목적의 월 금액을 배정합니다.'}</p> : <div className="account-map-connected-summary">
        {links.map((link) => <div key={link.id}><span><Check size={16} aria-hidden="true" />{locations.find(({ id }) => id === link.locationId)?.shortName ?? '계좌'}</span><strong>{formatWon(link.monthlyAmountWon)}</strong></div>)}
        {!showPicker ? <div className="account-map-question__tools"><button ref={editTrigger} type="button" disabled={disabled} onClick={() => { setError(null); setEditing(true); }}>배정 금액 수정</button><button type="button" disabled={disabled} onClick={() => setConnecting(true)}>다른 계좌 연결</button></div> : null}
      </div>}
      {showPicker ? <section aria-label={`${purpose.label} 연결`} className="account-map-question__picker"><AccountMapLocationPicker key={`${purpose.id}:${pickerEpoch}`} recoveryScope={purpose.id} draftCache={pickerCache.current} locations={[...locations]} linkedLocationIds={new Set(draft.links.filter((link) => link.purposeId === purpose.id).map((link) => link.locationId))} amountRequired={links.length > 0} disabled={disabled} onDirtyChange={setPickerDirty} onCancel={() => { setConnecting(false); setPickerDirty(false); setPickerEpoch((epoch) => epoch + 1); titleRef.current?.focus(); }}
        onSelect={(locationId, monthlyAmountWon) => connect({ purposeId: purpose.id, locationId, monthlyAmountWon, restoreLocation: locations.find(({ id }) => id === locationId)?.archivedAt !== undefined })}
        onCreate={(newLocation, monthlyAmountWon) => connect({ purposeId: purpose.id, locationId: newLocation.id, newLocation, monthlyAmountWon })} /></section> : links.length === 0 ? <Button type="button" variant="secondary" disabled={disabled} onClick={() => setConnecting(true)}>계좌 연결</Button> : null}
      {status.excessWon > 0 ? <p className="account-map-error" role="alert">월 기준보다 {formatWon(status.excessWon)} 더 배정되어 있어요. 배정 금액을 수정해 주세요.</p> : null}
      <footer className="account-map-question__footer"><Button type="button" variant="secondary" disabled={disabled} onClick={() => currentIndex === 0 ? onBack() : select(purposes[currentIndex - 1]!.id)}>이전</Button><Button type="button" variant="primary" disabled={disabled || pickerDirty || ((purpose.id === 'system:income' || last) && incomeMissing)} onClick={() => last ? onContinue() : select(purposes[currentIndex + 1]!.id)}>{last ? '계좌 연결 마치기' : links.length === 0 && purpose.id !== 'system:income' ? '나중에 연결' : '다음 목적'}<ChevronRight size={16} aria-hidden="true" /></Button></footer>
      {pickerDirty ? <p className="account-map-hint" role="status">입력한 계좌를 연결하면 다음으로 넘어갈 수 있어요. 위의 목적 버튼으로 이동해도 입력은 보존됩니다.</p> : null}
    </article>
    <button type="button" className="account-map-add-purpose" disabled={disabled} onClick={onAddCustomPurpose}>세부 목적 추가</button>
    {editing ? <AccountMapModal initialMode="edit" node={{ id: purpose.id, kind: 'purpose', label: purpose.label, amountWon: status.targetWon, status: 'resolved' }} related={draft.links.filter((link) => link.purposeId === purpose.id).map((link) => ({ label: locations.find(({ id }) => id === link.locationId)?.shortName ?? '계좌', amountWon: link.monthlyAmountWon, status: link.status, linkId: link.id, purposeId: link.purposeId, locationId: link.locationId, remainder: link.remainder }))} sourceElement={editTrigger.current} fallbackElement={titleRef.current} reducedMotion locations={[...locations]} onConnectLocation={(locationId, monthlyAmountWon) => connect({ purposeId: purpose.id, locationId, monthlyAmountWon, restoreLocation: locations.find(({ id }) => id === locationId)?.archivedAt !== undefined })} onCreateAndConnectLocation={(newLocation, monthlyAmountWon) => connect({ purposeId: purpose.id, locationId: newLocation.id, newLocation, monthlyAmountWon })} recovery={recovery} recoveryPending={pending} saveFailed={error !== null} saveErrorMessage={error ?? undefined} onClose={() => setEditing(false)} onReapply={onReapply} onKeepLatest={() => { onKeepLatest(); setEditing(false); }} onSaveEdit={saveAllocation} /> : null}
  </div>;
}
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
