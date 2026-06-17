
import { state, markDirty } from "./state.js";
import { dom } from "./dom.js";
import { utils } from "./utils.js";
import { 
  renderDividendSimulation,
  renderDraft
} from "./renderers.js";
import { featureController } from "./feature-controllers.js";
import { importLatestStep1Data } from "./step1-connector.js";
import { getStrategyAssumptions } from "./assumptions.js";
import { 
  SHARE_STATE_KEY, 
  SHARE_STATE_SCHEMA 
} from "./constants.js";

/**
 * Step 2 UI Controller
 * Manages event bindings and high-level UI orchestration.
 */
export const uiController = {
  init() {
    this.bindEvents();
    this.bindModalEvents();
  },

  /**
   * Performs a full UI update based on the current state.
   */
  updateAll() {
    renderDraft();
  },

  /**
   * Triggers chart and table re-rendering.
   */
  renderCharts() {
    renderDividendSimulation();
  },

  bindEvents() {
    // Sync Banner
    if (dom.dismissSyncBanner) {
      dom.dismissSyncBanner.addEventListener("click", () => { 
        if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true; 
      });
    }
    
    // Main Import
    if (dom.importStep1Data) {
      dom.importStep1Data.addEventListener("click", async () => {
        if (dom.importStep1Data.textContent === "Main으로 이동") {
          window.location.href = "../main/index.html";
          return;
        }

        if (confirm("Main의 최신 데이터로 다시 연동할까요?")) {
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

    // Input Listeners
    this.bindInputListeners();
    this.bindSimulationSettings();
    this.bindDisplayOptions();
    this.bindStrategyControls();
  },

  bindInputListeners() {
    const handleSyncOverride = (el, previousValue, callback) => {
      if (state.isSyncedWithStep1) {
        if (confirm("Main에서 연동된 값을 직접 수정하시겠습니까?\n수정 시 자동 동기화 상태가 해제됩니다.")) {
          state.isSyncedWithStep1 = false;
          if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
        } else {
          el.value = previousValue;
          return false;
        }
      }
      callback();
      return true;
    };

    if (dom.totalMonthlyInvestCapacity) {
      let prev = dom.totalMonthlyInvestCapacity.value;
      dom.totalMonthlyInvestCapacity.addEventListener("focus", () => prev = dom.totalMonthlyInvestCapacity.value);
      dom.totalMonthlyInvestCapacity.addEventListener("input", () => {
        handleSyncOverride(dom.totalMonthlyInvestCapacity, prev, () => {
          state.draft.totalMonthlyInvestCapacity = utils.toWon(dom.totalMonthlyInvestCapacity.value); 
          markDirty(); 
          this.renderCharts();
        });
      });
    }

    if (dom.totalInitialAsset) {
      let prev = dom.totalInitialAsset.value;
      dom.totalInitialAsset.addEventListener("focus", () => prev = dom.totalInitialAsset.value);
      dom.totalInitialAsset.addEventListener("input", () => {
        handleSyncOverride(dom.totalInitialAsset, prev, () => {
          state.draft.totalInitialAsset = utils.toWon(dom.totalInitialAsset.value);
          markDirty();
          this.renderCharts();
        });
      });
    }
  },

  bindSimulationSettings() {
    if (dom.saveStep2Simulation) {
      dom.saveStep2Simulation.addEventListener("click", async () => {
        await featureController.saveCurrent();
      });
    }

    if (dom.simYearsTabs) {
      dom.simYearsTabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-years]");
        if (btn) {
          const y = parseInt(btn.dataset.years);
          if (state.draft.dividendSim) state.draft.dividendSim.years = y;
          Array.from(dom.simYearsTabs.querySelectorAll(".tab-btn")).forEach(t => {
            const active = t === btn;
            t.classList.toggle("is-active", active);
            t.setAttribute("aria-selected", active ? "true" : "false");
          });
          if (dom.simHorizonYears) dom.simHorizonYears.value = y;
          markDirty();
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
          
          state.draft.dividendSim.presetName = "";
          markDirty();
          this.updateAll();
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
  },

  bindDisplayOptions() {
    ["optShowAsset", "optShowDividend", "optShowPR", "optShowTR"].forEach(id => {
      if (dom[id]) {
        dom[id].addEventListener("change", () => {
          state.displayOptions[id.replace("optShow", "show").charAt(0).toLowerCase() + id.replace("optShow", "show").slice(1)] = dom[id].checked;
          renderDividendSimulation();
        });
      }
    });
  },

  bindStrategyControls() {
    if (dom.strategyCardGroup) {
      dom.strategyCardGroup.addEventListener("click", (e) => {
        const card = e.target.closest("[data-strategy-card]");
        if (!card) return;
        this.applyStrategySelection(card.dataset.strategyCard);
      });
    }

    if (dom.benchmarkSelect) {
      dom.benchmarkSelect.addEventListener("change", () => {
        if (!state.draft.dividendSim) state.draft.dividendSim = {};
        state.draft.dividendSim.selectedBenchmark = dom.benchmarkSelect.value;
        if (state.draft.dividendSim.strategyKey === "indexGrowth") {
          this.applyStrategySelection("indexGrowth", { mark: false });
        } else {
          this.updateAssumptionNote();
        }
        markDirty();
        this.updateAll();
      });
    }

    if (dom.coveredCallSelect) {
      dom.coveredCallSelect.addEventListener("change", () => {
        if (!state.draft.dividendSim) state.draft.dividendSim = {};
        state.draft.dividendSim.coveredCallExample = dom.coveredCallSelect.value;
        if (state.draft.dividendSim.strategyKey === "coveredCallMonthlyIncome") {
          this.applyStrategySelection("coveredCallMonthlyIncome", { mark: false });
        } else {
          this.updateAssumptionNote();
        }
        markDirty();
        this.updateAll();
      });
    }
  },

  applyStrategySelection(strategyKey, options = {}) {
    if (!state.draft.dividendSim) state.draft.dividendSim = {};
    const sim = state.draft.dividendSim;
    const assumptions = getStrategyAssumptions({
      selectedBenchmark: sim.selectedBenchmark,
      coveredCallExample: sim.coveredCallExample,
    });

    const selected = strategyKey === "indexGrowth"
      ? assumptions.benchmark
      : strategyKey === "coveredCallMonthlyIncome"
        ? assumptions.coveredCall
        : assumptions.dividendGrowth;
    const defaults = selected.defaults || {};

    sim.strategyKey = strategyKey;
    sim.strategyName = selected.label;
    sim.presetName = selected.fullName || selected.label;
    sim.yield = defaults.dividendYield ?? defaults.cashFlowYield ?? sim.yield;
    sim.growth = defaults.dividendGrowth ?? defaults.distributionGrowth ?? sim.growth;
    sim.capitalGrowth = defaults.capitalGrowth ?? sim.capitalGrowth;
    sim.isDrip = defaults.isDrip !== false;

    this.syncStrategyControlState();
    if (options.mark !== false) markDirty();
    this.updateAll();
  },

  syncStrategyControlState() {
    const sim = state.draft?.dividendSim || {};
    if (dom.strategyCardGroup) {
      dom.strategyCardGroup.querySelectorAll("[data-strategy-card]").forEach((card) => {
        const active = card.dataset.strategyCard === (sim.strategyKey || "dividendGrowth");
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-checked", active ? "true" : "false");
      });
    }
    if (dom.benchmarkSelect) dom.benchmarkSelect.value = sim.selectedBenchmark || "nasdaq";
    if (dom.coveredCallSelect) dom.coveredCallSelect.value = sim.coveredCallExample || "jepi";
    this.updateAssumptionNote();
  },

  updateAssumptionNote() {
    if (!dom.assumptionRangeNote) return;
    const sim = state.draft?.dividendSim || {};
    const assumptions = getStrategyAssumptions({
      selectedBenchmark: sim.selectedBenchmark,
      coveredCallExample: sim.coveredCallExample,
    });
    const active = sim.strategyKey === "indexGrowth"
      ? assumptions.benchmark
      : sim.strategyKey === "coveredCallMonthlyIncome"
        ? assumptions.coveredCall
        : assumptions.dividendGrowth;
    const ranges = active.displayRanges || {};
    dom.assumptionRangeNote.textContent = `${active.label} 예시 범위: 현금흐름 ${ranges.cashFlowYield || ranges.dividendYield}, 성장 ${ranges.dividendGrowth || ranges.distributionGrowth}, 주가 ${ranges.capitalGrowth}. ${assumptions.copy.disclaimer}`;
  },

  bindModalEvents() {
    if (!dom.appHeader || !dom.dataHubModal) return;

    dom.appHeader.addEventListener("open-data-hub", async () => {
      await featureController.refreshList();
      dom.dataHubModal.updateSimulationList(state.simulations);
      dom.dataHubModal.updateBackupList(state.backupEntries || []);
      dom.dataHubModal.open();
    });

    dom.dataHubModal.addEventListener("select-simulation", async (e) => {
      await featureController.loadById(e.detail.id);
      dom.dataHubModal.close();
    });

    dom.dataHubModal.addEventListener("delete-simulation", async (e) => {
      if (confirm("정말 삭제하시겠습니까?")) {
        await featureController.deleteById(e.detail.id);
        dom.dataHubModal.updateSimulationList(state.simulations);
      }
    });

    dom.dataHubModal.addEventListener("restore-backup", async (e) => {
      await featureController.restoreBackupById(e.detail.backupId);
      dom.dataHubModal.close();
    });

    dom.dataHubModal.addEventListener("backup-now", async () => {
      await featureController.handleManualBackup();
    });

    dom.dataHubModal.addEventListener("generate-isf-code", async () => {
      const code = window.IsfShare.encodePayloadForHash(
        window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, featureController.toPortableFormat())
      );
      if (code) {
        dom.dataHubModal.showGeneratedCode(code);
        if (dom.appHeader) dom.appHeader.updateStatus("success", "ISF CODE 복사됨");
        window.IsfFeedback.showFeedback(dom.applyFeedback, "ISF CODE가 발급 및 복사되었습니다.");
      }
    });

    dom.dataHubModal.addEventListener("apply-isf-code", async (e) => {
      try {
        const decoded = window.IsfShare.decodePayloadFromHash(e.detail.code, SHARE_STATE_KEY);
        if (decoded) {
          const norm = featureController.normalize(decoded);
          state.draft = norm.draft;
          state.currentSimulationId = norm.id || "";
          this.updateAll();
          markDirty();
          dom.dataHubModal.close();
          if (dom.appHeader) dom.appHeader.updateStatus("success", "코드 적용 성공");
          window.IsfFeedback.showFeedback(dom.applyFeedback, "코드가 성공적으로 적용되었습니다.");
        } else {
          throw new Error("invalid-code");
        }
      } catch (_e) {
        if (dom.appHeader) dom.appHeader.updateStatus("error", "유효하지 않은 코드");
        window.IsfFeedback.showFeedback(dom.applyFeedback, "유효하지 않은 코드입니다.", true);
      }
    });

    dom.dataHubModal.addEventListener("export-json", () => {
      window.IsfShare.exportAsJson(window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, featureController.toPortableFormat()), "dividend-simulation");
      if (dom.appHeader) dom.appHeader.updateStatus("success", "JSON 저장 완료");
    });

    dom.dataHubModal.addEventListener("import-json", async (e) => {
      try {
        const imported = window.IsfShare.parseImportedJson(await e.detail.file.text(), SHARE_STATE_KEY);
        const norm = featureController.normalize(imported);
        state.draft = norm.draft;
        state.currentSimulationId = norm.id || "";
        this.updateAll();
        markDirty();
        if (dom.appHeader) dom.appHeader.updateStatus("success", "데이터 가져오기 성공");
        dom.dataHubModal.close();
      } catch (_e) {
        if (dom.appHeader) dom.appHeader.updateStatus("error", "JSON 형식 오류");
      }
    });
  }
};
