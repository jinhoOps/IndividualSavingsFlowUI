/**
 * ISF Step 2: Investment Portfolio Controller
 * (Refactored to ES6 Modules v0.5.12)
 */

import { state, createEmptyDraft, markDirty, markClean, getHubStorage, createDraftAccount, createDraftAllocation } from "./modules/state.js";
import { dom, initDom } from "./modules/dom.js";
import { 
  SHARE_STATE_KEY, 
  SHARE_STATE_SCHEMA, 
  HASH_STATE_PARAM, 
  TEMP_STORAGE_KEY 
} from "./modules/constants.js";
import { 
  renderDraft, 
  renderChartTabs, 
  renderCharts, 
  renderAccountList, 
  renderAccountSummary,
  renderDividendSimulation
} from "./modules/renderers.js";
import { checkBridgeData, importLatestBridgeIntoDraft } from "./modules/bridge.js";
import { 
  saveCurrentPortfolio, 
  loadPortfolioById, 
  deletePortfolioById, 
  refreshPortfolioList, 
  handleManualBackup, 
  restoreBackupById, 
  normalizeLoadedPortfolio,
  toPortablePortfolio,
  resetDraft,
  syncBackupUi
} from "./modules/storage-handler.js";
import { getAccountById } from "./modules/calculator.js";
import { utils } from "./modules/utils.js";

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

