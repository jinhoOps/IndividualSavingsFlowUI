import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

const STORAGE_KEY_PORTFOLIOS = 'isf-step3-portfolios-v2';

export class IsfState {
  constructor() {
    this.data = {
      portfolios: [],
      activeCreator: {
        name: '',
        period: '매일',
        assets: []
      },
      lastUpdated: new Date().toISOString()
    };
  }

  async loadFromStorage() {
    const saved = IsfStorageHub.loadLocal(STORAGE_KEY_PORTFOLIOS);
    if (saved) {
      this.data = {
        portfolios: saved.portfolios || [],
        activeCreator: saved.activeCreator || { name: '', period: '매일', assets: [] },
        lastUpdated: saved.lastUpdated || new Date().toISOString()
      };
    } else {
      this.resetActiveCreator();
    }
  }

  resetActiveCreator() {
    this.data.activeCreator = {
      name: '',
      period: '매일',
      assets: [
        { id: `as-${Date.now()}-1`, name: '', ticker: '', amount: 0, ratio: 0 },
        { id: `as-${Date.now()}-2`, name: '', ticker: '', amount: 0, ratio: 0 }
      ]
    };
    this.saveToStorage();
  }

  async saveToStorage() {
    this.data.lastUpdated = new Date().toISOString();
    IsfStorageHub.saveLocal(STORAGE_KEY_PORTFOLIOS, this.data);
  }

  addPortfolio(portfolio) {
    this.data.portfolios.push(portfolio);
    this.resetActiveCreator();
    this.saveToStorage();
  }

  removePortfolio(id) {
    this.data.portfolios = this.data.portfolios.filter(p => p.id !== id);
    this.saveToStorage();
  }

  updateActiveCreator(field, value) {
    if (field === 'name') {
      this.data.activeCreator.name = value;
    } else if (field === 'period') {
      this.data.activeCreator.period = value;
    } else if (field === 'assets') {
      this.data.activeCreator.assets = value;
    }
    this.saveToStorage();
  }

  addAssetToCreator() {
    const newAsset = {
      id: `as-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: '',
      ticker: '',
      amount: 0,
      ratio: 0
    };
    this.data.activeCreator.assets.push(newAsset);
    this.saveToStorage();
    return newAsset;
  }

  removeAssetFromCreator(assetId) {
    this.data.activeCreator.assets = this.data.activeCreator.assets.filter(as => as.id !== assetId);
    this.saveToStorage();
  }

  updateCreatorAsset(assetId, field, value) {
    const asset = this.data.activeCreator.assets.find(as => as.id === assetId);
    if (asset) {
      if (field === 'amount') {
        asset[field] = Number(value) || 0;
      } else {
        asset[field] = value;
      }
      this.saveToStorage();
    }
  }
}
