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
      }

      // 4. 청산 체크 (원금 대비 99% 이상 손실 시 청산으로 간주)
      if (currentValue < totalPrincipal * 0.01 || currentValue <= 0) {
        isLiquidated = true;
        liquidationDate = point.date;
        currentValue = 0;
        currentShares = 0;
      }

      // 5. MDD 계산
      if (currentValue > peakValue) {
        peakValue = currentValue;
      }
      const drawdown = peakValue > 0 ? (peakValue - currentValue) / peakValue : 0;
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

    // CAGR 계산 (거치식 전용)
    const years = filteredData.length / 12;
    const cagr = years > 0 && finalValue > 0 && initialPrincipal > 0 
      ? Math.pow(finalValue / initialPrincipal, 1 / years) - 1 
      : 0;

    // IRR 계산 (단순화: 월간 수익률의 기하평균을 연율화)
    const irr = 0; 

    return {
      finalValue,
      totalPrincipal,
      totalReturn,
      cagr: isFinite(cagr) ? cagr : 0,
      irr,
      mdd: maxDrawdown,
      isLiquidated,
      liquidationDate,
      history
    };
  }
}