async function initApp() {
  try {
    console.log("initApp: Starting initialization...");
    initDom();
    
    state.draft = createEmptyDraft();
    const hash = window.location.hash;

    // 1. 세션 복구 및 공유 데이터 로드
    const savedTmp = sessionStorage.getItem(TEMP_STORAGE_KEY);
    if (savedTmp && !hash) {
      try {
        const parsed = JSON.parse(savedTmp);
        if (parsed?.draft) {
          state.draft = parsed.draft; 
          state.currentPortfolioId = parsed.currentPortfolioId || "";
          state.activeAccountId = parsed.activeAccountId || ""; 
          state.dirty = true;
          console.log("initApp: Session restored.");
        }
      } catch (e) { console.warn("Session restore failed:", e); }
    } else if (hash) {
      try {
        const payload = IsfShare.decodePayloadFromHash(
          new URLSearchParams(hash.replace(/^#/, "")).get(HASH_STATE_PARAM), 
          SHARE_STATE_KEY
        );
        if (payload) { 
          const norm = normalizeLoadedPortfolio(payload); 
          state.draft = norm.draft; 
          state.currentPortfolioId = norm.id || ""; 
          console.log("initApp: Hash payload loaded.");
        }
      } catch (_e) { 
        console.error("Hash decode failed");
        IsfFeedback.showFeedback(dom.applyFeedback, "복원 실패", true); 
      }
    }
    
    // 2. 이벤트 바인딩
    bindEvents(); 
    
    // 3. UI 초기 렌더링
    renderDraft(); 
    if (state.dirty && dom.pendingBar) {
      IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
    }

    // 4. 비동기 데이터 로드 (에러가 나도 나머지는 작동하게)
    try {
      await checkReturningUser();
      await checkBridgeData();
      initializeBackupStore();
    } catch (e) {
      console.error("Async data initialization failed:", e);
    }
    
    // 5. PWA 관리자 시작
    try {
      const pwa = new IsfPwaManager({
        appVersion: "0.6.0", 
        appKey: SHARE_STATE_KEY,
        onFeedback: (msg) => IsfFeedback.showFeedback(dom.applyFeedback, msg),
        getCurrentData: () => state.draft,
      });
      pwa.init();
    } catch (e) {
      console.error("PWA initialization failed:", e);
    }
    
    console.log("initApp: Initialization finished.");
  } catch (err) {
    console.error("CRITICAL: initApp failed:", err);
  }
}

async function checkReturningUser() {
  const hub = getHubStorage();
  if (!hub) return;
  try {
    const rows = await hub.listStep2Portfolios();
    state.portfolios = rows || [];
    if (state.portfolios.length > 0 && !window.location.hash) {
      state.isReturningUser = true;
      state.isDashboardMode = true;
      document.body.classList.add("is-dashboard-mode");
    }
  } catch (e) { console.error(e); }
}

function bindModalEvents() {
  if (!dom.appHeader || !dom.dataHubModal) return;

  dom.appHeader.addEventListener("open-data-hub", async () => {
    await refreshPortfolioList();
    dom.dataHubModal.updatePortfolioList(state.portfolios);
    dom.dataHubModal.updateBackupList(state.backupEntries || []);
    dom.dataHubModal.open();
  });

  dom.dataHubModal.addEventListener("select-portfolio", async (e) => {
    await loadPortfolioById(e.detail.id);
    dom.dataHubModal.close();
  });

  dom.dataHubModal.addEventListener("delete-portfolio", async (e) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      await deletePortfolioById(e.detail.id);
      dom.dataHubModal.updatePortfolioList(state.portfolios);
    }
  });

  dom.dataHubModal.addEventListener("restore-backup", async (e) => {
    await restoreBackupById(e.detail.backupId);
    dom.dataHubModal.close();
  });

  dom.dataHubModal.addEventListener("backup-now", async () => {
    await handleManualBackup();
  });

  dom.dataHubModal.addEventListener("export-json", () => {
    IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, toPortablePortfolio()), "portfolio");
    if (dom.appHeader) dom.appHeader.updateStatus("success", "JSON 저장 완료");
  });

  dom.dataHubModal.addEventListener("copy-share-link", async () => {
    const enc = IsfShare.encodePayloadForHash(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, toPortablePortfolio()));
    const url = new URL(window.location.href);
    url.hash = `${HASH_STATE_PARAM}=${enc}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      if (dom.appHeader) dom.appHeader.updateStatus("success", "공유 링크 복사됨");
    } catch (e) {
      window.prompt("링크를 복사하세요:", url.toString());
    }
  });
}

function bindEvents() {
  bindModalEvents();
  
  if (dom.dismissBridgeBanner) {
    dom.dismissBridgeBanner.addEventListener("click", () => { 
      if (dom.bridgeBanner) dom.bridgeBanner.hidden = true; 
    });
  }
  
  if (dom.loadStep1Data) {
    dom.loadStep1Data.addEventListener("click", async () => { 
      if (state.dirty && !confirm("현재 수정한 내용을 덮어쓸까요?")) return; 
      try {
        await importLatestBridgeIntoDraft(); 
      } catch (e) {
        console.error(e);
        IsfFeedback.showFeedback(dom.applyFeedback, "데이터 가져오기 중 오류가 발생했습니다.", true);
      } finally {
        if (dom.bridgeBanner) dom.bridgeBanner.hidden = true; 
      }
    });
  }
  
  if (dom.chartTabSummary) {
    dom.chartTabSummary.addEventListener("click", () => { 
      state.activeChartTab = "summary"; 
      renderChartTabs(); 
      renderCharts(); 
    });
  }
  
  if (dom.chartTabFlow) {
    dom.chartTabFlow.addEventListener("click", () => { 
      state.activeChartTab = "flow"; 
      renderChartTabs(); 
      renderCharts(); 
    });
  }
  
  if (dom.totalMonthlyInvestCapacity) {
    dom.totalMonthlyInvestCapacity.addEventListener("input", () => { 
      state.draft.totalMonthlyInvestCapacity = utils.toWon(dom.totalMonthlyInvestCapacity.value); 
      markDirty(); 
      renderAccountSummary(); 
      renderCharts(); 
    });
  }
  
  if (dom.addAccount) {
    dom.addAccount.addEventListener("click", () => { 
      const acc = createDraftAccount({ name: `계좌 ${state.draft.accounts.length + 1}` }); 
      state.draft.accounts.push(acc); 
      state.activeAccountId = acc.id; 
      markDirty(); 
      renderDraft(); 
    });
  }
  
  if (dom.accountList) {
    dom.accountList.addEventListener("input", (e) => {
      const accRow = e.target.closest("[data-account-id]");
      const allocRow = e.target.closest("[data-allocation-id]");
      const acc = getAccountById(accRow?.dataset.accountId); 
      if (!acc) return;

      if (allocRow) {
        const al = acc.allocations.find(i => i.id === allocRow.dataset.allocationId); 
        if (!al) return;
        if (e.target.dataset.field === "label") al.label = e.target.value;
        if (e.target.dataset.field === "targetWeight") al.targetWeight = utils.sanitizeWeight(e.target.value);
        if (e.target.dataset.field === "actualAmount") al.actualAmount = utils.toWon(e.target.value);
      } else {
        if (e.target.dataset.field === "accountName") acc.name = e.target.value;
        if (e.target.dataset.field === "accountWeight") acc.accountWeight = utils.sanitizeWeight(e.target.value);
      }
      markDirty(); 
      renderAccountSummary(); 
      renderCharts();
    });
    
    dom.accountList.addEventListener("click", (e) => {
      const accRow = e.target.closest("[data-account-id]");
      const accId = accRow?.dataset.accountId;
      
      const selId = e.target.dataset.selectAccountId || e.target.closest(".account-row-head")?.dataset.selectAccountId;
      if (selId) { 
        state.activeAccountId = (state.activeAccountId === selId ? "" : selId); 
        renderAccountList(); 
        return; 
      }
      
      const rid = e.target.dataset.removeAccountId;
      if (rid && confirm("계좌를 삭제하시겠습니까?")) {
        state.draft.accounts = state.draft.accounts.filter(a => a.id !== rid);
        if (state.activeAccountId === rid) state.activeAccountId = "";
        markDirty(); 
        renderDraft();
        return;
      }

      const addAlId = e.target.dataset.addAllocationId;
      if (addAlId) {
        const acc = getAccountById(addAlId);
        if (acc) { 
          acc.allocations.push(createDraftAllocation({ label: `종목 ${acc.allocations.length + 1}` })); 
          markDirty(); 
          renderAccountList(); 
          renderCharts(); 
        }
        return;
      }

      const remAlId = e.target.dataset.removeAllocationId;
      if (remAlId) {
        const acc = getAccountById(accId);
        if (acc && confirm("종목을 삭제하시겠습니까?")) { 
          acc.allocations = acc.allocations.filter(a => a.id !== remAlId); 
          markDirty(); 
          renderAccountList(); 
          renderCharts(); 
        }
        return;
      }

      const tid = e.target.dataset.toggleImportant || e.target.closest(".btn-toggle-star")?.dataset.toggleImportant;
      if (tid) {
        const acc = getAccountById(accId);
        const al = acc?.allocations.find(i => i.id === tid);
        if (al) { 
          al.isImportant = !al.isImportant; 
          markDirty(); 
          renderAccountList(); 
          renderCharts(); 
        }
        return;
      }
    });
  }
  
  if (dom.savePortfolio) dom.savePortfolio.addEventListener("click", saveCurrentPortfolio);
  if (dom.applyChanges) dom.applyChanges.addEventListener("click", saveCurrentPortfolio);
  if (dom.cancelChanges) {
    dom.cancelChanges.addEventListener("click", async () => { 
      if (state.currentPortfolioId) await loadPortfolioById(state.currentPortfolioId, { skipConfirm: true }); 
      else resetDraft(); 
    });
  }

  // Simulation Events
  if (dom.toggleSimInputs) {
    dom.toggleSimInputs.addEventListener("click", () => {
      dom.simInputsContainer.hidden = !dom.simInputsContainer.hidden;
      dom.toggleSimInputs.textContent = dom.simInputsContainer.hidden ? "가정 설정" : "설정 닫기";
    });
  }

  if (dom.simYearsTabs) {
    dom.simYearsTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-years]");
      if (btn) {
        const y = parseInt(btn.dataset.years);
        if (state.draft.dividendSim) state.draft.dividendSim.years = y;
        Array.from(dom.simYearsTabs.querySelectorAll(".tab-btn")).forEach(t => t.classList.toggle("is-active", t === btn));
        renderDividendSimulation();
      }
    });
  }

  ["simDividendYield", "simDividendGrowth", "simCapitalGrowth", "simHorizonYears"].forEach(id => {
    const el = dom[id];
    if (el) {
      el.addEventListener("input", () => {
        if (!state.draft.dividendSim) state.draft.dividendSim = {};
        const val = parseFloat(el.value);
        if (id === "simDividendYield") state.draft.dividendSim.yield = val;
        if (id === "simDividendGrowth") state.draft.dividendSim.growth = val;
        if (id === "simCapitalGrowth") state.draft.dividendSim.capitalGrowth = val;
        if (id === "simHorizonYears") state.draft.dividendSim.years = val;
        markDirty();
        renderDividendSimulation();
      });
    }
  });

  if (dom.simDrip) {
    dom.simDrip.addEventListener("change", () => {
      if (!state.draft.dividendSim) state.draft.dividendSim = {};
      state.draft.dividendSim.isDrip = dom.simDrip.checked;
      markDirty();
      renderDividendSimulation();
    });
  }
}

function initializeBackupStore() {
  if (!IsfBackupManager.isIndexedDbAvailable()) return;
  IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY).then(entries => {
    state.backupStoreReady = true;
    if (entries) { 
      state.backupEntries = entries; 
      syncBackupUi(); 
    }
  }).catch(() => { state.backupStoreReady = true; });
}
