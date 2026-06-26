/**
 * Step 1 Data Connector for Step 3
 */

import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

const EMPTY_HANDOFF = {
  available: false,
  counts: {
    accounts: 0,
    incomeAllocations: 0,
    itemAccounts: 0,
    transfers: 0,
  },
  labels: [],
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneEmptyHandoff() {
  return {
    available: EMPTY_HANDOFF.available,
    counts: { ...EMPTY_HANDOFF.counts },
    labels: [],
  };
}

function normalizeAccountFlowHandoff(data) {
  const sidecar = data && typeof data === 'object' ? data.accountFlowHandoff : null;
  if (!sidecar || typeof sidecar !== 'object') {
    return cloneEmptyHandoff();
  }

  const accounts = asArray(sidecar.accounts)
    .filter(account => account && typeof account === 'object')
    .map(account => ({
      id: typeof account.id === 'string' ? account.id.trim() : '',
      name: typeof account.name === 'string' ? account.name.trim() : '',
      type: typeof account.type === 'string' ? account.type.trim() : '',
    }))
    .filter(account => account.id || account.name);
  const incomeAllocations = asArray(sidecar.incomeAllocations);
  const itemAccounts = asArray(sidecar.itemAccounts);
  const transfers = asArray(sidecar.transfers);
  const labels = accounts
    .map(account => account.name || account.id)
    .filter(Boolean)
    .slice(0, 8);

  const counts = {
    accounts: accounts.length,
    incomeAllocations: incomeAllocations.length,
    itemAccounts: itemAccounts.length,
    transfers: transfers.length,
  };
  const available = Object.values(counts).some(count => count > 0);

  return {
    available,
    counts,
    labels,
  };
}

async function fetchLatestStep1Data() {
  try {
    const snapshot = await IsfStorageHub.getLatestStep1Snapshot();
    if (snapshot?.data) {
      return snapshot.data;
    }
  } catch (error) {
    console.warn('[Step1Connector] Falling back to local Step 1 snapshot:', error);
  }
  return IsfStorageHub.loadLocal('isf-step1-active') || null;
}

export const Step1Connector = {
  /**
   * Step 1의 최신 스냅샷에서 투자 가능 금액을 추출합니다.
   * @returns {Promise<{investCapacity: number} | null>}
   */
  async fetchLatestSnapshot() {
    try {
      const data = await fetchLatestStep1Data();
      if (!data) return null;

      // Step 1 데이터 구조에서 투자 가능 금액 추출
      // 1. 저장된 monthlyInvest 필드 확인
      // 2. 필드가 없을 경우 investItems의 합계로 계산
      // 3. 그래도 없으면 0 (startInvest는 초기 자산이므로 여력으로 쓰기 부적절)
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
  },

  /**
   * Step 1 sidecar에 보존된 계좌흐름도 handoff 상태만 읽습니다.
   * Step 1 원본 데이터에는 어떤 값도 다시 쓰지 않습니다.
   */
  async fetchAccountFlowHandoff() {
    try {
      const data = await fetchLatestStep1Data();
      return normalizeAccountFlowHandoff(data);
    } catch (error) {
      console.error('[Step1Connector] Error fetching account-flow handoff:', error);
      return cloneEmptyHandoff();
    }
  }
};
