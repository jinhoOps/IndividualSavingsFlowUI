import { isfStore } from './IsfStore';
import { BackupEntry } from '../types/models';

const MAX_BACKUPS = 60;
const AUTO_BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export class BackupService {
  async createBackup(appKey: string, data: any, options: { type: 'auto' | 'manual', source: string }): Promise<BackupEntry> {
    const entry: BackupEntry = {
      id: `bak-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      appKey,
      createdAt: Date.now(),
      type: options.type,
      source: options.source,
      data,
      schemaVersion: 2 // Modern schema
    };

    await isfStore.perform('backups', 'readwrite', (s: IDBObjectStore) => s.put(entry));
    await this.trimBackups(appKey);
    return entry;
  }

  async listBackups(appKey: string): Promise<BackupEntry[]> {
    const all = await isfStore.perform<BackupEntry[]>('backups', 'readonly', (s: IDBObjectStore) => s.getAll());
    return all
      .filter(b => b.appKey === appKey)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async maybeAutoBackup(appKey: string, data: any): Promise<void> {
    const backups = await this.listBackups(appKey);
    const lastAuto = backups.find(b => b.type === 'auto');
    
    if (!lastAuto || Date.now() - lastAuto.createdAt > AUTO_BACKUP_INTERVAL_MS) {
      console.log(`BackupService: Triggering auto backup for ${appKey}`);
      await this.createBackup(appKey, data, { type: 'auto', source: 'system' });
    }
  }

  private async trimBackups(appKey: string): Promise<void> {
    const backups = await this.listBackups(appKey);
    const autos = backups.filter(b => b.type === 'auto');
    const manuals = backups.filter(b => b.type === 'manual');

    const MAX_AUTOS = 20;
    const MAX_MANUALS = 10;

    if (autos.length > MAX_AUTOS) {
      const toDelete = autos.slice(MAX_AUTOS);
      for (const b of toDelete) {
        await isfStore.perform('backups', 'readwrite', (s: IDBObjectStore) => s.delete(b.id));
      }
    }

    if (manuals.length > MAX_MANUALS) {
      const toDelete = manuals.slice(MAX_MANUALS);
      for (const b of toDelete) {
        await isfStore.perform('backups', 'readwrite', (s: IDBObjectStore) => s.delete(b.id));
      }
    }
  }
}

export const backupService = new BackupService();
