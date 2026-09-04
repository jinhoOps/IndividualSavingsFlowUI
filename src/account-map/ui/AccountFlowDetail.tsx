import { forwardRef, type JSX } from 'react';
import { Button } from '../../components/common/Button';
import type { AccountFlowDetailGroup } from './accountFlowViewModel';

export interface AccountFlowDetailProps {
  className?: string;
  accountLabel?: string;
  groups: readonly AccountFlowDetailGroup[];
  interactive: boolean;
  onEditLocation?(): void;
  onAddTransfer?(): void;
  onEditTransfer?(transferId: string): void;
}

export const AccountFlowDetail = forwardRef<HTMLElement, AccountFlowDetailProps>(function AccountFlowDetail({ className, accountLabel, groups, interactive, onEditLocation, onAddTransfer, onEditTransfer }, ref): JSX.Element {
  return <aside ref={ref} className={`account-flow-detail ${className ?? ''}`} aria-label={`${accountLabel ?? '선택한 계좌'} 월 계획 흐름`}><header><div><p>월 계획 흐름</p><h3>{accountLabel ?? '연결 흐름'}</h3></div><span>{interactive ? '고정됨' : '미리 보기'}</span></header><p className="account-flow-detail__notice">월 계획 기준이며 실제 잔액·거래와 다를 수 있습니다.</p>{groups.length === 0 ? <p className="account-flow-detail__empty">표시할 활성 월 계획 흐름이 없습니다.</p> : groups.map((group) => <section key={group.key}><h4>{group.label}</h4><ul>{group.rows.map((row) => <li key={row.id}><div><span>{row.label}</span><strong>{row.kind === 'sweep' ? `남은 금액 전부 · 계획상 ${formatWon(row.amountWon)}` : formatWon(row.amountWon)}</strong><small>{row.statusLabel}</small></div>{interactive && (row.kind === 'fixed' || row.kind === 'sweep') && onEditTransfer !== undefined ? <Button variant="secondary" type="button" onClick={() => onEditTransfer(row.id.replace(/^transfer:/u, ''))}>흐름 편집</Button> : null}</li>)}</ul></section>)}{!interactive ? null : <footer>{onEditLocation === undefined ? null : <Button variant="secondary" type="button" onClick={onEditLocation}>계좌 정보 편집</Button>}{onAddTransfer === undefined ? null : <Button variant="primary" type="button" onClick={onAddTransfer}>연결 추가</Button>}</footer>}</aside>;
});
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
