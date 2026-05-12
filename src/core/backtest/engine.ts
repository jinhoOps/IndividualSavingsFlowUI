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
    let cash = 0;
    const history: SimulationResult['history'] = [];
    
    let peakValue = -Infinity;
    let maxDrawdown = 0;
    let isLiquidated = false;
    let liquidationDate: string | undefined = undefined;

    // MDD 계산을 위한 '단위 가격(Unit Price)' 추적 (자금 투입 영향 배제)
    let unitPricePeak = -Infinity;
    let currentUnitPrice = 100; // 기준가 100으로 시작

    let lastInvestmentMonth = '';

    // 시뮬레이션 루프
    for (let i = 0; i < filteredData.length; i++) {
      const point = filteredData[i];
      const currentPrice = point.price;
      const currentMonth = point.date.substring(0, 7); // YYYY-MM
      
      if (isLiquidated) {
        history.push({
          date: point.date,
          value: 0,
          principal: totalPrincipal,
          isLiquidated: true
        });
        continue;
      }

      // 이전 가격 대비 수익률 계산 (MDD용 단위 가격 추적)
      if (i > 0) {
        const prevPrice = filteredData[i-1].price;
        const assetReturn = (currentPrice - prevPrice) / prevPrice;
        currentUnitPrice *= (1 + assetReturn);
      }

      // 1. 자금 투입
      // 초기 자본 투입 (첫 데이터 포인트에서만 실행)
      if (i === 0) {
        cash += initialPrincipal;
        totalPrincipal += initialPrincipal;
      }
      
      // 월간 적립금 투입 (월이 바뀔 때마다 실행, 단 첫 달은 제외하고 처리할지 고민 필요하나 보통 월초 투입 가정)
      if (currentMonth !== lastInvestmentMonth) {
        // 이미 i=0에서 initial을 넣었으므로, 첫 달 적립금은 initial에 포함되거나 별도로 넣어야 함.
        // 여기서는 매월 '새로운' 달이 시작될 때 monthlyInstallment를 넣는 것으로 통일 (첫 달 포함)
        cash += monthlyInstallment;
        totalPrincipal += monthlyInstallment;
        lastInvestmentMonth = currentMonth;
      }

      // 2. 보유 수량에 따른 현재 가치 계산 (배당 포함 전)
      if (cash > 0 && currentPrice > 0) {
        currentShares += cash / currentPrice;
        cash = 0;
      }

      let currentValue = currentShares * currentPrice;

      // 3. 배당금 재투자 (TR)
      // point.dividendYield는 해당 월의 배당률(예: 0.01 = 1%)로 가정
      if (reinvestDividends && point.dividendYield && point.dividendYield > 0) {
        const dividendAmount = currentValue * point.dividendYield;
        // 배당금으로 즉시 추가 매수 (수수료 등 무시)
        if (currentPrice > 0) {
          currentShares += dividendAmount / currentPrice;
          currentValue = currentShares * currentPrice;
          // 단위 가격에도 배당 반영하여 TR(Total Return) 지수화
          currentUnitPrice *= (1 + point.dividendYield);
        }
      }

      // 4. 청산 체크 (자산 가치가 원금의 1% 미만으로 떨어지면 청산)
      // 레버리지 자산 등에서 발생 가능
      if (currentValue < totalPrincipal * 0.01 || (currentShares > 0 && currentPrice <= 0)) {
        isLiquidated = true;
        liquidationDate = point.date;
        currentValue = 0;
        currentShares = 0;
      }

      // 5. MDD 계산 (단위 가격 기준 - 배당 반영된 TR 기준가 사용)
      if (currentUnitPrice > unitPricePeak) {
        unitPricePeak = currentUnitPrice;
      }
      const drawdown = unitPricePeak > 0 ? (unitPricePeak - currentUnitPrice) / unitPricePeak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      history.push({
        date: point.date,
        value: Number(currentValue.toFixed(2)),
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

    // CAGR 계산 (일자 기준 정밀화)
    const actualStartDate = new Date(filteredData[0].date);
    const actualEndDate = new Date(filteredData[filteredData.length - 1].date);
    const diffTime = Math.abs(actualEndDate.getTime() - actualStartDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = diffDays / 365.25;

    const cagr = years > 0 && finalValue > 0 && initialPrincipal > 0 
      ? Math.pow(finalValue / initialPrincipal, 1 / years) - 1 
      : 0;

    // IRR 계산용 월수 계산 (시작/종료일 차이 기반)
    const monthsForIRR = Math.max(1, Math.round(diffDays / 30.4375));
    const irr = this.calculateIRR(initialPrincipal, monthlyInstallment, finalValue, monthsForIRR);

    // 차트 데이터 다운샘플링 (데이터가 너무 많을 경우 UI 성능을 위해 월간 데이터만 추출)
    // 단, 청산 시점이나 시작/종료점은 포함
    const sampledHistory = history.length > 100 
      ? history.filter((h, idx) => {
          if (idx === 0 || idx === history.length - 1 || h.isLiquidated) return true;
          // 매월 첫 데이터만 남김
          const prev = history[idx - 1];
          return h.date.substring(0, 7) !== prev.date.substring(0, 7);
        })
      : history;

    return {
      finalValue: Number(finalValue.toFixed(2)),
      totalPrincipal,
      totalReturn: Number(totalReturn.toFixed(6)),
      finalAnnualDividend,
      cagr: isFinite(cagr) ? Number(cagr.toFixed(6)) : 0,
      irr: isFinite(irr) ? Number(irr.toFixed(6)) : 0,
      mdd: Number(maxDrawdown.toFixed(6)),
      isLiquidated,
      liquidationDate,
      history: sampledHistory
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
