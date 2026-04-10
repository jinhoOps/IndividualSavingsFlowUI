(function initStep2PortfolioMvpV2() {
  "use strict";

  const MODEL_VERSION = 2;
  const UNALLOCATED_ASSET_KEY = "__unallocated__";
  const STEP1_UNIT_TO_WON = 10000;
  const STEP1_LOCAL_STORAGE_KEY = "isf-rebuild-v1";
  const SHARE_STATE_KEY = "my-portfolio-flow";
  const SHARE_STATE_SCHEMA = 2;
  const HASH_STATE_PARAM = "s";

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
    saveChanges: document.getElementById("saveChanges"),
    discardChanges: document.getElementById("discardChanges"),
    importJsonFile: document.getElementById("importJsonFile"),
    copyShareLink: document.getElementById("copyShareLink"),
    applyFeedback: document.getElementById("applyFeedback"),
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
    if (hash) {
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

    const hub = getHubStorage();
    if (!hash && hub) {
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
      appVersion: "0.2.1",
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

  function step1AmountToWon(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.round(numeric * STEP1_UNIT_TO_WON));
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
      monthlyInvestCapacity: step1AmountToWon(safeInputs.monthlyInvest),
      currentCash: step1AmountToWon(safeInputs.startCash),
      currentInvest: step1AmountToWon(safeInputs.startInvest),
      currentSavings: step1AmountToWon(safeInputs.startSavings),
      timestamp: String(timestamp || new Date().toISOString()),
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

    function markDirty() {
    state.dirty = true;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
  }

    function markClean() {
    state.dirty = false;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, false);
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

    if (dom.saveChanges) {
      dom.saveChanges.addEventListener("click", async () => {
        await saveCurrentPortfolio();
      });
    }

    if (dom.discardChanges) {
      dom.discardChanges.addEventListener("click", async () => {
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
      row.setAttribute("data-allocation-id", allocation.id);
      row.setAttribute("draggable", "false"); // Enabled on mousedown/longpress
      
      // Desktop mousedown and pointerdown to enable drag
      row.onmousedown = (e) => {
        if (e.target instanceof HTMLInputElement) {
          row.setAttribute("draggable", "false");
        } else {
          row.setAttribute("draggable", "true");
        }
      };

      row.innerHTML = `
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
        } else {
          bucket.set(key, { key, label, value: amount, color: getAssetColor(key, label) });
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
        };
      })
      .filter((slice) => slice.value > 0);
  }
  function renderCharts() {
    renderSummaryChart();
    renderAccountChart();
    renderAmountBreakdown();
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
          <p class="account-chart-card-title">${IsfUtils.escapeHtml(account.name)}</p>
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
          <li class="amount-breakdown-row">
            <span class="amount-breakdown-label">${IsfUtils.escapeHtml(slice.label)}</span>
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
    const centerX = svgElement.classList.contains("account-mini-chart") ? 60 : 130;
    const centerY = svgElement.classList.contains("account-mini-chart") ? 60 : 130;
    const outerRadius = Number(config.outerRadius) > 0 ? Number(config.outerRadius) : 95;
    const innerRadius = Number(config.innerRadius) > 0 ? Number(config.innerRadius) : 58;
    const strokeWidth = outerRadius - innerRadius;
    const radius = innerRadius + strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const safeSlices = Array.isArray(slices) ? slices.filter((slice) => Number(slice.value) > 0) : [];
    const total = safeSlices.reduce((sum, slice) => sum + Number(slice.value || 0), 0);

    svgElement.innerHTML = "";
    const track = createSvgElement("circle", {
      cx: centerX,
      cy: centerY,
      r: radius,
      fill: "none",
      stroke: String(config.ringColor || "rgba(16, 34, 32, 0.12)"),
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

        // Add Label if slice is significant enough (> 3% to avoid too many labels)
        if (!svgElement.classList.contains("account-mini-chart") && ratio > 0.03) {
          const startAngle = (offset / circumference) * 2 * Math.PI - Math.PI / 2;
          const endAngle = ((offset + dash) / circumference) * 2 * Math.PI - Math.PI / 2;
          const midAngle = (startAngle + endAngle) / 2;
          
          const labelDist = outerRadius + 15;
          const lx = centerX + labelDist * Math.cos(midAngle);
          const ly = centerY + labelDist * Math.sin(midAngle);
          
          const textGroup = createSvgElement("g", { class: "donut-label" });
          
          const anchor = lx > centerX ? "start" : "end";
          const labelText = createSvgElement("text", {
            x: lx,
            y: ly,
            "text-anchor": anchor,
            class: "donut-label-text"
          });
          labelText.textContent = slice.label;
          textGroup.appendChild(labelText);
          
          const labelPercent = createSvgElement("text", {
            x: lx,
            y: ly + 14,
            "text-anchor": anchor,
            class: "donut-label-percent"
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
          y: centerY - 7,
          "text-anchor": "middle",
          "font-size": svgElement.classList.contains("account-mini-chart") ? 10 : 13,
          "font-weight": "600",
          fill: "rgba(16, 34, 32, 0.66)",
        });
        title.textContent = String(config.centerTitle);
        svgElement.appendChild(title);
      }
      if (config.centerValue) {
        const value = createSvgElement("text", {
          x: centerX,
          y: centerY + 16,
          "text-anchor": "middle",
          "font-size": svgElement.classList.contains("account-mini-chart") ? 10 : 15,
          "font-weight": "700",
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
      element.setAttribute(key, String(value));
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
      accounts: state.draft.accounts.map((account) => ({
        id: String(account.id || "").trim() || IsfUtils.createId("account"),
        name: String(account.name || "").trim() || "계좌",
        accountWeight: IsfUtils.sanitizeWeight(account.accountWeight),
        allocations: account.allocations.map((allocation) => ({
          id: String(allocation.id || "").trim() || IsfUtils.createId("alloc"),
          key: String(allocation.key || "").trim() || IsfUtils.createId("asset"),
          label: String(allocation.label || "").trim() || "종목",
          targetWeight: IsfUtils.sanitizeWeight(allocation.targetWeight),
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
      state.currentPortfolioId = "";
      state.draft = createEmptyDraft();
      state.draft.name = `Step1 연계 포트폴리오 (${new Date().toISOString().slice(0, 10)})`;
      state.draft.totalMonthlyInvestCapacity = IsfUtils.sanitizeMoney(payload.monthlyInvestCapacity);
      state.draft.bridgeContext = {
        timestamp: String(payload.timestamp || ""),
        currentCash: IsfUtils.sanitizeMoney(payload.currentCash),
        currentInvest: IsfUtils.sanitizeMoney(payload.currentInvest),
        currentSavings: IsfUtils.sanitizeMoney(payload.currentSavings),
      };
      state.draft.notes = buildBridgeMemo(payload);

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
      requestAnimationFrame(() => renderCharts());
    }
  });

})();
