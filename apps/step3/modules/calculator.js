/**
 * Step 3: Accumulative Portfolio Calculation Engine
 */

export const IsfCalculator = {
  /**
   * 입력된 개별 종목 금액(원)을 합산하여 총액을 반환합니다.
   * @param {Array} assets 
   * @returns {number}
   */
  sumAmounts(assets) {
    if (!Array.isArray(assets)) return 0;
    return assets.reduce((sum, asset) => sum + (Number(asset.amount) || 0), 0);
  },

  /**
   * 총 매수 금액 대비 각 종목의 비중 %를 실시간 반올림 정수로 산출합니다.
   * @param {Array} assets 
   * @param {number} totalAmount 
   * @returns {Array}
   */
  calculateRatios(assets, totalAmount) {
    if (!Array.isArray(assets)) return [];
    if (totalAmount <= 0) {
      return assets.map(asset => ({ ...asset, ratio: 0 }));
    }
    return assets.map(asset => {
      const ratio = Math.round(((Number(asset.amount) || 0) / totalAmount) * 100);
      return {
        ...asset,
        ratio
      };
    });
  },

  /**
   * 개별 종목 금액이 최소 1,000원 이상이고 1,000원 단위인지 여부를 판별합니다.
   * @param {number} amount 
   * @returns {boolean}
   */
  validateAssetAmount(amount) {
    const num = Number(amount);
    return num >= 1000 && num % 1000 === 0;
  },

  /**
   * 종목 개수가 2개 이상이고, 모든 종목의 금액이 유효한지 검사합니다.
   * 포트폴리오 및 개별 종목명이 비어있지 않은지도 검사합니다.
   * @param {Object} portfolio 
   * @returns {boolean}
   */
  validatePortfolio(portfolio) {
    if (!portfolio) return false;
    
    // 포트폴리오 이름 검증
    if (!portfolio.name || !portfolio.name.trim()) return false;

    // 종목 개수 검증 (최소 2개)
    const assets = portfolio.assets || [];
    if (assets.length < 2) return false;

    // 모든 종목에 대해 유효성 검증
    return assets.every(asset => {
      // 종목 이름 검증
      if (!asset.name || !asset.name.trim()) return false;
      // 금액 검증
      return this.validateAssetAmount(asset.amount);
    });
  }
};
