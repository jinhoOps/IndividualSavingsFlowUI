(function initStep2PortfolioMvpV2() {
  "use strict";

  const MODEL_VERSION = 2;
  const UNALLOCATED_ASSET_KEY = "__unallocated__";
  const STEP1_LOCAL_STORAGE_KEY = "isf-rebuild-v1";
  const SHARE_STATE_KEY = "my-portfolio-flow";
  const SHARE_STATE_SCHEMA = 2;
  const HASH_STATE_PARAM = "s";
  const MAX_FINANCIAL_INCOME = 20000000;
  const DEFAULT_TAX_RATE = 0.154;

  const DEFAULT_ACCOUNT_TEMPLATES = [
    { name: "국내주식", accountWeight: 34, allocations: [{ key: "kr-samsung", label: "삼성전자", targetWeight: 40 }, { key: "kr-sk-hynix", label: "SK하이닉스", targetWeight: 35 }, { key: "kr-hyundai", label: "현대차", targetWeight: 25 }] },
    { name: "ISA", accountWeight: 33, allocations: [{ key: "fund-kospi", label: "코스피", targetWeight: 30 }, { key: "fund-nasdaq100", label: "나스닥100", targetWeight: 40 }, { key: "fund-dow-dividend", label: "미국배당다우존스", targetWeight: 30 }] },
    { name: "해외주식", accountWeight: 33, allocations: [{ key: "us-nasdaq100", label: "나스닥100", targetWeight: 60 }, { key: "us-tesla", label: "Tesla", targetWeight: 20 }, { key: "us-amd", label: "AMD", targetWeight: 20 }] }
  ];

  const FALLBACK_ALLOCATIONS = [{ key: "domestic-stock", label: "국내주식", targetWeight: 35 }, { key: "global-stock", label: "해외주식", targetWeight: 35 }, { key: "bond", label: "채권", targetWeight: 20 }, { key: "cash-like", label: "현금성", targetWeight: 10 }];
  const ASSET_COLORS = ["#ea5b2a", "#1e8b7c", "#3175b6", "#d97706", "#7c3aed", "#e11d48", "#0f766e", "#64748b"];

  const dom = {
    appHeader: document.querySelector("app-header"),
    dataHubModal: document.querySelector("data-hub-modal"),
    bridgeBanner: document.getElementById("bridgeBanner"),
    dismissBridgeBanner: document.getElementById("dismissBridgeBanner"),
    loadStep1Data: document.getElementById("loadStep1Data"),
    bridgeTimestamp: document.getElementById("bridgeTimestamp"),
    bridgeMonthlyInvestCapacity: document.getElementById("bridgeMonthlyInvestCapacity"),
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
    accountList: document.getElementById("accountList"),
    accountSummary: document.getElementById("accountSummary"),
    savePortfolio: document.getElementById("savePortfolio"),
    resetPortfolio: document.getElementById("resetPortfolio"),
    pendingBar: document.getElementById("pendingBar"),
    pendingSummary: document.getElementById("pendingSummary"),
    applyChanges: document.getElementById("applyChanges"),
    cancelChanges: document.getElementById("cancelChanges"),
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
    isDashboardMode: false,
    isReturningUser: false
  };
  const colorCache = new Map();
  const TEMP_STORAGE_KEY = "isf-step2-draft-tmp";

  document.addEventListener("DOMContentLoaded", () => {
    state.draft = createEmptyDraft();
    const hash = window.location.hash;

    const savedTmp = sessionStorage.getItem(TEMP_STORAGE_KEY);
    if (savedTmp && !hash) {
      try {
        const parsed = JSON.parse(savedTmp);
        if (parsed?.draft) {
          state.draft = parsed.draft; state.currentPortfolioId = parsed.currentPortfolioId || "";
          state.activeAccountId = parsed.activeAccountId || ""; state.dirty = true;
          IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
        }
      } catch (e) { console.error(e); }
    } else if (hash) {
      try {
        const payload = IsfShare.decodePayloadFromHash(new URLSearchParams(hash.replace(/^#/, "")).get(HASH_STATE_PARAM), SHARE_STATE_KEY);
        if (payload) { const norm = normalizeLoadedPortfolio(payload); state.draft = norm.draft; state.currentPortfolioId = norm.id || ""; }
      } catch (_e) { showFeedback("복원 실패", true); }
    }
    
    bindEvents(); 
    checkReturningUser().then(() => {
      renderDraft(); 
      checkBridgeData();
    });

    new IsfPwaManager({
      appVersion: "0.4.0", appKey: SHARE_STATE_KEY,
      onFeedback: (msg) => IsfFeedback.showFeedback(dom.applyFeedback, msg),
      getCurrentData: () => state.draft,
    }).init();
  });

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

  async function checkBridgeData() {
    const hub = getHubStorage();
    const res = await resolveLatestBridgePayload(hub);
    const p = res.bridge?.payload;
    if (p && p.monthlyInvestCapacity !== state.draft.totalMonthlyInvestCapacity) {
      if (dom.bridgeBanner) {
        dom.bridgeBanner.hidden = false;
        if (dom.bridgeTimestamp) dom.bridgeTimestamp.textContent = formatDateTime(p.timestamp);
        if (dom.bridgeMonthlyInvestCapacity) dom.bridgeMonthlyInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
      }
    }
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

    dom.dataHubModal.addEventListener("backup-now", async () => {
      // Step 2 백업 로직 (필요 시 구현)
      if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 기능은 곧 지원됩니다.");
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
    if (dom.dismissBridgeBanner) dom.dismissBridgeBanner.addEventListener("click", () => { if (dom.bridgeBanner) dom.bridgeBanner.hidden = true; });
    if (dom.loadStep1Data) dom.loadStep1Data.addEventListener("click", async () => { if (state.dirty && !confirm("현재 수정한 내용을 덮어쓸까요?")) return; await importLatestBridgeIntoDraft(); if (dom.bridgeBanner) dom.bridgeBanner.hidden = true; });
    if (dom.chartTabSummary) dom.chartTabSummary.addEventListener("click", () => { state.activeChartTab = "summary"; renderChartTabs(); renderCharts(); });
    if (dom.chartTabAccount) dom.chartTabAccount.addEventListener("click", () => { state.activeChartTab = "account"; renderChartTabs(); renderCharts(); });
    if (dom.totalMonthlyInvestCapacity) dom.totalMonthlyInvestCapacity.addEventListener("input", () => { state.draft.totalMonthlyInvestCapacity = IsfUtils.sanitizeMoney(dom.totalMonthlyInvestCapacity.value); markDirty(); renderAccountSummary(); renderCharts(); });
    if (dom.addAccount) dom.addAccount.addEventListener("click", () => { const acc = createDraftAccount({ name: `계좌 ${state.draft.accounts.length + 1}` }); state.draft.accounts.push(acc); state.activeAccountId = acc.id; markDirty(); renderDraft(); });
    if (dom.accountList) {
      dom.accountList.addEventListener("input", (e) => {
        const accRow = e.target.closest("[data-account-id]");
        const allocRow = e.target.closest("[data-allocation-id]");
        const acc = getAccountById(accRow?.dataset.accountId); if (!acc) return;

        if (allocRow) {
          const al = acc.allocations.find(i => i.id === allocRow.dataset.allocationId); if (!al) return;
          if (e.target.dataset.field === "label") al.label = e.target.value;
          if (e.target.dataset.field === "targetWeight") al.targetWeight = IsfUtils.sanitizeWeight(e.target.value);
          if (e.target.dataset.field === "actualAmount") al.actualAmount = IsfUtils.sanitizeMoney(e.target.value);
          if (e.target.dataset.field === "memo") al.memo = e.target.value;
        } else {
          if (e.target.dataset.field === "accountName") acc.name = e.target.value;
          if (e.target.dataset.field === "accountWeight") acc.accountWeight = IsfUtils.sanitizeWeight(e.target.value);
        }
        markDirty(); renderAccountSummary(); renderCharts();
      });
      dom.accountList.addEventListener("click", (e) => {
        const accRow = e.target.closest("[data-account-id]");
        const accId = accRow?.dataset.accountId;
        
        const selId = e.target.dataset.selectAccountId || e.target.closest(".account-row-head")?.dataset.selectAccountId;
        if (selId) { state.activeAccountId = (state.activeAccountId === selId ? "" : selId); renderAccountList(); return; }
        
        const rid = e.target.dataset.removeAccountId;
        if (rid && confirm("계좌를 삭제하시겠습니까?")) {
          state.draft.accounts = state.draft.accounts.filter(a => a.id !== rid);
          if (state.activeAccountId === rid) state.activeAccountId = "";
          markDirty(); renderDraft();
          return;
        }

        const addAlId = e.target.dataset.addAllocationId;
        if (addAlId) {
          const acc = getAccountById(addAlId);
          if (acc) { acc.allocations.push(createDraftAllocation({ label: `종목 ${acc.allocations.length + 1}` })); markDirty(); renderAccountList(); renderCharts(); }
          return;
        }

        const remAlId = e.target.dataset.removeAllocationId;
        if (remAlId) {
          const acc = getAccountById(accId);
          if (acc && confirm("종목을 삭제하시겠습니까?")) { acc.allocations = acc.allocations.filter(a => a.id !== remAlId); markDirty(); renderAccountList(); renderCharts(); }
          return;
        }

        const tid = e.target.dataset.toggleImportant || e.target.closest(".btn-toggle-star")?.dataset.toggleImportant;
        if (tid) {
          const acc = getAccountById(accId);
          const al = acc?.allocations.find(i => i.id === tid);
          if (al) { al.isImportant = !al.isImportant; markDirty(); renderAccountList(); renderCharts(); }
          return;
        }
      });
    }
    if (dom.savePortfolio) dom.savePortfolio.addEventListener("click", saveCurrentPortfolio);
    if (dom.applyChanges) dom.applyChanges.addEventListener("click", saveCurrentPortfolio);
    if (dom.cancelChanges) dom.cancelChanges.addEventListener("click", async () => { if (state.currentPortfolioId) await loadPortfolioById(state.currentPortfolioId, { skipConfirm: true }); else resetDraft(); });
  }

  function renderDraft() {
    if (dom.portfolioName) dom.portfolioName.value = state.draft.name;
    if (dom.portfolioNotes) dom.portfolioNotes.value = state.draft.notes;
    if (dom.totalMonthlyInvestCapacity) dom.totalMonthlyInvestCapacity.value = state.draft.totalMonthlyInvestCapacity;
    renderChartTabs(); renderAccountList(); renderAccountSummary(); renderCharts();
  }

  function renderChartTabs() {
    const isSum = state.activeChartTab === "summary";
    dom.chartTabSummary?.classList.toggle("is-active", isSum); dom.chartTabAccount?.classList.toggle("is-active", !isSum);
    dom.summaryChartPane.hidden = !isSum; dom.accountChartPane.hidden = isSum;
  }

  function renderAccountList() {
    dom.accountList.innerHTML = state.draft.accounts.map(a => {
      const isActive = a.id === state.activeAccountId;
      const totalAlWeight = getAllocationWeightTotal(a);
      return `
      <div class="account-card ${isActive ? "is-active" : ""}" data-account-id="${a.id}">
        <div class="account-row-head" data-select-account-id="${a.id}">
          <div class="account-info">
            <input type="text" data-field="accountName" value="${IsfUtils.escapeHtml(a.name)}" placeholder="계좌명" onclick="event.stopPropagation()"/>
            <div class="account-meta">
              <input type="number" data-field="accountWeight" value="${a.accountWeight}" step="0.1" onclick="event.stopPropagation()"/>
              <span class="unit">%</span>
            </div>
          </div>
          <div class="account-actions">
            <button class="btn btn-ghost btn-sm" data-remove-account-id="${a.id}" onclick="event.stopPropagation()">삭제</button>
            <span class="chevron">${isActive ? "▲" : "▼"}</span>
          </div>
        </div>
        
        ${isActive ? `
        <div class="allocation-editor">
          <div class="allocation-table-head">
            <span></span>
            <span>종목명</span>
            <span>목표(%)</span>
            <span>현재액(만)</span>
            <span></span>
          </div>
          <div class="allocation-list">
            ${a.allocations.map(al => `
              <div class="allocation-row ${al.isImportant ? "is-important" : ""}" data-allocation-id="${al.id}">
                <button class="btn-toggle-star ${al.isImportant ? "is-active" : ""}" data-toggle-important="${al.id}">${al.isImportant ? "★" : "☆"}</button>
                <input type="text" data-field="label" value="${IsfUtils.escapeHtml(al.label)}" placeholder="종목명" />
                <input type="number" data-field="targetWeight" value="${al.targetWeight}" step="0.1" />
                <input type="number" data-field="actualAmount" value="${al.actualAmount}" step="1" inputmode="decimal" />
                <button class="btn btn-ghost btn-sm" data-remove-allocation-id="${al.id}">삭제</button>
              </div>
            `).join("")}
          </div>
          <div class="allocation-footer">
            <span class="total ${totalAlWeight > 100.01 ? "is-error" : ""}">합계: ${totalAlWeight.toFixed(1)}%</span>
            <button class="btn btn-ghost btn-sm" data-add-allocation-id="${a.id}">+ 종목 추가</button>
          </div>
        </div>
        ` : ""}
      </div>
    `}).join("");
  }

  function renderAccountSummary() { const total = getTotalAccountWeight(); dom.accountSummary.textContent = `전체 계좌 비중 합계: ${total.toFixed(2)}% / 자동 현금: ${formatCurrency(getAutoCashAmount())}`; dom.accountSummary.classList.toggle("is-error", total > 100.01); }

  function renderCharts() { renderSummaryChart(); renderAccountChartCards(); renderAmountBreakdown(); renderDividendSimulation(); }
  function renderSummaryChart() { const slices = buildSummarySlices(); renderDonutChart(dom.summaryDonut, slices, { centerValue: formatCurrency(getTotalMonthlyInvestCapacity()) }); }
  function renderAccountChartCards() { dom.accountChartCards.innerHTML = state.draft.accounts.map(a => `<div class="account-chart-card ${a.id === state.activeAccountId ? "is-active" : ""}"><p>${a.name} (${a.accountWeight}%)</p><button class="btn btn-ghost btn-sm" data-select-account-id="${a.id}">선택</button></div>`).join(""); }
  function renderAmountBreakdown() { 
    const slices = buildSummarySlices(); 
    dom.amountBreakdown.innerHTML = `<ul class="amount-breakdown-list">` + slices.map(s => `
      <li class="amount-breakdown-row ${s.isImportant ? "is-important" : ""}">
        <span class="amount-breakdown-label">${s.label}</span>
        <span class="amount-breakdown-percent">${((s.value / getTotalMonthlyInvestCapacity()) * 100).toFixed(1)}%</span>
        <strong class="amount-breakdown-value">${formatCurrency(s.value)}</strong>
      </li>
    `).join("") + `</ul>`; 
  }

  async function refreshBridgeSummary() {
    const hub = getHubStorage(); const bridgePanel = document.getElementById("bridgePanel");
    try {
      const res = await resolveLatestBridgePayload(hub); renderBridgeInfo(res.bridge);
      const isEmpty = getTotalMonthlyInvestCapacity() === 0; if (bridgePanel) bridgePanel.hidden = !isEmpty || !res.bridge;
    } catch (_e) { if (bridgePanel) bridgePanel.hidden = true; }
  }

  function renderBridgeInfo(b) {
    const p = b?.payload; if (dom.bridgeStatus) dom.bridgeStatus.textContent = "Step1 데이터 연결 대기";
    if (dom.bridgeTimestamp) dom.bridgeTimestamp.textContent = p?.timestamp ? formatDateTime(p.timestamp) : "-";
    if (dom.bridgeMonthlyInvestCapacity) dom.bridgeMonthlyInvestCapacity.textContent = formatCurrency(p?.monthlyInvestCapacity);
    if (dom.bridgeCurrentCash) dom.bridgeCurrentCash.textContent = formatCurrency(p?.currentCash);
    if (dom.bridgeCurrentInvest) dom.bridgeCurrentInvest.textContent = formatCurrency(p?.currentInvest);
  }

  async function resolveLatestBridgePayload(hub) { if (!hub) return { bridge: null }; try { const b = await hub.getLatestBridgeStep1ToStep2(); return b?.payload ? { bridge: b } : { bridge: null }; } catch (_e) { return { bridge: null }; } }
  async function importLatestBridgeIntoDraft() { const hub = getHubStorage(); const res = await resolveLatestBridgePayload(hub); if (res.bridge?.payload) { state.draft.totalMonthlyInvestCapacity = res.bridge.payload.monthlyInvestCapacity; renderDraft(); markDirty(); showFeedback("데이터 가져오기 완료"); } }

  function buildSummarySlices() {
    const total = getTotalMonthlyInvestCapacity(); if (total <= 0) return [];
    const bucket = new Map();
    state.draft.accounts.forEach(acc => {
      const budget = Math.round(total * IsfUtils.sanitizeWeight(acc.accountWeight) / 100);
      acc.allocations.forEach(al => {
        const amt = Math.round(budget * IsfUtils.sanitizeWeight(al.targetWeight) / 100); if (amt <= 0) return;
        const key = al.key || al.label; const prev = bucket.get(key);
        if (prev) { prev.value += amt; if (al.isImportant) prev.isImportant = true; }
        else bucket.set(key, { label: al.label, value: amt, color: getAssetColor(key), isImportant: al.isImportant });
      });
    });
    const slices = Array.from(bucket.values());
    const cash = getAutoCashAmount(); if (cash > 0) slices.push({ label: "자동 현금", value: cash, color: "#8a8f98" });
    return slices.sort((a, b) => b.value - a.value);
  }

  function getAssetColor(key) { if (!colorCache.has(key)) colorCache.set(key, ASSET_COLORS[colorCache.size % ASSET_COLORS.length]); return colorCache.get(key); }

  function renderDonutChart(svg, slices, cfg) {
    if (!svg) return; svg.innerHTML = ""; const total = slices.reduce((s, al) => s + al.value, 0); if (total <= 0) return;
    const r = 80; const sw = 30; const circum = 2 * Math.PI * r; let offset = 0;
    slices.forEach(s => {
      const ratio = s.value / total; const dash = circum * ratio;
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      arc.setAttribute("cx", "150"); arc.setAttribute("cy", "150"); arc.setAttribute("r", r);
      arc.setAttribute("fill", "none"); arc.setAttribute("stroke", s.color); arc.setAttribute("stroke-width", sw);
      arc.setAttribute("stroke-dasharray", `${dash} ${circum - dash}`); arc.setAttribute("stroke-dashoffset", -offset);
      arc.setAttribute("transform", "rotate(-90 150 150)"); svg.appendChild(arc);
      offset += dash;
    });
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "150"); text.setAttribute("y", "155"); text.setAttribute("text-anchor", "middle"); text.textContent = cfg.centerValue;
    svg.appendChild(text);
  }

  function renderDividendSimulation() {
    if (!dom.simTable || !dom.simChartSvg) return;
    const years = state.draft.dividendSim?.years || 10;
    const yieldRate = (state.draft.dividendSim?.yield || 3.5) / 100;
    const total = getTotalMonthlyInvestCapacity();
    let asset = 0; dom.simTable.innerHTML = "";
    for (let i = 1; i <= years; i++) {
      asset += total * 12; const div = asset * yieldRate;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i}년</td><td>-</td><td>${formatCurrency(asset)}</td><td>-</td><td>${formatCurrency(div)}</td><td>-</td><td>${formatCurrency(div/12)}</td><td>-</td>`;
      dom.simTable.appendChild(tr);
    }
  }

  function saveCurrentPortfolio() {
    const hub = getHubStorage();
    if (!hub) return;
    if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
    hub.saveStep2Portfolio(toPortablePortfolio()).then(() => {
      markClean();
      refreshPortfolioList().then(() => {
        if (dom.dataHubModal) dom.dataHubModal.updatePortfolioList(state.portfolios);
      });
      if (dom.appHeader) dom.appHeader.updateStatus("success", "브라우저에 저장됨");
    }).catch(() => {
      if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
    });
  }

  async function loadPortfolioById(id, options = {}) {
    const hub = getHubStorage();
    if (!hub) return;
    const p = await hub.getStep2PortfolioById(id);
    if (p) {
      state.draft = p;
      state.currentPortfolioId = id;
      renderDraft();
      markClean();
      if (!options.skipConfirm && dom.appHeader) dom.appHeader.updateStatus("success", "포트폴리오 로드됨");
    }
  }

  async function deletePortfolioById(id) {
    const hub = getHubStorage();
    if (!hub) return;
    await hub.deleteStep2Portfolio(id);
    if (state.currentPortfolioId === id) resetDraft();
    await refreshPortfolioList();
    if (dom.appHeader) dom.appHeader.updateStatus("success", "삭제되었습니다.");
  }

  async function refreshPortfolioList() {
    const hub = getHubStorage();
    const rows = await (hub?.listStep2Portfolios() || []);
    state.portfolios = rows || [];
  }
  function toPortablePortfolio() { return { ...state.draft, id: state.currentPortfolioId }; }
  function normalizeLoadedPortfolio(s) { return { draft: s, id: s.id }; }
  function resetDraft() { state.draft = createEmptyDraft(); state.currentPortfolioId = ""; renderDraft(); markClean(); }

})();
