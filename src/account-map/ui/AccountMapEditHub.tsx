import type { JSX } from 'react';
import { ArrowRight, ChevronRight, Landmark, SlidersHorizontal } from 'lucide-react';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { AccountMapAppliedV3, PurposeId } from '../domain/model';
import { SYSTEM_PURPOSE_IDS } from '../domain/model';
import { reconcilePurpose } from '../domain/reconciliation';
import { Button } from '../../components/common/Button';

interface Props {
  main: MainData;
  applied: AccountMapAppliedV3;
  locations: readonly FinancialLocation[];
  disabled: boolean;
  onEditPurpose(id: PurposeId, trigger: HTMLElement): void;
  onEditLocation(id: string, trigger: HTMLElement): void;
  onAddPurpose(): void;
  onAddTransfer(): void;
  onEditTransfer(id: string): void;
}

/** The same edits are reachable without finding a small node or edge in the map. */
export function AccountMapEditHub({ main, applied, locations, disabled, onEditPurpose, onEditLocation, onAddPurpose, onAddTransfer, onEditTransfer }: Props): JSX.Element {
  const purposes: PurposeId[] = [...SYSTEM_PURPOSE_IDS, ...applied.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id }) => id)];
  const name = (id: string) => locations.find((location) => location.id === id)?.shortName ?? '계좌';
  const label = (id: PurposeId) => (({ 'system:income': '수입', 'system:housing': '주거', 'system:living': '생활비', 'system:saving': '저축', 'system:investing': '투자' } as Record<string, string>)[id] ?? applied.customPurposes.find((purpose) => purpose.id === id)?.name ?? '목적');
  return <section className="account-map-edit-hub" id="account-map-edit-hub" aria-labelledby="account-map-edit-title">
    <header><p className="account-map-eyebrow">계좌 맵 편집</p><h2 id="account-map-edit-title" tabIndex={-1}>무엇을 바꿀까요?</h2><p>변경할 항목을 고르세요. 전체 설정을 다시 할 필요가 없어요.</p></header>
    <nav className="account-map-edit-shortcuts" aria-label="편집 항목"><a href="#account-map-edit-allocations"><SlidersHorizontal size={18} aria-hidden="true" />목적별 배정</a><a href="#account-map-edit-accounts"><Landmark size={18} aria-hidden="true" />계좌 정보</a><a href="#account-map-edit-transfers"><ArrowRight size={18} aria-hidden="true" />계좌 간 흐름</a></nav>
    <section id="account-map-edit-allocations" className="account-map-edit-group" aria-label="목적·계좌 배정 관리">
      <header><h3>목적별 배정</h3><p>어느 계좌에서 얼마를 쓸지 바꿉니다.</p></header>
      <div className="account-map-edit-rows">{purposes.map((id) => {
        const status = reconcilePurpose(id, applied, locations, main);
        const linked = applied.links.filter((link) => link.purposeId === id && link.status === 'active');
        return <button key={id} type="button" aria-label={`${label(id)} 배정 관리`} disabled={disabled} onClick={(event) => onEditPurpose(id, event.currentTarget)}><span><strong>{label(id)}</strong><small>{linked.length === 0 ? '연결할 계좌 선택' : linked.map((link) => name(link.locationId)).join(' · ')}</small></span><span className="account-map-edit-rows__value"><strong>{formatWon(status.targetWon)}</strong>{status.excessWon > 0 ? <small className="account-map-error">{formatWon(status.excessWon)} 초과</small> : status.unassignedWon > 0 ? <small>{formatWon(status.unassignedWon)} 미배정</small> : null}</span><ChevronRight size={18} aria-hidden="true" /></button>;
      })}</div><Button type="button" variant="quiet" disabled={disabled} onClick={onAddPurpose}>세부 목적 추가</Button>
    </section>
    <section id="account-map-edit-accounts" className="account-map-edit-group" aria-label="계좌 정보 관리"><header><h3>계좌 정보</h3><p>이름·은행을 수정하거나 쓰지 않는 계좌를 보관합니다.</p></header><div className="account-map-edit-rows">{locations.filter(({ archivedAt }) => archivedAt === undefined).map((location) => <button key={location.id} type="button" aria-label={`${location.shortName} 계좌 정보 편집`} disabled={disabled} onClick={(event) => onEditLocation(location.id, event.currentTarget)}><span><strong>{location.shortName}</strong><small>{location.institution?.name ?? (location.kind === 'cash' ? '현금·보관처' : '기관 미입력')}</small></span><ChevronRight size={18} aria-hidden="true" /></button>)}</div><p className="account-map-hint">새 계좌는 위의 목적별 배정에서 연결할 수 있어요.</p></section>
    <section id="account-map-edit-transfers" className="account-map-edit-group" aria-label="전체 계좌 흐름 관리"><header><h3>계좌 간 흐름</h3><p>계좌 사이에 매달 보낼 금액과 규칙을 바꿉니다.</p></header><div className="account-map-edit-rows">{applied.transfers.map((transfer) => <button key={transfer.id} type="button" aria-label={`${name(transfer.sourceLocationId)} → ${name(transfer.targetLocationId)} 흐름 관리`} disabled={disabled} onClick={() => onEditTransfer(transfer.id)}><span><strong>{name(transfer.sourceLocationId)} → {name(transfer.targetLocationId)}</strong><small>{transfer.status === 'suspended' ? '중지 · ' : ''}{transfer.allocation.kind === 'sweep' ? '남은 금액 전부' : `매달 ${formatWon(transfer.allocation.monthlyAmountWon)}`}</small></span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>{applied.transfers.length === 0 ? <p className="account-map-hint">계좌 사이에 돈을 옮긴다면 이체 계획을 추가해 보세요.</p> : null}<Button type="button" variant="secondary" disabled={disabled || locations.filter(({ archivedAt }) => archivedAt === undefined).length < 2} onClick={onAddTransfer}>계좌 간 흐름 추가</Button></section>
  </section>;
}
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
