/**
 * ISF Data Hub Modal Component (v0.5)
 * 데이터 백업, 복구, 포트폴리오 관리, JSON 내보내기/가져오기 등을 관리하는 통합 모달입니다.
 */
export class DataHubModal extends HTMLElement {
  constructor() {
    super();
    this.isActive = false;
  }

  static get observedAttributes() {
    return ['current-step'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'current-step') {
      this.render();
      this.bindEvents();
    }
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  /**
   * 모달을 엽니다.
   * @param {string} tabId 열 때 활성화할 탭 ID ('tab-portfolios' | 'tab-backups')
   */
  open(tabId) {
    this.isActive = true;
    const overlay = this.querySelector('.modal-overlay');
    if (overlay) overlay.classList.add('is-active');
    
    if (tabId) {
      this.setActiveTab(tabId);
    } else {
      // 기본값 설정: Step 1이면 백업, Step 2면 포트폴리오
      const step = this.getAttribute('current-step') || '1';
      this.setActiveTab(step === '1' ? 'tab-backups' : 'tab-portfolios');
    }

    document.body.style.overflow = 'hidden';
    this.dispatchEvent(new CustomEvent('modal-open'));
  }

  setActiveTab(tabId) {
    const tabBtns = this.querySelectorAll('.tab-btn');
    const tabPanes = this.querySelectorAll('.tab-pane');
    const targetBtn = Array.from(tabBtns).find(b => b.dataset.target === tabId);
    
    if (targetBtn) {
      tabBtns.forEach(b => b.classList.toggle('is-active', b === targetBtn));
      tabPanes.forEach(p => p.classList.toggle('is-active', p.id === tabId));
    }
  }

  close() {
    this.isActive = false;
    const overlay = this.querySelector('.modal-overlay');
    if (overlay) overlay.classList.remove('is-active');
    document.body.style.overflow = '';
    this.dispatchEvent(new CustomEvent('modal-close'));
  }

  /**
   * 포트폴리오 목록을 외부에서 업데이트합니다. (Step 2용)
   * @param {Array} portfolios 포트폴리오 객체 배열 [{id, name, ...}]
   */
  updatePortfolioList(portfolios = []) {
    const container = this.querySelector('#portfolioListContainer');
    if (!container) return;

    if (portfolios.length === 0) {
      container.innerHTML = `
        <div style="padding: var(--sp-md); text-align: center; color: var(--muted); font-size: 0.86rem; border: 1px dashed var(--line); border-radius: var(--rd-sm);">
          저장된 포트폴리오가 없습니다.
        </div>`;
      return;
    }

    container.innerHTML = portfolios.map(p => `
      <div class="portfolio-item">
        <span class="portfolio-name" title="${p.name || '이름 없음'}">${p.name || '이름 없음'}</span>
        <div style="display: flex; gap: var(--sp-xs); flex-shrink: 0;">
          <button type="button" class="btn btn-sm btn-ghost" data-action="select" data-id="${p.id}">불러오기</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="delete" data-id="${p.id}" style="color: var(--node-expense);">삭제</button>
        </div>
      </div>
    `).join('');

    // 포트폴리오 아이템 이벤트 바인딩
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'select') {
          this.dispatchEvent(new CustomEvent('select-portfolio', { detail: { id } }));
        } else if (action === 'delete') {
          this.dispatchEvent(new CustomEvent('delete-portfolio', { detail: { id } }));
        }
      };
    });
  }

  /**
   * 백업 목록을 외부에서 업데이트합니다.
   * @param {Array} entries 백업 엔트리 배열
   */
  updateBackupList(entries = []) {
    const select = this.querySelector('#modalBackupSelect');
    const restoreBtn = this.querySelector('#modalRestoreBackup');
    if (!select) return;

    if (entries.length === 0) {
      select.innerHTML = '<option value="">저장된 백업 없음</option>';
      select.disabled = true;
      if (restoreBtn) restoreBtn.disabled = true;
      return;
    }

    select.disabled = false;
    if (restoreBtn) restoreBtn.disabled = false;
    
    // 최근 순 정렬
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    
    select.innerHTML = sorted.map(entry => {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const typeStr = entry.type === 'auto' ? '[자동]' : '[수동]';
      return `<option value="${entry.id}">${dateStr} ${typeStr}</option>`;
    }).join('');
  }

  render() {
    const step = this.getAttribute('current-step') || '1';
    const showPortfolios = step === '2';
    const activeTab = showPortfolios ? 'tab-portfolios' : 'tab-backups';

    this.innerHTML = `
      <style>
        .data-hub-tabs { display: flex; gap: var(--sp-xs); margin-bottom: var(--sp-md); border-bottom: 1px solid var(--line); }
        .tab-btn { 
          padding: var(--sp-sm) var(--sp-md); border: none; background: none; 
          font-size: 0.9rem; font-weight: 600; color: var(--muted); cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .tab-btn.is-active { color: var(--tone-primary); border-bottom-color: var(--tone-primary); }
        .tab-pane { display: none; }
        .tab-pane.is-active { display: block; }
        .portfolio-list { display: flex; flex-direction: column; gap: var(--sp-xs); max-height: 240px; overflow-y: auto; padding-right: 4px; }
        .portfolio-item { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: var(--sp-sm) var(--sp-md); border: 1px solid var(--line); 
          border-radius: var(--rd-sm); background: var(--panel);
          transition: all 0.2s ease;
        }
        .portfolio-item:hover { border-color: var(--line-strong); background: #fff; }
        .portfolio-name { 
          font-weight: 500; font-size: 0.9rem; color: var(--ink); 
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
          margin-right: var(--sp-sm); 
        }
      </style>
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">데이터 관리 허브</h2>
            <button type="button" class="modal-close" aria-label="닫기">&times;</button>
          </div>

          <div class="tab-list data-hub-tabs">
            ${showPortfolios ? `<button type="button" class="tab-btn ${activeTab === 'tab-portfolios' ? 'is-active' : ''}" data-target="tab-portfolios">포트폴리오 목록</button>` : ''}
            <button type="button" class="tab-btn ${activeTab === 'tab-backups' ? 'is-active' : ''}" data-target="tab-backups">로컬 백업</button>
          </div>

          ${showPortfolios ? `
          <div id="tab-portfolios" class="tab-pane ${activeTab === 'tab-portfolios' ? 'is-active' : ''}">
            <div id="portfolioListContainer" class="portfolio-list">
              <div style="padding: var(--sp-md); text-align: center; color: var(--muted); font-size: 0.86rem;">
                불러오는 중...
              </div>
            </div>
            <p style="font-size: 0.75rem; color: var(--muted); margin-top: var(--sp-sm);">
              Step 2에서 작성한 포트폴리오를 브라우저에 저장하고 관리합니다.
            </p>
          </div>
          ` : ''}

          <div id="tab-backups" class="tab-pane ${activeTab === 'tab-backups' ? 'is-active' : ''}">
            <div class="modal-section" style="margin-bottom: 0;">
              <span class="modal-section-title">백업 스냅샷</span>
              <div class="modal-grid">
                <button type="button" id="modalBackupNow" class="btn btn-primary">지금 백업 생성</button>
                <div style="display: flex; gap: var(--sp-xs);">
                  <select id="modalBackupSelect" class="btn" style="flex: 1; text-align: left;"></select>
                  <button type="button" id="modalRestoreBackup" class="btn btn-ghost btn-sm" title="복원">복원</button>
                </div>
              </div>
              <p style="font-size: 0.75rem; color: var(--muted); margin-top: var(--sp-sm);">
                전체 데이터를 IndexedDB에 백업하거나 특정 시점으로 복원합니다.
              </p>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid var(--line); margin: var(--sp-lg) 0 var(--sp-md);">

          <div class="modal-section">
            <span class="modal-section-title">공유 및 파일 관리</span>
            <div class="modal-grid">
              <button type="button" id="modalCopyShareLink" class="btn">
                <span>공유 링크 복사</span>
              </button>
              <button type="button" id="modalExportJson" class="btn">
                <span>JSON 내보내기</span>
              </button>
              <button type="button" id="modalImportJson" class="btn">
                <span>JSON 불러오기</span>
              </button>
              <input type="file" id="modalImportFile" accept=".json" style="display: none;">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const overlay = this.querySelector('.modal-overlay');
    const closeBtn = this.querySelector('.modal-close');
    const backupNowBtn = this.querySelector('#modalBackupNow');
    const restoreBtn = this.querySelector('#modalRestoreBackup');
    const copyLinkBtn = this.querySelector('#modalCopyShareLink');
    const exportJsonBtn = this.querySelector('#modalExportJson');
    const importJsonBtn = this.querySelector('#modalImportJson');
    const importFile = this.querySelector('#modalImportFile');

    // 탭 전환 이벤트
    const tabBtns = this.querySelectorAll('.tab-btn');
    const tabPanes = this.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        tabBtns.forEach(b => b.classList.toggle('is-active', b === btn));
        tabPanes.forEach(p => p.classList.toggle('is-active', p.id === targetId));
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    closeBtn.addEventListener('click', () => this.close());

    backupNowBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('backup-now'));
    });

    restoreBtn.addEventListener('click', () => {
      const select = this.querySelector('#modalBackupSelect');
      if (select && select.value) {
        this.dispatchEvent(new CustomEvent('restore-backup', {
          detail: { backupId: select.value }
        }));
      }
    });

    copyLinkBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('copy-share-link'));
    });

    exportJsonBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('export-json'));
    });

    importJsonBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.dispatchEvent(new CustomEvent('import-json', {
          detail: { file }
        }));
      }
      e.target.value = ''; // Reset for next selection
    });
  }
}

if (!customElements.get('data-hub-modal')) {
  customElements.define('data-hub-modal', DataHubModal);
}
