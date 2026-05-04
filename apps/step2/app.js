

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
  renderDividendSimulation,
  initGlobalTooltips
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
    

    bindEvents(); 
    

    renderDraft(); 


    try {
      await checkReturningUser();
      await checkStep1SyncData();
      initializeBackupStore();
    } catch (e) {
      console.error("Async data initialization failed:", e);
    }
    

    try {
      const pwa = new IsfPwaManager({
        appVersion: "0.8.0",
        appKey: SHARE_STATE_KEY,
        onFeedback: (msg) => IsfFeedback.showFeedback(dom.applyFeedback, msg),
        getCurrentData: () => state.draft,
      });
      pwa.init();
    } catch (e) {
      console.error("PWA initialization failed:", e);
    }    
    initGlobalTooltips();
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
      if (confirm("Step 1의 최신 데이터로 다시 연동할까요?")) {
        try {
          await importLatestStep1Data(); 
          state.isSyncedWithStep1 = true;
        } catch (e) {
          console.error(e);
          window.IsfFeedback.showFeedback(dom.applyFeedback, "데이터 가져오기 중 오류가 발생했습니다.", true);
        }
      }
    });
  }
  
  if (dom.totalMonthlyInvestCapacity) {
    let previousValue = dom.totalMonthlyInvestCapacity.value;

    dom.totalMonthlyInvestCapacity.addEventListener("focus", () => {
      previousValue = dom.totalMonthlyInvestCapacity.value;
    });

    dom.totalMonthlyInvestCapacity.addEventListener("input", () => { 
      if (state.isSyncedWithStep1) {
        if (confirm("Step 1에서 연동된 값을 직접 수정하시겠습니까?\n수정 시 자동 동기화 상태가 해제됩니다.")) {
          state.isSyncedWithStep1 = false;
          if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
        } else {
          dom.totalMonthlyInvestCapacity.value = previousValue;
          return;
        }
      }

      state.draft.totalMonthlyInvestCapacity = utils.toWon(dom.totalMonthlyInvestCapacity.value); 
      markDirty(); 
      renderCharts(); 
    });
  }


  const PRESET_ASSETS = {
    SCHD: { yield: 3.5, growth: 10.0, capital: 5.0 },
    QQQI: { yield: 10.5, growth: 0.0, capital: 9.0 },
    JEPI: { yield: 8.0, growth: 1.0, capital: 3.0 }
  };

  const PRESET_COMBINATIONS = {
    "schd": [
      { label: "단일 100%", ratios: { SCHD: 1.0 } }
    ],
    "schd_qqqi": [
      { label: "7:3", ratios: { SCHD: 0.7, QQQI: 0.3 } },
      { label: "1:1", ratios: { SCHD: 0.5, QQQI: 0.5 } },
      { label: "3:7", ratios: { SCHD: 0.3, QQQI: 0.7 } }
    ],
    "schd_jepi": [
      { label: "7:3", ratios: { SCHD: 0.7, JEPI: 0.3 } },
      { label: "1:1", ratios: { SCHD: 0.5, JEPI: 0.5 } },
      { label: "3:7", ratios: { SCHD: 0.3, JEPI: 0.7 } }
    ],
    "jepi_qqqi": [
      { label: "7:3", ratios: { JEPI: 0.7, QQQI: 0.3 } },
      { label: "1:1", ratios: { JEPI: 0.5, QQQI: 0.5 } },
      { label: "3:7", ratios: { JEPI: 0.3, QQQI: 0.7 } }
    ],
    "all_weather": [
      { label: "4:3:3", ratios: { SCHD: 0.4, JEPI: 0.3, QQQI: 0.3 } }
    ]
  };

  document.querySelectorAll(".preset-cat-btn").forEach(catBtn => {
    catBtn.addEventListener("click", () => {
      document.querySelectorAll(".preset-cat-btn").forEach(b => b.classList.remove("is-active"));
      catBtn.classList.add("is-active");
      
      const cat = catBtn.dataset.cat;
      const subs = PRESET_COMBINATIONS[cat] || [];
      const subContainer = document.getElementById("presetSubContainer");
      if (subContainer) {
        subContainer.innerHTML = subs.map((sub, i) => 
          `<button class="btn btn-outline btn-sm preset-sub-btn" data-index="${i}">${sub.label}</button>`
        ).join("");
        
        subContainer.querySelectorAll(".preset-sub-btn").forEach(subBtn => {
          subBtn.addEventListener("click", () => {
            subContainer.querySelectorAll(".preset-sub-btn").forEach(b => b.classList.remove("is-active"));
            subBtn.classList.add("is-active");
            
            const subData = subs[subBtn.dataset.index];
            let y = 0, g = 0, c = 0;
            for (const [asset, ratio] of Object.entries(subData.ratios)) {
               y += PRESET_ASSETS[asset].yield * ratio;
               g += PRESET_ASSETS[asset].growth * ratio;
               c += PRESET_ASSETS[asset].capital * ratio;
            }
            // Round to 1 decimal place
            y = Math.round(y * 10) / 10;
            g = Math.round(g * 10) / 10;
            c = Math.round(c * 10) / 10;
            
            if (!state.draft.dividendSim) state.draft.dividendSim = {};
            state.draft.dividendSim.yield = y;
            state.draft.dividendSim.growth = g;
            state.draft.dividendSim.capitalGrowth = c;
            
            if (dom.simDividendYield) dom.simDividendYield.value = y;
            if (dom.simDividendGrowth) dom.simDividendGrowth.value = g;
            if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = c;
            
            markDirty();
            renderDividendSimulation();
          });
        });
        
        if (subContainer.firstChild) {
          subContainer.firstChild.click();
        }
      }
    });
  });
  

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

    const hub = getHubStorage();
    if (hub && hub.ensureMigration) {
      await hub.ensureMigration(LEGACY_SHARE_STATE_KEY, SHARE_STATE_KEY);
    }
    

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

oreReady = true;
  }
}

    console.error("initializeBackupStore failed:", e);
    state.backupStoreReady = true;
  }
}

