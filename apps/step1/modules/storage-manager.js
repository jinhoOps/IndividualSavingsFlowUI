/**
 * Individual Savings Flow (ISF) - Step 1: Storage Manager (Bridge)
 * v0.7.1
 * 
 * 파일 역할: 통합 저장소(Storage Hub)와 Step 1 앱 간의 브리지 및 레거시 공유 링크 지원
 */

import {
  STORAGE_KEY,
  SHARE_DB_NAME,
  SHARE_DB_VERSION,
  SHARE_DB_STORE
} from "./constants.js";

/**
 * 로컬에 저장된 사용자 입력을 로드합니다. (통합 허브 우선)
 */
export function loadPersistedInputs() {
  if (window.IsfStorageHub) {
    const hubData = window.IsfStorageHub.loadLocal(STORAGE_KEY);
    if (hubData) return hubData;
  }
  
  // 폴백: 로컬 스토리지 직접 접근
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("StorageManager: Failed to load from localStorage", e);
    return null;
  }
}

/**
 * 공유 ID(sid)를 사용하여 서버/IDB에 저장된 스냅샷을 로드합니다.
 * (레거시 호환용 - 구버전 sid는 IDB에 포인터가 남아있음)
 */
export async function loadShareSnapshotById(sid) {
  if (!sid) return null;
  
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
      
      request.onerror = () => {
        console.warn("StorageManager: Failed to open Share IDB");
        resolve(null);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SHARE_DB_STORE)) {
          resolve(null);
          return;
        }
        
        const transaction = db.transaction([SHARE_DB_STORE], "readonly");
        const store = transaction.objectStore(SHARE_DB_STORE);
        const getReq = store.get(sid);
        
        getReq.onsuccess = () => {
          resolve(getReq.result ? getReq.result.inputs : null);
        };
        getReq.onerror = () => resolve(null);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(SHARE_DB_STORE)) {
          db.createObjectStore(SHARE_DB_STORE, { keyPath: "id" });
        }
      };
    } catch (e) {
      console.error("StorageManager: Share IDB access error", e);
      resolve(null);
    }
  });
}
