(function initStep2PortfolioMvp() {
  "use strict";

  const DEFAULT_ASSETS = [
    { key: "domestic-stock", label: "국내주식", targetWeight: 25, memo: "" },
    { key: "global-stock", label: "해외주식", targetWeight: 35, memo: "" },
    { key: "bond", label: "채권", targetWeight: 20, memo: "" },
    { key: "cash-like", label: "현금성", targetWeight: 20, memo: "" },
  ];

  const dom = {
    loadStep1Data: document.getElementById("loadStep1Data"),
    bridgeStatus: document.getElementById("bridgeStatus"),
    bridgeTimestamp: document.getElementById("bridgeTimestamp"),
    bridgeMonthlyInvestCapacity: document.getElementById("bridgeMonthlyInvestCapacity"),
    bridgeCurrentCash: document.getElementById("bridgeCurrentCash"),
    bridgeCurrentInvest: document.getElementById("bridgeCurrentInvest"),
    bridgeCurrentSavings: document.getElementById("bridgeCurrentSavings"),
    portfolioName: document.getElementById("portfolioName"),
    portfolioNotes: document.getElementById("portfolioNotes"),
    assetList: document.getElementById("assetList"),
    addAsset: document.getElementById("addAsset"),
    assetSummary: document.getElementById("assetSummary"),
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
    draft: createEmptyDraft(),
    dirty: false,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderDraft();
    void refreshBridgeSummary();
    void refreshPortfolioList();
  });

  function getHubStorage() {
    const hub = window.IsfHubStorage;
    if (!hub || typeof hub !== "object") {
      return null;
    }
    const required = [
      "getLatestBridgeStep1ToStep2",
      "saveStep2Portfolio",
      "listStep2Portfolios",
      "getStep2PortfolioById",
      "deleteStep2Portfolio",
    ];
    return required.every((name) => typeof hub[name] === "function") ? hub : null;
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

    if (dom.portfolioName) {
      dom.portfolioName.addEventListener("input", () => {
        state.draft.name = String(dom.portfolioName.value || "");
        markDirty();
        renderAssetSummary();
      });
    }

    if (dom.portfolioNotes) {
      dom.portfolioNotes.addEventListener("input", () => {
        state.draft.notes = String(dom.portfolioNotes.value || "");
        markDirty();
      });
    }

    if (dom.assetList) {
      dom.assetList.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const row = target.closest("[data-asset-id]");
        if (!row) {
          return;
        }
        const assetId = row.getAttribute("data-asset-id") || "";
        const asset = state.draft.assets.find((item) => item.id === assetId);
        if (!asset) {
          return;
        }
        if (target instanceof HTMLInputElement && target.dataset.field === "label") {
          asset.label = target.value;
        }
        if (target instanceof HTMLInputElement && target.dataset.field === "targetWeight") {
          asset.targetWeight = sanitizeWeight(target.value);
        }
        if (target instanceof HTMLInputElement && target.dataset.field === "memo") {
          asset.memo = target.value;
        }
        markDirty();
        renderAssetSummary();
      });

      dom.assetList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const removeId = target.getAttribute("data-remove-asset-id");
        if (!removeId) {
          return;
        }
        if (state.draft.assets.length <= 1) {
          showFeedback("자산군은 최소 1개 이상 필요합니다.");
          return;
        }
        state.draft.assets = state.draft.assets.filter((item) => item.id !== removeId);
        markDirty();
        renderDraftAssets();
      });
    }

    if (dom.addAsset) {
      dom.addAsset.addEventListener("click", () => {
        state.draft.assets.push(createDraftAsset({
          label: `자산군 ${state.draft.assets.length + 1}`,
          targetWeight: 0,
          memo: "",
        }));
        markDirty();
        renderDraftAssets();
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
          showFeedback("불러올 포트폴리오를 선택하세요.");
          return;
        }
        await loadPortfolioById(selectedId);
      });
    }

    if (dom.deletePortfolio) {
      dom.deletePortfolio.addEventListener("click", async () => {
        const selectedId = dom.portfolioSelect instanceof HTMLSelectElement ? dom.portfolioSelect.value : "";
        if (!selectedId) {
          showFeedback("삭제할 포트폴리오를 선택하세요.");
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

  function createAssetId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "asset-" + window.crypto.randomUUID();
    }
    return "asset-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
  }

  function createDraftAsset(source = {}) {
    return {
      id: createAssetId(),
      key: String(source.key || "").trim() || createAssetId(),
      label: String(source.label || "").trim() || "자산군",
      targetWeight: sanitizeWeight(source.targetWeight),
      memo: String(source.memo || ""),
    };
  }

  function createEmptyDraft() {
    return {
      name: "내 포트폴리오",
      notes: "",
      assets: DEFAULT_ASSETS.map((item) => createDraftAsset(item)),
    };
  }

  function sanitizeWeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.round(numeric * 100) / 100);
  }

  function formatCurrency(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "-";
    }
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(Math.round(numeric));
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

  function showFeedback(message, isError) {
    if (!dom.step2Feedback) {
      return;
    }
    dom.step2Feedback.hidden = false;
    dom.step2Feedback.textContent = message;
    dom.step2Feedback.classList.toggle("is-error", Boolean(isError));
  }

  function markDirty() {
    state.dirty = true;
  }

  function markClean() {
    state.dirty = false;
  }

  function renderDraft() {
    if (dom.portfolioName) {
      dom.portfolioName.value = state.draft.name;
    }
    if (dom.portfolioNotes) {
      dom.portfolioNotes.value = state.draft.notes;
    }
    renderDraftAssets();
    renderAssetSummary();
  }

  function renderDraftAssets() {
    if (!dom.assetList) {
      return;
    }
    dom.assetList.innerHTML = "";

    state.draft.assets.forEach((asset, index) => {
      const row = document.createElement("div");
      row.className = "asset-row";
      row.setAttribute("data-asset-id", asset.id);
      row.innerHTML = `
        <input type="text" data-field="label" value="${escapeHtml(asset.label)}" aria-label="자산군 ${index + 1} 이름" />
        <input type="number" min="0" max="100" step="0.01" data-field="targetWeight" value="${asset.targetWeight}" aria-label="자산군 ${index + 1} 목표 비중" />
        <input type="text" data-field="memo" value="${escapeHtml(asset.memo)}" aria-label="자산군 ${index + 1} 메모" />
        <button type="button" class="btn btn-ghost" data-remove-asset-id="${asset.id}">삭제</button>
      `;
      dom.assetList.appendChild(row);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getTotalWeight() {
    return state.draft.assets.reduce((sum, asset) => sum + sanitizeWeight(asset.targetWeight), 0);
  }

  function validateDraft() {
    const name = String(state.draft.name || "").trim();
    if (!name) {
      return { valid: false, message: "포트폴리오 이름을 입력하세요." };
    }
    if (!Array.isArray(state.draft.assets) || state.draft.assets.length === 0) {
      return { valid: false, message: "자산군을 1개 이상 입력하세요." };
    }
    if (state.draft.assets.some((asset) => !String(asset.label || "").trim())) {
      return { valid: false, message: "자산군 이름이 비어 있습니다." };
    }
    const totalWeight = getTotalWeight();
    if (Math.abs(totalWeight - 100) > 0.01) {
      return { valid: false, message: "목표 비중 합계는 100%여야 합니다." };
    }
    return { valid: true, message: "" };
  }

  function renderAssetSummary() {
    if (!dom.assetSummary) {
      return;
    }
    const totalWeight = getTotalWeight();
    const diff = Math.abs(totalWeight - 100);
    const valid = diff <= 0.01;
    dom.assetSummary.textContent = valid
      ? `목표 비중 합계 ${totalWeight.toFixed(2)}% (정상)`
      : `목표 비중 합계 ${totalWeight.toFixed(2)}% (100% 기준 미충족)`;
    dom.assetSummary.classList.toggle("is-error", !valid);
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

    const payload = {
      id: state.currentPortfolioId || "",
      name: String(state.draft.name || "").trim(),
      notes: String(state.draft.notes || ""),
      targetAllocations: state.draft.assets.map((asset) => ({
        key: String(asset.key || "").trim() || createAssetId(),
        label: String(asset.label || "").trim(),
        targetWeight: sanitizeWeight(asset.targetWeight),
        memo: String(asset.memo || ""),
      })),
    };

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
      if (!preferredId && !state.currentPortfolioId && state.portfolios.length > 0) {
        state.currentPortfolioId = state.portfolios[0].id;
      }
    } catch (_error) {
      state.portfolios = [];
      renderPortfolioOptions("");
    }
  }

  function renderPortfolioOptions(selectedId) {
    if (!(dom.portfolioSelect instanceof HTMLSelectElement)) {
      return;
    }
    dom.portfolioSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.portfolios.length > 0
      ? "저장된 포트폴리오 선택"
      : "저장된 포트폴리오 없음";
    dom.portfolioSelect.appendChild(placeholder);

    state.portfolios.forEach((portfolio) => {
      const option = document.createElement("option");
      option.value = portfolio.id;
      option.textContent = `${portfolio.name} · ${formatDateTime(portfolio.updatedAt)}`;
      if (selectedId && selectedId === portfolio.id) {
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
      state.currentPortfolioId = loaded.id;
      state.draft = {
        name: String(loaded.name || "포트폴리오"),
        notes: String(loaded.notes || ""),
        assets: Array.isArray(loaded.targetAllocations) && loaded.targetAllocations.length > 0
          ? loaded.targetAllocations.map((asset) => createDraftAsset(asset))
          : DEFAULT_ASSETS.map((asset) => createDraftAsset(asset)),
      };
      markClean();
      renderDraft();
      renderPortfolioMeta(`불러오기 완료 · ${formatDateTime(loaded.updatedAt)}`);
      showFeedback("포트폴리오를 불러왔습니다.", false);
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
    markClean();
    renderDraft();
    renderPortfolioMeta("새 포트폴리오 작성 모드");
    showFeedback("새 포트폴리오 작성을 시작합니다.", false);
  }

  function renderPortfolioMeta(text) {
    if (!dom.portfolioMeta) {
      return;
    }
    dom.portfolioMeta.textContent = text || "";
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
      state.draft = {
        name: `Step1 연계 포트폴리오 (${new Date().toISOString().slice(0, 10)})`,
        notes: [
          `기준시점: ${payload.timestamp || "-"}`,
          `월 투자여력: ${formatCurrency(payload.monthlyInvestCapacity)}`,
          `현금: ${formatCurrency(payload.currentCash)} / 투자: ${formatCurrency(payload.currentInvest)} / 저축: ${formatCurrency(payload.currentSavings)}`,
        ].join("\n"),
        assets: DEFAULT_ASSETS.map((asset) => createDraftAsset(asset)),
      };
      markClean();
      renderDraft();
      renderBridgeInfo(bridge, "Step1 최신 데이터를 편집기에 반영했습니다.");
      renderPortfolioMeta("Step1 브리지 데이터 반영 완료");
      showFeedback("Step1 최신 데이터를 반영했습니다.", false);
    } catch (_error) {
      showFeedback("Step1 데이터 가져오기에 실패했습니다.", true);
    }
  }
})();
