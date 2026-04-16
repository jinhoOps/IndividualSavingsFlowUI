(function initStep2PortfolioMvpV2() {
  "use strict";

  const MODEL_VERSION = 2;
  const UNALLOCATED_ASSET_KEY = "__unallocated__";
  const STEP1_UNIT_TO_WON = 10000;
  const STEP1_LOCAL_STORAGE_KEY = "isf-rebuild-v1";
  const SHARE_STATE_KEY = "my-portfolio-flow";
  const SHARE_STATE_SCHEMA = 2;
  const HASH_STATE_PARAM = "s";
  const MAX_FINANCIAL_INCOME = 20000000;
  const DEFAULT_TAX_RATE = 0.154; // 15.4%

  const DEFAULT_ACCOUNT_TEMPLATES = [
    {
      name: "국내주식",
      accountWeight: 34,
      allocations: [
        { key: "kr-samsung", label: "삼성전자", targetWeight: 40, memo: "" },
        { key: "kr-sk-hynix", label: "SK하이닉스", targetWeight: 35, memo: "" },
        { key: "kr-hyundai", label: "현대차", targetWeight: 25, memo: "" },
      ],
    },
    {
      name: "ISA",
      accountWeight: 33,
      allocations: [
        { key: "fund-kospi", label: "코스피", targetWeight: 30, memo: "" },
        { key: "fund-nasdaq100", label: "나스닥100", targetWeight: 40, memo: "" },
        { key: "fund-dow-dividend", label: "미국배당다우존스", targetWeight: 30, memo: "" },
      ],
    },
    {
      name: "해외주식",
      accountWeight: 33,
      allocations: [
        { key: "us-nasdaq100", label: "나스닥100", targetWeight: 60, memo: "" },
        { key: "us-tesla", label: "Tesla", targetWeight: 20, memo: "" },
        { key: "us-amd", label: "AMD", targetWeight: 20, memo: "" },
      ],
    },
  ];

  const FALLBACK_ALLOCATIONS = [
    { key: "domestic-stock", label: "국내주식", targetWeight: 35, memo: "" },
    { key: "global-stock", label: "해외주식", targetWeight: 35, memo: "" },
    { key: "bond", label: "채권", targetWeight: 20, memo: "" },
    { key: "cash-like", label: "현금성", targetWeight: 10, memo: "" },
  ];

  const ASSET_COLORS = ["#ea5b2a", "#1e8b7c", "#3175b6", "#d97706", "#7c3aed", "#e11d48", "#0f766e", "#64748b"];

  const dom = {
    loadStep1Data: document.getElementById("loadStep1Data"),
    bridgeStatus: document.getElementById("bridgeStatus"),
    bridgeTimestamp: document.getElementById("bridgeTimestamp"),
    bridgeMonthlyInvestCapacity: document.getElementById("bridgeMonthlyInvestCapacity"),
    bridgeCurrentCash: document.getElementById("bridgeCurrentCash"),
    bridgeCurrentInvest: document.getElementById("bridgeCurrentInvest"),
    bridgeCurrentSavings: document.getElementById("bridgeCurrentSavings"),
    chartMeta: document.getElementById("chartMeta"),
    chartTabSummary: document.getElementById("chartTabSummary"),
    chartTabAccount: document.getElementById("chartTabAccount"),
    summaryChartPane: document.getElementById("summaryChartPane"),
    accountChartPane: document.getElementById("accountChartPane"),
    summaryDonut: document.getElementById("summaryDonut"),
    accountChartCards: document.getElementById("accountChartCards"),
    amountBreakdown: document.getElementById("amountBreakdown"),
    portfolioName: document.getElementById("portfolioName"),
    portfolioNotes: document.getElementById("portfolioNotes"),
    totalMonthlyInvestCapacity: document.getElementById("totalMonthlyInvestCapacity"),
    addAccount: document.getElementById("addAccount"),
    mobileAccountSelect: document.getElementById("mobileAccountSelect"),
    accountList: document.getElementById("accountList"),
    accountSummary: document.getElementById("accountSummary"),
    allocationEditorTitle: document.getElementById("allocationEditorTitle"),
    allocationPanel: document.getElementById("allocationPanel"),
    addAllocation: document.getElementById("addAllocation"),
    allocationList: document.getElementById("allocationList"),
    allocationSummary: document.getElementById("allocationSummary"),
    savePortfolio: document.getElementById("savePortfolio"),
    resetPortfolio: document.getElementById("resetPortfolio"),
    portfolioSelect: document.getElementById("portfolioSelect"),
    loadPortfolio: document.getElementById("loadPortfolio"),
    deletePortfolio: document.getElementById("deletePortfolio"),
    portfolioMeta: document.getElementById("portfolioMeta"),
    step2Feedback: document.getElementById("step2Feedback"),
    exportJson: document.getElementById("exportJson"),
        importJsonTrigger: document.getElementById("importJsonTrigger"),
    pendingBar: document.getElementById("pendingBar"),
    pendingSummary: document.getElementById("pendingSummary"),
    applyChanges: document.getElementById("applyChanges"),
    cancelChanges: document.getElementById("cancelChanges"),
    importJsonFile: document.getElementById("importJsonFile"),
    copyShareLink: document.getElementById("copyShareLink"),
    applyFeedback: document.getElementById("applyFeedback"),
    toggleSimInputs: document.getElementById("toggleSimInputs"),
    simInputsContainer: document.getElementById("simInputsContainer"),
    simDividendYield: document.getElementById("simDividendYield"),
    simDividendGrowth: document.getElementById("simDividendGrowth"),
    simCapitalGrowth: document.getElementById("simCapitalGrowth"),
    simHorizonYears: document.getElementById("simHorizonYears"),
    simDrip: document.getElementById("simDrip"),
    simChartSvg: document.getElementById("simChartSvg"),
    simChartTooltip: document.getElementById("simChartTooltip"),
    simTable: document.querySelector("#simTable tbody"),
    simYearsTabs: document.getElementById("simYearsTabs"),
  };

  const state = {
    portfolios: [],
    currentPortfolioId: "",
    draft: null,
    activeAccountId: "",
    activeChartTab: "summary",
    dirty: false,
  };

  const colorCache = new Map();

  document.addEventListener("DOMContentLoaded", () => {
    state.draft = createEmptyDraft();
    const hash = window.location.hash;
    const hub = getHubStorage();

    // 1. Try to restore from Session Storage first (Prevent data loss on refresh)
    const savedTmp = sessionStorage.getItem(TEMP_STORAGE_KEY);
    if (savedTmp && !hash) {
      try {
        const parsed = JSON.parse(savedTmp);
        if (parsed && parsed.draft) {
          state.draft = parsed.draft;
          state.currentPortfolioId = parsed.currentPortfolioId || "";
          state.activeAccountId = parsed.activeAccountId || "";
          state.dirty = true;
          IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
          showFeedback("편집 중이던 데이터를 복구했습니다.", false);
        }
      } catch (e) {
        console.error("Failed to restore temp draft", e);
      }
    } else if (hash) {
      // 2. Load from Hash
      try {
        const hashInputs = IsfShare.decodePayloadFromHash(new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM), SHARE_STATE_KEY);
        if (hashInputs) {
          const normalized = normalizeLoadedPortfolio(hashInputs);
          state.draft = normalized.draft;
          state.currentPortfolioId = normalized.id || "";
        }
      } catch (_error) {
        showFeedback("공유 링크 복원에 실패했습니다.", true);
      }
    }
    
    bindEvents();
    ensureActiveAccountSelected();
    renderDraft();
    void refreshPortfolioList();

    if (!hash && !savedTmp && hub) {
      resolveLatestBridgePayload(hub).then(resolved => {
        const bridge = resolved.bridge;
        if (bridge && bridge.payload && state.draft.totalMonthlyInvestCapacity === 0) {
          state.draft.totalMonthlyInvestCapacity = IsfUtils.sanitizeMoney(bridge.payload.monthlyInvestCapacity);
          state.draft.bridgeContext = {
            timestamp: String(bridge.payload.timestamp || ""),
            currentCash: IsfUtils.sanitizeMoney(bridge.payload.currentCash),
            currentInvest: IsfUtils.sanitizeMoney(bridge.payload.currentInvest),
            currentSavings: IsfUtils.sanitizeMoney(bridge.payload.currentSavings),
          };
          renderDraft();
        }
        renderBridgeInfo(bridge, bridge ? "초기 진입 시 Step1 투자여력을 자동 반영했습니다." : "");
      }).catch(() => refreshBridgeSummary());
    } else {
      void refreshBridgeSummary();
    }

    const pwaManager = new IsfPwaManager({
      appVersion: "0.3.0",
      appKey: SHARE_STATE_KEY,
      onFeedback: (message) => IsfFeedback.showFeedback(dom.applyFeedback, message),
      isViewMode: () => false,
      swPath: "../../sw.js",
      manifestPath: "../../manifest.webmanifest",
      versionCheckTriggerElement: dom.checkLatestVersion,
      getCurrentData: () => state.draft,
    });
    pwaManager.init();
  });

  function getHubStorage() {
    const hub = window.IsfHubStorage;
    if (!hub || typeof hub !== "object") {
      return null;
    }
    const required = ["getLatestBridgeStep1ToStep2", "saveStep2Portfolio", "listStep2Portfolios", "getStep2PortfolioById", "deleteStep2Portfolio"];
    return required.every((name) => typeof hub[name] === "function") ? hub : null;
  }

  function step1AmountToUnit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.round(numeric));
  }

  function buildBridgePayloadFromStep1Inputs(inputs, timestamp) {
    const safeInputs = inputs && typeof inputs === "object" ? inputs : null;
    if (!safeInputs) {
      return null;
    }
    const hasKnownFields = ["monthlyInvest", "startCash", "startInvest", "startSavings"].some((fieldName) => fieldName in safeInputs);
    if (!hasKnownFields) {
      return null;
    }
    return {
      monthlyInvestCapacity: step1AmountToUnit(safeInputs.monthlyInvest),
      currentCash: step1AmountToUnit(safeInputs.startCash),
      currentInvest: step1AmountToUnit(safeInputs.startInvest),
      currentSavings: step1AmountToUnit(safeInputs.startSavings),
      annualExpenseGrowth: Number(safeInputs.annualExpenseGrowth || 0),
      timestamp: String(timestamp || new Date().toISOString()),
      investItems: Array.isArray(safeInputs.investItems) ? safeInputs.investItems : [],
    };
  }

  function formatWeight(value) {
    return IsfUtils.sanitizeWeight(value).toFixed(2);
  }

  function formatPercentInteger(value) {
    return String(Math.round(IsfUtils.sanitizeWeight(value)));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(IsfUtils.sanitizeMoney(value));
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return "-";
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function createDraftAllocation(source) {
    const safe = source && typeof source === "object" ? source : {};
    return {
      id: String(safe.id || "").trim() || IsfUtils.createId("alloc"),
      key: String(safe.key || "").trim() || IsfUtils.createId("asset"),
      label: String(safe.label || "").trim() || "종목",
      targetWeight: IsfUtils.sanitizeWeight(safe.targetWeight),
      isImportant: Boolean(safe.isImportant),
      memo: String(safe.memo || ""),
    };
  }

  function createDraftAccount(source) {
    const safe = source && typeof source === "object" ? source : {};
    const rawAllocations = Array.isArray(safe.allocations) ? safe.allocations : FALLBACK_ALLOCATIONS;
    const allocations = rawAllocations.map((item) => createDraftAllocation(item));
    return {
      id: String(safe.id || "").trim() || IsfUtils.createId("account"),
      name: String(safe.name || "").trim() || "계좌",
      accountWeight: IsfUtils.sanitizeWeight(safe.accountWeight),
      allocations: allocations.length > 0 ? allocations : [createDraftAllocation({ label: "종목 1", targetWeight: 100 })],
    };
  }

  function createDefaultAccounts() {
    return DEFAULT_ACCOUNT_TEMPLATES.map((template) => createDraftAccount(template));
  }

  function createEmptyDraft() {
    return {
      modelVersion: MODEL_VERSION,
      name: "내 포트폴리오",
      notes: "",
      totalMonthlyInvestCapacity: 0,
      accounts: createDefaultAccounts(),
      bridgeContext: null,
      dividendSim: { yield: 3.5, growth: 5.0, capitalGrowth: 4.0, years: 10, drip: true }
    };
  }

  function showFeedback(message, isError) {
    if (!(dom.step2Feedback instanceof HTMLElement)) {
      return;
    }
    dom.step2Feedback.hidden = false;
    dom.step2Feedback.textContent = message;
    dom.step2Feedback.classList.toggle("is-error", Boolean(isError));
    IsfFeedback.showFeedback(dom.applyFeedback, message, isError);
  }

  function clearFeedback() {
    if (!(dom.step2Feedback instanceof HTMLElement)) {
      return;
    }
    dom.step2Feedback.hidden = true;
    dom.step2Feedback.textContent = "";
    dom.step2Feedback.classList.remove("is-error");
  }

  const TEMP_STORAGE_KEY = "isf-step2-draft-tmp";

  function markDirty() {
    state.dirty = true;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
    // Persist to session storage to prevent data loss on refresh
    try {
      sessionStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify({
        draft: state.draft,
        currentPortfolioId: state.currentPortfolioId,
        activeAccountId: state.activeAccountId
      }));
    } catch (e) {
      console.warn("Failed to save temporary draft", e);
    }
  }

  function markClean() {
    state.dirty = false;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, false);
    sessionStorage.removeItem(TEMP_STORAGE_KEY);
  }
  function getAccountById(accountId) {
    const safeId = String(accountId || "").trim();
    if (!safeId) {
      return null;
    }
    return state.draft.accounts.find((account) => account.id === safeId) || null;
  }

  function ensureActiveAccountSelected() {
    const current = getAccountById(state.activeAccountId);
    if (current) {
      return current;
    }
    state.activeAccountId = "";
    return null;
  }

  function setActiveAccount(accountId, toggle = false) {
    if (toggle && state.activeAccountId === accountId) {
      state.activeAccountId = "";
    } else {
      const account = getAccountById(accountId);
      state.activeAccountId = account ? account.id : "";
    }
    renderAccountList();
    renderMobileAccountPicker();
    renderAllocationEditor();
    renderCharts();
  }

  function setActiveChartTab(tabKey) {
    state.activeChartTab = tabKey === "account" ? "account" : "summary";
    renderChartTabs();
    requestAnimationFrame(() => renderCharts());
  }

  function getAllocationWeightTotal(account) {
    if (!account || !Array.isArray(account.allocations)) {
      return 0;
    }
    return account.allocations.reduce((sum, allocation) => sum + IsfUtils.sanitizeWeight(allocation.targetWeight), 0);
  }

  function isAllocationTotalValid(account) {
    return getAllocationWeightTotal(account) <= 100.01;
  }

  function getTotalAccountWeight() {
    return state.draft.accounts.reduce((sum, account) => sum + IsfUtils.sanitizeWeight(account.accountWeight), 0);
  }

  function getTotalMonthlyInvestCapacity() {
    return IsfUtils.sanitizeMoney(state.draft.totalMonthlyInvestCapacity);
  }

  function getAccountAllocatedAmount(account) {
    const totalCapacity = getTotalMonthlyInvestCapacity();
    const accountWeight = IsfUtils.sanitizeWeight(account?.accountWeight);
    if (totalCapacity <= 0 || accountWeight <= 0) {
      return 0;
    }
    return Math.round((totalCapacity * accountWeight) / 100);
  }

  function getAutoCashAmount() {
    const totalCapacity = getTotalMonthlyInvestCapacity();
    if (totalCapacity <= 0) {
      return 0;
    }
    const totalWeight = getTotalAccountWeight();
    if (totalWeight >= 100) {
      return 0;
    }
    return Math.round((totalCapacity * (100 - totalWeight)) / 100);
  }

  function validateDraft() {
    if (!String(state.draft.name || "").trim()) {
      return { valid: false, message: "포트폴리오 이름을 입력하세요." };
    }

    if (!Number.isFinite(Number(state.draft.totalMonthlyInvestCapacity)) || Number(state.draft.totalMonthlyInvestCapacity) < 0) {
      return { valid: false, message: "월 투자 가능 금액은 0 이상이어야 합니다." };
    }

    if (!Array.isArray(state.draft.accounts) || state.draft.accounts.length === 0) {
      return { valid: false, message: "계좌를 1개 이상 추가하세요." };
    }

    for (let i = 0; i < state.draft.accounts.length; i += 1) {
      const account = state.draft.accounts[i];
      const accountLabel = String(account.name || "").trim() || `계좌 ${i + 1}`;
      if (!String(account.name || "").trim()) {
        return { valid: false, message: `${accountLabel}: 계좌명을 입력하세요.` };
      }
      const accountWeight = IsfUtils.sanitizeWeight(account.accountWeight);
      if (accountWeight < 0 || accountWeight > 100) {
        return { valid: false, message: `${accountLabel}: 계좌 비중은 0~100%여야 합니다.` };
      }
      if (!Array.isArray(account.allocations) || account.allocations.length === 0) {
        return { valid: false, message: `${accountLabel}: 종목을 1개 이상 입력하세요.` };
      }
      if (account.allocations.some((allocation) => !String(allocation.label || "").trim())) {
        return { valid: false, message: `${accountLabel}: 종목 이름이 비어 있습니다.` };
      }
      const allocationTotal = getAllocationWeightTotal(account);
      if (allocationTotal > 100.01) {
        return { valid: false, message: `${accountLabel}: 종목 비중 합계가 100%를 초과합니다.` };
      }
    }

    if (getTotalAccountWeight() > 100.01) {
      return { valid: false, message: "계좌 비중 합계가 100%를 초과했습니다." };
    }

    return { valid: true, message: "" };
  }

  function bindEvents() {
    if (dom.simYearsTabs) {
      dom.simYearsTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".chart-tab");
        if (!btn) return;
        const years = parseInt(btn.dataset.years, 10);
        if (isNaN(years)) return;
        
        if (state.draft.dividendSim) {
          state.draft.dividendSim.years = years;
          if (dom.simHorizonYears) dom.simHorizonYears.value = years;
        }
        
        syncSimYearsTabs(years);
        renderDividendSimulation();
        markDirty();
      });
    }

    if (dom.toggleSimInputs) {
      dom.toggleSimInputs.addEventListener("click", () => {
        if (dom.simInputsContainer) {
          dom.simInputsContainer.hidden = !dom.simInputsContainer.hidden;
        }
      });
    }

    const simInputs = [dom.simDividendYield, dom.simDividendGrowth, dom.simCapitalGrowth, dom.simHorizonYears];
    simInputs.forEach(input => {
      if (input) {
        input.addEventListener("input", () => {
          if (!state.draft.dividendSim) return;
          state.draft.dividendSim.yield = Number(dom.simDividendYield.value || 0);
          state.draft.dividendSim.growth = Number(dom.simDividendGrowth.value || 0);
          state.draft.dividendSim.capitalGrowth = Number(dom.simCapitalGrowth.value || 0);
          state.draft.dividendSim.years = Math.min(40, Math.max(1, Number(dom.simHorizonYears.value || 1)));
          markDirty();
          renderDividendSimulation();
        });
      }
    });

    if (dom.simDrip) {
      dom.simDrip.addEventListener("change", () => {
        if (!state.draft.dividendSim) return;
        state.draft.dividendSim.drip = dom.simDrip.checked;
        markDirty();
        renderDividendSimulation();
      });
    }

    if (dom.loadStep1Data) {
      dom.loadStep1Data.addEventListener("click", async () => {
        if (state.dirty) {
          const shouldOverwrite = window.confirm("편집 중인 내용이 있습니다. Step1 최신 데이터로 덮어쓸까요?");
          if (!shouldOverwrite) {
            return;
          }
        }
        await importLatestBridgeIntoDraft();
      });
    }

    if (dom.chartTabSummary) {
      dom.chartTabSummary.addEventListener("click", () => setActiveChartTab("summary"));
    }
    if (dom.chartTabAccount) {
      dom.chartTabAccount.addEventListener("click", () => setActiveChartTab("account"));
    }

    if (dom.portfolioName) {
      dom.portfolioName.addEventListener("input", () => {
        state.draft.name = String(dom.portfolioName.value || "");
        markDirty();
      });
    }

    if (dom.portfolioNotes) {
      dom.portfolioNotes.addEventListener("input", () => {
        state.draft.notes = String(dom.portfolioNotes.value || "");
        markDirty();
      });
    }

    if (dom.totalMonthlyInvestCapacity) {
      dom.totalMonthlyInvestCapacity.addEventListener("input", () => {
        state.draft.totalMonthlyInvestCapacity = IsfUtils.sanitizeMoney(dom.totalMonthlyInvestCapacity.value);
        markDirty();
        renderAccountSummary();
        renderCharts();
      });
    }

    if (dom.addAccount) {
      dom.addAccount.addEventListener("click", () => {
        const next = createDraftAccount({ name: `계좌 ${state.draft.accounts.length + 1}`, accountWeight: 0 });
        state.draft.accounts.push(next);
        state.activeAccountId = next.id;
        markDirty();
        renderAccountList();
        renderMobileAccountPicker();
        renderAllocationEditor();
        renderAccountSummary();
        renderCharts();
      });
    }

    if (dom.mobileAccountSelect) {
      dom.mobileAccountSelect.addEventListener("change", () => {
        const selectedId = String(dom.mobileAccountSelect.value || "");
        setActiveAccount(selectedId, false);
      });
    }

    if (dom.accountList) {
      dom.accountList.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const row = target.closest("[data-account-id]");
        if (!row) {
          return;
        }
        const account = getAccountById(row.getAttribute("data-account-id") || "");
        if (!account) {
          return;
        }

        if (target.dataset.field === "accountName") {
          account.name = target.value;
        }
        if (target.dataset.field === "accountWeight") {
          account.accountWeight = IsfUtils.sanitizeWeight(target.value);
        }

        markDirty();
        renderAccountSummary();
        renderAllocationSummary();
        renderCharts();
      });

      dom.accountList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const selectId = String(target.getAttribute("data-select-account-id") || "");
        if (selectId) {
          setActiveAccount(selectId, true);
          return;
        }

        const removeId = String(target.getAttribute("data-remove-account-id") || "");
        if (!removeId) {
          return;
        }
        if (state.draft.accounts.length <= 1) {
          showFeedback("계좌는 최소 1개 이상 필요합니다.", true);
          return;
        }

        state.draft.accounts = state.draft.accounts.filter((account) => account.id !== removeId);
        if (state.activeAccountId === removeId) {
          state.activeAccountId = "";
        }
        markDirty();
        renderAccountList();
        renderMobileAccountPicker();
        renderAllocationEditor();
        renderAccountSummary();
        renderCharts();
      });
    }

    if (dom.addAllocation) {
      dom.addAllocation.addEventListener("click", () => {
        const account = ensureActiveAccountSelected();
        if (!account) {
          showFeedback("먼저 계좌를 추가하세요.", true);
          return;
        }
        account.allocations.push(createDraftAllocation({ label: `종목 ${account.allocations.length + 1}`, targetWeight: 0 }));
        markDirty();
        renderAllocationEditor();
        renderCharts();
      });
    }

    if (dom.allocationList) {
      dom.allocationList.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const row = target.closest("[data-allocation-id]");
        if (!row) {
          return;
        }
        const allocationId = String(row.getAttribute("data-allocation-id") || "");
        const account = ensureActiveAccountSelected();
        if (!account) {
          return;
        }
        const allocation = account.allocations.find((item) => item.id === allocationId);
        if (!allocation) {
          return;
        }

        if (target.dataset.field === "label") {
          allocation.label = target.value;
        }
        if (target.dataset.field === "targetWeight") {
          allocation.targetWeight = IsfUtils.sanitizeWeight(target.value);
        }
        if (target.dataset.field === "memo") {
          allocation.memo = target.value;
        }

        markDirty();
        renderAllocationSummary();
        renderCharts();
      });

      dom.allocationList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const toggleId = String(target.getAttribute("data-toggle-important") || target.closest(".btn-toggle-star")?.getAttribute("data-toggle-important") || "");
        if (toggleId) {
          const account = ensureActiveAccountSelected();
          if (account) {
            const allocation = account.allocations.find((item) => item.id === toggleId);
            if (allocation) {
              allocation.isImportant = !allocation.isImportant;
              markDirty();
              renderAllocationEditor();
              renderCharts();
            }
          }
          return;
        }

        const removeId = String(target.getAttribute("data-remove-allocation-id") || "");
        if (!removeId) {
          return;
        }
        const account = ensureActiveAccountSelected();
        if (!account) {
          return;
        }
        if (account.allocations.length <= 1) {
          showFeedback("종목은 최소 1개 이상 필요합니다.", true);
          return;
        }
        account.allocations = account.allocations.filter((allocation) => allocation.id !== removeId);
        markDirty();
        renderAllocationEditor();
        renderCharts();
      });

      // Drag and Drop implementation
      let dragTimer = null;
      let draggedId = null;

      dom.allocationList.addEventListener("dragstart", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-allocation-id]");
        if (!row) return;

        draggedId = row.getAttribute("data-allocation-id");
        row.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
      });

      dom.allocationList.addEventListener("dragover", (event) => {
        event.preventDefault();
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-allocation-id]");
        if (!row || row.getAttribute("data-allocation-id") === draggedId) return;

        row.classList.add("drag-over");
        event.dataTransfer.dropEffect = "move";
      });

      dom.allocationList.addEventListener("dragleave", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-allocation-id]");
        if (row) row.classList.remove("drag-over");
      });

      dom.allocationList.addEventListener("drop", (event) => {
        event.preventDefault();
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest("[data-allocation-id]");
        if (!row) return;

        const targetId = row.getAttribute("data-allocation-id");
        row.classList.remove("drag-over");

        if (draggedId && targetId && draggedId !== targetId) {
          const account = ensureActiveAccountSelected();
          if (account) {
            const fromIndex = account.allocations.findIndex(a => a.id === draggedId);
            const toIndex = account.allocations.findIndex(a => a.id === targetId);
            if (fromIndex !== -1 && toIndex !== -1) {
              const [movedItem] = account.allocations.splice(fromIndex, 1);
              account.allocations.splice(toIndex, 0, movedItem);
              markDirty();
              renderAllocationEditor();
              renderCharts();
            }
          }
        }
        draggedId = null;
      });

      dom.allocationList.addEventListener("dragend", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement) {
          const row = target.closest("[data-allocation-id]");
          if (row) row.classList.remove("dragging");
        }
        draggedId = null;
      });

      // Long press for mobile
      dom.allocationList.addEventListener("touchstart", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        // Don't trigger on input fields
        if (target instanceof HTMLInputElement) return;

        const row = target.closest("[data-allocation-id]");
        if (!row) return;

        dragTimer = setTimeout(() => {
          row.setAttribute("draggable", "true");
          // Visual feedback for long press
          row.style.boxShadow = "0 0 15px rgba(234, 91, 42, 0.4)";
        }, 500);
      }, { passive: true });

      dom.allocationList.addEventListener("touchend", () => {
        if (dragTimer) {
          clearTimeout(dragTimer);
          dragTimer = null;
        }
      });

      dom.allocationList.addEventListener("touchmove", () => {
        if (dragTimer) {
          clearTimeout(dragTimer);
          dragTimer = null;
        }
      });

      // Reset draggable on mouseup/touchend to prevent stuck state
      document.addEventListener("mouseup", () => {
        const rows = dom.allocationList.querySelectorAll("[data-allocation-id]");
        rows.forEach(r => {
          r.setAttribute("draggable", "false");
          r.style.boxShadow = "";
        });
      });
    }
    if (dom.accountChartCards) {
      dom.accountChartCards.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const accountId = String(target.getAttribute("data-focus-account-id") || "");
        if (!accountId) {
          return;
        }
        setActiveAccount(accountId, false);
        setActiveChartTab("account");
      });
    }

    if (dom.savePortfolio) {
      dom.savePortfolio.addEventListener("click", async () => {
        await saveCurrentPortfolio();
      });
    }

    if (dom.applyChanges) {
      dom.applyChanges.addEventListener("click", async () => {
        await saveCurrentPortfolio();
      });
    }

    if (dom.cancelChanges) {
      dom.cancelChanges.addEventListener("click", async () => {
        if (state.currentPortfolioId) {
          await loadPortfolioById(state.currentPortfolioId, { skipConfirm: true });
          showFeedback("변경사항을 취소하고 마지막 저장 상태로 되돌렸습니다.", false);
        } else {
          resetDraft();
          showFeedback("변경사항을 취소했습니다.", false);
        }
      });
    }

    if (dom.resetPortfolio) {
      dom.resetPortfolio.addEventListener("click", () => {
        if (state.dirty) {
          const shouldReset = window.confirm("편집 중인 내용이 있습니다. 새 포트폴리오로 초기화할까요?");
          if (!shouldReset) {
            return;
          }
        }
        resetDraft();
      });
    }

    if (dom.loadPortfolio) {
      dom.loadPortfolio.addEventListener("click", async () => {
        const selectedId = dom.portfolioSelect instanceof HTMLSelectElement ? dom.portfolioSelect.value : "";
        if (!selectedId) {
          showFeedback("불러올 포트폴리오를 선택하세요.", true);
          return;
        }
        await loadPortfolioById(selectedId);
      });
    }

    if (dom.deletePortfolio) {
      dom.deletePortfolio.addEventListener("click", async () => {
        const selectedId = dom.portfolioSelect instanceof HTMLSelectElement ? dom.portfolioSelect.value : "";
        if (!selectedId) {
          showFeedback("삭제할 포트폴리오를 선택하세요.", true);
          return;
        }
        const shouldDelete = window.confirm("선택한 포트폴리오를 삭제할까요?");
        if (!shouldDelete) {
          return;
        }
        await deletePortfolioById(selectedId);
      });
    }

    if (dom.exportJson) {
      dom.exportJson.addEventListener("click", () => {
        const payload = toPortablePortfolio();
        IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, payload), "portfolio_v2");
        showFeedback("JSON 파일로 저장했습니다.", false);
      });
    }

    if (dom.importJsonTrigger && dom.importJsonFile) {
      dom.importJsonTrigger.addEventListener("click", () => {
        dom.importJsonFile.click();
      });

      dom.importJsonFile.addEventListener("change", async (event) => {
        const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : null;
        if (!file) {
          return;
        }
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const normalized = normalizeLoadedPortfolio(parsed);
          state.currentPortfolioId = normalized.id || "";
          state.draft = normalized.draft;
          ensureActiveAccountSelected();
          markDirty();
          renderDraft();
          showFeedback("JSON 데이터를 성공적으로 불러왔습니다.", false);
        } catch (_error) {
          showFeedback("JSON 파일 형식이 올바르지 않습니다.", true);
        } finally {
          if (event.target instanceof HTMLInputElement) {
            event.target.value = "";
          }
        }
      });
    }

    if (dom.copyShareLink) {
      dom.copyShareLink.addEventListener("click", () => {
        try {
          const payload = toPortablePortfolio();
          const envelope = IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, payload);
          const encoded = IsfShare.encodePayloadForHash(envelope);
          if (!encoded) {
             showFeedback("링크 길이를 초과했습니다. JSON 내보내기를 이용해주세요.", true);
             return;
          }
          const url = new URL(window.location.href);
          url.hash = `${HASH_STATE_PARAM}=${encoded}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url.toString()).then(() => {
              showFeedback("공유용 단축 링크가 클립보드에 복사되었습니다.", false);
            });
          } else {
            window.prompt("아래 링크를 복사하여 공유하세요.", url.toString());
          }
        } catch (_error) {
          showFeedback("링크 복사에 실패했습니다.", true);
        }
      });
    }
  }

  function syncSimYearsTabs(years) {
    if (!dom.simYearsTabs) return;
    Array.from(dom.simYearsTabs.querySelectorAll(".chart-tab")).forEach(b => {
      const val = parseInt(b.dataset.years, 10);
      const active = val === years;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active);
    });
  }

  function renderDraft() {
    ensureActiveAccountSelected();
    if (dom.portfolioName) {
      dom.portfolioName.value = state.draft.name;
    }
    if (dom.portfolioNotes) {
      dom.portfolioNotes.value = state.draft.notes;
    }
    if (dom.totalMonthlyInvestCapacity) {
      dom.totalMonthlyInvestCapacity.value = String(IsfUtils.sanitizeMoney(state.draft.totalMonthlyInvestCapacity));
    }
    if (state.draft.dividendSim) {
      if (dom.simDividendYield) dom.simDividendYield.value = state.draft.dividendSim.yield;
      if (dom.simDividendGrowth) dom.simDividendGrowth.value = state.draft.dividendSim.growth;
      if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = state.draft.dividendSim.capitalGrowth;
      if (dom.simHorizonYears) dom.simHorizonYears.value = state.draft.dividendSim.years;
      if (dom.simDrip) dom.simDrip.checked = state.draft.dividendSim.drip;
      syncSimYearsTabs(state.draft.dividendSim.years);
    } else {
      state.draft.dividendSim = { yield: 3.5, growth: 5.0, capitalGrowth: 4.0, years: 10, drip: true };
      syncSimYearsTabs(10);
    }
    renderChartTabs();
    renderAccountList();
    renderMobileAccountPicker();
    renderAllocationEditor();
    renderAccountSummary();
    renderCharts();
    clearFeedback();
  }

  function renderChartTabs() {
    const isSummary = state.activeChartTab !== "account";
    state.activeChartTab = isSummary ? "summary" : "account";

    if (dom.chartTabSummary) {
      dom.chartTabSummary.classList.toggle("is-active", isSummary);
      dom.chartTabSummary.setAttribute("aria-selected", String(isSummary));
    }
    if (dom.chartTabAccount) {
      dom.chartTabAccount.classList.toggle("is-active", !isSummary);
      dom.chartTabAccount.setAttribute("aria-selected", String(!isSummary));
    }
    if (dom.summaryChartPane) {
      dom.summaryChartPane.hidden = !isSummary;
      dom.summaryChartPane.classList.toggle("is-hidden", !isSummary);
      dom.summaryChartPane.setAttribute("aria-hidden", String(!isSummary));
    }
    if (dom.accountChartPane) {
      dom.accountChartPane.hidden = isSummary;
      dom.accountChartPane.classList.toggle("is-hidden", isSummary);
      dom.accountChartPane.setAttribute("aria-hidden", String(isSummary));
    }
    if (dom.chartMeta) {
      dom.chartMeta.textContent = isSummary
        ? "종합 도넛은 월 투자 가능 금액에서 계좌/종목 비중으로 계산하고, 남는 금액은 자동 현금 처리합니다."
        : "계좌별 도넛은 계좌별 비중/금액을 각각 분리해서 보여줍니다.";
    }
  }

  function renderAccountList() {
    if (!(dom.accountList instanceof HTMLElement)) {
      return;
    }
    dom.accountList.innerHTML = "";

    state.draft.accounts.forEach((account, index) => {
      const row = document.createElement("div");
      row.className = "account-row" + (account.id === state.activeAccountId ? " is-active" : "");
      row.setAttribute("data-account-id", account.id);
      row.innerHTML = `
        <input type="text" data-field="accountName" value="${IsfUtils.escapeHtml(account.name)}" aria-label="계좌 ${index + 1} 이름" />
        <input type="number" min="0" max="100" step="0.01" data-field="accountWeight" value="${formatWeight(account.accountWeight)}" aria-label="계좌 ${index + 1} 비중" />
        <div class="account-row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-select-account-id="${IsfUtils.escapeHtml(account.id)}">${account.id === state.activeAccountId ? "편집중" : "선택"}</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-remove-account-id="${IsfUtils.escapeHtml(account.id)}">삭제</button>
      `;
      dom.accountList.appendChild(row);
    });
  }

  function renderMobileAccountPicker() {
    if (!(dom.mobileAccountSelect instanceof HTMLSelectElement)) {
      return;
    }
    dom.mobileAccountSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "편집할 계좌 선택";
    dom.mobileAccountSelect.appendChild(placeholder);

    state.draft.accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} · ${formatWeight(account.accountWeight)}%`;
      dom.mobileAccountSelect.appendChild(option);
    });

    dom.mobileAccountSelect.value = state.activeAccountId || "";
  }

  function renderAllocationEditor() {
    const account = ensureActiveAccountSelected();

    if (dom.allocationPanel) {
      dom.allocationPanel.hidden = !account;
    }

    if (dom.allocationEditorTitle) {
      dom.allocationEditorTitle.textContent = account ? `종목 구성 · ${account.name}` : "종목 구성";
    }

    if (!(dom.allocationList instanceof HTMLElement)) {
      return;
    }
    dom.allocationList.innerHTML = "";

    if (!account) {
      renderAllocationSummary();
      return;
    }

    account.allocations.forEach((allocation, index) => {
      const row = document.createElement("div");
      row.className = "allocation-row";
      if (allocation.isImportant) row.classList.add("is-important");
      row.setAttribute("data-allocation-id", allocation.id);
      row.setAttribute("draggable", "false"); 
      
      row.onmousedown = (e) => {
        if (e.target instanceof HTMLInputElement || e.target.closest(".btn-toggle-star")) {
          row.setAttribute("draggable", "false");
        } else {
          row.setAttribute("draggable", "true");
        }
      };

      row.innerHTML = `
        <button type="button" class="btn-toggle-star ${allocation.isImportant ? "is-active" : ""}" 
                data-toggle-important="${IsfUtils.escapeHtml(allocation.id)}" title="중요 종목 표시">
          ${allocation.isImportant ? "★" : "☆"}
        </button>
        <input type="text" data-field="label" value="${IsfUtils.escapeHtml(allocation.label)}" aria-label="종목 ${index + 1} 이름" />
        <input type="number" min="0" max="100" step="0.01" data-field="targetWeight" value="${formatWeight(allocation.targetWeight)}" aria-label="종목 ${index + 1} 목표 비중" />
        <input type="text" data-field="memo" value="${IsfUtils.escapeHtml(allocation.memo)}" aria-label="종목 ${index + 1} 메모" />
        <div class="allocation-row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-remove-allocation-id="${IsfUtils.escapeHtml(allocation.id)}">삭제</button>
        </div>
      `;
      dom.allocationList.appendChild(row);
    });

    renderAllocationSummary();
  }

  function renderAccountSummary() {
    if (!(dom.accountSummary instanceof HTMLElement)) {
      return;
    }
    const totalCapacity = getTotalMonthlyInvestCapacity();
    const totalWeight = getTotalAccountWeight();
    const autoCash = getAutoCashAmount();
    const invalidCount = state.draft.accounts.filter((account) => !isAllocationTotalValid(account)).length;
    const overweight = totalWeight > 100.01;
    dom.accountSummary.textContent = `월 투자 가능 금액 ${formatCurrency(totalCapacity)} · 계좌 비중 합계 ${totalWeight.toFixed(2)}% · 자동 현금 ${formatCurrency(autoCash)}`;
    dom.accountSummary.classList.toggle("is-error", invalidCount > 0 || overweight);
    if (invalidCount > 0 || overweight) {
      dom.accountSummary.textContent += ` · 검증 실패 계좌 ${invalidCount}개${overweight ? " · 계좌 비중 100% 초과" : ""}`;
    }
  }

  function renderAllocationSummary() {
    if (!(dom.allocationSummary instanceof HTMLElement)) {
      return;
    }
    const account = ensureActiveAccountSelected();
    if (!account) {
      dom.allocationSummary.textContent = "계좌를 먼저 선택하세요.";
      dom.allocationSummary.classList.add("is-error");
      return;
    }
    const totalWeight = getAllocationWeightTotal(account);
    const overweight = totalWeight > 100.01;
    const underweight = totalWeight < 99.99;
    
    if (overweight) {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (비중합계 100% 초과합니다)`;
      dom.allocationSummary.classList.add("is-error");
      dom.allocationSummary.classList.remove("is-warning");
    } else if (underweight) {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (설정하지 않은 비중은 현금으로 처리됩니다)`;
      dom.allocationSummary.classList.remove("is-error");
      dom.allocationSummary.classList.add("is-warning");
    } else {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (정상)`;
      dom.allocationSummary.classList.remove("is-error");
      dom.allocationSummary.classList.remove("is-warning");
    }
  }

  function getAssetColor(assetKey, fallbackLabel) {
    const safeKey = String(assetKey || "").trim() || String(fallbackLabel || "").trim() || "asset";
    if (safeKey === UNALLOCATED_ASSET_KEY) {
      return "#8a8f98";
    }
    if (colorCache.has(safeKey)) {
      return colorCache.get(safeKey);
    }

    let hash = 0;
    for (let index = 0; index < safeKey.length; index += 1) {
      hash = ((hash << 5) - hash + safeKey.charCodeAt(index)) | 0;
    }
    const color = ASSET_COLORS[Math.abs(hash) % ASSET_COLORS.length];
    colorCache.set(safeKey, color);
    return color;
  }

  function buildSummarySlices() {
    const bucket = new Map();
    const totalCapacity = getTotalMonthlyInvestCapacity();
    if (totalCapacity <= 0) {
      return [];
    }

    state.draft.accounts.forEach((account) => {
      const accountBudget = getAccountAllocatedAmount(account);
      if (accountBudget <= 0) {
        return;
      }
      account.allocations.forEach((allocation) => {
        const weight = IsfUtils.sanitizeWeight(allocation.targetWeight);
        const amount = Math.round((accountBudget * weight) / 100);
        if (amount <= 0) {
          return;
        }
        const key = String(allocation.key || "").trim() || String(allocation.label || "").trim() || "asset";
        const label = String(allocation.label || "").trim() || "종목";
        const prev = bucket.get(key);
        if (prev) {
          prev.value += amount;
          if (allocation.isImportant) prev.isImportant = true;
        } else {
          bucket.set(key, { 
            key, 
            label, 
            value: amount, 
            color: getAssetColor(key, label),
            isImportant: Boolean(allocation.isImportant)
          });
        }
      });
    });

    const slices = Array.from(bucket.values());
    const autoCash = getAutoCashAmount();
    const totalValue = slices.reduce((sum, s) => sum + s.value, 0);
    const grandTotal = totalValue + autoCash;

    if (grandTotal <= 0) return [];

    const threshold = grandTotal * 0.01; // 1%
    const smallItems = [];
    const mainSlices = [];

    slices.forEach((slice) => {
      if (slice.value <= threshold) {
        smallItems.push(slice);
      } else {
        mainSlices.push(slice);
      }
    });

    if (smallItems.length > 0) {
      const smallSum = smallItems.reduce((sum, s) => sum + s.value, 0);
      mainSlices.push({
        key: "others-group-auto",
        label: `기타 ${smallItems.length}종`,
        value: smallSum,
        color: "#a0a5ad",
        isGroup: true,
      });
    }

    if (autoCash > 0) {
      mainSlices.push({
        key: UNALLOCATED_ASSET_KEY,
        label: "현금(자동)",
        value: autoCash,
        color: getAssetColor(UNALLOCATED_ASSET_KEY, "현금"),
      });
    }

    return mainSlices.sort((a, b) => b.value - a.value);
  }

  function buildAccountSlices(account) {
    if (!account || !Array.isArray(account.allocations)) {
      return [];
    }
    return account.allocations
      .map((allocation) => {
        const label = String(allocation.label || "").trim() || "종목";
        const key = String(allocation.key || "").trim() || label;
        const value = IsfUtils.sanitizeWeight(allocation.targetWeight);
        return {
          key,
          label,
          value,
          expectedAmount: Math.round((getAccountAllocatedAmount(account) * value) / 100),
          color: getAssetColor(key, label),
          isImportant: Boolean(allocation.isImportant)
        };
      })
      .filter((slice) => slice.value > 0);
  }
  function renderCharts() {
    renderSummaryChart();
    renderAccountChart();
    renderAmountBreakdown();
    renderDividendSimulation();
  }

  function calculateDividendProjection() {
    if (!state.draft.dividendSim) return [];
    
    // We treat unallocated/automatic cash as 0% yield 0% growth unless they actually assigned it.
    const validTotalWeight = getTotalAccountWeight();
    const allocatedRatio = Math.min(100, Math.max(0, validTotalWeight)) / 100;
    const totalCapacity = getTotalMonthlyInvestCapacity();
    const yearlyInvest = totalCapacity * 12 * allocatedRatio;
    
    let currentPrincipal = (state.draft.bridgeContext?.currentInvest || 0) * allocatedRatio;
    let currentAssetValue = currentPrincipal;

    const rateYield = state.draft.dividendSim.yield / 100;
    const rateGrowth = state.draft.dividendSim.growth / 100;
    const rateCapital = state.draft.dividendSim.capitalGrowth / 100;
    const isDrip = state.draft.dividendSim.drip;
    const years = state.draft.dividendSim.years;
    
    const annualInflation = Number(state.draft.bridgeContext?.annualExpenseGrowth || 0) / 100;
    
    const results = [];
    
    for (let y = 1; y <= years; y++) {
      currentPrincipal += yearlyInvest;
      currentAssetValue += yearlyInvest;
      
      currentAssetValue *= (1 + rateCapital);
      
      let expectedDividend = currentAssetValue * rateYield * Math.pow(1 + rateGrowth, y - 1);
      let afterTaxDividend = expectedDividend * (1 - DEFAULT_TAX_RATE);
      
      if (isDrip) {
        currentPrincipal += afterTaxDividend;
        currentAssetValue += afterTaxDividend;
      }
      
      // Real value calculation (Current Price)
      const realDiscountFactor = Math.pow(1 + annualInflation, y);
      const realAssetValue = currentAssetValue / Math.max(realDiscountFactor, 1e-9);
      const realAnnualDiv = afterTaxDividend / Math.max(realDiscountFactor, 1e-9);
      
      results.push({
        year: y,
        principal: currentPrincipal,
        assetValue: currentAssetValue,
        realAssetValue: realAssetValue,
        annualDiv: afterTaxDividend,
        realAnnualDiv: realAnnualDiv,
        monthlyDiv: afterTaxDividend / 12,
        realMonthlyDiv: realAnnualDiv / 12,
        isWarning: afterTaxDividend >= (MAX_FINANCIAL_INCOME * 0.9) && afterTaxDividend < MAX_FINANCIAL_INCOME,
        isCritical: afterTaxDividend >= MAX_FINANCIAL_INCOME,
      });
    }
    
    return results;
  }

  function renderDividendSimulation() {
    if (!dom.simTable || !(dom.simChartSvg instanceof SVGElement)) return;
    const data = calculateDividendProjection();
    
    dom.simTable.innerHTML = "";
    let maxDiv = 0;
    let maxAsset = 0;
    let maxRiskLevel = 0; // 0 = ok, 1 = warn, 2 = critical
    
    data.forEach(row => {
      if (row.annualDiv > maxDiv) maxDiv = row.annualDiv;
      if (row.assetValue > maxAsset) maxAsset = row.assetValue;
      if (row.isCritical) maxRiskLevel = 2;
      else if (row.isWarning && maxRiskLevel === 0) maxRiskLevel = 1;
      
      const tr = document.createElement("tr");
      if (row.isCritical) tr.className = "status-critical";
      else if (row.isWarning) tr.className = "status-warn";
      
      tr.innerHTML = `
        <td>${row.year}년</td>
        <td>${formatCurrency(row.principal)}</td>
        <td>${formatCurrency(row.assetValue)}</td>
        <td>${formatCurrency(row.realAssetValue)}</td>
        <td>${formatCurrency(row.annualDiv)}</td>
        <td>${formatCurrency(row.realAnnualDiv)}</td>
        <td>${formatCurrency(row.monthlyDiv)}</td>
        <td>${formatCurrency(row.realMonthlyDiv)}</td>
      `;
      dom.simTable.appendChild(tr);
    });
    
    if (maxRiskLevel === 2) {
      dom.step2Feedback.classList.remove("is-warn");
      showFeedback(`경고: 배당소득이 종합과세 대상(2천만원) 기준을 초과했습니다. 실제 운용 시 ISA/연금저축 등의 절세계좌를 우선적으로 검토하세요.`, true);
    } else if (maxRiskLevel === 1) {
      dom.step2Feedback.classList.add("is-warn"); // Assuming styling might use this later, currently error is true
      showFeedback(`주의: 배당소득이 연간 1,800만원(종합과세 90% 수준)을 초과했습니다.`, true);
    } else {
      dom.step2Feedback.classList.remove("is-warn");
      if (dom.step2Feedback.textContent.includes("종합과세")) clearFeedback();
    }

    dom.simChartSvg.innerHTML = "";
    if (data.length === 0) return;
    
    const width = 600;
    const height = 220;
    const padX = 40;
    const padY = 20;
    const w = width - padX * 2;
    const h = height - padY * 2;
    
    const barWidth = Math.min(30, w / data.length - 4);
    const divScale = maxDiv > 0 ? h / maxDiv : 0;
    const assetScale = maxAsset > 0 ? h / maxAsset : 0;
    
    const axisYGroup = createSvgElement("g", { stroke: "#e2e8f0", fill: "none" });
    [0, 0.5, 1].forEach(tick => {
       const y = height - padY - (h * tick);
       axisYGroup.appendChild(createSvgElement("line", { x1: padX, y1: y, x2: width - padX, y2: y }));
    });
    dom.simChartSvg.appendChild(axisYGroup);

    let linePath = "";
    
    // 툴팁 이벤트 헬퍼
    const setupTooltip = (el, title, values) => {
      if (!dom.simChartTooltip) return;
      el.style.cursor = "pointer";
      
      el.addEventListener("mouseenter", (e) => {
        dom.simChartTooltip.innerHTML = `<strong>${title}</strong><br/>${values.join('<br/>')}`;
        dom.simChartTooltip.hidden = false;
        
        const rect = dom.simChartSvg.getBoundingClientRect();
        dom.simChartTooltip.style.left = `${e.clientX - rect.left}px`;
        dom.simChartTooltip.style.top = `${e.clientY - rect.top - 40}px`;
      });
      
      el.addEventListener("mousemove", (e) => {
        const rect = dom.simChartSvg.getBoundingClientRect();
        const tW = dom.simChartTooltip.offsetWidth;
        let left = e.clientX - rect.left + 15;
        if (left + tW > rect.width) left = e.clientX - rect.left - tW - 15;
        
        dom.simChartTooltip.style.left = `${left}px`;
        dom.simChartTooltip.style.top = `${e.clientY - rect.top - 20}px`;
      });
      
      el.addEventListener("mouseleave", () => {
        dom.simChartTooltip.hidden = true;
      });
    };

    data.forEach((row, i) => {
      const x = padX + (w / data.length) * i + (w / data.length) / 2;
      const barH = Math.max(0, row.annualDiv * divScale);
      const y = height - padY - barH;
      
      const barColor = row.isCritical ? "#ef4444" : (row.isWarning ? "#eab308" : "#3175b6");
      
      const rect = createSvgElement("rect", {
        x: x - barWidth / 2,
        y: y,
        width: Math.max(0, barWidth),
        height: barH,
        fill: barColor,
        rx: 2
      });
      setupTooltip(rect, `${row.year}년차 (배당)`, [
        `연간 배당: ${formatCurrency(row.annualDiv)}`,
        `월평균: ${formatCurrency(row.monthlyDiv)}`
      ]);
      dom.simChartSvg.appendChild(rect);
      
      const textX = createSvgElement("text", {
        x: x,
        y: height - padY + 14,
        "text-anchor": "middle",
        "font-size": "10",
        fill: "#64748b"
      });
      textX.textContent = `${row.year}년`;
      dom.simChartSvg.appendChild(textX);
      
      const assetY = maxAsset > 0 ? height - padY - (row.assetValue * assetScale) : height - padY;
      if (i === 0) linePath += `M ${x} ${assetY} `;
      else linePath += `L ${x} ${assetY} `;
      
      const circle = createSvgElement("circle", { cx: x, cy: assetY, r: 4, fill: "#ea5b2a" });
      setupTooltip(circle, `${row.year}년차 (자산)`, [
        `자산 평가액: ${formatCurrency(row.assetValue)}`,
        `누적 원금: ${formatCurrency(row.principal)}`
      ]);
      dom.simChartSvg.appendChild(circle);
    });
    
    if (linePath) {
      const pathLine = createSvgElement("path", {
        d: linePath,
        fill: "none",
        stroke: "#ea5b2a",
        "stroke-width": 2
      });
      dom.simChartSvg.insertBefore(pathLine, dom.simChartSvg.lastElementChild);
    }
  }

  function renderSummaryChart() {
    const slices = buildSummarySlices();
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    const cashValue = slices.reduce((sum, slice) => {
      return sum + (slice.key === UNALLOCATED_ASSET_KEY ? Number(slice.value || 0) : 0);
    }, 0);
    const stockValue = Math.max(0, total - cashValue);
    const stockPercent = total > 0 ? Math.round((stockValue / total) * 100) : 0;
    const cashPercent = total > 0 ? Math.max(0, 100 - stockPercent) : 0;
    renderDonutChart(dom.summaryDonut, slices, {
      centerTitle: total > 0 ? "주식/현금" : "데이터 없음",
      centerValue: total > 0 ? `${stockPercent}% / ${cashPercent}%` : "",
      ringColor: "rgba(16, 34, 32, 0.1)",
      outerRadius: 110,
      innerRadius: 65,
    });
  }

  function renderAccountChart() {
    if (state.activeChartTab !== "account") {
      if (dom.accountChartCards instanceof HTMLElement) {
        dom.accountChartCards.innerHTML = "";
      }
      return;
    }
    renderAccountChartCards();
  }

  function renderAccountChartCards() {
    if (!(dom.accountChartCards instanceof HTMLElement)) {
      return;
    }
    dom.accountChartCards.innerHTML = "";

    state.draft.accounts.forEach((account) => {
      const card = document.createElement("article");
      card.className = "account-chart-card" + (account.id === state.activeAccountId ? " is-active" : "");
      card.innerHTML = `
        <div class="account-chart-card-head">
          <p class="account-chart-card-title">${IsfUtils.escapeHtml(account.name)}${account.allocations.some(a => a.isImportant) ? " <small>★</small>" : ""}</p>
          <button type="button" class="btn btn-ghost btn-sm" data-focus-account-id="${IsfUtils.escapeHtml(account.id)}">선택</button>
        </div>
        <p class="account-chart-card-meta">계좌 비중 ${formatWeight(account.accountWeight)}%</p>
        <svg class="account-mini-chart" viewBox="0 0 120 120" role="img" aria-label="${IsfUtils.escapeHtml(account.name)} 미니 도넛"></svg>
      `;
      dom.accountChartCards.appendChild(card);

      const miniChart = card.querySelector("svg");
      renderDonutChart(miniChart, buildAccountSlices(account), {
        centerTitle: "계좌",
        centerValue: `${formatPercentInteger(account.accountWeight)}%`,
        ringColor: "rgba(16, 34, 32, 0.1)",
        outerRadius: 43,
        innerRadius: 24,
      });
    });
  }

  function renderAmountBreakdown() {
    if (!(dom.amountBreakdown instanceof HTMLElement)) {
      return;
    }

    const slices = buildSummarySlices();
    const total = slices.reduce((sum, slice) => sum + Number(slice.value || 0), 0);
    if (total <= 0) {
      dom.amountBreakdown.innerHTML = '<p class="muted">입력값이 없어서 표시할 금액이 없습니다.</p>';
      return;
    }

    const rows = slices
      .map((slice) => {
        const value = IsfUtils.sanitizeMoney(slice.value);
        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
        return `
          <li class="amount-breakdown-row ${slice.isImportant ? "is-important" : ""}">
            <span class="amount-breakdown-label">${slice.isImportant ? "★ " : ""}${IsfUtils.escapeHtml(slice.label)}</span>
            <span class="amount-breakdown-percent">${percent}%</span>
            <strong class="amount-breakdown-value">${formatCurrency(value)}</strong>
          </li>
        `;
      })
      .join("");

    dom.amountBreakdown.innerHTML = `
      <ul class="amount-breakdown-list">${rows}</ul>
      <p class="amount-breakdown-total">합계 ${formatCurrency(total)}</p>
    `;
  }

  function renderDonutChart(svgElement, slices, options) {
    if (!(svgElement instanceof SVGElement)) {
      return;
    }

    const config = options && typeof options === "object" ? options : {};
    const isMini = svgElement.classList.contains("account-mini-chart");
    const isSummary = svgElement.id === "summaryDonut";
    
    // 크기 대폭 확장
    const centerX = isSummary ? 250 : (isMini ? 60 : 130);
    const centerY = isSummary ? 200 : (isMini ? 60 : 130);
    const outerRadius = Number(config.outerRadius) > 0 ? Number(config.outerRadius) : (isSummary ? 140 : 95);
    const innerRadius = Number(config.innerRadius) > 0 ? Number(config.innerRadius) : (isSummary ? 95 : 58);
    
    const strokeWidth = outerRadius - innerRadius;
    const radius = innerRadius + strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const safeSlices = Array.isArray(slices) ? slices.filter((slice) => Number(slice.value) > 0) : [];
    const total = safeSlices.reduce((sum, slice) => sum + Number(slice.value || 0), 0);

    svgElement.innerHTML = "";
    // 더 넉넉한 viewBox 설정 (라벨 공간 확보)
    if (isSummary) {
      svgElement.setAttribute("viewBox", "0 0 500 400");
    }

    const track = createSvgElement("circle", {
      cx: centerX,
      cy: centerY,
      r: radius,
      fill: "none",
      stroke: String(config.ringColor || "rgba(16, 34, 32, 0.08)"),
      "stroke-width": strokeWidth,
    });
    svgElement.appendChild(track);

    if (total > 0) {
      let offset = 0;
      safeSlices.forEach((slice) => {
        const value = Number(slice.value || 0);
        if (value <= 0) {
          return;
        }
        const ratio = value / total;
        const dash = circumference * ratio;
        const arc = createSvgElement("circle", {
          cx: centerX,
          cy: centerY,
          r: radius,
          fill: "none",
          stroke: String(slice.color || "#999"),
          "stroke-width": strokeWidth,
          "stroke-dasharray": `${dash} ${Math.max(0, circumference - dash)}`,
          "stroke-dashoffset": String(-offset),
          transform: `rotate(-90 ${centerX} ${centerY})`,
        });
        svgElement.appendChild(arc);

        // 라벨 가시성 개선
        if (isSummary && ratio > 0.02) {
          const startAngle = (offset / circumference) * 2 * Math.PI - Math.PI / 2;
          const endAngle = ((offset + dash) / circumference) * 2 * Math.PI - Math.PI / 2;
          const midAngle = (startAngle + endAngle) / 2;
          
          const labelDist = outerRadius + 15;
          const lx = centerX + labelDist * Math.cos(midAngle);
          const ly = centerY + labelDist * Math.sin(midAngle);
          
          const textGroup = createSvgElement("g", { class: "donut-label" });
          const anchor = lx > centerX ? "start" : "end";
          
          // 텍스트 강조를 위한 후광(Halo) 효과용 복사본
          const labelTextHalo = createSvgElement("text", {
            x: lx, y: ly, "text-anchor": anchor, class: "donut-label-halo"
          });
          labelTextHalo.textContent = (slice.isImportant ? "★ " : "") + slice.label;
          textGroup.appendChild(labelTextHalo);

          const labelText = createSvgElement("text", {
            x: lx, y: ly, "text-anchor": anchor, class: "donut-label-text"
          });
          labelText.textContent = (slice.isImportant ? "★ " : "") + slice.label;
          textGroup.appendChild(labelText);
          
          const labelPercent = createSvgElement("text", {
            x: lx, y: ly + 16, "text-anchor": anchor, class: "donut-label-percent"
          });
          labelPercent.textContent = `${(ratio * 100).toFixed(1)}%`;
          textGroup.appendChild(labelPercent);
          
          svgElement.appendChild(textGroup);
        }

        offset += dash;
      });
    }

    if (config.centerTitle || config.centerValue) {
      if (config.centerTitle) {
        const title = createSvgElement("text", {
          x: centerX,
          y: centerY - 10,
          "text-anchor": "middle",
          "font-size": isMini ? 10 : 15,
          "font-weight": "600",
          fill: "rgba(16, 34, 32, 0.5)",
        });
        title.textContent = String(config.centerTitle);
        svgElement.appendChild(title);
      }
      if (config.centerValue) {
        const value = createSvgElement("text", {
          x: centerX,
          y: centerY + 22,
          "text-anchor": "middle",
          "font-size": isMini ? 11 : 22,
          "font-weight": "800",
          fill: "#102220",
        });
        value.textContent = String(config.centerValue);
        svgElement.appendChild(value);
      }
    }
  }

  function createSvgElement(tagName, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Number.isNaN(value)) {
        element.setAttribute(key, String(value));
      }
    });
    return element;
  }

  function toPortablePortfolio() {
    return {
      id: state.currentPortfolioId || "",
      modelVersion: MODEL_VERSION,
      name: String(state.draft.name || "포트폴리오").trim() || "포트폴리오",
      notes: String(state.draft.notes || ""),
      totalMonthlyInvestCapacity: IsfUtils.sanitizeMoney(state.draft.totalMonthlyInvestCapacity),
      bridgeContext: state.draft.bridgeContext && typeof state.draft.bridgeContext === "object" ? state.draft.bridgeContext : null,
      dividendSim: state.draft.dividendSim && typeof state.draft.dividendSim === "object" ? state.draft.dividendSim : null,
      accounts: state.draft.accounts.map((account) => ({
        id: String(account.id || "").trim() || IsfUtils.createId("account"),
        name: String(account.name || "").trim() || "계좌",
        accountWeight: IsfUtils.sanitizeWeight(account.accountWeight),
        allocations: account.allocations.map((allocation) => ({
          id: String(allocation.id || "").trim() || IsfUtils.createId("alloc"),
          key: String(allocation.key || "").trim() || IsfUtils.createId("asset"),
          label: String(allocation.label || "").trim() || "종목",
          targetWeight: IsfUtils.sanitizeWeight(allocation.targetWeight),
          isImportant: Boolean(allocation.isImportant),
          memo: String(allocation.memo || ""),
        })),
      })),
    };
  }
  function normalizeLoadedPortfolio(source) {
    const raw = source && typeof source === "object" ? source : {};
    const isV2 = Number(raw.modelVersion) === MODEL_VERSION && Array.isArray(raw.accounts);

    function deriveDraftAccounts(rawAccounts, fallbackTotal) {
      const safeAccounts = Array.isArray(rawAccounts) ? rawAccounts : [];
      if (safeAccounts.length === 0) {
        return createDefaultAccounts();
      }
      const hasAccountWeight = safeAccounts.some((account) => Number.isFinite(Number(account?.accountWeight)));
      if (hasAccountWeight) {
        return safeAccounts.map((account) => createDraftAccount(account));
      }

      const totalContribution = safeAccounts.reduce((sum, account) => sum + IsfUtils.sanitizeMoney(account?.monthlyContribution), 0);
      const totalBudget = IsfUtils.sanitizeMoney(fallbackTotal);
      const base = Math.max(totalContribution, totalBudget);
      if (base <= 0) {
        const evenWeight = Math.round((100 / safeAccounts.length) * 100) / 100;
        return safeAccounts.map((account) => createDraftAccount({ ...account, accountWeight: evenWeight, monthlyContribution: undefined }));
      }
      return safeAccounts.map((account) => {
        const monthly = IsfUtils.sanitizeMoney(account?.monthlyContribution);
        return createDraftAccount({
          ...account,
          accountWeight: (monthly / base) * 100,
          monthlyContribution: undefined,
        });
      });
    }

    if (isV2) {
      const totalFromContribution = Array.isArray(raw.accounts)
        ? raw.accounts.reduce((sum, account) => sum + IsfUtils.sanitizeMoney(account?.monthlyContribution), 0)
        : 0;
      const fallbackTotal = IsfUtils.sanitizeMoney(raw.totalMonthlyInvestCapacity || 0)
        || (IsfUtils.sanitizeMoney(raw.unallocatedMonthlyInvest || 0) + totalFromContribution);
      return {
        migrated: false,
        id: String(raw.id || ""),
        updatedAt: Number(raw.updatedAt || Date.now()),
        draft: {
          modelVersion: MODEL_VERSION,
          name: String(raw.name || "포트폴리오"),
          notes: String(raw.notes || ""),
          totalMonthlyInvestCapacity: fallbackTotal,
          bridgeContext: raw.bridgeContext && typeof raw.bridgeContext === "object" ? raw.bridgeContext : null,
          dividendSim: raw.dividendSim && typeof raw.dividendSim === "object" ? raw.dividendSim : { yield: 3.5, growth: 5.0, capitalGrowth: 4.0, years: 10, drip: true },
          accounts: deriveDraftAccounts(raw.accounts, fallbackTotal),
        },
      };
    }

    const legacyAllocations = Array.isArray(raw.targetAllocations)
      ? raw.targetAllocations.map((allocation) => createDraftAllocation(allocation))
      : FALLBACK_ALLOCATIONS.map((allocation) => createDraftAllocation(allocation));

    return {
      migrated: true,
      id: String(raw.id || ""),
      updatedAt: Number(raw.updatedAt || Date.now()),
      draft: {
        modelVersion: MODEL_VERSION,
        name: String(raw.name || "포트폴리오"),
        notes: String(raw.notes || ""),
        totalMonthlyInvestCapacity: 0,
        bridgeContext: null,
        dividendSim: { yield: 3.5, growth: 5.0, capitalGrowth: 4.0, years: 10, drip: true },
        accounts: [
          createDraftAccount({
            name: "통합계좌",
            accountWeight: 100,
            allocations: legacyAllocations,
          }),
        ],
      },
    };
  }

  async function saveCurrentPortfolio() {
    const hub = getHubStorage();
    if (!hub) {
      showFeedback("브라우저 저장소를 사용할 수 없습니다.", true);
      return;
    }

    const validation = validateDraft();
    if (!validation.valid) {
      showFeedback(validation.message, true);
      return;
    }

    const payload = toPortablePortfolio();
    payload.id = state.currentPortfolioId || "";

    try {
      const saved = await hub.saveStep2Portfolio(payload);
      state.currentPortfolioId = saved.id;
      markClean();
      await refreshPortfolioList(saved.id);
      renderPortfolioMeta(`저장 완료 · ${formatDateTime(saved.updatedAt)}`);
      showFeedback("포트폴리오를 저장했습니다.", false);
    } catch (_error) {
      showFeedback("저장 중 오류가 발생했습니다.", true);
    }
  }

  async function refreshPortfolioList(preferredId) {
    const hub = getHubStorage();
    if (!hub) {
      return;
    }
    try {
      const rows = await hub.listStep2Portfolios();
      state.portfolios = Array.isArray(rows) ? rows : [];
      renderPortfolioOptions(preferredId || state.currentPortfolioId);
    } catch (_error) {
      state.portfolios = [];
      renderPortfolioOptions("");
    }
  }

  function getPortfolioAccountCount(portfolio) {
    if (Array.isArray(portfolio?.accounts) && portfolio.accounts.length > 0) {
      return portfolio.accounts.length;
    }
    if (Array.isArray(portfolio?.targetAllocations) && portfolio.targetAllocations.length > 0) {
      return 1;
    }
    return 0;
  }

  function renderPortfolioOptions(selectedId) {
    if (!(dom.portfolioSelect instanceof HTMLSelectElement)) {
      return;
    }
    dom.portfolioSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.portfolios.length > 0 ? "저장된 포트폴리오 선택" : "저장된 포트폴리오 없음";
    dom.portfolioSelect.appendChild(placeholder);

    state.portfolios.forEach((portfolio) => {
      const option = document.createElement("option");
      option.value = String(portfolio.id || "");
      option.textContent = `${portfolio.name} · 계좌 ${getPortfolioAccountCount(portfolio)}개 · ${formatDateTime(portfolio.updatedAt)}`;
      if (selectedId && selectedId === option.value) {
        option.selected = true;
      }
      dom.portfolioSelect.appendChild(option);
    });
  }

  async function loadPortfolioById(portfolioId, options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const hub = getHubStorage();
    if (!hub) {
      showFeedback("브라우저 저장소를 사용할 수 없습니다.", true);
      return;
    }

    if (state.dirty && !safeOptions.skipConfirm) {
      const shouldOverwrite = window.confirm("편집 중인 내용이 있습니다. 선택한 포트폴리오를 불러올까요?");
      if (!shouldOverwrite) {
        return;
      }
    }

    try {
      const loaded = await hub.getStep2PortfolioById(portfolioId);
      if (!loaded) {
        showFeedback("선택한 포트폴리오를 찾을 수 없습니다.", true);
        return;
      }

      const normalized = normalizeLoadedPortfolio(loaded);
      state.currentPortfolioId = normalized.id;
      state.draft = normalized.draft;
      ensureActiveAccountSelected();
      markClean();
      renderDraft();

      if (normalized.migrated) {
        const upgraded = toPortablePortfolio();
        upgraded.id = state.currentPortfolioId;
        await hub.saveStep2Portfolio(upgraded);
        await refreshPortfolioList(state.currentPortfolioId);
        renderPortfolioMeta(`불러오기 완료 · v1 -> v2 자동 변환 · ${formatDateTime(Date.now())}`);
        showFeedback("기존 포트폴리오를 계좌형(v2)으로 자동 변환했습니다.", false);
      } else {
        renderPortfolioMeta(`불러오기 완료 · ${formatDateTime(normalized.updatedAt)}`);
        showFeedback("포트폴리오를 불러왔습니다.", false);
      }
    } catch (_error) {
      showFeedback("포트폴리오 불러오기에 실패했습니다.", true);
    }
  }

  async function deletePortfolioById(portfolioId) {
    const hub = getHubStorage();
    if (!hub) {
      showFeedback("브라우저 저장소를 사용할 수 없습니다.", true);
      return;
    }

    try {
      await hub.deleteStep2Portfolio(portfolioId);
      if (state.currentPortfolioId === portfolioId) {
        resetDraft();
      }
      await refreshPortfolioList("");
      renderPortfolioMeta("포트폴리오를 삭제했습니다.");
      showFeedback("삭제 완료", false);
    } catch (_error) {
      showFeedback("포트폴리오 삭제에 실패했습니다.", true);
    }
  }

  function resetDraft() {
    state.currentPortfolioId = "";
    state.draft = createEmptyDraft();
    ensureActiveAccountSelected();
    setActiveChartTab("summary");
    markClean();
    renderDraft();
    renderPortfolioMeta("새 포트폴리오 작성 모드");
    showFeedback("새 포트폴리오 작성을 시작합니다.", false);
  }

  function renderPortfolioMeta(text) {
    if (dom.portfolioMeta) {
      dom.portfolioMeta.textContent = String(text || "");
    }
  }

  async function refreshBridgeSummary() {
    const hub = getHubStorage();
    try {
      const resolved = await resolveLatestBridgePayload(hub);
      if (!resolved.bridge) {
        renderBridgeInfo(null, hub ? "Step1 브리지 데이터가 없습니다." : "공통 저장소를 찾지 못했고 Step1 로컬 데이터도 없습니다.");
        return;
      }
      const statusBySource = {
        bridge: "",
        "snapshot-fallback": "브리지 기록이 없어 Step1 스냅샷에서 복원했습니다.",
        "local-storage-fallback": "브리지/스냅샷을 찾지 못해 Step1 로컬 저장값에서 복원했습니다.",
      };
      const statusText = statusBySource[resolved.source] || "";
      renderBridgeInfo(resolved.bridge, statusText);
    } catch (_error) {
      renderBridgeInfo(null, "Step1 브리지 데이터를 읽을 수 없습니다.");
    }
  }

  function renderBridgeInfo(bridge, statusText) {
    const payload = bridge && bridge.payload && typeof bridge.payload === "object" ? bridge.payload : null;
    if (dom.bridgeStatus) {
      dom.bridgeStatus.textContent = statusText || "최신 Step1 브리지 데이터 기준";
    }
    if (dom.bridgeTimestamp) {
      dom.bridgeTimestamp.textContent = payload?.timestamp ? formatDateTime(payload.timestamp) : "-";
    }
    if (dom.bridgeMonthlyInvestCapacity) {
      dom.bridgeMonthlyInvestCapacity.textContent = formatCurrency(payload?.monthlyInvestCapacity);
    }
    if (dom.bridgeCurrentCash) {
      dom.bridgeCurrentCash.textContent = formatCurrency(payload?.currentCash);
    }
    if (dom.bridgeCurrentInvest) {
      dom.bridgeCurrentInvest.textContent = formatCurrency(payload?.currentInvest);
    }
    if (dom.bridgeCurrentSavings) {
      dom.bridgeCurrentSavings.textContent = formatCurrency(payload?.currentSavings);
    }
  }

  function buildBridgeMemo(payload) {
    return [
      "[Step1 연계 메모]",
      `기준시점: ${payload.timestamp || "-"}`,
      `월 투자여력: ${formatCurrency(payload.monthlyInvestCapacity)}`,
      `현재 현금: ${formatCurrency(payload.currentCash)}`,
      `현재 투자: ${formatCurrency(payload.currentInvest)}`,
      `현재 저축: ${formatCurrency(payload.currentSavings)}`,
    ].join("\n");
  }

  function buildBridgePayloadFromStep1Snapshot(snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : null;
    const data = safeSnapshot && safeSnapshot.data && typeof safeSnapshot.data === "object" ? safeSnapshot.data : null;
    return buildBridgePayloadFromStep1Inputs(data, safeSnapshot?.createdAt);
  }

  function buildBridgePayloadFromStep1LocalStorage() {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(STEP1_LOCAL_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return buildBridgePayloadFromStep1Inputs(parsed, new Date().toISOString());
    } catch (_error) {
      return null;
    }
  }

  async function resolveLatestBridgePayload(hub) {
    const safeHub = hub && typeof hub === "object" ? hub : null;
    if (!safeHub) {
      const localFallbackPayload = buildBridgePayloadFromStep1LocalStorage();
      if (!localFallbackPayload) {
        return { bridge: null, source: "none" };
      }
      return {
        source: "local-storage-fallback",
        bridge: {
          id: "local-storage-fallback",
          step1SnapshotId: "",
          createdAt: localFallbackPayload.timestamp,
          payload: localFallbackPayload,
        },
      };
    }

    try {
      const bridge = await safeHub.getLatestBridgeStep1ToStep2();
      if (bridge && bridge.payload && typeof bridge.payload === "object") {
        return { bridge, source: "bridge" };
      }
    } catch (_error) {
      // Continue with fallback path.
    }

    if (typeof safeHub.getLatestStep1Snapshot !== "function") {
      return { bridge: null, source: "none" };
    }

    try {
      const snapshot = await safeHub.getLatestStep1Snapshot();
      const fallbackPayload = buildBridgePayloadFromStep1Snapshot(snapshot);
      if (!fallbackPayload) {
        const localFallbackPayload = buildBridgePayloadFromStep1LocalStorage();
        if (!localFallbackPayload) {
          return { bridge: null, source: "none" };
        }
        return {
          source: "local-storage-fallback",
          bridge: {
            id: "local-storage-fallback",
            step1SnapshotId: "",
            createdAt: localFallbackPayload.timestamp,
            payload: localFallbackPayload,
          },
        };
      }
      return {
        source: "snapshot-fallback",
        bridge: {
          id: `snapshot-fallback-${String(snapshot?.id || "latest")}`,
          step1SnapshotId: String(snapshot?.id || ""),
          createdAt: String(snapshot?.createdAt || ""),
          payload: fallbackPayload,
        },
      };
    } catch (_error) {
      const localFallbackPayload = buildBridgePayloadFromStep1LocalStorage();
      if (!localFallbackPayload) {
        return { bridge: null, source: "none" };
      }
      return {
        source: "local-storage-fallback",
        bridge: {
          id: "local-storage-fallback",
          step1SnapshotId: "",
          createdAt: localFallbackPayload.timestamp,
          payload: localFallbackPayload,
        },
      };
    }
  }

  async function importLatestBridgeIntoDraft() {
    const hub = getHubStorage();
    try {
      const resolved = await resolveLatestBridgePayload(hub);
      const bridge = resolved.bridge;
      if (!bridge || !bridge.payload || typeof bridge.payload !== "object") {
        showFeedback("가져올 Step1 데이터가 없습니다.", true);
        await refreshBridgeSummary();
        return;
      }

      const payload = bridge.payload;

      if (!state.draft) {
        state.draft = createEmptyDraft();
      }

      if (!state.draft.name || state.draft.name === "포트폴리오" || state.draft.name.startsWith("Step1 연계 포트폴리오")) {
        state.draft.name = `Step1 연계 포트폴리오 (${new Date().toISOString().slice(0, 10)})`;
      }

      state.draft.totalMonthlyInvestCapacity = IsfUtils.sanitizeMoney(payload.monthlyInvestCapacity);
      state.draft.bridgeContext = {
        timestamp: String(payload.timestamp || ""),
        currentCash: IsfUtils.sanitizeMoney(payload.currentCash),
        currentInvest: IsfUtils.sanitizeMoney(payload.currentInvest),
        currentSavings: IsfUtils.sanitizeMoney(payload.currentSavings),
      };

      if (Array.isArray(payload.investItems) && payload.investItems.length > 0) {
        const totalInvestAmount = payload.investItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        if (totalInvestAmount > 0) {
          const bridgedAccounts = payload.investItems.map((item) => ({
            name: String(item.name || "투자 항목").trim(),
            weight: ((Number(item.amount) || 0) / totalInvestAmount) * 100,
          }));

          let userChoice = "2";
          if (state.draft.accounts.length > 0) {
            const promptMsg = "Step1 계좌(투자 하위항목) 비중이 기존과 다릅니다. 어떻게 처리하시겠습니까?\n\n1. 가져온 데이터로 전부 덮어쓰기\n2. 기존 계좌 비율 조절하여 합계 100%로 정규화하기\n3. 취소";
            userChoice = window.prompt(promptMsg, "1");
          } else {
            userChoice = "1";
          }

          if (userChoice === "pwacanceled" || userChoice === null || userChoice === "3") {
            showFeedback("브리지 데이터 연동을 취소했습니다.", false);
            return;
          }

          if (userChoice === "1") {
            state.draft.accounts = bridgedAccounts.map((ba) => {
              const existing = state.draft.accounts.find((a) => a.name === ba.name);
              if (existing) {
                existing.accountWeight = ba.weight;
                return existing;
              }
              return createDraftAccount({ name: ba.name, accountWeight: ba.weight });
            });
          } else {
            bridgedAccounts.forEach((ba) => {
              const existing = state.draft.accounts.find((a) => a.name === ba.name);
              if (existing) {
                existing.accountWeight = ba.weight;
              } else {
                state.draft.accounts.push(createDraftAccount({ name: ba.name, accountWeight: ba.weight }));
              }
            });
            const newTotal = state.draft.accounts.reduce((sum, acc) => sum + acc.accountWeight, 0);
            if (newTotal > 0) {
              state.draft.accounts.forEach((acc) => {
                acc.accountWeight = (acc.accountWeight / newTotal) * 100;
              });
            }
          }
        }
      }


      const newMemo = buildBridgeMemo(payload);
      if (!state.draft.notes) {
        state.draft.notes = newMemo;
      } else {
        const memoRegex = /\[Step1 연계 메모\][\s\S]*?(?=\n\n|$)/;
        if (memoRegex.test(state.draft.notes)) {
          state.draft.notes = state.draft.notes.replace(memoRegex, newMemo);
        } else {
          state.draft.notes = state.draft.notes + "\n\n" + newMemo;
        }
      }

      ensureActiveAccountSelected();
            setActiveChartTab("summary");
      markDirty();
      renderDraft();
      await saveCurrentPortfolio();
      const importStatusBySource = {
        bridge: "Step1 최신 데이터를 편집기에 반영했습니다.",
        "snapshot-fallback": "Step1 스냅샷 기반으로 최신 데이터를 반영했습니다.",
        "local-storage-fallback": "Step1 로컬 저장값 기반으로 데이터를 반영했습니다.",
      };
      renderBridgeInfo(bridge, importStatusBySource[resolved.source] || "Step1 데이터를 편집기에 반영했습니다.");
      renderPortfolioMeta("Step1 브리지 데이터 반영 완료");
      showFeedback("Step1 월 투자여력을 Step2 월 투자 가능 금액으로 반영했습니다.", false);
    } catch (_error) {
      showFeedback("Step1 데이터 가져오기에 실패했습니다.", true);
    }
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "변경사항이 있습니다. 나가시겠습니까?";
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      // bfcache 복원 후 DOM 렌더링이 완전히 안정화될 시간을 확보 (iOS Safari 등 대응)
      setTimeout(() => {
        requestAnimationFrame(() => renderCharts());
      }, 150);
    }
  });

})();
