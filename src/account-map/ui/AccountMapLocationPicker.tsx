import { useEffect, useMemo, useState, type JSX } from 'react';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import { findLocationDuplicate, INSTITUTIONS } from '../domain/institutions';

export interface LocationPickerProps {
  locations: FinancialLocation[];
  linkedLocationIds: Set<string>;
  onSelect(locationId: string, amount?: number): void;
  onCreate(location: FinancialLocation, amount?: number): void;
  amountRequired?: boolean;
  disabled?: boolean;
  cancelDisabled?: boolean;
  onCancel?(): void;
  onDirtyChange?(dirty: boolean): void;
}

export function AccountMapLocationPicker({
  locations,
  linkedLocationIds,
  onSelect,
  onCreate,
  amountRequired = false,
  disabled = false,
  cancelDisabled = false,
  onCancel,
  onDirtyChange,
}: LocationPickerProps): JSX.Element {
  const [mode, setMode] = useState<'choose' | 'create'>('choose');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationKind, setLocationKind] = useState<FinancialLocation['kind']>('bank');
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [customInstitution, setCustomInstitution] = useState('');
  const [shortName, setShortName] = useState('');
  const [amount, setAmount] = useState('');
  const available = locations.filter((location) => location.archivedAt === undefined
    && !linkedLocationIds.has(location.id));
  const knownInstitution = INSTITUTIONS.find(([id]) => id === institutionId);
  const needsInstitution = locationKind !== 'cash';
  const usesCustomInstitution = locationKind === 'brokerage' || institutionId === 'custom';
  const preview = useMemo(() => {
    if (mode !== 'create' || shortName.trim() === '') return null;
    if (needsInstitution && knownInstitution === undefined && (!usesCustomInstitution || customInstitution.trim() === '')) return null;
    const now = Date.now();
    const id = createId();
    const institution = !needsInstitution
      ? undefined
      : knownInstitution === undefined
        ? {
            ...(locationKind === 'bank' ? { id: `custom:${id}` } : {}),
            name: customInstitution.trim(),
          }
        : { id: knownInstitution[0], name: knownInstitution[1] };
    return {
      id: `location:${id}`,
      shortName: shortName.trim(),
      ...(institution === undefined ? {} : { institution }),
      kind: locationKind,
      roles: [],
      createdAt: now,
      updatedAt: now,
    };
  }, [customInstitution, knownInstitution, locationKind, mode, needsInstitution, shortName, usesCustomInstitution]);
  const duplicate = preview === null ? { kind: 'none' as const } : findLocationDuplicate(locations, preview);
  const amountWon = amount === '' ? undefined : Number(amount);
  const amountValid = !amountRequired || (amountWon !== undefined && Number.isSafeInteger(amountWon) && amountWon > 0);
  const dirty = selectedLocationId !== null || mode === 'create' || amount !== '';
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    setInstitutionId(null);
    setCustomInstitution('');
  }, [locationKind]);

  function submitExisting(locationId: string): void {
    if (disabled || !amountValid) return;
    onSelect(locationId, amountWon);
  }

  return <div className="account-map-location-picker">
    {mode === 'choose' ? <>
      {available.length === 0
        ? <p className="account-map-empty-copy">바로 고를 수 있는 기존 항목이 없습니다.</p>
        : <div className="account-map-location-list">{available.map((location) => <button
          key={location.id}
          type="button"
          className={selectedLocationId === location.id ? 'is-selected' : ''}
          disabled={disabled}
          onClick={() => setSelectedLocationId(location.id)}
        ><strong>{location.shortName}</strong><span>{location.institution?.name ?? '기관 없음'}</span></button>)}</div>}
      <button type="button" className="account-map-new-location" disabled={disabled} onClick={() => { setMode('create'); setSelectedLocationId(null); }}><span aria-hidden="true">＋</span><strong>새 계좌·보관처 추가</strong></button>
    </> : <>
      <fieldset><legend>위치 종류</legend><div className="account-map-institutions">{LOCATION_KINDS.map(([kind, label]) => <button key={kind} type="button" className={locationKind === kind ? 'is-selected' : ''} aria-pressed={locationKind === kind} disabled={disabled} onClick={() => setLocationKind(kind)}>{label}</button>)}</div></fieldset>
      {locationKind === 'bank' ? <fieldset><legend>기관 빠른 선택</legend><div className="account-map-institutions">{INSTITUTIONS.map(([id, name]) => <button key={id} type="button" className={institutionId === id ? 'is-selected' : ''} disabled={disabled} onClick={() => setInstitutionId(id)}>{name}</button>)}<button type="button" className={institutionId === 'custom' ? 'is-selected' : ''} disabled={disabled} onClick={() => setInstitutionId('custom')}>직접 입력</button></div></fieldset> : null}
      {usesCustomInstitution ? <label>기관 이름<input value={customInstitution} disabled={disabled} onChange={(event) => setCustomInstitution(event.target.value)} /></label> : null}
      <label>표시 이름<input value={shortName} disabled={disabled} maxLength={8} placeholder="예: 급여통장" onChange={(event) => setShortName(event.target.value)} /></label>
      {duplicate.kind === 'none' ? null : <div className="account-map-duplicate"><p>{duplicate.kind === 'archived' ? '보관된 같은 항목이 있어요.' : '이미 같은 항목이 있어요.'}</p><button type="button" className="ui-button ui-button--secondary" disabled={disabled || !amountValid} onClick={() => submitExisting(duplicate.location.id)}>{duplicate.kind === 'archived' ? '기존 항목 복원해서 연결' : '기존 항목 연결'}</button></div>}
    </>}
    {amountRequired ? <label>이 계좌에 둘 월 금액<input inputMode="numeric" value={amount} disabled={disabled} placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/\D/gu, ''))} /><span>원</span></label> : null}
    <div className="account-map-location-picker__actions">
      {onCancel === undefined ? null : <button type="button" className="ui-button ui-button--secondary" disabled={cancelDisabled} onClick={onCancel}>취소</button>}
      {mode === 'choose'
        ? <button type="button" className="ui-button ui-button--primary" disabled={disabled || selectedLocationId === null || !amountValid} onClick={() => { if (selectedLocationId !== null) submitExisting(selectedLocationId); }}>완료</button>
        : <button type="button" className="ui-button ui-button--primary" disabled={disabled || preview === null || duplicate.kind !== 'none' || !amountValid} onClick={() => { if (preview !== null) onCreate(preview, amountWon); }}>완료</button>}
    </div>
  </div>;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const LOCATION_KINDS = [
  ['bank', '은행'],
  ['brokerage', '증권'],
  ['cash', '현금'],
] as const satisfies ReadonlyArray<readonly [FinancialLocation['kind'], string]>;
