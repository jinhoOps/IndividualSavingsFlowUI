(function initIsfHubStorage(global) {
  "use strict";

  const HUB_DB_NAME = "isf-hub-db-v1";
  const HUB_DB_VERSION = 2;
  const HUB_STORE_STEP1 = "step1Snapshots";
  const HUB_STORE_STEP2 = "step2Portfolios";
  const HUB_STORE_BRIDGE = "bridgeStep1ToStep2";
  // 스냅샷 최대 보관 개수 (backup-manager.js의 MAX_BACKUP_ENTRIES=60과 의도적으로 다릅니다.
  // 스냅샷은 앱 상태의 주 저장소이고, 백업은 복구용 이력이므로 보관 정책을 분리합니다.)
  const MAX_HUB_SNAPSHOTS = 20;

  let hubDbPromise = null;

  function isIndexedDbAvailable() {
    return typeof global !== "undefined" && typeof global.indexedDB !== "undefined";
  }

  function createId(prefix) {
    const safePrefix = String(prefix || "id").trim() || "id";
    const bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    const randomText = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return safePrefix + "-" + Date.now() + "-" + randomText;
  }

  function idbRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = function onSuccess() {
        resolve(request.result);
      };
      request.onerror = function onError() {
        reject(request.error || new Error("indexeddb-request-failed"));
      };
    });
  }

  function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = function onComplete() {
        resolve();
      };
      transaction.onabort = function onAbort() {
        reject(transaction.error || new Error("indexeddb-transaction-aborted"));
      };
      transaction.onerror = function onError() {
        reject(transaction.error || new Error("indexeddb-transaction-failed"));
      };
    });
  }

  function ensureStoreWithIndexes(db, transaction, storeName, keyPath, indexes) {
    let store = null;
    if (!db.objectStoreNames.contains(storeName)) {
      store = db.createObjectStore(storeName, { keyPath });
    } else if (transaction) {
      store = transaction.objectStore(storeName);
    }
    if (!store) {
      return null;
    }
    const safeIndexes = Array.isArray(indexes) ? indexes : [];
    safeIndexes.forEach((indexDef) => {
      const safeDef = indexDef && typeof indexDef === "object" ? indexDef : {};
      const indexName = String(safeDef.name || "").trim();
      const indexKeyPath = String(safeDef.keyPath || "").trim();
      if (!indexName || !indexKeyPath) {
        return;
      }
      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, indexKeyPath, { unique: Boolean(safeDef.unique) });
      }
    });
    return store;
  }

  function openHubDb() {
    if (!isIndexedDbAvailable()) {
      return Promise.reject(new Error("indexeddb-not-supported"));
    }
    if (hubDbPromise) {
      return hubDbPromise;
    }

    hubDbPromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(HUB_DB_NAME, HUB_DB_VERSION);

      request.onupgradeneeded = function onUpgradeNeeded() {
        const db = request.result;
        const transaction = request.transaction;
        ensureStoreWithIndexes(db, transaction, HUB_STORE_STEP1, "id", [{ name: "updatedAt", keyPath: "updatedAt", unique: false }]);
        ensureStoreWithIndexes(db, transaction, HUB_STORE_STEP2, "id", [{ name: "updatedAt", keyPath: "updatedAt", unique: false }]);
        ensureStoreWithIndexes(db, transaction, HUB_STORE_BRIDGE, "id", [{ name: "createdAt", keyPath: "createdAt", unique: false }]);
      };

      request.onsuccess = function onSuccess() {
        const db = request.result;
        db.onversionchange = function onVersionChange() {
          db.close();
          hubDbPromise = null;
        };
        resolve(db);
      };

      request.onerror = function onError() {
        hubDbPromise = null;
        reject(request.error || new Error("hub-db-open-failed"));
      };

      request.onblocked = function onBlocked() {
        hubDbPromise = null;
        reject(new Error("hub-db-open-blocked"));
      };
    });

    return hubDbPromise;
  }

  function getComparableTimestamp(value) {
    if (Number.isFinite(Number(value))) {
      return Number(value);
    }
    const parsed = Date.parse(String(value || ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return 0;
  }

  async function getLatestByScan(storeName, orderKey) {
    const db = await openHubDb();
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    const rows = await idbRequestToPromise(request);
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    const safeOrderKey = String(orderKey || "").trim();
    return rows
      .slice()
      .sort((left, right) => getComparableTimestamp(right?.[safeOrderKey]) - getComparableTimestamp(left?.[safeOrderKey]))[0] || null;
  }

  async function getLatestByIndex(storeName, indexName) {
    const db = await openHubDb();
    try {
      const transaction = db.transaction(storeName, "readonly");
      const objectStore = transaction.objectStore(storeName);
      if (!objectStore.indexNames.contains(indexName)) {
        return getLatestByScan(storeName, indexName);
      }
      const index = objectStore.index(indexName);
      const request = index.openCursor(null, "prev");

      return await new Promise((resolve, reject) => {
        request.onsuccess = function onSuccess() {
          const cursor = request.result;
          resolve(cursor ? cursor.value : null);
        };
        request.onerror = function onError() {
          reject(request.error || new Error("indexeddb-cursor-failed"));
        };
      });
    } catch (_error) {
      return getLatestByScan(storeName, indexName);
    }
  }

  async function enforceStoreLimit(storeName, indexName, maxEntries) {
    try {
      const db = await openHubDb();
      const countTx = db.transaction(storeName, "readonly");
      const countStore = countTx.objectStore(storeName);
      const count = await idbRequestToPromise(countStore.count());

      if (count <= maxEntries) return;

      let itemsToDelete = count - maxEntries;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      await new Promise((resolve, reject) => {
        const cursorRequest = index.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && itemsToDelete > 0) {
            store.delete(cursor.primaryKey);
            itemsToDelete--;
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
      await idbTransactionDone(tx);
    } catch (_error) {}
  }


  async function saveStep1Snapshot(data) {
    const nowIso = new Date().toISOString();
    const entry = {
      id: createId("s1"),
      createdAt: nowIso,
      updatedAt: Date.now(),
      data: data && typeof data === "object" ? data : {},
    };
    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_STEP1, "readwrite");
    transaction.objectStore(HUB_STORE_STEP1).put(entry);
    await idbTransactionDone(transaction);
    void enforceStoreLimit(HUB_STORE_STEP1, "updatedAt", MAX_HUB_SNAPSHOTS);
    return entry;
  }

  async function getLatestStep1Snapshot() {
    return getLatestByIndex(HUB_STORE_STEP1, "updatedAt");
  }

  async function saveBridgeStep1ToStep2(step1SnapshotId, payload) {
    const entry = {
      id: createId("bridge"),
      step1SnapshotId: String(step1SnapshotId || "").trim(),
      payload: payload && typeof payload === "object" ? payload : {},
      createdAt: new Date().toISOString(),
    };
    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_BRIDGE, "readwrite");
    transaction.objectStore(HUB_STORE_BRIDGE).put(entry);
    await idbTransactionDone(transaction);
    void enforceStoreLimit(HUB_STORE_BRIDGE, "createdAt", MAX_HUB_SNAPSHOTS);
    return entry;
  }

  async function getLatestBridgeStep1ToStep2() {
    return getLatestByIndex(HUB_STORE_BRIDGE, "createdAt");
  }

  function sanitizeNonNegativeNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.round(numeric));
  }

  function sanitizeStep2Allocation(source, index) {
    const safe = source && typeof source === "object" ? source : {};
    return {
      id: typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : createId(`alloc-${index}`),
      key: String(safe.key || "").trim() || createId(`asset-${index}`),
      label: String(safe.label || "").trim() || `자산군 ${index + 1}`,
      targetWeight: Math.max(0, Math.min(100, Number.isFinite(Number(safe.targetWeight)) ? Math.round(Number(safe.targetWeight) * 100) / 100 : 0)),
      memo: String(safe.memo || ""),
    };
  }

  function sanitizeWeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    const rounded = Math.round(numeric * 100) / 100;
    if (rounded < 0) {
      return 0;
    }
    if (rounded > 100) {
      return 100;
    }
    return rounded;
  }

  function sanitizeStep2Account(source, index) {
    const safe = source && typeof source === "object" ? source : {};
    const rawAllocations = Array.isArray(safe.allocations) ? safe.allocations : [];
    const allocations = rawAllocations.map((allocation, allocIndex) => sanitizeStep2Allocation(allocation, allocIndex));
    return {
      id: typeof safe.id === "string" && safe.id.trim() ? safe.id.trim() : createId(`account-${index}`),
      name: String(safe.name || "").trim() || `계좌 ${index + 1}`,
      accountWeight: sanitizeWeight(safe.accountWeight),
      monthlyContribution: sanitizeNonNegativeNumber(safe.monthlyContribution),
      allocations,
    };
  }

  function sanitizeLegacyTargetAllocations(source) {
    const raw = Array.isArray(source) ? source : [];
    return raw.map((allocation, index) => sanitizeStep2Allocation(allocation, index));
  }

  function normalizeStep2PortfolioEntry(portfolio) {
    const source = portfolio && typeof portfolio === "object" ? portfolio : {};
    const safeId = typeof source.id === "string" && source.id.trim() ? source.id.trim() : createId("pf");
    const safeName = String(source.name || "포트폴리오").trim() || "포트폴리오";
    const safeNotes = String(source.notes || "");
    const safeUpdatedAt = Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now();
    const isV2 = Number(source.modelVersion) === 2 || Array.isArray(source.accounts);

    if (isV2) {
      return {
        id: safeId,
        modelVersion: 2,
        name: safeName,
        notes: safeNotes,
        totalMonthlyInvestCapacity: sanitizeNonNegativeNumber(source.totalMonthlyInvestCapacity),
        unallocatedMonthlyInvest: sanitizeNonNegativeNumber(source.unallocatedMonthlyInvest),
        bridgeContext: source.bridgeContext && typeof source.bridgeContext === "object" ? source.bridgeContext : null,
        accounts: Array.isArray(source.accounts)
          ? source.accounts.map((account, index) => sanitizeStep2Account(account, index))
          : [],
        updatedAt: safeUpdatedAt,
      };
    }

    return {
      id: safeId,
      name: safeName,
      targetAllocations: sanitizeLegacyTargetAllocations(source.targetAllocations),
      notes: safeNotes,
      updatedAt: safeUpdatedAt,
    };
  }

  async function saveStep2Portfolio(portfolio) {
    const entry = normalizeStep2PortfolioEntry(portfolio);
    entry.updatedAt = Date.now();

    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_STEP2, "readwrite");
    transaction.objectStore(HUB_STORE_STEP2).put(entry);
    await idbTransactionDone(transaction);
    return entry;
  }

  async function listStep2Portfolios() {
    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_STEP2, "readonly");
    const request = transaction.objectStore(HUB_STORE_STEP2).getAll();
    const rows = await idbRequestToPromise(request);
    return Array.isArray(rows)
      ? rows
        .map((row) => normalizeStep2PortfolioEntry(row))
        .slice()
        .sort((left, right) => Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0))
      : [];
  }

  async function getStep2PortfolioById(id) {
    const safeId = String(id || "").trim();
    if (!safeId) {
      return null;
    }
    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_STEP2, "readonly");
    const request = transaction.objectStore(HUB_STORE_STEP2).get(safeId);
    const entry = await idbRequestToPromise(request);
    return entry ? normalizeStep2PortfolioEntry(entry) : null;
  }

  async function deleteStep2Portfolio(id) {
    const safeId = String(id || "").trim();
    if (!safeId) {
      return false;
    }
    const db = await openHubDb();
    const transaction = db.transaction(HUB_STORE_STEP2, "readwrite");
    transaction.objectStore(HUB_STORE_STEP2).delete(safeId);
    await idbTransactionDone(transaction);
    return true;
  }

  global.IsfHubStorage = {
    DB_NAME: HUB_DB_NAME,
    DB_VERSION: HUB_DB_VERSION,
    STORE_STEP1: HUB_STORE_STEP1,
    STORE_STEP2: HUB_STORE_STEP2,
    STORE_BRIDGE: HUB_STORE_BRIDGE,
    openHubDb,
    saveStep1Snapshot,
    getLatestStep1Snapshot,
    saveBridgeStep1ToStep2,
    getLatestBridgeStep1ToStep2,
    saveStep2Portfolio,
    listStep2Portfolios,
    getStep2PortfolioById,
    deleteStep2Portfolio,
  };
})(window);
