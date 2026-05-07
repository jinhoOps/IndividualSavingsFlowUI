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

    // 시뮬레이션 루프
    filteredData.forEach((point, index) => {
      const currentPrice = point.price;
      
      // 1. 자금 투입 (매월 초에 투입된다고 가정)
      if (index === 0) {
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

      // 4. MDD 계산
      if (currentValue > peakValue) {
        peakValue = currentValue;
      }
      const drawdown = (peakValue - currentValue) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      history.push({
        date: point.date,
        value: Math.round(currentValue),
        principal: totalPrincipal
      });
    });

    const finalValue = history[history.length - 1].value;
    const totalReturn = (finalValue - totalPrincipal) / totalPrincipal;

    // CAGR 계산 (거치식 전용)
    const years = filteredData.length / 12;
    const cagr = years > 0 ? Math.pow(finalValue / initialPrincipal, 1 / years) - 1 : 0;

    // IRR 계산 (단순화: 월간 수익률의 기하평균을 연율화)
    // 실제 IRR은 복잡한 방정식 풀이가 필요하므로 추후 고도화 가능
    const irr = 0; 

    return {
      finalValue,
      totalPrincipal,
      totalReturn,
      cagr: isFinite(cagr) ? cagr : 0,
      irr,
      mdd: maxDrawdown,
      history
    };
  }
}
