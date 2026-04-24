(function initIsfStorageHub(global) {
  "use strict";

  const DB_NAME = "isf-hub-db-v1";
  const DB_VERSION = 2;
  const STORES = {
    STEP1: "step1Snapshots",
    STEP2: "step2Entries" // 기존 step2Portfolios에서 변경 (일반화)
  };
  const MAX_SNAPSHOTS = 20;

  function _createId(prefix) {
    if (global.IsfUtils && global.IsfUtils.createId) {
      return global.IsfUtils.createId(prefix);
    }
    const safePrefix = String(prefix || "id").trim() || "id";
    const bytes = new Uint8Array(8);
    if (typeof global !== "undefined" && global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const randomText = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return safePrefix + "-" + Date.now() + "-" + randomText;
  }

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
        // Migration: Move data from legacy store
        if (event.oldVersion < 2 && db.objectStoreNames.contains("step2Portfolios")) {
          const oldStore = event.target.transaction.objectStore("step2Portfolios");
          const newStore = event.target.transaction.objectStore(STORES.STEP2);
          const getAllReq = oldStore.getAll();
          getAllReq.onsuccess = () => {
            if (Array.isArray(getAllReq.result)) {
              getAllReq.result.forEach(item => newStore.put(item));
            }
            // 주의: 비동기 콜백에서의 deleteObjectStore는 위험할 수 있으므로, 
            // 데이터 복사까지만 수행하고 실제 삭제는 향후 스키마 정리 시점에 별도로 다룹니다.
            console.log("StorageHub: Legacy data migrated to new store.");
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
    // 0. Migration
    async ensureMigration(oldKey, newKey) {
      if (!oldKey || !newKey || oldKey === newKey) return;
      
      try {
        // 1. LocalStorage migration
        const oldData = loadFromLocal(oldKey);
        if (oldData) {
          const newData = loadFromLocal(newKey);
          if (!newData) {
            saveToLocal(newKey, oldData);
            console.log(`StorageHub: Migrated localStorage from ${oldKey} to ${newKey}`);
          }
        }
        
        // 2. Backup migration (IndexedDB)
        if (global.IsfBackupManager && global.IsfBackupManager.migrateAppKey) {
          await global.IsfBackupManager.migrateAppKey(oldKey, newKey);
          console.log(`StorageHub: Migrated backups from ${oldKey} to ${newKey}`);
        }
      } catch (e) {
        console.warn("StorageHub: ensureMigration failed", e);
      }
    },

    // 1. Persistence (LocalStorage)
    saveLocal: (key, data) => saveToLocal(key, data),
    loadLocal: (key) => loadFromLocal(key),

    // 2. Step 1 Snapshots (IDB)
    async saveStep1Snapshot(data) {
      const entry = {
        id: _createId("s1"),
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
        id: data.id || _createId("ds"), // ds: Dividend Simulation
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
      let backupResult = null;
      if (currentLocal) {
        backupResult = await this.createManualBackup(appKey, currentLocal, currentBackupEntries, {
          type: "auto",
          source: "view-save",
          allowDuplicate: false
        });
      }
      const success = saveToLocal(appKey, data);
      return {
        success,
        backupEntries: (backupResult && backupResult.nextEntries) ? backupResult.nextEntries : currentBackupEntries
      };
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
