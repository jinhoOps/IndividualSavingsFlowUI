import { IsfUtils } from "../../../shared/core/utils.js";

import { SHARE_STATE_KEY, STORAGE_KEY } from "./constants.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { initOnboarding } from "./onboarding-manager.js";
import { initializeSnapshotSelector } from "./feature-controllers.js";
import {
  syncViewModeUi,
  syncViewModeGuideUi,
  syncBackupUi,
  syncSankeyValueModeUi,
  syncSankeySortModeUi,
  syncSankeyGroupingUi,
  syncItemSortModeUi,
  syncMobileInputsPanelVisibility,
  syncAdvancedTabBlockVisibility,
  setActiveAdvancedTab,
  refreshInputsPanel,
  syncGroupOptionsAll,
} from "./ui-controller.js";
import {
  activateMgmtTab,
  bindStep1Events,
  initMgmtTabs,
} from "./event-bindings.js";
import { createPersistenceController } from "./persistence-controller.js";
import { createRenderOrchestrator } from "./render-orchestrator.js";
import { createVisualizationController } from "./visualization-controller.js";
import { createItemEditorController } from "./item-editor-controller.js";

export function startStep1App() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

function init() {
  const controllers = createControllers();

  checkReturningUser();
  bindStep1Events(controllers);
  syncInitialUi();
  initMgmtTabs();
  refreshInputsPanel(state.inputs);
  syncGroupOptionsAll();
  controllers.persistence.setPendingBarVisible(false);
  controllers.render.renderAll();
  controllers.persistence.initializeBackupStore();
  void controllers.persistence.initializeInputsFromShareId();
  void initializeSnapshotSelector();
  initializePwa();
  initializeViewModeFeedback();
  initializeOnboarding();
  initScrollHintBanners();
}

function createControllers() {
  const render = createRenderOrchestrator();
  const persistence = createPersistenceController({
    renderAll: () => render.renderAll(),
  });
  const visualization = createVisualizationController({
    markPendingChanges: () => persistence.markPendingChanges(),
  });
  const itemEditor = createItemEditorController({
    markPendingChanges: () => persistence.markPendingChanges(),
    getVisibleInputs: () => render.getVisibleInputs(),
    activateMgmtTab,
  });

  return {
    render,
    persistence,
    visualization,
    itemEditor,
  };
}

function syncInitialUi() {
  syncViewModeUi();
  syncViewModeGuideUi();
  syncBackupUi();
  syncSankeyValueModeUi();
  syncSankeySortModeUi();
  syncSankeyGroupingUi();
  syncItemSortModeUi();
  syncMobileInputsPanelVisibility();
  setActiveAdvancedTab(state.activeAdvancedTab);
  syncAdvancedTabBlockVisibility();
}

function checkReturningUser() {
  if (state.isViewMode || hasShareState()) return;
  const persisted = window.IsfStorageHub.loadLocal(STORAGE_KEY);
  if (persisted) {
    state.isDashboardMode = true;
    document.body.classList.add("is-dashboard-mode");
    state.mobileInputsCollapsed = true;
    syncMobileInputsPanelVisibility();
  }
}

function hasShareState() {
  return !!window.IsfShare.getShareIdFromUrl();
}

function initializePwa() {
  const pwaManager = new window.IsfPwaManager({
    appVersion: IsfUtils.APP_VERSION,
    appKey: SHARE_STATE_KEY,
    onFeedback: (message) => window.IsfFeedback.showFeedback(dom.applyFeedback, message),
    isViewMode: () => state.isViewMode,
    swPath: "../../sw.js",
    manifestPath: "../../manifest.webmanifest",
    versionCheckTriggerElement: dom.checkLatestVersion,
    getCurrentData: () => state.inputs,
  });
  pwaManager.init();
}

function initializeViewModeFeedback() {
  if (state.isViewMode) {
    window.IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드로 열었습니다. 로컬 저장값은 변경되지 않습니다.");
  }
}

function initializeOnboarding() {
  const onboardingManager = initOnboarding(state.isViewMode);
  if (!onboardingManager) return;
  window.addEventListener("request-onboarding", () => {
    onboardingManager.reset();
    onboardingManager.start();
  });
}

function initScrollHintBanners() {
  const banners = document.querySelectorAll(".scroll-hint-banner");
  banners.forEach((banner) => {
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "scroll-hint-close";
    closeButton.innerHTML = "&times;";
    closeButton.setAttribute("aria-label", "스크롤 알림 닫기");
    closeButton.style.cssText = "background:none; border:none; font-size:1.1rem; font-weight:bold; color:var(--muted); cursor:pointer; padding:0 4px; margin-left:8px; line-height:1; vertical-align:middle;";
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      banner.style.transition = "opacity 0.4s ease, margin-bottom 0.4s ease, padding 0.4s ease, height 0.4s ease";
      banner.style.opacity = "0";
      setTimeout(() => {
        banner.style.display = "none";
      }, 400);
    });
    banner.appendChild(closeButton);

    const container = banner.parentElement;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollLeft <= 10) return;
      banner.style.transition = "opacity 0.5s ease";
      banner.style.opacity = "0";
      container.removeEventListener("scroll", handleScroll);
      setTimeout(() => {
        banner.style.display = "none";
      }, 500);
    };
    container.addEventListener("scroll", handleScroll);
  });
}
