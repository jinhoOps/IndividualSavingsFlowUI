/**
 * Step 3: Portfolio Rebalancing - Main Application
 * 3-Tier Architecture: State / Helpers / UI
 */

import { IsfUtils } from '../../shared/core/utils.js';
import { IsfState } from './modules/state.js';
import { IsfDom } from './modules/dom.js';
import { IsfCalculator } from './modules/calculator.js';
import { IsfChartBuilder } from './modules/chart-builder.js';
import { IsfSnapshotManager } from './modules/snapshot-manager.js';
import { Step1Connector } from './modules/step1-connector.js';

const App = {
  // 1. State
  state: null,

  // 2. Core Helpers
  async init() {
    console.log('[Step3] Initializing Application...');
    this.state = new IsfState();
    
    try {
      await this.state.loadFromStorage();
      await this.loadInitialData();
      this.bindEvents();
      this.render();
      console.log('[Step3] Initialization Complete.');
    } catch (error) {
      console.error('[Step3] Initialization Failed:', error);
    }
  },

  async loadInitialData() {
    const step1Data = await Step1Connector.fetchLatestSnapshot();
    if (step1Data) {
      this.state.updateInvestCapacity(step1Data.investCapacity);
    }
  },

  bindEvents() {
    // Add Account
    IsfDom.nodes.addAccountBtn.onclick = () => {
      const name = prompt('계좌 별명을 입력하세요 (예: 연금저축펀드)', '새 계좌');
      if (name) {
        this.state.addAccount(name);
        this.render();
      }
    };

    // Save Snapshot
    IsfDom.nodes.saveSnapshotBtn.onclick = async () => {
      const name = prompt('스냅샷 이름을 입력하세요', `포트폴리오 ${new Date().toLocaleDateString()}`);
      if (name) {
        await IsfSnapshotManager.saveSnapshot(this.state.data, name);
        this.render();
      }
    };
  },

  // 3. UI Logic
  render() {
    // Calculate Rebalancing
    const analysis = IsfCalculator.calculateRebalancing(this.state.data);
    const summary = this.state.getSummary();
    
    // Update Summaries
    IsfDom.nodes.investCapacity.textContent = IsfUtils.formatMoney(summary.investCapacity);
    IsfDom.nodes.totalAssetValue.textContent = IsfUtils.formatMoney(analysis.totalValue);
    IsfDom.nodes.expectedYield.textContent = `${summary.expectedYield.toFixed(2)}%`;

    // Render Chart
    IsfChartBuilder.renderDonutChart(IsfDom.nodes.portfolioChart, analysis.assets.map(as => ({
      label: as.name,
      value: as.currentValue
    })));

    // Render Guide
    IsfDom.renderGuide(analysis.assets);

    // Render Snapshots
    IsfDom.renderSnapshots(IsfSnapshotManager.listSnapshots(), {
      onRestore: (id) => {
        const snap = IsfSnapshotManager.listSnapshots().find(s => s.id === id);
        if (snap && confirm(`'${snap.name}' 스냅샷으로 복원하시겠습니까?`)) {
          this.state.restoreSnapshot(snap.data);
          this.render();
        }
      },
      onDelete: (id) => {
        if (confirm('스냅샷을 삭제하시겠습니까?')) {
          IsfSnapshotManager.deleteSnapshot(id);
          this.render();
        }
      }
    });

    // Render Editor
    IsfDom.renderEditor(this.state.data, {
      onRemoveAccount: (id) => {
        this.state.removeAccount(id);
        this.render();
      },
      onAccountUpdate: (id, field, value) => {
        this.state.updateAccount(id, field, value);
        this.render();
      },
      onAddAsset: (accountId) => {
        this.state.addAsset(accountId, '새 종목');
        this.render();
      },
      onRemoveAsset: (id) => {
        this.state.removeAsset(id);
        this.render();
      },
      onInputChange: (id, field, value) => {
        this.state.updateAsset(id, field, value);
        this.render();
      }
    });
  }
};

// Start App
document.addEventListener('DOMContentLoaded', () => App.init());
