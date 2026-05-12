/**
 * Step 3: Portfolio Snapshot & History Manager
 */

import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

const SNAPSHOT_KEY = 'isf-step3-snapshots-v1';
const MAX_SNAPSHOTS = 20;

export const IsfSnapshotManager = {
  /**
   * 현재 상태를 스냅샷으로 저장합니다.
   * @param {Object} data IsfState.data
   * @param {string} name 스냅샷 이름
   */
  async saveSnapshot(data, name) {
    const snapshots = this.listSnapshots();
    const newSnapshot = {
      id: `snap-${Date.now()}`,
      name: name || `포트폴리오 ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(data)) // Deep clone
    };

    snapshots.unshift(newSnapshot);
    
    // 개수 제한
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.pop();
    }

    IsfStorageHub.saveLocal(SNAPSHOT_KEY, snapshots);
    return newSnapshot;
  },

  /**
   * 저장된 스냅샷 목록을 가져옵니다.
   * @returns {Array}
   */
  listSnapshots() {
    return IsfStorageHub.loadLocal(SNAPSHOT_KEY) || [];
  },

  /**
   * 특정 스냅샷을 삭제합니다.
   * @param {string} id 
   */
  deleteSnapshot(id) {
    const snapshots = this.listSnapshots();
    const filtered = snapshots.filter(s => s.id !== id);
    IsfStorageHub.saveLocal(SNAPSHOT_KEY, filtered);
  }
};
