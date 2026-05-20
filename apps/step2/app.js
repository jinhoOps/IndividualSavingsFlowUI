

import { state, createEmptyDraft, markDirty, getHubStorage } from "./modules/state.js";
import { dom, initDom } from "./modules/dom.js";
import { 
  SHARE_STATE_KEY, 
  LEGACY_SHARE_STATE_KEY,
  HASH_STATE_PARAM, 
  TEMP_STORAGE_KEY 
} from "./modules/constants.js";
import { 
  initGlobalTooltips
} from "./modules/renderers.js";
import { checkStep1SyncData } from "./modules/step1-connector.js";
import { featureController } from "./modules/feature-controllers.js";
import { uiController } from "./modules/ui-controller.js";

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
        const payload = window.IsfShare.decodePayloadFromHash(
          new URLSearchParams(hash.replace(/^#/, "")).get(HASH_STATE_PARAM), 
          SHARE_STATE_KEY
        );
        if (payload) { 
          const norm = featureController.normalize(payload); 
          state.draft = norm.draft; 
          state.currentSimulationId = norm.id || ""; 
          console.log("initApp: Hash payload loaded.");
        }
      } catch (_e) { 
        console.error("Hash decode failed");
        window.IsfFeedback.showFeedback(dom.applyFeedback, "복원 실패", true); 
      }
    }
    
    uiController.init();
    uiController.updateAll(); 

    try {
      await checkReturningUser();
      await checkStep1SyncData();
      initializeBackupStore();
    } catch (e) {
      console.error("Async data initialization failed:", e);
    }
    
    try {
      const pwaManager = new window.IsfPwaManager({
        appVersion: window.IsfUtils.APP_VERSION,
        appKey: SHARE_STATE_KEY,
        onFeedback: (msg) => window.IsfFeedback.showFeedback(dom.applyFeedback, msg),
        getCurrentData: () => state.draft,
      });
      pwaManager.init();
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

async function initializeBackupStore() {
  if (!window.IsfBackupManager.isIndexedDbAvailable()) return;
  try {
    const hub = getHubStorage();
    if (hub && hub.ensureMigration) {
      await hub.ensureMigration(LEGACY_SHARE_STATE_KEY, SHARE_STATE_KEY);
    }
    
    const entries = await window.IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY);
    state.backupStoreReady = true;
    if (entries) {
      state.backupEntries = entries;
      featureController.syncBackupUi();
    }
  } catch (e) {
    console.error("initializeBackupStore failed:", e);
    state.backupStoreReady = true;
  }
}

