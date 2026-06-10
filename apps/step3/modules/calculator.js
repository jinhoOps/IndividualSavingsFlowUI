/**
 * Step 3: Rebalancing Calculation Engine
 */

export const IsfCalculator = {
  /**
   * 포트폴리오의 현재 상태와 목표 격차를 계산합니다.
   * @param {Object} data IsfState.data
   * @returns {Object} { totalValue, assets: [{ id, currentValue, currentRatio, targetRatio, diffRatio, buyAmount }] }
   */
  calculateRebalancing(data) {
    const { assets, investCapacity } = data;
    
    // 1. 현재 총 자산 가치 계산
    const assetsWithValues = assets.map(as => ({
      ...as,
      currentValue: as.currentPrice * as.quantity
    }));
    
    const totalCurrentValue = assetsWithValues.reduce((sum, as) => sum + as.currentValue, 0);
    const totalFutureValue = totalCurrentValue + investCapacity; // 이번 달 투자금 포함

    // 2. 비중 분석 및 매수액 산출
    // 로직: 목표 비중(%)에 도달하기 위해 필요한 금액(Total * Target%) - 현재 금액
    const results = assetsWithValues.map(as => {
      const currentRatio = totalCurrentValue > 0 ? (as.currentValue / totalCurrentValue) * 100 : 0;
      const targetValue = totalFutureValue * (as.targetRatio / 100);
      let buyAmount = targetValue - as.currentValue;

      // 음수(매도)는 매수 가이드에서는 0으로 처리 (신규 투자금 우선 전략)
      // 단, 전체 투자금(investCapacity)을 초과하지 않도록 추후 보정이 필요할 수 있음
      buyAmount = Math.max(0, buyAmount);

      return {
        ...as,
        currentRatio,
        diffRatio: as.targetRatio - currentRatio,
        buyAmount
      };
    });

    // 3. 투자금 비례 배분
    const totalRequiredBuy = results.reduce((sum, as) => sum + as.buyAmount, 0);
    if (investCapacity <= 0) {
      results.forEach(as => { as.buyAmount = 0; });
    } else if (totalRequiredBuy > investCapacity) {
      const ratio = investCapacity / totalRequiredBuy;
      results.forEach(as => {
        as.buyAmount *= ratio;
      });
    }

    return {
      totalValue: totalCurrentValue,
      totalFutureValue,
      assets: results
    };
  }
};
