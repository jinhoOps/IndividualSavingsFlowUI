import { isfStore } from './IsfStore';
import { backupService } from './BackupService';
import { MoneyUtils } from '../types/money';

/**
 * Compatibility Bridge for Legacy Vanilla JS Apps.
 * Redirects legacy IsfStorageHub and IsfBackupManager calls to the modernized TypeScript services.
 */

export function initCompatibilityBridge() {
  const global = window as any;

  // Modern Storage Hub Bridge
  const storageHub = {
    // Basic LocalStorage
    saveLocal: (key: string, data: any) => {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    },
    loadLocal: (key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },

    // Step 1
    saveStep1Snapshot: async (data: any) => {
      await isfStore.saveStep1(data);
      return { id: 'bkp-' + Date.now(), updatedAt: Date.now(), data };
    },
    getLatestStep1Snapshot: () => isfStore.loadStep1(),
    listStep1Snapshots: () => isfStore.listStep1History(),
    getStep1SnapshotById: (id: any) => isfStore.getStep1ById(Number(id)),

    // Step 2
    saveStep2Entry: (data: any) => isfStore.saveStep2Simulation(data),
    listStep2Entries: () => isfStore.listStep2Simulations(),
    getStep2EntryById: async (id: string) => {
      const all = await isfStore.listStep2Simulations();
      return all.find(s => s.id === id) || null;
    },
    deleteStep2Entry: (id: string) => isfStore.deleteStep2Simulation(id),

    // Step 2 Aliases
    saveStep2Portfolio: (p: any) => isfStore.saveStep2Simulation(p),
    listStep2Portfolios: () => isfStore.listStep2Simulations(),
    getStep2PortfolioById: async (id: string) => {
      const all = await isfStore.listStep2Simulations();
      return all.find(s => s.id === id) || null;
    },
    deleteStep2Portfolio: (id: string) => isfStore.deleteStep2Simulation(id),

    // Backup
    triggerAutoBackup: async (appKey: string, data: any, _current: any) => {
      await backupService.maybeAutoBackup(appKey, data);
      const next = await backupService.listBackups(appKey);
      return { created: true, nextEntries: next };
    },
    createManualBackup: async (appKey: string, data: any, _current: any, options: any) => {
      await backupService.createBackup(appKey, data, { type: 'manual', source: options.source || 'manual' });
      const next = await backupService.listBackups(appKey);
      return { created: true, nextEntries: next };
    },
    persistViewDataLocally: async (appKey: string, data: any, _current: any) => {
      localStorage.setItem(appKey, JSON.stringify(data));
      const next = await backupService.listBackups(appKey);
      return { success: true, backupEntries: next };
    },

    // Migration
    ensureMigration: async () => {
      console.log('IsfStorageHub: Modernized version active. Migration handled by IsfStore.');
    }
  };

  const target = (typeof window !== 'undefined' ? window : globalThis) as any;

  target.IsfStorageHub = storageHub;
  target.IsfHubStorage = storageHub;

  // Modern Backup Manager Bridge
  target.IsfBackupManager = {
    isIndexedDbAvailable: () => true,
    loadBackupEntriesFromDb: (appKey: string) => backupService.listBackups(appKey),
    createBackupEntry: async (current: any, data: any, options: any) => {
      const entry = await backupService.createBackup(options.appKey, data, { 
        type: options.type || 'manual', 
        source: options.source || 'normal' 
      });
      const next = await backupService.listBackups(options.appKey);
      return { created: true, entry, nextEntries: next };
    },
    maybeCreateAutoBackupIfDue: async (current: any, data: any, appKey: string) => {
      await backupService.maybeAutoBackup(appKey, data);
      const next = await backupService.listBackups(appKey);
      return { created: true, nextEntries: next };
    },
    getBackupTimestampMs: (entry: any) => entry.createdAt || 0,
    migrateAppKey: async () => true
  };

  // Legacy Utility Aliases
  target.IsfUtils = target.IsfUtils || {};
  target.IsfUtils.toWon = MoneyUtils.toWon;
  target.IsfUtils.toMan = MoneyUtils.toMan;
  target.IsfUtils.formatMoney = MoneyUtils.formatMan;

  console.log('CompatibilityBridge: Legacy APIs bridged to Modernized Storage (Window & GlobalThis).');
}

// Auto-initialize if running in a browser environment
if (typeof window !== 'undefined') {
  initCompatibilityBridge();
}
