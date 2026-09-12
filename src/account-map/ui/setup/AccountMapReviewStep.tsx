import { useState, type JSX } from 'react';
import type { FinancialLocation } from '../../../workspace/domain/financialLocation';
import type { MainData } from '../../../main/domain/model';
import type { AccountMapDraftV2 } from '../../domain/model';
import type { MapInteractionState } from '../../application/reducer';
import { AccountMapCanvas } from '../AccountMapCanvas';
import type { AccountMapReviewProjection } from '../../application/setupProjection';

export interface AccountMapReviewStepProps {
  locations: readonly FinancialLocation[];
  review: AccountMapReviewProjection;
  canApply: boolean;
  main: MainData;
  draft: AccountMapDraftV2;
  onEditLocations(): void;
  onEditTransfers(): void;
}

/** Presentation-only review of the calculation supplied by the application boundary. */
export function AccountMapReviewStep({ locations, review, canApply, main, draft, onEditLocations, onEditTransfers }: AccountMapReviewStepProps): JSX.Element {
  const [interaction, setInteraction] = useState<MapInteractionState>({ transientNodeId: null, pinnedNodeId: null, modalNodeId: null });
  const locationName = (locationId: string): string => locations.find((location) => location.id === locationId)?.shortName ?? '알 수 없는 계좌';
  return (
    <div className="account-map-setup-step account-map-review-step">
      <header>
        <p className="account-map-eyebrow">4 / 4 · 전체 검토</p>
        <h1 id="account-map-setup-title">월 흐름을 검토해요</h1>
        <p>계좌와 월 배정액을 마지막으로 확인해 주세요. 지도 만들기를 눌러야 설정이 완료됩니다.</p>
      </header>
      <div className="account-map-review-summary"><strong>{review.accounts.length}개 계좌 · {draft.transfers.filter(({status}) => status === 'active').length}개 이체 계획</strong><p>실제 잔액이나 자동이체가 아닌 월 계획입니다.</p><div className="account-map-question__tools"><button type="button" onClick={onEditLocations}>계좌·배정 수정</button><button type="button" onClick={onEditTransfers}>이체 계획 수정</button></div></div>
      {!canApply ? <p className="account-map-error" role="alert">수입 계좌를 연결하고 초과 배정을 조정해 주세요. 위의 계좌·배정 수정에서 돌아갈 수 있어요.</p> : null}
      <AccountMapCanvas applied={{...draft, schemaVersion: 3, setupCompletedAt: draft.updatedAt}} main={main} locations={locations} interaction={interaction} onTransient={(nodeId) => setInteraction((current) => ({...current, transientNodeId: nodeId}))} onBlur={() => setInteraction((current) => ({...current, transientNodeId: null}))} onInvoke={(nodeId) => setInteraction({transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null})} onBackground={() => setInteraction({transientNodeId: null, pinnedNodeId: null, modalNodeId: null})} onEscape={() => setInteraction({transientNodeId: null, pinnedNodeId: null, modalNodeId: null})} />
      <section className="account-map-review-flow" aria-labelledby="account-map-review-flow-title">
        <h2 id="account-map-review-flow-title">계좌별 계획</h2>
        <ul>
          {review.accounts.map((account) => (
            <li key={account.locationId}>
              <strong>{locationName(account.locationId)}</strong>
              <span>수입 {formatWon(account.availableWon)}</span>
              <span>목적 배정 {formatWon(account.localAllocationWon)}</span>
              {account.sweep === null ? null : <span>남은 금액 전부 · 계획상 {formatWon(account.sweep.amountWon)}</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="account-map-review-flow" aria-labelledby="account-map-review-warnings-title">
        <h2 id="account-map-review-warnings-title">확인할 사항</h2>
        {review.warnings.length === 0 ? <p className="account-map-hint">현재 계산에서 부족하거나 미배정인 계좌가 없습니다.</p> : (
          <ul>
            {review.warnings.map((warning) => (
              <li key={`${warning.kind}:${warning.locationId}`} className="account-map-alert">
                <strong>{locationName(warning.locationId)}</strong>
                <span>{warning.kind === 'shortfall' ? `계획상 부족 ${formatWon(warning.amountWon)}` : `배정되지 않은 금액 ${formatWon(warning.amountWon)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
