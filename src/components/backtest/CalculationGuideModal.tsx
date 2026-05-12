import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculationGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-md bg-ink/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-panel w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-float border border-line animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-panel/90 backdrop-blur-md px-lg py-md border-b border-line flex justify-between items-center z-10">
          <div>
            <h2 className="text-title-sm font-black text-ink">백테스트 계산 로직 가이드</h2>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">Calculation Methodology v0.9.27</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-line transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="p-lg space-y-xl">
          {/* 1. 기본 시뮬레이션 루프 */}
          <section>
            <h3 className="text-body-md font-black text-primary mb-md flex items-center gap-sm">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              기본 시뮬레이션 원칙
            </h3>
            <div className="space-y-sm text-body-sm leading-relaxed text-ink/80">
              <p>본 엔진은 <strong className="text-ink">월간 데이터(Monthly Time-series)</strong>를 기반으로 동작하며, 모든 자금 투입은 <strong className="text-ink">해당 월의 초(Begin of Month)</strong>에 이루어지는 것으로 가정합니다.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted">
                <li>데이터 포인트 사이의 수익률은 가격 변동률을 그대로 반영합니다.</li>
                <li>적립식 투자의 경우, 매월 지정된 날짜에 신규 현금이 투입되어 당일 종가로 즉시 매수됩니다.</li>
                <li>모든 계산은 소수점 8자리 이상의 정밀도로 수행된 후, 최종 결과에서 반올림 처리됩니다.</li>
              </ul>
            </div>
          </section>

          {/* 2. 배당 재투자 (TR) */}
          <section className="bg-line/20 p-md rounded-md">
            <h3 className="text-body-md font-black text-ink mb-md">배당 재투자 (Total Return, TR)</h3>
            <div className="bg-white/50 p-sm rounded border border-line mb-md">
              <code className="text-xs font-mono text-primary">
                Dividend_Amount = Current_Value * Monthly_Dividend_Yield<br />
                New_Shares = (Dividend_Amount / Current_Price)<br />
                Total_Shares += New_Shares
              </code>
            </div>
            <p className="text-body-sm text-muted">
              배당 수익이 발생하는 즉시 당일 종가로 전액 재투자합니다. 이는 복리 효과를 극대화하며, 주가 지수뿐만 아니라 배당을 포함한 '총수익' 관점에서의 성과를 보여줍니다.
            </p>
          </section>

          {/* 3. CAGR vs IRR */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <h3 className="text-body-sm font-black text-ink mb-sm">CAGR (연평균 성장률)</h3>
              <p className="text-xs text-muted leading-relaxed">
                거치식 투자에서 주로 사용됩니다. 시작과 끝의 가치만을 고려하여 기하평균 수익률을 산출합니다.
              </p>
              <div className="mt-2 text-[10px] font-mono bg-line/30 p-2 rounded">
                CAGR = (Final / Initial)^(1 / Years) - 1
              </div>
            </div>
            <div>
              <h3 className="text-body-sm font-black text-ink mb-sm">IRR (내부 수익률)</h3>
              <p className="text-xs text-muted leading-relaxed">
                적립식 투자처럼 현금 흐름이 비정기적이거나 반복될 때 사용됩니다. 투입된 모든 자금의 시간 가치를 고려한 연환산 수익률입니다. (Newton-Raphson 법 사용)
              </p>
              <div className="mt-2 text-[10px] font-mono bg-line/30 p-2 rounded">
                ∑ [CashFlow_t / (1 + r)^t] = 0
              </div>
            </div>
          </section>

          {/* 4. MDD */}
          <section>
            <h3 className="text-body-md font-black text-ink mb-md">MDD (최대 낙폭)</h3>
            <div className="flex gap-md items-start">
              <div className="flex-1 text-body-sm text-muted leading-relaxed">
                투자 기간 중 발생한 <strong className="text-ink">전고점 대비 최대 하락 비율</strong>입니다. 
                자금 투입에 의한 가치 왜곡을 방지하기 위해, 원금 투입 효과를 제거한 <strong className="text-ink">단위 가격(Unit Price) 지수</strong>를 별도로 추적하여 계산합니다.
              </div>
              <div className="w-32 h-20 bg-line/10 rounded flex items-center justify-center text-[10px] text-muted border border-dashed border-line">
                Chart Placeholder
              </div>
            </div>
          </section>

          {/* 5. 청산 조건 */}
          <section>
            <h3 className="text-body-md font-black text-red-500 mb-sm">강제 청산 (Liquidation) 조건</h3>
            <p className="text-body-sm text-muted">
              레버리지 자산이나 극심한 변동성으로 인해 <strong className="text-ink">자산 가치가 누적 원금의 1% 미만</strong>으로 떨어질 경우, 
              해당 시점에서 시뮬레이션을 중단하고 '청산'으로 간주합니다. 이후의 수익률은 0%로 고정됩니다.
            </p>
          </section>

          {/* 6. 통화 및 환율 */}
          <section className="bg-primary/5 p-md rounded-md border border-primary/20">
            <h3 className="text-body-md font-black text-primary mb-md">통화 및 환율 (Currency)</h3>
            <div className="space-y-sm text-body-sm text-ink/80 leading-relaxed">
              <p>본 앱은 원화(KRW) 기반의 투자 계획을 지원합니다. 해외 자산(USD) 투자 시 다음과 같이 처리됩니다:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted">
                <li><strong className="text-ink">입력 변환</strong>: 사용자가 입력한 원화 투자금은 <strong className="text-ink">고정 환율(1,450원)</strong>을 적용하여 달러로 환산된 후 시뮬레이션에 투입됩니다.</li>
                <li><strong className="text-ink">결과 표시</strong>: USD 자산의 최종 금액은 달러($)로 먼저 표시되며, 현재 고정 환율을 적용한 원화 금액이 병기됩니다.</li>
                <li><strong className="text-ink">상대 비교</strong>: 서로 다른 통화의 자산을 비교(Relative Mode)할 경우, 모든 가치를 <strong className="text-ink">원화로 재환산</strong>하여 성과 차이를 계산합니다.</li>
                <li>실제 과거 환율 변동 데이터는 시뮬레이션에 반영되지 않으며, 고정 환율을 통해 자산 본연의 수익 성과에 집중합니다.</li>
              </ul>
            </div>
          </section>
        </div>

        <footer className="p-lg bg-line/10 border-t border-line text-center">
          <p className="text-[11px] text-muted font-medium">본 시뮬레이션은 과거의 데이터를 기반으로 하며, 미래의 수익을 보장하지 않습니다.</p>
        </footer>
      </div>
    </div>
  );
};
