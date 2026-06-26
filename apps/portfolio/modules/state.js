import { IsfStorageHub } from '../../../shared/storage/hub-storage.js';

const STORAGE_KEY_PORTFOLIOS = 'isf-step3-portfolios-v2';
const EMPTY_ACCOUNT_FLOW_HANDOFF = {
  available: false,
  counts: {
    accounts: 0,
    incomeAllocations: 0,
    itemAccounts: 0,
    transfers: 0
  },
  labels: []
};

function normalizeAccountFlowHandoff(handoff) {
  const counts = handoff && typeof handoff === 'object' ? handoff.counts || {} : {};
  const labels = Array.isArray(handoff?.labels) ? handoff.labels.filter(Boolean) : [];
  const normalized = {
    available: Boolean(handoff?.available),
    counts: {
      accounts: Number(counts.accounts) || 0,
      incomeAllocations: Number(counts.incomeAllocations) || 0,
      itemAccounts: Number(counts.itemAccounts) || 0,
      transfers: Number(counts.transfers) || 0
    },
    labels
  };
  normalized.available = normalized.available || Object.values(normalized.counts).some(count => count > 0);
  return normalized;
}

export class IsfState {
  constructor() {
    this.data = {
      portfolios: [],
      activeCreator: {
        name: '',
        period: '매일',
        assets: []
      },
      accountFlowHandoff: { ...EMPTY_ACCOUNT_FLOW_HANDOFF, counts: { ...EMPTY_ACCOUNT_FLOW_HANDOFF.counts } },
      lastUpdated: new Date().toISOString()
    };
  }

  async loadFromStorage() {
    const saved = IsfStorageHub.loadLocal(STORAGE_KEY_PORTFOLIOS);
    if (saved) {
      this.data = {
        portfolios: saved.portfolios || [],
        activeCreator: saved.activeCreator || { name: '', period: '매일', assets: [] },
        accountFlowHandoff: normalizeAccountFlowHandoff(saved.accountFlowHandoff),
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

  setAccountFlowHandoff(handoff) {
    this.data.accountFlowHandoff = normalizeAccountFlowHandoff(handoff);
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
