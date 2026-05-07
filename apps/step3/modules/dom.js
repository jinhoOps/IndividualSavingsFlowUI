/**
 * Step 3: DOM Rendering & Event Binding
 */

import { IsfUtils } from '../../shared/core/utils.js';

export const IsfDom = {
  // Selectors
  nodes: {
    investCapacity: document.getElementById('investCapacity'),
    totalAssetValue: document.getElementById('totalAssetValue'),
    expectedYield: document.getElementById('expectedYield'),
    accountList: document.getElementById('accountList'),
    addAccountBtn: document.getElementById('addAccountBtn'),
    portfolioChart: document.getElementById('portfolioChart'),
    guideContent: document.getElementById('guideContent'),
    snapshotControls: document.getElementById('snapshotControls'),
    saveSnapshotBtn: document.getElementById('saveSnapshotBtn'),
  },

  /**
   * 리밸런싱 가이드 리스트를 렌더링합니다.
   * @param {Array} results calculateRebalancing의 결과 assets
   */
  renderGuide(results) {
    const { guideContent } = this.nodes;
    const items = results.filter(as => as.buyAmount > 0);

    if (items.length === 0) {
      guideContent.innerHTML = '<p class="hint">현재 비중에 맞게 자산이 구성되어 있거나 가용 투자금이 없습니다.</p>';
      return;
    }

    guideContent.innerHTML = `
      <ul class="guide-list">
        ${items.map(as => `
          <li class="guide-item">
            <div class="guide-info">
              <span class="guide-name">${as.name}</span>
              <span class="guide-ticker">${as.ticker || ''}</span>
            </div>
            <div class="guide-action">
              <span class="guide-amount">${Math.round(as.buyAmount / 10000).toLocaleString()} 만원</span>
              <span class="guide-label">매수 추천</span>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  },

  /**
   * 스냅샷 목록을 렌더링합니다.
   * @param {Array} snapshots 
   * @param {Object} handlers { onRestore, onDelete }
   */
  renderSnapshots(snapshots, handlers) {
    const { snapshotControls } = this.nodes;
    if (!snapshotControls) return;

    if (snapshots.length === 0) {
      snapshotControls.innerHTML = '<p class="hint">저장된 포트폴리오 스냅샷이 없습니다.</p>';
      return;
    }

    snapshotControls.innerHTML = `
      <div class="snapshot-list">
        ${snapshots.map(s => `
          <div class="snapshot-item">
            <div class="snapshot-info">
              <span class="snapshot-name">${s.name}</span>
              <span class="snapshot-date">${new Date(s.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="snapshot-actions">
              <button class="btn btn-ghost btn-xs btn-restore-snap" data-id="${s.id}">복원</button>
              <button class="btn btn-ghost btn-xs btn-delete-snap" data-id="${s.id}">삭제</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind events
    snapshotControls.querySelectorAll('.btn-restore-snap').forEach(btn => {
      btn.onclick = () => handlers.onRestore(btn.dataset.id);
    });
    snapshotControls.querySelectorAll('.btn-delete-snap').forEach(btn => {
      btn.onclick = () => handlers.onDelete(btn.dataset.id);
    });
  },

  /**
   * 계좌 리스트 및 내부 종목들을 렌더링합니다.
   * @param {Object} data IsfState.data
   * @param {Object} handlers { onAddAsset, onRemoveAccount, onRemoveAsset, onInputChange, onAccountUpdate }
   */
  renderEditor(data, handlers) {
    const { accounts, assets } = data;
    const { accountList } = this.nodes;

    if (accounts.length === 0) {
      accountList.innerHTML = '<p class="empty">등록된 계좌가 없습니다. 계좌를 추가하여 자산 구성을 시작하세요.</p>';
      return;
    }

    accountList.innerHTML = accounts.map(acc => {
      const accountAssets = assets.filter(as => as.accountId === acc.id);
      return this._buildAccountHtml(acc, accountAssets);
    }).join('');

    // Bind events
    this._bindEditorEvents(handlers);
  },

  _buildAccountHtml(acc, assets) {
    const types = ['ISA', '연금저축', 'IRP', '일반계좌', '비과세'];
    return `
      <div class="account-card" data-account-id="${acc.id}">
        <div class="account-head">
          <div class="account-info">
            <select class="account-type-select" data-id="${acc.id}">
              ${types.map(t => `<option value="${t}" ${acc.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <h3 class="account-name">${acc.name}</h3>
          </div>
          <div class="account-actions">
            <button class="btn btn-ghost btn-xs btn-remove-account" data-id="${acc.id}">삭제</button>
          </div>
        </div>
        
        <div class="asset-list">
          <div class="asset-header">
            <span class="col-name">종목명(티커)</span>
            <span class="col-ratio">목표(%)</span>
            <span class="col-price">현재가</span>
            <span class="col-qty">수량</span>
            <span class="col-action"></span>
          </div>
          ${assets.map(as => this._buildAssetRowHtml(as)).join('')}
          <button class="btn btn-ghost btn-xs btn-add-asset" data-account-id="${acc.id}">+ 종목 추가</button>
        </div>
      </div>
    `;
  },

  _buildAssetRowHtml(as) {
    return `
      <div class="asset-row" data-asset-id="${as.id}">
        <div class="col-name">
          <input type="text" class="input-minimal" value="${as.name}" data-field="name" data-id="${as.id}" placeholder="종목명">
          <input type="text" class="input-minimal ticker" value="${as.ticker}" data-field="ticker" data-id="${as.id}" placeholder="Ticker">
        </div>
        <div class="col-ratio">
          <input type="number" class="input-minimal" value="${as.targetRatio}" data-field="targetRatio" data-id="${as.id}" step="0.1">
        </div>
        <div class="col-price">
          <input type="number" class="input-minimal" value="${IsfUtils.toMan(as.currentPrice)}" data-field="currentPrice" data-id="${as.id}" step="1">
        </div>
        <div class="col-qty">
          <input type="number" class="input-minimal" value="${as.quantity}" data-field="quantity" data-id="${as.id}" step="0.0001">
        </div>
        <div class="col-action">
          <button class="btn-remove-asset" data-id="${as.id}" title="삭제">×</button>
        </div>
      </div>
    `;
  },

  _bindEditorEvents(handlers) {
    const { accountList } = this.nodes;

    // Account Type Select
    accountList.querySelectorAll('.account-type-select').forEach(sel => {
      sel.onchange = (e) => handlers.onAccountUpdate(sel.dataset.id, 'type', e.target.value);
    });

    // Remove Account
    accountList.querySelectorAll('.btn-remove-account').forEach(btn => {
      btn.onclick = () => {
        if (confirm('계좌를 삭제하시겠습니까? 관련 종목 데이터도 모두 삭제됩니다.')) {
          handlers.onRemoveAccount(btn.dataset.id);
        }
      };
    });

    // Add Asset
    accountList.querySelectorAll('.btn-add-asset').forEach(btn => {
      btn.onclick = () => handlers.onAddAsset(btn.dataset.accountId);
    });

    // Remove Asset
    accountList.querySelectorAll('.btn-remove-asset').forEach(btn => {
      btn.onclick = () => handlers.onRemoveAsset(btn.dataset.id);
    });

    // Input Change
    accountList.querySelectorAll('input').forEach(input => {
      input.onchange = (e) => {
        const { field, id } = e.target.dataset;
        let value = e.target.value;
        
        // 데이터 타입 변환
        if (field === 'targetRatio' || field === 'quantity') value = parseFloat(value) || 0;
        if (field === 'currentPrice') value = IsfUtils.toWon(parseFloat(value) || 0);

        handlers.onInputChange(id, field, value);
      };
    });
  }
};
