import {
  STORAGE_KEY,
  SHARE_DB_NAME,
  SHARE_DB_VERSION,
  SHARE_DB_STORE,
  DEFAULT_INPUTS
} from "./constants.js";
import { sanitizeInputs, cloneInputs } from "./input-sanitizer.js";

let shareDbPromise = null;

export function persistInputs(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (_error) {
    // Ignore storage errors to keep UI functional.
  }
}

export function loadPersistedInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function getShareDb() {
  if (!IsfBackupManager.isIndexedDbAvailable()) {
    return Promise.reject(new Error("indexeddb-not-supported"));
  }
  if (shareDbPromise) {
    return shareDbPromise;
  }

  shareDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_DB_STORE)) {
        const store = db.createObjectStore(SHARE_DB_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        shareDbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      shareDbPromise = null;
      reject(request.error || new Error("share-indexeddb-open-failed"));
    };

    request.onblocked = () => {
      shareDbPromise = null;
      reject(new Error("share-indexeddb-open-blocked"));
    };
  });

  return shareDbPromise;
}

export async function saveShareSnapshot(inputs) {
  if (!IsfBackupManager.isIndexedDbAvailable()) {
    return "";
  }
  try {
    const db = await getShareDb();
    const sid = IsfUtils.createId("sid");
    const entry = {
      id: sid,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      data: sanitizeInputs(cloneInputs(inputs)),
    };
    const transaction = db.transaction(SHARE_DB_STORE, "readwrite");
    transaction.objectStore(SHARE_DB_STORE).put(entry);
    await IsfUtils.idbTransactionDone(transaction);
    return sid;
  } catch (_error) {
    return "";
  }
}

export async function loadShareSnapshotById(sid, normalizeShareId) {
  const safeSid = normalizeShareId(sid);
  if (!safeSid || !IsfBackupManager.isIndexedDbAvailable()) {
    return null;
  }
  try {
    const db = await getShareDb();
    const transaction = db.transaction(SHARE_DB_STORE, "readonly");
    const request = transaction.objectStore(SHARE_DB_STORE).get(safeSid);
    const entry = await IsfUtils.idbRequestToPromise(request);
    if (!entry || !entry.data || typeof entry.data !== "object") {
      return null;
    }
    return sanitizeInputs({ ...DEFAULT_INPUTS, ...entry.data });
  } catch (_error) {
    return null;
  }
}
