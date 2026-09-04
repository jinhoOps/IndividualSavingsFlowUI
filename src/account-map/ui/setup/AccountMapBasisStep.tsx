import type { JSX } from 'react';
import type { MainData } from '../../../main/domain/model';

export type MainPlanEditTarget = 'income' | 'housing' | 'living' | 'saving' | 'investing';

export interface AccountMapBasisStepProps {
  main: MainData;
  disabled?: boolean;
  onContinue(): void;
  onRequestMainEdit(target: MainPlanEditTarget): void;
}

/** Read-only Main basis. The host decides how an edit request is presented. */
export function AccountMapBasisStep({
  main,
  disabled = false,
  onContinue,
  onRequestMainEdit,
}: AccountMapBasisStepProps): JSX.Element {
  return (
    <div className="account-map-setup-step account-map-basis-step">
      <header>
        <p className="account-map-eyebrow">1 / 4 · 기준 확인</p>
        <h1 id="account-map-setup-title">월 자금 기준 확인</h1>
        <p>Main에서 저장한 월 금액을 읽어 왔어요. 계좌 연결은 이 기준을 바꾸지 않습니다.</p>
      </header>
      <div className="account-map-basis-step__groups">
        <section aria-labelledby="account-map-basis-income">
          <h2 id="account-map-basis-income">들어오는 돈</h2>
          <BasisAmount label="수입" amountWon={main.monthlyNetIncomeWon} onEdit={() => onRequestMainEdit('income')} disabled={disabled} />
        </section>
        <section aria-labelledby="account-map-basis-spending">
          <h2 id="account-map-basis-spending">나가는 돈</h2>
          <BasisAmount label="주거" amountWon={main.monthlyHousingWon} onEdit={() => onRequestMainEdit('housing')} disabled={disabled} />
          <BasisAmount label="생활비" amountWon={main.monthlyLivingWon} onEdit={() => onRequestMainEdit('living')} disabled={disabled} />
        </section>
        <section aria-labelledby="account-map-basis-saving">
          <h2 id="account-map-basis-saving">모으는 돈</h2>
          <BasisAmount label="저축" amountWon={main.monthlySavingWon} onEdit={() => onRequestMainEdit('saving')} disabled={disabled} />
          <BasisAmount label="투자" amountWon={main.monthlyInvestmentWon} onEdit={() => onRequestMainEdit('investing')} disabled={disabled} />
        </section>
      </div>
      <footer className="account-map-setup__actions">
        <button type="button" className="ui-button ui-button--secondary" disabled={disabled} onClick={() => onRequestMainEdit('income')}>Main 금액 수정</button>
        <button type="button" className="ui-button ui-button--primary" disabled={disabled} onClick={onContinue}>이 금액으로 계속</button>
      </footer>
    </div>
  );
}

function BasisAmount({ label, amountWon, disabled, onEdit }: { label: string; amountWon: number; disabled: boolean; onEdit(): void }): JSX.Element {
  return (
    <div className="account-map-basis-step__amount">
      <span>{label}</span>
      <strong>{formatWon(amountWon)}</strong>
      <button type="button" disabled={disabled} onClick={onEdit} aria-label={`${label} Main 금액 수정`}>수정</button>
    </div>
  );
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
