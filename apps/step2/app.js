(function initStep2PortfolioMvpV2() {
  "use strict";

  const MODEL_VERSION = 2;
  const UNALLOCATED_ASSET_KEY = "__unallocated__";

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
    accountDonut: document.getElementById("accountDonut"),
    summaryLegend: document.getElementById("summaryLegend"),
    accountLegend: document.getElementById("accountLegend"),
    accountChartCards: document.getElementById("accountChartCards"),
    focusedAccountTitle: document.getElementById("focusedAccountTitle"),
    portfolioName: document.getElementById("portfolioName"),
    portfolioNotes: document.getElementById("portfolioNotes"),
    totalMonthlyInvestCapacity: document.getElementById("totalMonthlyInvestCapacity"),
    addAccount: document.getElementById("addAccount"),
    accountList: document.getElementById("accountList"),
    accountSummary: document.getElementById("accountSummary"),
    allocationEditorTitle: document.getElementById("allocationEditorTitle"),
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
    bindEvents();
    ensureActiveAccountSelected();
    renderDraft();
    void refreshBridgeSummary();
    void refreshPortfolioList();
  });

  function getHubStorage() {
    const hub = window.IsfHubStorage;
    if (!hub || typeof hub !== "object") {
      return null;
    }
    const required = ["getLatestBridgeStep1ToStep2", "saveStep2Portfolio", "listStep2Portfolios", "getStep2PortfolioById", "deleteStep2Portfolio"];
    return required.every((name) => typeof hub[name] === "function") ? hub : null;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  }

  function sanitizeAmount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.round(numeric));
  }

  function sanitizeWeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    const rounded = Math.round(numeric * 100) / 100;
    if (rounded < 0) {
      return 0;
    }
    if (rounded > 100) {
      return 100;
    }
    return rounded;
  }

  function formatWeight(value) {
    return sanitizeWeight(value).toFixed(2);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(sanitizeAmount(value));
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
      id: String(safe.id || "").trim() || createId("alloc"),
      key: String(safe.key || "").trim() || createId("asset"),
      label: String(safe.label || "").trim() || "자산군",
      targetWeight: sanitizeWeight(safe.targetWeight),
      memo: String(safe.memo || ""),
    };
  }

  function createDraftAccount(source) {
    const safe = source && typeof source === "object" ? source : {};
    const rawAllocations = Array.isArray(safe.allocations) ? safe.allocations : FALLBACK_ALLOCATIONS;
    const allocations = rawAllocations.map((item) => createDraftAllocation(item));
    return {
      id: String(safe.id || "").trim() || createId("account"),
      name: String(safe.name || "").trim() || "계좌",
      accountWeight: sanitizeWeight(safe.accountWeight),
      allocations: allocations.length > 0 ? allocations : [createDraftAllocation({ label: "자산군 1", targetWeight: 100 })],
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function showFeedback(message, isError) {
    if (!(dom.step2Feedback instanceof HTMLElement)) {
      return;
    }
    dom.step2Feedback.hidden = false;
    dom.step2Feedback.textContent = message;
    dom.step2Feedback.classList.toggle("is-error", Boolean(isError));
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
  }

  function markClean() {
    state.dirty = false;
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
    const first = state.draft.accounts[0] || null;
    state.activeAccountId = first ? first.id : "";
    return first;
  }

  function setActiveAccount(accountId) {
    const account = getAccountById(accountId);
    if (!account) {
      return;
    }
    state.activeAccountId = account.id;
    renderAccountList();
    renderAllocationEditor();
    renderCharts();
  }

  function setActiveChartTab(tabKey) {
    state.activeChartTab = tabKey === "account" ? "account" : "summary";
    renderChartTabs();
  }

  function getAllocationWeightTotal(account) {
    if (!account || !Array.isArray(account.allocations)) {
      return 0;
    }
    return account.allocations.reduce((sum, allocation) => sum + sanitizeWeight(allocation.targetWeight), 0);
  }

  function isAllocationTotalValid(account) {
    return Math.abs(getAllocationWeightTotal(account) - 100) <= 0.01;
  }

  function getTotalAccountWeight() {
    return state.draft.accounts.reduce((sum, account) => sum + sanitizeWeight(account.accountWeight), 0);
  }

  function getTotalMonthlyInvestCapacity() {
    return sanitizeAmount(state.draft.totalMonthlyInvestCapacity);
  }

  function getAccountAllocatedAmount(account) {
    const totalCapacity = getTotalMonthlyInvestCapacity();
    const accountWeight = sanitizeWeight(account?.accountWeight);
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
      const accountWeight = sanitizeWeight(account.accountWeight);
      if (accountWeight < 0 || accountWeight > 100) {
        return { valid: false, message: `${accountLabel}: 계좌 비중은 0~100%여야 합니다.` };
      }
      if (!Array.isArray(account.allocations) || account.allocations.length === 0) {
        return { valid: false, message: `${accountLabel}: 자산군을 1개 이상 입력하세요.` };
      }
      if (account.allocations.some((allocation) => !String(allocation.label || "").trim())) {
        return { valid: false, message: `${accountLabel}: 자산군 이름이 비어 있습니다.` };
      }
      if (!isAllocationTotalValid(account)) {
        return { valid: false, message: `${accountLabel}: 비중 합계가 100%여야 합니다.` };
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
        state.draft.totalMonthlyInvestCapacity = sanitizeAmount(dom.totalMonthlyInvestCapacity.value);
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
        renderAllocationEditor();
        renderAccountSummary();
        renderCharts();
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
          account.accountWeight = sanitizeWeight(target.value);
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
          setActiveAccount(selectId);
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
          state.activeAccountId = state.draft.accounts[0] ? state.draft.accounts[0].id : "";
        }
        markDirty();
        renderAccountList();
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
        account.allocations.push(createDraftAllocation({ label: `자산군 ${account.allocations.length + 1}`, targetWeight: 0 }));
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
          allocation.targetWeight = sanitizeWeight(target.value);
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
          showFeedback("자산군은 최소 1개 이상 필요합니다.", true);
          return;
        }
        account.allocations = account.allocations.filter((allocation) => allocation.id !== removeId);
        markDirty();
        renderAllocationEditor();
        renderCharts();
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
        setActiveAccount(accountId);
        setActiveChartTab("account");
      });
    }

    if (dom.savePortfolio) {
      dom.savePortfolio.addEventListener("click", async () => {
        await saveCurrentPortfolio();
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
      dom.totalMonthlyInvestCapacity.value = String(sanitizeAmount(state.draft.totalMonthlyInvestCapacity));
    }
    renderChartTabs();
    renderAccountList();
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
    }
    if (dom.accountChartPane) {
      dom.accountChartPane.hidden = isSummary;
    }
    if (dom.chartMeta) {
      dom.chartMeta.textContent = isSummary
        ? "종합 도넛은 월 투자 가능 금액에서 계좌/종목 비중으로 계산하고, 남는 금액은 자동 현금 처리합니다."
        : "계좌별 도넛은 선택 계좌의 자산 비중(%) 기준입니다.";
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
        <input type="text" data-field="accountName" value="${escapeHtml(account.name)}" aria-label="계좌 ${index + 1} 이름" />
        <input type="number" min="0" max="100" step="0.01" data-field="accountWeight" value="${formatWeight(account.accountWeight)}" aria-label="계좌 ${index + 1} 비중" />
        <div class="account-row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-select-account-id="${escapeHtml(account.id)}">${account.id === state.activeAccountId ? "편집중" : "선택"}</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-remove-account-id="${escapeHtml(account.id)}">삭제</button>
      `;
      dom.accountList.appendChild(row);
    });
  }

  function renderAllocationEditor() {
    const account = ensureActiveAccountSelected();
    if (dom.allocationEditorTitle) {
      dom.allocationEditorTitle.textContent = account ? `자산군 구성 · ${account.name}` : "자산군 구성";
    }

    if (!(dom.allocationList instanceof HTMLElement)) {
      return;
    }
    dom.allocationList.innerHTML = "";

    if (!account) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "편집할 계좌가 없습니다.";
      dom.allocationList.appendChild(empty);
      renderAllocationSummary();
      return;
    }

    account.allocations.forEach((allocation, index) => {
      const row = document.createElement("div");
      row.className = "allocation-row";
      row.setAttribute("data-allocation-id", allocation.id);
      row.innerHTML = `
        <input type="text" data-field="label" value="${escapeHtml(allocation.label)}" aria-label="자산군 ${index + 1} 이름" />
        <input type="number" min="0" max="100" step="0.01" data-field="targetWeight" value="${formatWeight(allocation.targetWeight)}" aria-label="자산군 ${index + 1} 목표 비중" />
        <input type="text" data-field="memo" value="${escapeHtml(allocation.memo)}" aria-label="자산군 ${index + 1} 메모" />
        <button type="button" class="btn btn-ghost btn-sm" data-remove-allocation-id="${escapeHtml(allocation.id)}">삭제</button>
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
    const valid = isAllocationTotalValid(account);
    dom.allocationSummary.textContent = valid
      ? `비중 합계 ${totalWeight.toFixed(2)}% (정상)`
      : `비중 합계 ${totalWeight.toFixed(2)}% (100% 기준 미충족)`;
    dom.allocationSummary.classList.toggle("is-error", !valid);
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
        const weight = sanitizeWeight(allocation.targetWeight);
        const amount = Math.round((accountBudget * weight) / 100);
        if (amount <= 0) {
          return;
        }
        const key = String(allocation.key || "").trim() || String(allocation.label || "").trim() || "asset";
        const label = String(allocation.label || "").trim() || "자산군";
        const prev = bucket.get(key);
        if (prev) {
          prev.value += amount;
        } else {
          bucket.set(key, { key, label, value: amount, color: getAssetColor(key, label) });
        }
      });
    });

    const slices = Array.from(bucket.values()).sort((a, b) => b.value - a.value);
    const autoCash = getAutoCashAmount();
    if (autoCash > 0) {
      slices.push({ key: UNALLOCATED_ASSET_KEY, label: "현금(자동)", value: autoCash, color: getAssetColor(UNALLOCATED_ASSET_KEY, "현금") });
    }
    return slices;
  }

  function buildAccountSlices(account) {
    if (!account || !Array.isArray(account.allocations)) {
      return [];
    }
    return account.allocations
      .map((allocation) => {
        const label = String(allocation.label || "").trim() || "자산군";
        const key = String(allocation.key || "").trim() || label;
        const value = sanitizeWeight(allocation.targetWeight);
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
  }

  function renderSummaryChart() {
    const slices = buildSummarySlices();
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    renderDonutChart(dom.summaryDonut, slices, {
      centerTitle: "월 투자금 합계",
      centerValue: total > 0 ? formatCurrency(total) : "데이터 없음",
      ringColor: "rgba(16, 34, 32, 0.1)",
      outerRadius: 95,
      innerRadius: 58,
    });
    renderLegend(dom.summaryLegend, slices, total, (slice) => {
      const percent = total > 0 ? ((slice.value / total) * 100).toFixed(1) : "0.0";
      return `${formatCurrency(slice.value)} · ${percent}%`;
    });
  }

  function renderAccountChart() {
    renderAccountChartCards();

    const account = ensureActiveAccountSelected();
    if (!account) {
      renderDonutChart(dom.accountDonut, [], {
        centerTitle: "계좌 없음",
        centerValue: "데이터 없음",
        ringColor: "rgba(16, 34, 32, 0.1)",
        outerRadius: 95,
        innerRadius: 58,
      });
      renderLegend(dom.accountLegend, [], 0, () => "-");
      if (dom.focusedAccountTitle) {
        dom.focusedAccountTitle.textContent = "계좌 선택";
      }
      return;
    }

    const slices = buildAccountSlices(account);
    const totalWeight = slices.reduce((sum, slice) => sum + slice.value, 0);
    const accountBudget = getAccountAllocatedAmount(account);
    if (dom.focusedAccountTitle) {
      dom.focusedAccountTitle.textContent = `${account.name} · 계좌 비중 ${formatWeight(account.accountWeight)}% · ${formatCurrency(accountBudget)}`;
    }

    renderDonutChart(dom.accountDonut, slices, {
      centerTitle: "계좌 비중",
      centerValue: totalWeight > 0 ? `${totalWeight.toFixed(2)}%` : "데이터 없음",
      ringColor: "rgba(16, 34, 32, 0.1)",
      outerRadius: 95,
      innerRadius: 58,
    });
    renderLegend(dom.accountLegend, slices, totalWeight, (slice) => `${slice.value.toFixed(2)}% · ${formatCurrency(slice.expectedAmount)}`);
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
          <p class="account-chart-card-title">${escapeHtml(account.name)}</p>
          <button type="button" class="btn btn-ghost btn-sm" data-focus-account-id="${escapeHtml(account.id)}">보기</button>
        </div>
        <p class="account-chart-card-meta">계좌 비중 ${formatWeight(account.accountWeight)}% · ${formatCurrency(getAccountAllocatedAmount(account))}</p>
        <svg class="account-mini-chart" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(account.name)} 미니 도넛"></svg>
      `;
      dom.accountChartCards.appendChild(card);

      const miniChart = card.querySelector("svg");
      renderDonutChart(miniChart, buildAccountSlices(account), {
        centerTitle: "",
        centerValue: "",
        ringColor: "rgba(16, 34, 32, 0.1)",
        outerRadius: 42,
        innerRadius: 25,
      });
    });
  }

  function renderLegend(container, slices, total, formatter) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.innerHTML = "";

    if (!Array.isArray(slices) || slices.length === 0 || total <= 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "표시할 데이터가 없습니다.";
      container.appendChild(empty);
      return;
    }

    slices.forEach((slice) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-dot" style="background:${escapeHtml(slice.color)}"></span>
        <span class="legend-label">${escapeHtml(slice.label)}</span>
        <span class="legend-value">${escapeHtml(formatter(slice))}</span>
      `;
      container.appendChild(item);
    });
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
        const dash = circumference * (value / total);
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
      totalMonthlyInvestCapacity: sanitizeAmount(state.draft.totalMonthlyInvestCapacity),
      bridgeContext: state.draft.bridgeContext && typeof state.draft.bridgeContext === "object" ? state.draft.bridgeContext : null,
      accounts: state.draft.accounts.map((account) => ({
        id: String(account.id || "").trim() || createId("account"),
        name: String(account.name || "").trim() || "계좌",
        accountWeight: sanitizeWeight(account.accountWeight),
        allocations: account.allocations.map((allocation) => ({
          id: String(allocation.id || "").trim() || createId("alloc"),
          key: String(allocation.key || "").trim() || createId("asset"),
          label: String(allocation.label || "").trim() || "자산군",
          targetWeight: sanitizeWeight(allocation.targetWeight),
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

      const totalContribution = safeAccounts.reduce((sum, account) => sum + sanitizeAmount(account?.monthlyContribution), 0);
      const totalBudget = sanitizeAmount(fallbackTotal);
      const base = Math.max(totalContribution, totalBudget);
      if (base <= 0) {
        const evenWeight = Math.round((100 / safeAccounts.length) * 100) / 100;
        return safeAccounts.map((account) => createDraftAccount({ ...account, accountWeight: evenWeight, monthlyContribution: undefined }));
      }
      return safeAccounts.map((account) => {
        const monthly = sanitizeAmount(account?.monthlyContribution);
        return createDraftAccount({
          ...account,
          accountWeight: (monthly / base) * 100,
          monthlyContribution: undefined,
        });
      });
    }

    if (isV2) {
      const totalFromContribution = Array.isArray(raw.accounts)
        ? raw.accounts.reduce((sum, account) => sum + sanitizeAmount(account?.monthlyContribution), 0)
        : 0;
      const fallbackTotal = sanitizeAmount(raw.totalMonthlyInvestCapacity || 0)
        || (sanitizeAmount(raw.unallocatedMonthlyInvest || 0) + totalFromContribution);
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

  async function loadPortfolioById(portfolioId) {
    const hub = getHubStorage();
    if (!hub) {
      showFeedback("브라우저 저장소를 사용할 수 없습니다.", true);
      return;
    }

    if (state.dirty) {
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
    if (!hub) {
      renderBridgeInfo(null, "공통 저장소를 사용할 수 없습니다.");
      return;
    }

    try {
      const bridge = await hub.getLatestBridgeStep1ToStep2();
      renderBridgeInfo(bridge, bridge ? "" : "Step1 브리지 데이터가 없습니다.");
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

  async function importLatestBridgeIntoDraft() {
    const hub = getHubStorage();
    if (!hub) {
      showFeedback("공통 저장소를 사용할 수 없습니다.", true);
      return;
    }

    try {
      const bridge = await hub.getLatestBridgeStep1ToStep2();
      if (!bridge || !bridge.payload || typeof bridge.payload !== "object") {
        showFeedback("가져올 Step1 데이터가 없습니다.", true);
        await refreshBridgeSummary();
        return;
      }

      const payload = bridge.payload;
      state.currentPortfolioId = "";
      state.draft = createEmptyDraft();
      state.draft.name = `Step1 연계 포트폴리오 (${new Date().toISOString().slice(0, 10)})`;
      state.draft.totalMonthlyInvestCapacity = sanitizeAmount(payload.monthlyInvestCapacity);
      state.draft.bridgeContext = {
        timestamp: String(payload.timestamp || ""),
        currentCash: sanitizeAmount(payload.currentCash),
        currentInvest: sanitizeAmount(payload.currentInvest),
        currentSavings: sanitizeAmount(payload.currentSavings),
      };
      state.draft.notes = buildBridgeMemo(payload);

      ensureActiveAccountSelected();
      setActiveChartTab("summary");
      markClean();
      renderDraft();
      renderBridgeInfo(bridge, "Step1 최신 데이터를 편집기에 반영했습니다.");
      renderPortfolioMeta("Step1 브리지 데이터 반영 완료");
      showFeedback("Step1 월 투자여력을 Step2 월 투자 가능 금액으로 반영했습니다.", false);
    } catch (_error) {
      showFeedback("Step1 데이터 가져오기에 실패했습니다.", true);
    }
  }
})();
