(function initDataHubModal(global) {
  "use strict";

  class DataHubModal extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    static get observedAttributes() {
      return ["current-step", "data-step"];
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal !== newVal) {
        this.render();
        this.setupEventListeners();
      }
    }

    connectedCallback() {
      this.render();
      this.setupEventListeners();
    }

    /**
     * @param {string} step '1' | '2'
     */
    setStep(step) {
      this.setAttribute("current-step", step);
    }

    /**
     * @param {string} tabId 'tab-simulations' | 'tab-backups'
     */
    setActiveTab(tabId) {
      const panes = this.shadowRoot.querySelectorAll(".tab-pane");
      const btns = this.shadowRoot.querySelectorAll(".tab-btn");
      panes.forEach((p) => p.classList.toggle("is-active", p.id === tabId));
      btns.forEach((b) => b.classList.toggle("is-active", b.dataset.target === tabId));
    }

    /**
     * @param {Array} entries 시뮬레이션 엔트리 배열 [{id, name, ...}]
     */
    updateSimulationList(entries = []) {
      const container = this.shadowRoot.getElementById("simulationListContainer");
      if (!container) return;

      if (entries.length === 0) {
        container.innerHTML = '<p class="empty">저장된 시뮬레이션이 없습니다.</p>';
        return;
      }

      container.innerHTML = entries
        .map(
          (e) => `
        <div class="simulation-item">
          <span class="simulation-name" title="${e.name || "이름 없음"}">${e.name || "배당 시뮬레이션"}</span>
          <div class="item-actions">
            <button class="btn-select" data-id="${e.id}">불러오기</button>
            <button class="btn-delete" data-id="${e.id}">삭제</button>
          </div>
        </div>
      `,
        )
        .join("");

      container.querySelectorAll(".btn-select").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.id;
          this.dispatchEvent(new CustomEvent("select-simulation", { detail: { id } }));
        }),
      );
      container.querySelectorAll(".btn-delete").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.id;
          this.dispatchEvent(new CustomEvent("delete-simulation", { detail: { id } }));
        }),
      );
    }

    // 하위 호환성 유지 (앱에서 호출할 때 깨지지 않게)
    updatePortfolioList(entries) {
      this.updateSimulationList(entries);
    }

    /**
     * @param {Array} entries 백업 엔트리 배열 [{id, createdAt, ...}]
     */
    updateBackupList(entries = []) {
      const container = this.shadowRoot.getElementById("backupListContainer");
      if (!container) return;

      if (entries.length === 0) {
        container.innerHTML = '<p class="empty">백업 이력이 없습니다.</p>';
        return;
      }

      container.innerHTML = entries
        .map(
          (e) => `
        <div class="backup-item">
          <div class="backup-info">
            <span class="backup-date">${IsfUtils.formatTimestamp(e.createdAt)}</span>
            <span class="backup-meta">${e.type === "auto" ? "자동" : "수동"} · ${e.source === "view-save" ? "공유데이터 저장" : "일반"}</span>
          </div>
          <button class="btn-restore" data-id="${e.id}">복원</button>
        </div>
      `,
        )
        .join("");

      container.querySelectorAll(".btn-restore").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.id;
          this.dispatchEvent(new CustomEvent("restore-backup", { detail: { backupId: id } }));
        }),
      );
    }

    setupEventListeners() {
      const root = this.shadowRoot;
      root.getElementById("btnClose").addEventListener("click", () => this.close());
      root.getElementById("modalOverlay").addEventListener("click", () => this.close());
      root.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => this.setActiveTab(btn.dataset.target));
      });

      root.getElementById("btnExportJson").addEventListener("click", () => this.dispatchEvent(new CustomEvent("export-json")));
      root.getElementById("btnCopyLink").addEventListener("click", () => this.dispatchEvent(new CustomEvent("copy-share-link")));
      root.getElementById("btnBackupNow").addEventListener("click", () => this.dispatchEvent(new CustomEvent("backup-now")));
      
      const fileInput = root.getElementById("fileInput");
      root.getElementById("btnImportJson").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.dispatchEvent(new CustomEvent("import-json", { detail: { file } }));
        fileInput.value = "";
      });
    }

    open() {
      this.shadowRoot.getElementById("modalContainer").classList.add("is-open");
      document.body.style.overflow = "hidden";
    }

    close() {
      this.shadowRoot.getElementById("modalContainer").classList.remove("is-open");
      document.body.style.overflow = "";
    }

    render() {
      const step = this.getAttribute("current-step") || this.dataset.step || "1";
      const showSimulations = step === "2";
      const activeTab = showSimulations ? "tab-simulations" : "tab-backups";

      this.shadowRoot.innerHTML = `
      <style>
        :host { --primary: #ea5b2a; --bg: #f8f9fa; --line: #e9ecef; --ink: #212529; --muted: #868e96; }
        #modalContainer { position: fixed; inset: 0; z-index: 1000; visibility: hidden; opacity: 0; transition: all 0.2s; }
        #modalContainer.is-open { visibility: visible; opacity: 1; }
        #modalOverlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); }
        #modalContent { 
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 90%; max-width: 500px; background: #fff; border-radius: 16px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden;
        }
        .modal-header { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
        .modal-header h2 { margin: 0; font-size: 1.1rem; }
        .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted); }
        
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .tab-list { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
        .tab-btn { flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; color: var(--muted); }
        .tab-btn.is-active { color: var(--primary); border-bottom-color: var(--primary); }
        .tab-pane { display: none; padding-top: 12px; }
        .tab-pane.is-active { display: block; }
        
        .simulation-list, .backup-list { display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
        .simulation-item, .backup-item { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 10px 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
        }
        .simulation-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
        .backup-info { display: flex; flex-direction: column; gap: 2px; }
        .backup-date { font-weight: 600; font-size: 0.85rem; }
        .backup-meta { font-size: 0.75rem; color: var(--muted); }
        
        .item-actions { display: flex; gap: 6px; }
        .btn-select, .btn-restore, .btn-delete { padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; cursor: pointer; }
        .btn-select, .btn-restore { background: #fff; border: 1px solid var(--line); }
        .btn-delete { background: #fff; border: 1px solid #ffcfcf; color: #e03131; }
        
        .modal-footer { padding: 16px 20px; background: var(--bg); border-top: 1px solid var(--line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-action { padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; text-align: center; font-size: 0.85rem; border: 1px solid var(--line); background: #fff; }
        .btn-primary { background: var(--primary); color: #fff; border: none; }
        .empty { text-align: center; padding: 40px 0; color: var(--muted); font-size: 0.9rem; }
      </style>
      <div id="modalContainer">
        <div id="modalOverlay"></div>
        <div id="modalContent">
          <div class="modal-header">
            <h2>데이터 통합 관리 센터</h2>
            <button id="btnClose" class="btn-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="tab-list">
              ${showSimulations ? `<button type="button" class="tab-btn ${activeTab === "tab-simulations" ? "is-active" : ""}" data-target="tab-simulations">시뮬레이션 목록</button>` : ""}
              <button type="button" class="tab-btn ${activeTab === "tab-backups" ? "is-active" : ""}" data-target="tab-backups">데이터 백업 이력</button>
            </div>
            
            ${showSimulations ? `
            <div id="tab-simulations" class="tab-pane ${activeTab === "tab-simulations" ? "is-active" : ""}">
              <div id="simulationListContainer" class="simulation-list"></div>
            </div>
            ` : ""}
            
            <div id="tab-backups" class="tab-pane ${activeTab === "tab-backups" ? "is-active" : ""}">
              <div id="backupListContainer" class="backup-list"></div>
              <button id="btnBackupNow" class="btn-action" style="width: 100%; margin-top: 12px;">지금 상태 백업하기</button>
            </div>
          </div>
          <div class="modal-footer">
            <button id="btnExportJson" class="btn-action">JSON 내보내기</button>
            <button id="btnImportJson" class="btn-action">JSON 가져오기</button>
            <button id="btnCopyLink" class="btn-action btn-primary" style="grid-column: span 2;">공유 링크 복사</button>
            <input type="file" id="fileInput" accept=".json" hidden />
          </div>
        </div>
      </div>
      `;
    }
  }

  customElements.define("data-hub-modal", DataHubModal);
})(window);
