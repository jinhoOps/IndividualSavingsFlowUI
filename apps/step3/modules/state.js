import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

const STORAGE_KEY_STEP3 = 'isf-step3-settings-v1';

/**
 * Step 3: Global State Management
 * Accounts: { id, name, type, color, assets: [assetIds] }
 * Assets: { id, name, ticker, targetRatio, currentPrice, quantity, accountId }
 */

export class IsfState {
  constructor() {
    this.data = {
      investCapacity: 0,
      accounts: [],
      assets: [],
      lastUpdated: new Date().toISOString()
    };
  }

  async loadFromStorage() {
    const saved = IsfStorageHub.loadLocal(STORAGE_KEY_STEP3);
    if (saved) {
      this.data = { ...this.data, ...saved };
    }
  }

  restoreSnapshot(snapshotData) {
    this.data = JSON.parse(JSON.stringify(snapshotData));
    this.saveToStorage();
  }

  async saveToStorage() {
    this.data.lastUpdated = new Date().toISOString();
    IsfStorageHub.saveLocal(STORAGE_KEY_STEP3, this.data);
  }

  updateInvestCapacity(value) {
    this.data.investCapacity = value;
    this.saveToStorage();
  }

  removeAccount(id) {
    this.data.accounts = this.data.accounts.filter(acc => acc.id !== id);
    this.data.assets = this.data.assets.filter(as => as.accountId !== id);
    this.saveToStorage();
  }

  removeAsset(id) {
    this.data.assets = this.data.assets.filter(as => as.id !== id);
    this.saveToStorage();
  }

  updateAsset(id, field, value) {
    const asset = this.data.assets.find(as => as.id === id);
    if (asset) {
      if (['targetRatio', 'currentPrice', 'quantity', 'expectedYield'].includes(field)) {
        asset[field] = Number(value) || 0;
      } else {
        asset[field] = value;
      }
      this.saveToStorage();
    }
  }

  getSummary() {
    const totalAssetValue = this.data.assets.reduce((sum, asset) => {
      return sum + (asset.currentPrice * asset.quantity);
    }, 0);

    let totalWeightedYield = 0;
    if (totalAssetValue > 0) {
      this.data.assets.forEach(asset => {
        const weight = (asset.currentPrice * asset.quantity) / totalAssetValue;
        totalWeightedYield += (asset.expectedYield || 0) * weight;
      });
    }

    return {
      investCapacity: this.data.investCapacity,
      totalAssetValue: totalAssetValue,
      expectedYield: totalWeightedYield 
    };
  }

  addAccount(name, type = 'ISA') {
    const id = `acc-${Date.now()}`;
    const newAccount = { id, name, type, color: '#ea5b2a' };
    this.data.accounts.push(newAccount);
    this.saveToStorage();
    return newAccount;
  }

  updateAccount(id, field, value) {
    const account = this.data.accounts.find(acc => acc.id === id);
    if (account) {
      account[field] = value;
      this.saveToStorage();
    }
  }

  addAsset(accountId, name, ticker = '', targetRatio = 0) {
    const id = `asset-${Date.now()}`;
    const newAsset = { 
      id, accountId, name, ticker, 
      targetRatio, currentPrice: 0, quantity: 0,
      expectedYield: 0
    };
    this.data.assets.push(newAsset);
    this.saveToStorage();
    return newAsset;
  }
}
