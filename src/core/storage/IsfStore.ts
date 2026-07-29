import { Step1State, Step2Simulation, BackupEntry } from '../types/models';
import type { MainData } from '../../main/domain/model';

const DB_NAME = 'isf-v2-db';
const DB_VERSION = 4;

const STORES = {
  STEP1_HISTORY: 'step1_history',
  STEP2_SIMULATIONS: 'step2_simulations',
  BACKUPS: 'backups',
  MAIN_V2_HISTORY_ENTRIES: 'main_v2_history_entries'
} as const;

export class IsfStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      let settled = false;

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.STEP1_HISTORY)) {
          const s1 = db.createObjectStore(STORES.STEP1_HISTORY, { keyPath: 'updatedAt' });
          s1.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORES.STEP2_SIMULATIONS)) {
          const s2 = db.createObjectStore(STORES.STEP2_SIMULATIONS, { keyPath: 'id' });
          s2.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
          const b = db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
          b.createIndex('appKey', 'appKey');
          b.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORES.MAIN_V2_HISTORY_ENTRIES)) {
          const mainEntries = db.createObjectStore(STORES.MAIN_V2_HISTORY_ENTRIES, { autoIncrement: true });
          mainEntries.createIndex('updatedAt', 'updatedAt');
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        this.db = database;
        database.onversionchange = () => {
          database.close();
          if (this.db === database) this.db = null;
        };
        settled = true;
        resolve();
      };

      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new Error('IndexedDB upgrade was blocked by another open tab.'));
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(request.error ?? new Error('IndexedDB could not be opened.'));
      };
    });
  }

  public async perform<T>(
    storeName: string, 
    mode: IDBTransactionMode, 
    callback: (store: IDBObjectStore) => IDBRequest<T> | void
  ): Promise<T> {
    await this.init();
    if (!this.db) throw new Error('DB_NOT_INITIALIZED');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);
      let requestResult: T | undefined;
      let settled = false;

      if (request) {
        request.onsuccess = () => {
          requestResult = request.result;
        };
        request.onerror = () => {
          if (settled) return;
          settled = true;
          reject(request.error ?? new Error('IDB_REQUEST_FAILED'));
        };
      }
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(requestResult as T);
      };
      tx.onabort = () => {
        if (settled) return;
        settled = true;
        reject(tx.error || new Error('TX_ABORTED'));
      };
    });
  }

  // --- Step 1 Methods ---

  async saveStep1(data: Step1State): Promise<void> {
    localStorage.setItem('isf-step1-active', JSON.stringify(data));
    await this.perform(STORES.STEP1_HISTORY, 'readwrite', (s) => s.put(data));
    await this.trimStore(STORES.STEP1_HISTORY, 50);
  }

  async loadStep1(): Promise<Step1State | null> {
    const local = localStorage.getItem('isf-step1-active');
    if (local) {
      try { return JSON.parse(local); } catch (e) { return null; }
    }
    return this.perform<IDBCursorWithValue | null>(STORES.STEP1_HISTORY, 'readonly', (s) => {
      return s.index('updatedAt').openCursor(null, 'prev');
    }).then(cursor => (cursor?.value as Step1State) || null);
  }

  async listStep1History(): Promise<Step1State[]> {
    const list = await this.perform<Step1State[]>(STORES.STEP1_HISTORY, 'readonly', (s) => s.getAll());
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getStep1ById(id: number): Promise<Step1State | null> {
    return this.perform<Step1State | null>(STORES.STEP1_HISTORY, 'readonly', (s) => s.get(id));
  }

  // --- Step 2 Methods ---

  async saveStep2Simulation(sim: Step2Simulation): Promise<Step2Simulation> {
    await this.perform(STORES.STEP2_SIMULATIONS, 'readwrite', (s) => s.put(sim));
    return sim;
  }

  async listStep2Simulations(): Promise<Step2Simulation[]> {
    const list = await this.perform<Step2Simulation[]>(STORES.STEP2_SIMULATIONS, 'readonly', (s) => s.getAll());
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteStep2Simulation(id: string): Promise<void> {
    await this.perform(STORES.STEP2_SIMULATIONS, 'readwrite', (s) => s.delete(id));
  }

  // --- Main v2 Methods ---

  async saveMainV2(data: MainData): Promise<void> {
    await this.perform(STORES.MAIN_V2_HISTORY_ENTRIES, 'readwrite', (store) => store.add(data));
  }

  async loadLatestMainV2(): Promise<MainData | null> {
    return this.perform<IDBCursorWithValue | null>(STORES.MAIN_V2_HISTORY_ENTRIES, 'readonly', (store) => {
      return store.index('updatedAt').openCursor(null, 'prev');
    }).then((cursor) => (cursor?.value as MainData) || null);
  }

  // --- Utility ---

  private async trimStore(storeName: string, maxCount: number): Promise<void> {
    await this.perform(storeName, 'readwrite', (store) => {
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result > maxCount) {
          const toDelete = countReq.result - maxCount;
          const index = store.index('updatedAt');
          let deleted = 0;
          index.openCursor().onsuccess = (e) => {
            const cursor = (e.target as any).result;
            if (cursor && deleted < toDelete) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    });
  }
}

export const isfStore = new IsfStore();
