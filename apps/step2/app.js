/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.1
 * 
 * 파일 역할: Step 2 애플리케이션의 엔트리 포인트 및 전체 배당 시뮬레이션 흐름 제어
 */

import { state, createEmptyDraft, markDirty, markClean, getHubStorage } from "./modules/state.js";
import { dom, initDom } from "./modules/dom.js";
import { 
  SHARE_STATE_KEY, 
  LEGACY_SHARE_STATE_KEY,
  SHARE_STATE_SCHEMA, 
  HASH_STATE_PARAM, 
  TEMP_STORAGE_KEY 
} from "./modules/constants.js";
import { 
  renderDraft, 
  renderCharts, 
  renderDividendSimulation
} from "./modules/renderers.js";
import { checkStep1SyncData, importLatestStep1Data } from "./modules/step1-connector.js";
import { 
  saveCurrentSimulation, 
  loadSimulationById, 
  deleteSimulationById, 
  refreshSimulationList, 
  handleManualBackup, 
  restoreBackupById, 
  normalizeLoadedSimulation,
  toPortableSimulation,
  syncBackupUi
} from "./modules/storage-handler.js";
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
          state.currentSimulationId = parsed.currentSimulationId || "";
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
          const norm = normalizeLoadedSimulation(payload); 
          state.draft = norm.draft; 
          state.currentSimulationId = norm.id || ""; 
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

    // 4. 비동기 데이터 로드 (에러가 나도 나머지는 작동하게)
    try {
      await checkReturningUser();
      await checkStep1SyncData();
      initializeBackupStore();
    } catch (e) {
      console.error("Async data initialization failed:", e);
    }
    
    // 5. PWA 관리자 시작
    try {
      const pwa = new IsfPwaManager({
        appVersion: "0.7.0", 
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
    const rows = await hub.listStep2Entries();
    state.simulations = rows || [];
    if (state.simulations.length > 0 && !window.location.hash) {
      state.isReturningUser = true;
      state.isDashboardMode = true;
      document.body.classList.add("is-dashboard-mode");
    }
  } catch (e) { console.error(e); }
}

function bindModalEvents() {
  if (!dom.appHeader || !dom.dataHubModal) return;

  dom.appHeader.addEventListener("open-data-hub", async () => {
    await refreshSimulationList();
    dom.dataHubModal.updateSimulationList(state.simulations);
    dom.dataHubModal.updateBackupList(state.backupEntries || []);
    dom.dataHubModal.open();
  });

  dom.dataHubModal.addEventListener("select-simulation", async (e) => {
    await loadSimulationById(e.detail.id);
    dom.dataHubModal.close();
  });

  dom.dataHubModal.addEventListener("delete-simulation", async (e) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      await deleteSimulationById(e.detail.id);
      dom.dataHubModal.updateSimulationList(state.simulations);
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
    IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, toPortableSimulation()), "dividend-simulation");
    if (dom.appHeader) dom.appHeader.updateStatus("success", "JSON 저장 완료");
  });

  dom.dataHubModal.addEventListener("copy-share-link", async () => {
    const enc = IsfShare.encodePayloadForHash(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, toPortableSimulation()));
    const url = new URL(window.location.href);
    url.hash = `${HASH_STATE_PARAM}=${enc}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      if (dom.appHeader) dom.appHeader.updateStatus("success", "공유 링크 복사됨");
    } catch (e) {
      window.prompt("링크를 복사하세요:", url.toString());
    }
  });

  dom.dataHubModal.addEventListener("import-json", async (e) => {
    try {
      const imported = IsfShare.parseImportedJson(await e.detail.file.text(), SHARE_STATE_KEY);
      const norm = normalizeLoadedSimulation(imported);
      state.draft = norm.draft;
      state.currentSimulationId = norm.id || "";
      renderDraft();
      markDirty();
      if (dom.appHeader) dom.appHeader.updateStatus("success", "데이터 가져오기 성공");
    } catch (_e) {
      if (dom.appHeader) dom.appHeader.updateStatus("error", "JSON 형식 오류");
    }
  });
}

function bindEvents() {
  bindModalEvents();
  
  if (dom.dismissSyncBanner) {
    dom.dismissSyncBanner.addEventListener("click", () => { 
      if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true; 
    });
  }
  
  if (dom.importStep1Data) {
    dom.importStep1Data.addEventListener("click", async () => { 
      if (state.dirty && !confirm("현재 수정한 내용을 덮어쓸까요?")) return; 
      try {
        await importLatestStep1Data(); 
      } catch (e) {
        console.error(e);
        IsfFeedback.showFeedback(dom.applyFeedback, "데이터 가져오기 중 오류가 발생했습니다.", true);
      } finally {
        if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true; 
      }
    });
  }
  
  if (dom.totalMonthlyInvestCapacity) {
    dom.totalMonthlyInvestCapacity.addEventListener("input", () => { 
      state.draft.totalMonthlyInvestCapacity = utils.toWon(dom.totalMonthlyInvestCapacity.value); 
      markDirty(); 
      renderCharts(); 
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

async function initializeBackupStore() {
  if (!IsfBackupManager.isIndexedDbAvailable()) return;
  try {
    // 1. Ensure Migration from Legacy Key (Rebranding)
    const hub = getHubStorage();
    if (hub && hub.ensureMigration) {
      await hub.ensureMigration(LEGACY_SHARE_STATE_KEY, SHARE_STATE_KEY);
    }
    
    // 2. Load Entries
    const entries = await IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY);
    state.backupStoreReady = true;
    if (entries) {
      state.backupEntries = entries;
      syncBackupUi();
    }
  } catch (e) {
    console.error("initializeBackupStore failed:", e);
    state.backupStoreReady = true;
  }
}
