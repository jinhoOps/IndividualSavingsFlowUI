import { AssetData, SimulationParams, SimulationResult, TimeSeriesPoint } from './types';

export class BacktestEngine {
  /**
   * 백테스트 시뮬레이션을 실행합니다.
   */
  static run(asset: AssetData, params: SimulationParams): SimulationResult {
    const { initialPrincipal, monthlyInstallment, startDate, endDate, reinvestDividends } = params;

    // 기간 내 데이터 필터링
    const filteredData = asset.data.filter(
      (p) => p.date >= startDate && p.date <= endDate
    ).sort((a, b) => a.date.localeCompare(b.date));

    if (filteredData.length === 0) {
      throw new Error('시뮬레이션 기간 내의 데이터가 없습니다.');
    }

    let currentShares = 0;
    let totalPrincipal = 0;
    let cash = 0; // 초기 자본은 루프 내에서 처리
    const history: SimulationResult['history'] = [];
    
    let peakValue = -Infinity;
    let maxDrawdown = 0;
    let isLiquidated = false;
    let liquidationDate: string | undefined = undefined;

    // MDD 계산을 위한 '단위 가격(Unit Price)' 추적 (자금 투입 영향 배제)
    let unitPricePeak = -Infinity;
    let currentUnitPrice = 100; // 기준가 100으로 시작

    // 시뮬레이션 루프
    for (let i = 0; i < filteredData.length; i++) {
      const point = filteredData[i];
      const currentPrice = point.price;
      
      if (isLiquidated) {
        history.push({
          date: point.date,
          value: 0,
          principal: totalPrincipal,
          isLiquidated: true
        });
        continue;
      }

      // 이전 가격 대비 수익률 계산 (MDD용)
      if (i > 0) {
        const prevPrice = filteredData[i-1].price;
        const assetReturn = (currentPrice - prevPrice) / prevPrice;
        currentUnitPrice *= (1 + assetReturn);
      }

      // 1. 자금 투입 (매월 초에 투입된다고 가정)
      if (i === 0) {
        cash += initialPrincipal;
        totalPrincipal += initialPrincipal;
      }
      
      cash += monthlyInstallment;
      totalPrincipal += monthlyInstallment;

      // 2. 보유 수량에 따른 현재 가치 계산 (배당 포함 전)
      if (cash > 0) {
        currentShares += cash / currentPrice;
        cash = 0;
      }

      let currentValue = currentShares * currentPrice;

      // 3. 배당금 재투자 (TR)
      if (reinvestDividends && point.dividendYield) {
        const dividendAmount = currentValue * point.dividendYield;
        // 배당금으로 즉시 추가 매수
        currentShares += dividendAmount / currentPrice;
        currentValue = currentShares * currentPrice;
        // 단위 가격에도 배당 반영
        currentUnitPrice *= (1 + point.dividendYield);
      }

      // 4. 청산 체크 (원금 대비 99% 이상 손실 시 청산으로 간주)
      if (currentValue < totalPrincipal * 0.01 || currentValue <= 0) {
        isLiquidated = true;
        liquidationDate = point.date;
        currentValue = 0;
        currentShares = 0;
      }

      // 5. MDD 계산 (단위 가격 기준)
      if (currentUnitPrice > unitPricePeak) {
        unitPricePeak = currentUnitPrice;
      }
      const drawdown = unitPricePeak > 0 ? (unitPricePeak - currentUnitPrice) / unitPricePeak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      history.push({
        date: point.date,
        value: Math.round(currentValue),
        principal: totalPrincipal,
        isLiquidated: isLiquidated
      });
    }

    const finalValue = history[history.length - 1].value;
    const totalReturn = totalPrincipal > 0 ? (finalValue - totalPrincipal) / totalPrincipal : 0;

    // 최종 연 배당금 계산 (마지막 데이터 포인트의 배당률 기준 연율화)
    const lastPoint = filteredData[filteredData.length - 1];
    const finalAnnualDividend = !isLiquidated && lastPoint.dividendYield 
      ? Math.round(currentShares * lastPoint.price * lastPoint.dividendYield * 12)
      : 0;

    // CAGR 계산 (거치식 전용)
    const years = filteredData.length / 12;
    const cagr = years > 0 && finalValue > 0 && initialPrincipal > 0 
      ? Math.pow(finalValue / initialPrincipal, 1 / years) - 1 
      : 0;

    // IRR 계산 (적립식 포함 전체 현금 흐름 기준)
    const irr = this.calculateIRR(initialPrincipal, monthlyInstallment, finalValue, filteredData.length);

    return {
      finalValue,
      totalPrincipal,
      totalReturn,
      finalAnnualDividend,
      cagr: isFinite(cagr) ? cagr : 0,
      irr,
      mdd: maxDrawdown,
      isLiquidated,
      history
    };
  }

  /**
   * 내부 수익률(IRR)을 계산합니다 (이분법 사용)
   */
  private static calculateIRR(initial: number, monthly: number, final: number, months: number): number {
    if (months === 0 || (initial === 0 && monthly === 0)) return 0;
    
    // f(r) = initial*(1+r)^n + monthly * ((1+r)^n - 1)/r - final = 0
    const f = (r: number) => {
      if (Math.abs(r) < 1e-10) return initial + (monthly * months) - final;
      const compound = Math.pow(1 + r, months);
      return initial * compound + (monthly * (compound - 1) / r) - final;
    };

    let low = -0.999;
    let high = 1.0; // 월 100% 수익률까지 탐색
    
    // 해가 존재하는지 확인 (단조 증가 함수이므로 간단함)
    if (f(low) * f(high) > 0) {
      // 범위를 벗어난 경우 (극단적인 수익률)
      if (f(high) < 0) return 10.0; // 1000%+
      return -0.99;
    }

    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (f(mid) > 0) high = mid;
      else low = mid;
    }

    const monthlyRate = (low + high) / 2;
    // 월간 수익률을 연율화: (1+r)^12 - 1
    return Math.pow(1 + monthlyRate, 12) - 1;
  }
}
