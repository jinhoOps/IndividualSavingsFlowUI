/**
 * Step 1 Data Connector for Step 3
 */

import { IsfStorageHub } from '../../shared/storage/hub-storage.js';

export const Step1Connector = {
  /**
   * Step 1의 최신 스냅샷에서 투자 가능 금액을 추출합니다.
   * @returns {Promise<{investCapacity: number} | null>}
   */
  async fetchLatestSnapshot() {
    try {
      const snapshot = await IsfStorageHub.getLatestStep1Snapshot();
      if (!snapshot) return null;

      // Step 1 데이터 구조에서 투자 가능 금액(startInvest 등) 추출
      const data = snapshot.data || {};
      const investCapacity = data.monthlyInvest || data.startInvest || 0;

      return {
        investCapacity: investCapacity
      };
    } catch (error) {
      console.error('[Step1Connector] Error fetching snapshot:', error);
      return null;
    }
  }
};
