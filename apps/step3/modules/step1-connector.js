/**
 * Step 1 Data Connector for Step 3
 */

import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

export const Step1Connector = {
  /**
   * Step 1의 최신 스냅샷에서 투자 가능 금액을 추출합니다.
   * @returns {Promise<{investCapacity: number} | null>}
   */
  async fetchLatestSnapshot() {
    try {
      const snapshot = await IsfStorageHub.getLatestStep1Snapshot();
      if (!snapshot) return null;

      // Step 1 데이터 구조에서 투자 가능 금액 추출
      // 1. 저장된 monthlyInvest 필드 확인
      // 2. 필드가 없을 경우 investItems의 합계로 계산
      // 3. 그래도 없으면 0 (startInvest는 초기 자산이므로 여력으로 쓰기 부적절)
      const data = snapshot.data || {};
      let investCapacity = 0;
      
      if (typeof data.monthlyInvest === 'number') {
        investCapacity = data.monthlyInvest;
      } else if (Array.isArray(data.investItems)) {
        investCapacity = data.investItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
      }

      return {
        investCapacity: investCapacity
      };
    } catch (error) {
      console.error('[Step1Connector] Error fetching snapshot:', error);
      return null;
    }
  }
};
