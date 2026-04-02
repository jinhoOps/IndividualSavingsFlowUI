(function initIsfBackupManager(global) {
  "use strict";

  const BACKUP_DB_NAME = "isf-backup-db-v1";
  const BACKUP_DB_VERSION = 1;
  const BACKUP_DB_STORE = "backupEntries";
  const MAX_BACKUP_ENTRIES = 60;
  const AUTO_BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

  let backupDbPromise = null;

  function isIndexedDbAvailable() {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  }

  function getBackupDb() {
    if (!isIndexedDbAvailable()) {
      return Promise.reject(new Error("indexeddb-not-supported"));
    }
    if (backupDbPromise) {
      return backupDbPromise;
    }

    backupDbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BACKUP_DB_STORE)) {
          const store = db.createObjectStore(BACKUP_DB_STORE, { keyPath: "id" });
          store.createIndex("app", "app", { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          backupDbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        backupDbPromise = null;
        reject(request.error || new Error("indexeddb-open-failed"));
      };

      request.onblocked = () => {
        backupDbPromise = null;
        reject(new Error("indexeddb-open-blocked"));
      };
    });

    return backupDbPromise;
  }

  function idbRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error || new Error("indexeddb-request-failed"));
      };
    });
  }

  function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onabort = () => {
        reject(transaction.error || new Error("indexeddb-transaction-aborted"));
      };
      transaction.onerror = () => {
        reject(transaction.error || new Error("indexeddb-transaction-failed"));
      };
    });
  }

  function createBackupEntryId() {
    return `bkp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getBackupTimestampMs(entry) {
    if (!entry || typeof entry !== "object") {
      return 0;
    }
    const parsed = Date.parse(String(entry.createdAt || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildBackupSignature(data) {
    try {
      return JSON.stringify(data);
    } catch (_error) {
      return "";
    }
  }

  function normalizeBackupEntries(entries, appKey = null) {
    return (Array.isArray(entries) ? entries : [])
      .filter((item) => item !== null && typeof item === "object")
      .filter((item) => appKey === null || item.app === appKey)
      .sort((left, right) => getBackupTimestampMs(right) - getBackupTimestampMs(left))
      .slice(0, MAX_BACKUP_ENTRIES);
  }

  async function loadBackupEntriesFromDb(appKey = null) {
    try {
      const db = await getBackupDb();
      const tx = db.transaction(BACKUP_DB_STORE, "readonly");
      const done = idbTransactionDone(tx);
      const store = tx.objectStore(BACKUP_DB_STORE);
      const rawEntries = await idbRequestToPromise(
        appKey ? store.index("app").getAll(appKey) : store.getAll()
      );
      await done;
      return normalizeBackupEntries(rawEntries, appKey);
    } catch (_error) {
      return null;
    }
  }

  async function persistBackupEntries(entries, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const appKey = safeOptions.appKey || "default";
    const schemaVersion = safeOptions.schemaVersion || 1;

    const safeEntries = normalizeBackupEntries(entries).map((item) => ({
      id: item.id || createBackupEntryId(),
      type: item.type || "manual",
      source: item.source || "normal",
      createdAt: item.createdAt || new Date().toISOString(),
      signature: item.signature || buildBackupSignature(item.data),
      data: item.data,
      app: item.app || appKey,
      schemaVersion: item.schemaVersion || schemaVersion,
      backupSchemaVersion: 1,
    }));

    try {
      const db = await getBackupDb();
      const tx = db.transaction(BACKUP_DB_STORE, "readwrite");
      const done = idbTransactionDone(tx);
      const store = tx.objectStore(BACKUP_DB_STORE);
      
      const existingEntries = await idbRequestToPromise(store.index("app").getAll(appKey));
      const safeEntryIds = new Set(safeEntries.map((item) => item.id));
      
      existingEntries.forEach((entry) => {
        if (!safeEntryIds.has(entry.id)) {
          store.delete(entry.id);
        }
      });

      safeEntries.forEach((item) => {
        store.put(item);
      });
      await done;
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function createBackupEntry(currentEntries, inputs, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeType = safeOptions.type === "manual" ? "manual" : "auto";
    const safeSource = safeOptions.source === "view-save" ? "view-save" : "normal";
    const appKey = safeOptions.appKey || "default";
    const schemaVersion = safeOptions.schemaVersion || 1;
    const allowDuplicate = Boolean(safeOptions.allowDuplicate);
    const replaceRecentManualWithinMs = Math.max(0, Number(safeOptions.replaceRecentManualWithinMs) || 0);

    const signature = buildBackupSignature(inputs);
    const entries = Array.isArray(currentEntries) ? currentEntries : [];

    if (safeType === "manual" && replaceRecentManualWithinMs > 0) {
      const latestManualEntry = entries.find((entry) => entry.type === "manual" && entry.source === safeSource);
      if (latestManualEntry) {
        const elapsed = Date.now() - getBackupTimestampMs(latestManualEntry);
        if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < replaceRecentManualWithinMs) {
          if (latestManualEntry.signature === signature) {
            return { created: false, reason: "duplicate-recent" };
          }
          if (safeOptions.onRecentManualOverwriteConfirm) {
            const confirmed = safeOptions.onRecentManualOverwriteConfirm();
            if (!confirmed) {
              return { created: false, reason: "overwrite-cancelled" };
            }
          }

          const replacedEntry = {
            ...latestManualEntry,
            createdAt: new Date().toISOString(),
            signature,
            data: JSON.parse(JSON.stringify(inputs)),
          };
          const nextEntries = normalizeBackupEntries([
            replacedEntry,
            ...entries.filter((entry) => entry.id !== latestManualEntry.id),
          ], appKey);

          if (!await persistBackupEntries(nextEntries, { appKey, schemaVersion })) {
            return { created: false, reason: "storage-error" };
          }
          return { created: true, entry: replacedEntry, replaced: true, nextEntries };
        }
      }
    }

    const latestEntry = entries.length > 0 ? entries[0] : null;
    if (!allowDuplicate && latestEntry && latestEntry.signature === signature) {
      return { created: false, reason: "duplicate" };
    }

    const nextEntry = {
      id: createBackupEntryId(),
      type: safeType,
      source: safeSource,
      createdAt: new Date().toISOString(),
      signature,
      data: JSON.parse(JSON.stringify(inputs)),
      app: appKey,
      schemaVersion: schemaVersion
    };

    const nextEntries = [nextEntry, ...entries].slice(0, MAX_BACKUP_ENTRIES);

    if (!await persistBackupEntries(nextEntries, { appKey, schemaVersion })) {
      return { created: false, reason: "storage-error" };
    }

    return { created: true, entry: nextEntry, nextEntries };
  }

  async function maybeCreateAutoBackupIfDue(currentEntries, inputs, appKey) {
    const entries = Array.isArray(currentEntries) ? currentEntries : [];
    const latestAuto = entries.find((entry) => entry.type === "auto");
    if (latestAuto) {
      const elapsed = Date.now() - getBackupTimestampMs(latestAuto);
      if (Number.isFinite(elapsed) && elapsed < AUTO_BACKUP_INTERVAL_MS) {
        return { created: false, reason: "interval" };
      }
    }

    return createBackupEntry(entries, inputs, {
      type: "auto",
      source: "normal",
      allowDuplicate: false,
      appKey: appKey,
    });
  }

  global.IsfBackupManager = {
    isIndexedDbAvailable,
    loadBackupEntriesFromDb,
    persistBackupEntries,
    createBackupEntry,
    maybeCreateAutoBackupIfDue,
    getBackupTimestampMs,
    AUTO_BACKUP_INTERVAL_MS,
    MAX_BACKUP_ENTRIES,
  };

})(window);
