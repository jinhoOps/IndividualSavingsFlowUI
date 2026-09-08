import type { JSX } from 'react';
import type { FinancialLocation } from '../../../workspace/domain/financialLocation';
import type { AccountMapReviewProjection } from '../../application/setupProjection';

export interface AccountMapReviewStepProps {
  locations: readonly FinancialLocation[];
  review: AccountMapReviewProjection;
  canApply: boolean;
}

/** Presentation-only review of the calculation supplied by the application boundary. */
export function AccountMapReviewStep({ locations, review, canApply }: AccountMapReviewStepProps): JSX.Element {
  const locationName = (locationId: string): string => locations.find((location) => location.id === locationId)?.shortName ?? '알 수 없는 계좌';
  return (
    <div className="account-map-setup-step account-map-review-step">
      <header>
        <p className="account-map-eyebrow">4 / 4 · 전체 검토</p>
        <h1 id="account-map-setup-title">월 흐름을 검토해요</h1>
        <p>계산 결과는 완료한 지도와 같은 월 계획 기준입니다. 실제 잔액이나 거래가 아닙니다.</p>
      </header>
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
      {canApply ? null : <p className="account-map-error" role="alert">수입 위치를 모두 연결하고 초과 배정을 조정한 뒤 적용할 수 있어요.</p>}
    </div>
  );
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
