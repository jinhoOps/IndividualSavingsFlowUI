
import {
  STORAGE_KEY,
  SHARE_DB_NAME,
  SHARE_DB_VERSION,
  SHARE_DB_STORE
} from "./constants.js";


export function loadPersistedInputs() {
  if (window.IsfStorageHub) {
    const hubData = window.IsfStorageHub.loadLocal(STORAGE_KEY);
    if (hubData) return hubData;
  }
  

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("StorageManager: Failed to load from localStorage", e);
    return null;
  }
}


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


