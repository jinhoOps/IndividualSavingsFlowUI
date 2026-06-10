
import { state, markDirty } from "./state.js";
import { dom } from "./dom.js";
import { utils } from "./utils.js";
import { 
  renderDividendSimulation,
  renderDraft
} from "./renderers.js";
import { featureController } from "./feature-controllers.js";
import { importLatestStep1Data } from "./step1-connector.js";
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
    
    // Step 1 Import
    if (dom.importStep1Data) {
      dom.importStep1Data.addEventListener("click", async () => {
        if (dom.importStep1Data.textContent === "Step 1로 이동") {
          window.location.href = "../step1/index.html";
          return;
        }

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

    // Input Listeners
    this.bindInputListeners();
    this.bindSimulationSettings();
    this.bindDisplayOptions();
    this.bindPresets();
  },

  bindInputListeners() {
    const handleSyncOverride = (el, previousValue, callback) => {
      if (state.isSyncedWithStep1) {
        if (confirm("Step 1에서 연동된 값을 직접 수정하시겠습니까?\n수정 시 자동 동기화 상태가 해제됩니다.")) {
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

  bindPresets() {
    const PRESET_ASSETS = {
      SCHD: { yield: 3.5, growth: 10.0, capital: 5.0 },
      QQQI: { yield: 10.5, growth: 0.0, capital: 9.0 },
      JEPI: { yield: 8.0, growth: 1.0, capital: 3.0 },
      QLD: { yield: 0.4, growth: 0.0, capital: 18.0 },
      TQQQ: { yield: 0.2, growth: 0.0, capital: 23.0 },
      QQQM: { yield: 0.6, growth: 10.0, capital: 11.0 },
      VOO: { yield: 1.3, growth: 7.0, capital: 8.0 },
      SGOV: { yield: 4.5, growth: 0.0, capital: 0.0 }
    };

    const PRESET_COMBINATIONS = {
      "schd": [{ label: "단일 100%", ratios: { SCHD: 1.0 }, fullName: "배당 성장 집중형 (SCHD 100%)" }],
      "schd_qqqi": [
        { label: "7:3", ratios: { SCHD: 0.7, QQQI: 0.3 }, fullName: "밸런스 표준형 (SCHD+QQQI) 7:3" },
        { label: "1:1", ratios: { SCHD: 0.5, QQQI: 0.5 }, fullName: "밸런스 표준형 (SCHD+QQQI) 1:1" },
        { label: "3:7", ratios: { SCHD: 0.3, QQQI: 0.7 }, fullName: "밸런스 표준형 (SCHD+QQQI) 3:7" }
      ],
      "schd_jepi": [
        { label: "7:3", ratios: { SCHD: 0.7, JEPI: 0.3 }, fullName: "안정적 고배당형 (SCHD+JEPI) 7:3" },
        { label: "1:1", ratios: { SCHD: 0.5, JEPI: 0.5 }, fullName: "안정적 고배당형 (SCHD+JEPI) 1:1" },
        { label: "3:7", ratios: { SCHD: 0.3, JEPI: 0.7 }, fullName: "안정적 고배당형 (SCHD+JEPI) 3:7" }
      ],
      "jepi_qqqi": [
        { label: "7:3", ratios: { JEPI: 0.7, QQQI: 0.3 }, fullName: "월배당 극대화형 (JEPI+QQQI) 7:3" },
        { label: "1:1", ratios: { JEPI: 0.5, QQQI: 0.5 }, fullName: "월배당 극대화형 (JEPI+QQQI) 1:1" },
        { label: "3:7", ratios: { JEPI: 0.3, QQQI: 0.7 }, fullName: "월배당 극대화형 (JEPI+QQQI) 3:7" }
      ],
      "all_weather": [{ label: "4:3:3", ratios: { SCHD: 0.4, JEPI: 0.3, QQQI: 0.3 }, fullName: "올웨더 배당형 (SCHD+JEPI+QQQI) 4:3:3" }],
      "aggressive_leverage": [
        { label: "1안 (레버리지+CC)", ratios: { QLD: 0.5, TQQQ: 0.1, QQQI: 0.4 }, fullName: "적극형 1안: QLD 50% / TQQQ 10% / QQQI 40%" },
        { label: "2안 (나스닥 알파)", ratios: { QQQM: 0.7, QLD: 0.3 }, fullName: "적극형 2안: QQQM 70% / QLD 30%" },
        { label: "3안 (지수+레버리지)", ratios: { VOO: 0.5, QLD: 0.5 }, fullName: "적극형 3안: VOO 50% / QLD 50%" },
        { label: "4안 (바벨 전략)", ratios: { QLD: 0.5, SGOV: 0.5 }, fullName: "적극형 4안: QLD 50% / SGOV 50%" }
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
              y = Math.round(y * 10) / 10;
              g = Math.round(g * 10) / 10;
              c = Math.round(c * 10) / 10;
              
              if (!state.draft.dividendSim) state.draft.dividendSim = {};
              state.draft.dividendSim.yield = y;
              state.draft.dividendSim.growth = g;
              state.draft.dividendSim.capitalGrowth = c;
              state.draft.dividendSim.presetName = subData.fullName;
              
              if (dom.simDividendYield) dom.simDividendYield.value = y;
              if (dom.simDividendGrowth) dom.simDividendGrowth.value = g;
              if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = c;
              
              markDirty();
              this.updateAll();
            });
          });
          if (subContainer.firstChild) subContainer.firstChild.click();
        }
      });
    });
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
