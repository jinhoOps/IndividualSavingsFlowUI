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

    
    setStep(step) {
      this.setAttribute("current-step", step);
    }

    
    setActiveTab(tabId) {
      const panes = this.shadowRoot.querySelectorAll(".tab-pane");
      const btns = this.shadowRoot.querySelectorAll(".tab-btn");
      panes.forEach((p) => p.classList.toggle("is-active", p.id === tabId));
      btns.forEach((b) => b.classList.toggle("is-active", b.dataset.target === tabId));
    }

    
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


    updatePortfolioList(entries) {
      this.updateSimulationList(entries);
    }

    
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
      root.getElementById("btnBackupNow").addEventListener("click", () => this.dispatchEvent(new CustomEvent("backup-now")));
      
      root.getElementById("btnGenerateCode").addEventListener("click", () => this.dispatchEvent(new CustomEvent("generate-isf-code")));
      
      root.getElementById("btnApplyCode").addEventListener("click", () => {
        const codeInput = root.getElementById("isfCodeInput");
        const code = codeInput.value.trim();
        if (code) {
          this.dispatchEvent(new CustomEvent("apply-isf-code", { detail: { code } }));
        } else {
          codeInput.focus();
        }
      });

      root.getElementById("btnMergeCode").addEventListener("click", () => {
        const codeInput = root.getElementById("isfCodeInput");
        const code = codeInput.value.trim();
        if (code) {
          this.dispatchEvent(new CustomEvent("merge-isf-code", { detail: { code } }));
        } else {
          codeInput.focus();
        }
      });

      const fileInput = root.getElementById("fileInput");
      root.getElementById("btnImportJson").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.dispatchEvent(new CustomEvent("import-json", { detail: { file } }));
        fileInput.value = "";
      });
    }

    
    showGeneratedCode(code) {
      const input = this.shadowRoot.getElementById("isfCodeInput");
      if (input) {
        input.value = code;
        input.readOnly = false;
        input.select();
        try {
          document.execCommand("copy");
          input.readOnly = true;
        } catch (e) {
          input.readOnly = true;
        }
      }
    }

    open() {
      this.shadowRoot.getElementById("modalContainer").classList.add("is-open");
      document.body.style.overflow = "hidden";
      
      const input = this.shadowRoot.getElementById("isfCodeInput");
      if (input) {
        input.value = "";
        input.readOnly = false;
      }
    }

    close() {
      this.shadowRoot.getElementById("modalContainer").classList.remove("is-open");
      document.body.style.overflow = "";
    }

    render() {
      const step = this.getAttribute("current-step") || this.dataset.step || "1";
      const showSimulations = step === "2";

      this.shadowRoot.innerHTML = `
      <style>
        :host { 
          --primary: var(--tone-primary, #ea5b2a); 
          --accent: var(--tone-accent, #1e8b7c);
          --bg: var(--bg, #f8f9fa); 
          --line: var(--line, #e9ecef); 
          --ink: var(--ink, #212529); 
          --muted: var(--muted, #868e96); 
          --radius: var(--rd-md, 16px);
          --panel: rgba(255, 255, 255, 0.95);
        }
        #modalContainer { position: fixed; inset: 0; z-index: 1000; visibility: hidden; opacity: 0; transition: all 0.2s; }
        #modalContainer.is-open { visibility: visible; opacity: 1; }
        #modalOverlay { position: absolute; inset: 0; background: rgba(16, 34, 32, 0.4); backdrop-filter: blur(4px); }
        #modalContent { 
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 90%; max-width: 500px; background: var(--panel); border-radius: var(--radius); 
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden;
        }
        .modal-header { padding: var(--sp-md) var(--sp-lg); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
        .modal-header h2 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); }
        .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted); }
        
        .modal-body { padding: var(--sp-lg); display: flex; flex-direction: column; gap: var(--sp-lg); min-height: 320px; }
        
        .tab-list { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 4px; overflow-x: auto; custom-scrollbar: none; }
        .tab-btn { flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; font-weight: 600; color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
        .tab-btn.is-active { color: var(--primary); border-bottom-color: var(--primary); }
        .tab-pane { display: none; padding-top: 12px; height: 100%; }
        .tab-pane.is-active { display: block; }
        
        .simulation-list, .backup-list { display: flex; flex-direction: column; gap: var(--sp-sm); max-height: 240px; overflow-y: auto; padding-right: 4px; }
        .simulation-item, .backup-item { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 10px 12px; background: rgba(16, 34, 32, 0.04); border: 1px solid var(--line); border-radius: var(--rd-sm, 8px);
        }
        .simulation-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; color: var(--ink); }
        .backup-info { display: flex; flex-direction: column; gap: 2px; }
        .backup-date { font-weight: 600; font-size: 0.85rem; color: var(--ink); }
        .backup-meta { font-size: 0.75rem; color: var(--muted); }
        
        .item-actions { display: flex; gap: 6px; }
        .btn-select, .btn-restore, .btn-delete { padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; cursor: pointer; font-family: inherit; }
        .btn-select, .btn-restore { background: var(--panel); border: 1px solid var(--line); color: var(--ink); }
        .btn-delete { background: var(--panel); border: 1px solid #ffcfcf; color: var(--status-error, #e03131); }
        
        .share-section { display: flex; flex-direction: column; gap: 16px; }
        .share-card { background: rgba(16, 34, 32, 0.04); border: 1px solid var(--line); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .share-card h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--ink); }
        .share-card p { margin: 0; font-size: 0.8rem; color: var(--muted); line-height: 1.5; }
        
        .code-input-group { display: flex; gap: 8px; }
        .code-input-group input { 
          flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); 
          font-family: monospace; font-size: 0.9rem; color: var(--ink);
        }
        .code-input-group input:focus { border-color: var(--primary); outline: none; }
        
        .modal-footer { padding: var(--sp-md) var(--sp-lg); background: rgba(16, 34, 32, 0.04); border-top: 1px solid var(--line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-action { padding: 10px; border-radius: var(--rd-sm, 8px); font-weight: 600; cursor: pointer; text-align: center; font-size: 0.85rem; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font-family: inherit; }
        .btn-primary { background: var(--primary); color: #fff; border: none; }
        .empty { text-align: center; padding: 40px 0; color: var(--muted); font-size: 0.9rem; }

        /* AI Tab Styles */
        .ai-status-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--accent); color: white; font-weight: bold; }
        .ai-key-input { font-family: password; letter-spacing: 2px; }
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
              <button type="button" class="tab-btn is-active" data-target="tab-share">공유 및 연동</button>
              ${showSimulations ? `<button type="button" class="tab-btn" data-target="tab-simulations">시뮬레이션 목록</button>` : ""}
              <button type="button" class="tab-btn" data-target="tab-backups">데이터 백업 이력</button>
              <button type="button" class="tab-btn" data-target="tab-ai">AI 지능형 자문 <span class="ai-status-badge">Beta</span></button>
            </div>
            
            <div id="tab-share" class="tab-pane is-active">
              <div class="share-section">
                <div class="share-card">
                  <h3>ISF CODE 공유 및 병합</h3>
                  <p>짧은 코드를 통해 설정을 공유하거나, 파트너의 데이터를 현재 내 데이터와 합칠 수 있습니다.</p>
                  <div class="code-input-group">
                    <input type="text" id="isfCodeInput" placeholder="코드를 입력하거나 발급받으세요" />
                    <button id="btnGenerateCode" class="btn-action">발급</button>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button id="btnApplyCode" class="btn-action btn-primary">코드 불러오기</button>
                    <button id="btnMergeCode" class="btn-action" style="background: rgba(30, 139, 124, 0.1); border-color: var(--accent); color: var(--accent);">부부 데이터 병합</button>
                  </div>
                </div>
                
                <div class="share-card" style="flex-direction: row; align-items: center; justify-content: space-between; padding: 12px 16px;">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <h3 style="font-size: 0.85rem;">JSON 파일 관리</h3>
                    <p style="font-size: 0.75rem;">오프라인 보관용 파일</p>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button id="btnExportJson" class="btn-action" style="padding: 6px 10px; font-size: 0.75rem;">내보내기</button>
                    <button id="btnImportJson" class="btn-action" style="padding: 6px 10px; font-size: 0.75rem;">가져오기</button>
                  </div>
                </div>
              </div>
            </div>

            ${showSimulations ? `
            <div id="tab-simulations" class="tab-pane">
              <div id="simulationListContainer" class="simulation-list"></div>
            </div>
            ` : ""}
            
            <div id="tab-backups" class="tab-pane">
              <div id="backupListContainer" class="backup-list"></div>
              <button id="btnBackupNow" class="btn-action" style="width: 100%; margin-top: 12px;">지금 상태 백업하기</button>
            </div>

            <div id="tab-ai" class="tab-pane">
              <div class="share-section">
                <div class="share-card">
                  <h3>AI 기능 설정</h3>
                  <p>Google Gemini API 키를 등록하여 지능형 자산 분석 및 세무 자문 기능을 활성화하세요.</p>
                  <div class="code-input-group">
                    <input type="password" id="aiApiKeyInput" class="ai-key-input" placeholder="Gemini API Key를 입력하세요" />
                  </div>
                  <button id="btnSaveAiKey" class="btn-action btn-primary">API 키 저장</button>
                  <p style="font-size: 0.7rem; color: var(--muted); margin-top: 8px;">* API 키는 브라우저 로컬 저장소에만 안전하게 보관되며, 서버로 전송되지 않습니다.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="grid-template-columns: 1fr;">
            <p style="margin: 0; font-size: 0.7rem; color: var(--muted); text-align: center;">모든 데이터는 브라우저 로컬 저장소에 안전하게 보관됩니다.</p>
            <input type="file" id="fileInput" accept=".json" hidden />
          </div>
        </div>
      </div>
      `;
    }
  }

  customElements.define("data-hub-modal", DataHubModal);
})(window);
v>
      `;
    }
  }

  customElements.define("data-hub-modal", DataHubModal);
})(window);
