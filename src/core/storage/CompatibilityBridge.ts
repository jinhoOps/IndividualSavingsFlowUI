import { isfStore } from './IsfStore';
import { backupService } from './BackupService';
import { MoneyUtils } from '../types/money';

/**
 * Compatibility Bridge for Legacy Vanilla JS Apps.
 * Redirects legacy IsfStorageHub and IsfBackupManager calls to the modernized TypeScript services.
 */

export function initCompatibilityBridge() {
  const global = window as any;

  global.IsfStorageHub = {
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
      return { updatedAt: Date.now() }; // Fake return to match legacy
    },
    getLatestStep1Snapshot: () => isfStore.loadStep1(),

    // Step 2
    saveStep2Entry: (data: any) => isfStore.saveStep2Simulation(data),
    listStep2Entries: () => isfStore.listStep2Simulations(),
    getStep2EntryById: async (id: string) => {
      const all = await isfStore.listStep2Simulations();
      return all.find(s => s.id === id) || null;
    },
    deleteStep2Entry: (id: string) => isfStore.deleteStep2Simulation(id),

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

    // Migration (Stub - user said wipe is fine)
    ensureMigration: async () => {
      console.log('IsfStorageHub: Modernized version active. Migration skipped per user request.');
    }
  };

  // Legacy Utility Aliases
  global.IsfUtils = global.IsfUtils || {};
  global.IsfUtils.toWon = MoneyUtils.toWon;
  global.IsfUtils.toMan = MoneyUtils.toMan;
  global.IsfUtils.formatMoney = MoneyUtils.formatMan;

  console.log('CompatibilityBridge: Legacy APIs bridged to Modernized Storage.');
}
