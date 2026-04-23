(function initIsfStorageHub(global) {
  "use strict";

  const DB_NAME = "isf-hub-db-v1";
  const DB_VERSION = 2;
  const STORES = {
    STEP1: "step1Snapshots",
    STEP2: "step2Entries" // 기존 step2Portfolios에서 변경 (일반화)
  };
  const MAX_SNAPSHOTS = 20;

  let dbPromise = null;

  function isIdbSupported() {
    return typeof global !== "undefined" && !!global.indexedDB;
  }

  async function getDb() {
    if (!isIdbSupported()) throw new Error("IDB_NOT_SUPPORTED");
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        // Step 1: Snapshots
        if (!db.objectStoreNames.contains(STORES.STEP1)) {
          const s1 = db.createObjectStore(STORES.STEP1, { keyPath: "id" });
          s1.createIndex("updatedAt", "updatedAt");
        }
        // Step 2: Entries (Portfolios/Simulations)
        if (!db.objectStoreNames.contains(STORES.STEP2)) {
          const s2 = db.createObjectStore(STORES.STEP2, { keyPath: "id" });
          s2.createIndex("updatedAt", "updatedAt");
        }
        // Migration: Rename store if legacy exists
        if (event.oldVersion < 2 && db.objectStoreNames.contains("step2Portfolios")) {
          const oldStore = event.target.transaction.objectStore("step2Portfolios");
          const newStore = event.target.transaction.objectStore(STORES.STEP2);
          oldStore.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              newStore.put(cursor.value);
              cursor.continue();
            }
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { dbPromise = null; reject(request.error); };
    });
    return dbPromise;
  }

  async function perform(storeName, mode, callback) {
    const db = await getDb();
    if (!db.objectStoreNames.contains(storeName)) {
      if (mode === "readonly") return null;
      throw new Error(`Store not found: ${storeName}`);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
      tx.oncomplete = () => { if (!request) resolve(); };
      tx.onabort = () => reject(tx.error || new Error("TX_ABORTED"));
    });
  }

  // --- LocalStorage Persistence ---
  
  function saveToLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function loadFromLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // --- Hub API (Unified) ---

  const StorageHub = {
    // 1. Persistence (LocalStorage)
    saveLocal: (key, data) => saveToLocal(key, data),
    loadLocal: (key) => loadFromLocal(key),

    // 2. Step 1 Snapshots (IDB)
    async saveStep1Snapshot(data) {
      const entry = {
        id: IsfUtils.createId("s1"),
        updatedAt: Date.now(),
        data: data || {}
      };
      await perform(STORES.STEP1, "readwrite", (s) => s.put(entry));
      await this.enforceStoreLimit(STORES.STEP1, MAX_SNAPSHOTS);
      return entry;
    },

    async enforceStoreLimit(storeName, maxCount) {
      try {
        await perform(storeName, "readwrite", (store) => {
          const countReq = store.count();
          countReq.onsuccess = () => {
            if (countReq.result > maxCount) {
              const toDelete = countReq.result - maxCount;
              const index = store.index("updatedAt");
              let deleted = 0;
              index.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && deleted < toDelete) {
                  cursor.delete();
                  deleted++;
                  cursor.continue();
                }
              };
            }
          };
        });
      } catch (e) {
        console.warn("enforceStoreLimit failed:", e);
      }
    },

    async getLatestStep1Snapshot() {
      return perform(STORES.STEP1, "readonly", (s) => {
        return s.index("updatedAt").openCursor(null, "prev");
      }).then(c => c ? c.value : null);
    },

    // 3. Step 2 Entries (Simulations)
    async saveStep2Entry(data) {
      const entry = {
        ...data,
        id: data.id || IsfUtils.createId("ds"), // ds: Dividend Simulation
        updatedAt: Date.now(),
        modelVersion: 10
      };
      await perform(STORES.STEP2, "readwrite", (s) => s.put(entry));
      return entry;
    },

    async listStep2Entries() {
      const rows = await perform(STORES.STEP2, "readonly", (s) => s.getAll());
      return (rows || []).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getStep2EntryById(id) {
      if (!id) return null;
      return perform(STORES.STEP2, "readonly", (s) => s.get(id));
    },

    async deleteStep2Entry(id) {
      if (!id) return false;
      await perform(STORES.STEP2, "readwrite", (s) => s.delete(id));
      return true;
    },

    // 4. Backup Integration
    async triggerAutoBackup(appKey, data, currentEntries) {
      if (!global.IsfBackupManager) return { created: false };
      return global.IsfBackupManager.maybeCreateAutoBackupIfDue(currentEntries, data, appKey);
    },

    async createManualBackup(appKey, data, currentEntries, options = {}) {
      if (!global.IsfBackupManager) return { created: false };
      return global.IsfBackupManager.createBackupEntry(currentEntries, data, {
        ...options,
        appKey: appKey
      });
    },

    // 5. View Mode Overwrite
    async persistViewDataLocally(appKey, data, currentBackupEntries) {
      const currentLocal = loadFromLocal(appKey);
      if (currentLocal) {
        await this.createManualBackup(appKey, currentLocal, currentBackupEntries, {
          type: "auto",
          source: "view-save",
          allowDuplicate: false
        });
      }
      return saveToLocal(appKey, data);
    }
  };

  // Backward Compatibility (Mapped to new unified API)
  global.IsfHubStorage = {
    ...StorageHub,
    openHubDb: getDb,
    savePortfolio: (p) => StorageHub.saveStep2Entry(p),
    saveStep2Portfolio: (p) => StorageHub.saveStep2Entry(p),
    listPortfolios: () => StorageHub.listStep2Entries(),
    listStep2Portfolios: () => StorageHub.listStep2Entries(),
    getPortfolioById: (id) => StorageHub.getStep2EntryById(id),
    getStep2PortfolioById: (id) => StorageHub.getStep2EntryById(id),
    deletePortfolio: (id) => StorageHub.deleteStep2Entry(id),
    deleteStep2Portfolio: (id) => StorageHub.deleteStep2Entry(id)
  };

  global.IsfStorageHub = StorageHub;

})(window);
