const MONEY_UNIT = 10000;
const STORAGE_KEY = "isf-rebuild-v1";
const SHARE_STATE_KEY = "my-household-flow";
const SHARE_STATE_SCHEMA = 1;
const HASH_STATE_PARAM = "s";
const SHARE_DB_NAME = "isf-share-pointer-db-v1";
const SHARE_DB_VERSION = 1;
const SHARE_DB_STORE = "shareSnapshots";
const VIEW_MODE_GUIDE_DISMISSED_KEY = "isf-view-guide-dismissed-v1";
const MANUAL_BACKUP_WINDOW_MS = 60 * 1000;
const MAX_INCOME_ITEMS = 12;
const MAX_ALLOCATION_ITEMS = 20;
const SANKEY_VALUE_MODES = {
  AMOUNT: "amount",
  PERCENT: "percent",
};
const SANKEY_SORT_MODES = {
  GROUP: "group",
  AMOUNT_DESC: "amount-desc",
  AMOUNT_ASC: "amount-asc",
  NAME_ASC: "name-asc",
};
const ITEM_SORT_MODES = {
  DEFAULT: "default",
  AMOUNT_ASC: "amount-asc",
  AMOUNT_DESC: "amount-desc",
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
};
const SANKEY_ZOOM_MIN = 1;
const SANKEY_ZOOM_MAX = 2.6;
const SANKEY_ZOOM_STEP = 0.2;
const SANKEY_MOBILE_BASE_ZOOM = 0.85;
const SANKEY_MOBILE_HEIGHT_RATIO = 0.62;
const SANKEY_MOBILE_WIDTH_SCALE = 1.38;
const SANKEY_MOBILE_MIN_COLUMN_STEP = 126;
const SANKEY_MOBILE_MIN_COLUMN_STEP_WITH_INFLOW = 110;
const MOBILE_LAYOUT_QUERY = "(max-width: 760px)";

const DEFAULT_EXPENSE_ITEMS = [
  { id: "rent", name: "주거비(월세)", amount: 60 },
  { id: "maintenance", name: "관리비", amount: 10 },
  { id: "telecom", name: "통신비", amount: 5 },
  { id: "transport", name: "교통비", amount: 10 },
  { id: "food", name: "식비", amount: 40 },
  { id: "etc", name: "기타생활비", amount: 20 },
];

const DEFAULT_SAVINGS_ITEMS = [
  { id: "youth-saving", name: "청년적금", amount: 70, annualRate: 3.6 },
  { id: "housing-subscription", name: "주택청약", amount: 5, annualRate: 2.9 },
];

const DEFAULT_INVEST_ITEMS = [
  { id: "global-stock", name: "해외주식", amount: 30 },
  { id: "isa", name: "ISA", amount: 30 },
  { id: "gold-spot", name: "금현물", amount: 3 },
];

const DEFAULT_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 300 },
  ],
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  savingsItems: DEFAULT_SAVINGS_ITEMS,
  investItems: DEFAULT_INVEST_ITEMS,
  monthlyExpense: 145,
  monthlySavings: 75,
  monthlyInvest: 63,
  monthlyDebtPayment: 0,
  startCash: 100,
  startSavings: 3000,
  startInvest: 3000,
  startDebt: 0,
  annualIncomeGrowth: 4.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 3.0,
  annualInvestReturn: 9.5,
  annualDebtInterest: 4.2,
  horizonYears: 10,
};

const SAMPLE_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 310 },
    { id: "income-side", name: "부수입", amount: 20 },
  ],
  expenseItems: [
    { id: "rent", name: "주거비(월세)", amount: 65 },
    { id: "general-maintenance", name: "일반관리비", amount: 8, group: "공과금" },
    { id: "electricity", name: "전기세", amount: 6, group: "공과금" },
    { id: "water", name: "수도세", amount: 3, group: "공과금" },
    { id: "gas", name: "가스비", amount: 5, group: "공과금" },
    { id: "telecom", name: "통신비", amount: 6 },
    { id: "transport", name: "교통비", amount: 12 },
    { id: "food", name: "식비", amount: 45 },
    { id: "etc", name: "기타생활비", amount: 10 },
  ],
  savingsItems: [
    { id: "youth-saving", name: "청년적금", amount: 70, annualRate: 3.3 },
    { id: "housing-subscription", name: "주택청약", amount: 20, annualRate: 2.8 },
  ],
  investItems: [
    { id: "global-stock", name: "해외주식", amount: 30 },
    { id: "isa", name: "ISA", amount: 15 },
    { id: "gold-spot", name: "금현물", amount: 5 },
  ],
  monthlyExpense: 160,
  monthlySavings: 90,
  monthlyInvest: 50,
  monthlyDebtPayment: 15,
  startCash: 120,
  startSavings: 800,
  startInvest: 500,
  startDebt: 300,
  annualIncomeGrowth: 3.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 3.0,
  annualInvestReturn: 6.5,
  annualDebtInterest: 4.5,
  horizonYears: 5,
};

function createResetInputs(baseInputs = DEFAULT_INPUTS) {
  const safeBase = baseInputs && typeof baseInputs === "object" ? baseInputs : DEFAULT_INPUTS;
  return {
    incomes: Array.isArray(safeBase.incomes) && safeBase.incomes.length > 0
      ? safeBase.incomes.map((item, index) => createIncomeItem({
        id: item?.id,
        name: item?.name ?? `수입 ${index + 1}`,
        amount: item?.amount,
      }))
      : cloneInputs(DEFAULT_INPUTS.incomes),
    expenseItems: (Array.isArray(safeBase.expenseItems) ? safeBase.expenseItems : DEFAULT_EXPENSE_ITEMS)
      .map((item, index) => ({
        id: typeof item?.id === "string" && item.id.trim()
          ? item.id.trim()
          : createAllocationItemId("expense", index),
        name: normalizeAllocationName(item?.name, "생활비", index),
        amount: 0,
        ...(normalizeAllocationGroupName(item?.group) ? { group: normalizeAllocationGroupName(item?.group) } : {}),
      })),
    savingsItems: (Array.isArray(safeBase.savingsItems) ? safeBase.savingsItems : DEFAULT_SAVINGS_ITEMS)
      .map((item, index) => ({
        id: typeof item?.id === "string" && item.id.trim()
          ? item.id.trim()
          : createAllocationItemId("savings", index),
        name: normalizeAllocationName(item?.name, "저축", index),
        amount: 0,
        annualRate: sanitizeSavingsAnnualRate(item?.annualRate, safeBase.annualSavingsYield),
        ...(normalizeAllocationGroupName(item?.group) ? { group: normalizeAllocationGroupName(item?.group) } : {}),
        ...(normalizeMaturityMonth(item?.maturityMonth) ? { maturityMonth: normalizeMaturityMonth(item?.maturityMonth) } : {}),
      })),
    investItems: (Array.isArray(safeBase.investItems) ? safeBase.investItems : DEFAULT_INVEST_ITEMS)
      .map((item, index) => ({
        id: typeof item?.id === "string" && item.id.trim()
          ? item.id.trim()
          : createAllocationItemId("invest", index),
        name: normalizeAllocationName(item?.name, "투자", index),
        amount: 0,
        ...(normalizeAllocationGroupName(item?.group) ? { group: normalizeAllocationGroupName(item?.group) } : {}),
        ...(normalizeMaturityMonth(item?.maturityMonth) ? { maturityMonth: normalizeMaturityMonth(item?.maturityMonth) } : {}),
      })),
    monthlyExpense: 0,
    monthlySavings: 0,
    monthlyInvest: 0,
    monthlyDebtPayment: 0,
    startCash: 0,
    startSavings: 0,
    startInvest: 0,
    startDebt: 0,
    annualIncomeGrowth: IsfUtils.sanitizeRate(safeBase.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: IsfUtils.sanitizeRate(safeBase.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield: IsfUtils.sanitizeRate(safeBase.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20),
    annualInvestReturn: IsfUtils.sanitizeRate(safeBase.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: IsfUtils.sanitizeRate(safeBase.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: 3,
  };
}

const FORM_FIELD_KEYS = [
  "monthlyDebtPayment",
  "startCash",
  "startSavings",
  "startInvest",
  "startDebt",
  "annualIncomeGrowth",
  "annualExpenseGrowth",
  "annualSavingsYield",
  "annualInvestReturn",
  "annualDebtInterest",
  "horizonYears",
];

const TONE_COLORS = {
  income: "#1e8b7c",
  expense: "#c9573c",
  savings: "#3175b6",
  invest: "#5d4fb3",
  debt: "#8c3d65",
  surplus: "#2f9e44",
  deficit: "#d6336c",
};

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const backupTimestampFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const sankeyTextMeasureCanvas = document.createElement("canvas");
const sankeyTextMeasureContext = sankeyTextMeasureCanvas.getContext("2d");
const mobileLayoutMediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);
let backupDbPromise = null;
let shareDbPromise = null;

const dom = {
  controlsPanel: document.querySelector(".controls-panel"),
  inputsForm: document.getElementById("inputsForm"),
  inputsPanelContent: document.getElementById("inputsPanelContent"),
  toggleInputsMobile: document.getElementById("toggleInputsMobile"),
  copyShareLink: document.getElementById("copyShareLink"),
  exportJson: document.getElementById("exportJson"),
  importJson: document.getElementById("importJson"),
  importJsonFile: document.getElementById("importJsonFile"),
  backupMenu: document.getElementById("backupMenu"),
  shareMenu: document.getElementById("shareMenu"),
  moreActionsMenu: document.getElementById("moreActionsMenu"),
  backupNow: document.getElementById("backupNow"),
  backupSelect: document.getElementById("backupSelect"),
  restoreBackup: document.getElementById("restoreBackup"),
  backupHelp: document.getElementById("backupHelp"),
  loadSample: document.getElementById("loadSample"),
  resetInputs: document.getElementById("resetInputs"),
  easterEgg: document.getElementById("easterEgg"),
  addIncomeItem: document.getElementById("addIncomeItem"),
  incomeList: document.getElementById("incomeList"),
  incomeTotalHint: document.getElementById("incomeTotalHint"),
  expenseList: document.getElementById("expenseList"),
  expenseTotalHint: document.getElementById("expenseTotalHint"),
  editExpenseItems: document.getElementById("editExpenseItems"),
  expenseEditorActions: document.getElementById("expenseEditorActions"),
  addExpenseItem: document.getElementById("addExpenseItem"),
  applyExpenseItems: document.getElementById("applyExpenseItems"),
  cancelExpenseItems: document.getElementById("cancelExpenseItems"),
  savingsList: document.getElementById("savingsList"),
  savingsTotalHint: document.getElementById("savingsTotalHint"),
  editSavingsItems: document.getElementById("editSavingsItems"),
  savingsEditorActions: document.getElementById("savingsEditorActions"),
  addSavingsItem: document.getElementById("addSavingsItem"),
  applySavingsItems: document.getElementById("applySavingsItems"),
  cancelSavingsItems: document.getElementById("cancelSavingsItems"),
  investList: document.getElementById("investList"),
  investTotalHint: document.getElementById("investTotalHint"),
  editInvestItems: document.getElementById("editInvestItems"),
  investEditorActions: document.getElementById("investEditorActions"),
  addInvestItem: document.getElementById("addInvestItem"),
  applyInvestItems: document.getElementById("applyInvestItems"),
  cancelInvestItems: document.getElementById("cancelInvestItems"),
  mobileEditorFab: document.getElementById("mobileEditorFab"),
  mobileEditorFabLabel: document.getElementById("mobileEditorFabLabel"),
  mobileEditorAdd: document.getElementById("mobileEditorAdd"),
  mobileEditorApply: document.getElementById("mobileEditorApply"),
  mobileEditorCancel: document.getElementById("mobileEditorCancel"),
  checkLatestVersion: document.getElementById("checkLatestVersion"),
  advancedSettings: document.getElementById("advancedSettings"),
  advancedTabExpense: document.getElementById("advancedTabExpense"),
  advancedTabSavings: document.getElementById("advancedTabSavings"),
  advancedTabInvest: document.getElementById("advancedTabInvest"),
  advancedTabRates: document.getElementById("advancedTabRates"),
  expenseAdvancedBlock: document.getElementById("expenseAdvancedBlock"),
  savingsAdvancedBlock: document.getElementById("savingsAdvancedBlock"),
  investAdvancedBlock: document.getElementById("investAdvancedBlock"),
  ratesAdvancedBlock: document.getElementById("ratesAdvancedBlock"),
  expenseSortMode: document.getElementById("expenseSortMode"),
  savingsSortMode: document.getElementById("savingsSortMode"),
  investSortMode: document.getElementById("investSortMode"),
  expenseGroupOptions: document.getElementById("expenseGroupOptions"),
  savingsGroupOptions: document.getElementById("savingsGroupOptions"),
  investGroupOptions: document.getElementById("investGroupOptions"),
  jumpAdvancedFields: Array.from(document.querySelectorAll(".jump-advanced-field")),
  jumpToInputs: document.getElementById("jumpToInputs"),
  saveViewToLocal: document.getElementById("saveViewToLocal"),
  viewModeGuide: document.getElementById("viewModeGuide"),
  viewModeGuideDontShow: document.getElementById("viewModeGuideDontShow"),
  dismissViewModeGuide: document.getElementById("dismissViewModeGuide"),
  jumpToTop: document.getElementById("jumpToTop"),
  pendingBar: document.getElementById("pendingBar"),
  pendingSummary: document.getElementById("pendingSummary"),
  applyChanges: document.getElementById("applyChanges"),
  cancelChanges: document.getElementById("cancelChanges"),
  applyFeedback: document.getElementById("applyFeedback"),
  summaryCards: document.getElementById("summaryCards"),
  cardMeta: document.getElementById("cardMeta"),
  sankeySvg: document.getElementById("sankeySvg"),
  sankeyWrap: document.getElementById("sankeyWrap"),
  sankeyMeta: document.getElementById("sankeyMeta"),
  sankeyLegend: document.getElementById("sankeyLegend"),
  sankeyViewAmount: document.getElementById("sankeyViewAmount"),
  sankeyViewPercent: document.getElementById("sankeyViewPercent"),
  sankeySortMode: document.getElementById("sankeySortMode"),
  sankeyZoomOut: document.getElementById("sankeyZoomOut"),
  sankeyZoomIn: document.getElementById("sankeyZoomIn"),
  sankeyZoomReset: document.getElementById("sankeyZoomReset"),
  sankeyZoomLabel: document.getElementById("sankeyZoomLabel"),
  sankeyEmpty: document.getElementById("sankeyEmpty"),
  sankeyTooltip: document.getElementById("sankeyTooltip"),
  projectionTableBody: document.querySelector("#projectionTable tbody"),
  projectionMeta: document.getElementById("projectionMeta"),
  appTitle: document.querySelector("h1"),
};

const state = {
  isViewMode: IsfShare.detectViewMode(),
  inputs: resolveInitialInputs(),
  backupEntries: [],
  backupStoreReady: false,
  backupStoreError: false,
  draftInputs: null,
  applyFeedbackTimer: null,
  suspendInputTracking: false,
  isApplyingHashState: false,
  sankeyValueMode: SANKEY_VALUE_MODES.AMOUNT,
  sankeySortMode: SANKEY_SORT_MODES.GROUP,
  sankeyZoom: 1,
  activeAdvancedTab: "expense",
  itemSortModes: {
    expense: ITEM_SORT_MODES.DEFAULT,
    savings: ITEM_SORT_MODES.DEFAULT,
    invest: ITEM_SORT_MODES.DEFAULT,
  },
  itemEditors: {
    expense: { active: false, items: [], baselineSignature: "" },
    savings: { active: false, items: [], baselineSignature: "" },
    invest: { active: false, items: [], baselineSignature: "" },
  },
  snapshot: null,
  mobileInputsCollapsed: false,
  viewModeGuideClosedTemporarily: false,
  pwaVersionLastCheckedAt: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  syncViewModeUi();
  syncViewModeGuideUi();
  syncBackupUi();
  syncSankeyValueModeUi();
  syncSankeySortModeUi();
  syncSankeyZoomUi();
  syncItemSortModeUi();
  setActiveAdvancedTab(state.activeAdvancedTab);
  syncAdvancedTabBlockVisibility();
  refreshInputsPanel(state.inputs);
  syncGroupOptionsAll();
  setPendingBarVisible(false);
  renderAll();
  initializeBackupStore();
  void initializeInputsFromShareId();
  const pwaManager = new IsfPwaManager({
    appVersion: "0.1.1",
    onFeedback: (message) => IsfFeedback.showFeedback(dom.applyFeedback, message),
    isViewMode: () => state.isViewMode,
    swPath: "../../sw.js",
    manifestPath: "../../manifest.webmanifest",
    versionCheckTriggerElement: dom.checkLatestVersion,
    getCurrentData: () => state.inputs,
  });
  pwaManager.init();
  if (state.isViewMode) {
    IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드로 열었습니다. 로컬 저장값은 변경되지 않습니다.");
  }
});

function closeActionMenus() {
  if (dom.backupMenu instanceof HTMLDetailsElement) {
    dom.backupMenu.open = false;
  }
  if (dom.shareMenu instanceof HTMLDetailsElement) {
    dom.shareMenu.open = false;
  }
  if (dom.moreActionsMenu instanceof HTMLDetailsElement) {
    dom.moreActionsMenu.open = false;
  }
}

function bindActionMenus() {
  const menus = [dom.backupMenu, dom.shareMenu, dom.moreActionsMenu].filter(Boolean);

  menus.forEach((menu) => {
    if (!(menu instanceof HTMLDetailsElement)) return;
    menu.addEventListener("toggle", () => {
      if (menu.open) {
        menus.forEach((other) => {
          if (other !== menu && other instanceof HTMLDetailsElement) {
            other.open = false;
          }
        });
      }
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!(dom.controlsPanel instanceof HTMLElement)) {
      return;
    }
    if (dom.controlsPanel.contains(target)) {
      return;
    }
    closeActionMenus();
  });
}

function bindControls() {
  bindActionMenus();

  if (dom.inputsForm) {
    const handleInput = (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) {
        return;
      }
      const baseInputs = ensureDraftInputs();
      state.draftInputs = sanitizeInputs(readInputsFromForm(baseInputs));
      if (target.name === "annualSavingsYield") {
        updateSavingsRateInputHints(state.draftInputs.annualSavingsYield);
      }
      markPendingChanges();
    };

    dom.inputsForm.addEventListener("input", handleInput);
  }

  bindReadonlyAdvancedNavigation();
  setActiveAdvancedTab(state.activeAdvancedTab);

  if (dom.advancedTabExpense) {
    dom.advancedTabExpense.addEventListener("click", () => {
      navigateToAdvancedGroup("expense", {
        scroll: false,
        focusEditButton: false,
        showFeedback: false,
      });
    });
  }
  if (dom.advancedTabSavings) {
    dom.advancedTabSavings.addEventListener("click", () => {
      navigateToAdvancedGroup("savings", {
        scroll: false,
        focusEditButton: false,
        showFeedback: false,
      });
    });
  }
  if (dom.advancedTabInvest) {
    dom.advancedTabInvest.addEventListener("click", () => {
      navigateToAdvancedGroup("invest", {
        scroll: false,
        focusEditButton: false,
        showFeedback: false,
      });
    });
  }
  if (dom.advancedTabRates) {
    dom.advancedTabRates.addEventListener("click", () => {
      navigateToAdvancedGroup("rates", {
        scroll: false,
        focusEditButton: false,
        showFeedback: false,
      });
    });
  }

  if (dom.expenseSortMode) {
    dom.expenseSortMode.addEventListener("change", () => {
      setItemSortMode("expense", dom.expenseSortMode.value);
    });
  }
  if (dom.savingsSortMode) {
    dom.savingsSortMode.addEventListener("change", () => {
      setItemSortMode("savings", dom.savingsSortMode.value);
    });
  }
  if (dom.investSortMode) {
    dom.investSortMode.addEventListener("change", () => {
      setItemSortMode("invest", dom.investSortMode.value);
    });
  }

  if (dom.sankeyViewAmount) {
    dom.sankeyViewAmount.addEventListener("click", () => {
      setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT);
    });
  }

  if (dom.sankeySortMode) {
    dom.sankeySortMode.addEventListener("change", () => {
      setSankeySortMode(dom.sankeySortMode.value);
    });
  }

  if (dom.toggleInputsMobile) {
    dom.toggleInputsMobile.addEventListener("click", () => {
      if (!mobileLayoutMediaQuery.matches) {
        return;
      }
      state.mobileInputsCollapsed = !state.mobileInputsCollapsed;
      syncMobileInputsPanelVisibility();
    });
  }

  bindMobileLayoutWatcher();
  syncMobileInputsPanelVisibility();

  if (dom.sankeyViewPercent) {
    dom.sankeyViewPercent.addEventListener("click", () => {
      setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT);
    });
  }

  if (dom.sankeyZoomIn) {
    dom.sankeyZoomIn.addEventListener("click", () => {
      setSankeyZoom(state.sankeyZoom + SANKEY_ZOOM_STEP);
    });
  }

  if (dom.sankeyZoomOut) {
    dom.sankeyZoomOut.addEventListener("click", () => {
      setSankeyZoom(state.sankeyZoom - SANKEY_ZOOM_STEP);
    });
  }

  if (dom.sankeyZoomReset) {
    dom.sankeyZoomReset.addEventListener("click", () => {
      setSankeyZoom(1);
    });
  }

  if (dom.copyShareLink) {
    dom.copyShareLink.addEventListener("click", async () => {
      const shareLink = await buildShareLink(state.inputs, { viewMode: true });
      if (!shareLink) {
        IsfFeedback.showFeedback(dom.applyFeedback, "링크 길이 초과로 보기 링크 생성이 제한됩니다. JSON 저장을 사용하세요.");
        return;
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareLink);
          IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드 링크를 복사했습니다.");
          closeActionMenus();
          return;
        }
      } catch (_error) {
        // Fallback below.
      }
      window.prompt("아래 보기 모드 링크를 복사해 공유하세요.", shareLink);
      closeActionMenus();
    });
  }

  if (dom.saveViewToLocal) {
    dom.saveViewToLocal.addEventListener("click", async () => {
      if (!state.isViewMode || !hasShareState()) {
        return;
      }
      const localInputs = sanitizeInputs(cloneInputs(getVisibleInputs()));
      persistInputs(localInputs);
      const res = await IsfBackupManager.createBackupEntry(state.backupEntries, localInputs, { type: "manual", source: "view-save" , appKey: SHARE_STATE_KEY}); if(res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }
      switchToNormalMode();
      IsfFeedback.showFeedback(dom.applyFeedback, "현재 보기 상태를 로컬 저장소에 저장하고 일반 모드로 전환했습니다.");
    });
  }

  if (dom.dismissViewModeGuide) {
    dom.dismissViewModeGuide.addEventListener("click", () => {
      dismissViewModeGuide();
    });
  }

  if (dom.exportJson) {
    dom.exportJson.addEventListener("click", () => {
      IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs), "my-household-flow-backup");
      IsfFeedback.showFeedback(dom.applyFeedback, "JSON 백업 파일을 저장했습니다.");
      closeActionMenus();
    });
  }

  if (dom.importJson) {
    dom.importJson.addEventListener("click", () => {
      if (dom.importJsonFile) {
        dom.importJsonFile.click();
      }
      closeActionMenus();
    });
  }

  if (dom.importJsonFile) {
    dom.importJsonFile.addEventListener("change", async (event) => {
      const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : null;
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const imported = IsfShare.parseImportedJson(text, SHARE_STATE_KEY);
        commitImmediateInputs(imported);
        IsfFeedback.showFeedback(dom.applyFeedback, "JSON 데이터를 불러와 적용했습니다.");
      } catch (_error) {
        IsfFeedback.showFeedback(dom.applyFeedback, "JSON 파일 형식이 올바르지 않습니다.");
      } finally {
        if (event.target instanceof HTMLInputElement) {
          event.target.value = "";
        }
      }
    });
  }

  if (dom.backupNow) {
    dom.backupNow.addEventListener("click", async () => {
      if (state.isViewMode) {
        IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드에서는 자동/수동 백업이 중지됩니다. 먼저 저장 아이콘으로 로컬 저장하세요.");
        return;
      }
      if (!state.backupStoreReady) {
        IsfFeedback.showFeedback(dom.applyFeedback, "백업 저장소를 준비 중입니다. 잠시 후 다시 시도하세요.");
        return;
      }
      const inputs = sanitizeInputs(cloneInputs(getVisibleInputs()));
      const res = await IsfBackupManager.createBackupEntry(state.backupEntries, inputs, {
        type: "manual",
        source: "normal",
        allowDuplicate: true,
        replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS,
        promptOnRecentManualOverwrite: true, appKey: IsfShare.SHARE_STATE_KEY}); if(res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }

      if (result.created) {
        IsfFeedback.showFeedback(dom.applyFeedback, result.replaced ? "최근 1분 수동 백업을 덮어썼습니다." : "로컬 백업을 저장했습니다.");
        closeActionMenus();
        return;
      }

      if (result.reason === "overwrite-cancelled") {
        IsfFeedback.showFeedback(dom.applyFeedback, "백업 저장을 취소했습니다.");
        return;
      }

      if (result.reason === "duplicate-recent") {
        IsfFeedback.showFeedback(dom.applyFeedback, "1분 이내 동일 내용 백업이 이미 있습니다.");
        return;
      }

      IsfFeedback.showFeedback(dom.applyFeedback, "백업 저장에 실패했습니다.");
    });
  }

  if (dom.restoreBackup) {
    dom.restoreBackup.addEventListener("click", async () => {
      await restoreSelectedBackup();
      closeActionMenus();
    });
  }

  if (dom.backupSelect) {
    dom.backupSelect.addEventListener("change", () => {
      syncBackupUi();
    });
  }

  if (dom.addIncomeItem) {
    dom.addIncomeItem.addEventListener("click", () => {
      const draftInputs = ensureDraftInputs();
      if (draftInputs.incomes.length >= MAX_INCOME_ITEMS) {
        return;
      }
      draftInputs.incomes.push(createIncomeItem({ name: `수입 ${draftInputs.incomes.length + 1}` }));
      state.draftInputs = sanitizeInputs(draftInputs);
      renderIncomeList(state.draftInputs.incomes);
      markPendingChanges();
    });
  }

  if (dom.incomeList) {
    dom.incomeList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const itemId = target.dataset.incomeId;
      const field = target.dataset.field;
      if (!itemId || !field) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const income = draftInputs.incomes.find((item) => item.id === itemId);
      if (!income) {
        return;
      }

      if (field === "name") {
        income.name = target.value.slice(0, 24);
      }

      if (field === "amount") {
        income.amount = IsfUtils.sanitizeMoney(target.value, 0);
      }

      markPendingChanges();
    });

    dom.incomeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const removeId = target.dataset.removeIncome;
      if (!removeId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      if (draftInputs.incomes.length <= 1) {
        return;
      }

      draftInputs.incomes = draftInputs.incomes.filter((item) => item.id !== removeId);
      state.draftInputs = sanitizeInputs(draftInputs);
      renderIncomeList(state.draftInputs.incomes);
      markPendingChanges();
    });
  }

  if (dom.expenseList) {
    dom.expenseList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }

      if (state.itemEditors.expense.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.expense.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          item.name = target.value.slice(0, 24);
        }
        if (field === "amount") {
          item.amount = IsfUtils.sanitizeMoney(target.value, 0);
        }
        if (field === "group") {
          item.group = normalizeAllocationGroupName(target.value);
        }
        renderExpenseTotalHint(
          IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.expense.items)),
          state.itemEditors.expense.items.length,
        );
        setItemEditorUi("expense", true);
        return;
      }

      const itemId = target.dataset.expenseId;
      if (!itemId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const expense = draftInputs.expenseItems.find((item) => item.id === itemId);
      if (!expense) {
        return;
      }

      expense.amount = IsfUtils.sanitizeMoney(target.value, 0);
      markPendingChanges();
    });

    dom.expenseList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.expense.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.expense.items.length <= 1) {
        return;
      }
      state.itemEditors.expense.items = state.itemEditors.expense.items.filter((item) => item.id !== removeId);
      renderExpenseList(state.itemEditors.expense.items, { editing: true });
      renderExpenseTotalHint(
        IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.expense.items)),
        state.itemEditors.expense.items.length,
      );
      setItemEditorUi("expense", true);
    });
  }

  if (dom.savingsList) {
    dom.savingsList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }

      if (state.itemEditors.savings.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.savings.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          item.name = target.value.slice(0, 24);
        }
        if (field === "amount") {
          item.amount = IsfUtils.sanitizeMoney(target.value, 0);
        }
        if (field === "annualRate") {
          const parsedRate = parseSavingsAnnualRateInput(target.value, getVisibleInputs().annualSavingsYield);
          if (parsedRate === null) {
            delete item.annualRate;
          } else {
            item.annualRate = parsedRate;
          }
        }
        if (field === "group") {
          item.group = normalizeAllocationGroupName(target.value);
        }
        if (field === "maturityMonth") {
          const normalized = normalizeMaturityMonth(target.value);
          if (!normalized) {
            delete item.maturityMonth;
          } else {
            item.maturityMonth = normalized;
          }
        }
        renderSavingsTotalHint(
          IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.savings.items)),
          state.itemEditors.savings.items.length,
        );
        setItemEditorUi("savings", true);
        return;
      }

      const itemId = target.dataset.savingsId;
      const field = target.dataset.field;
      if (!itemId || !field) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const item = draftInputs.savingsItems.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      if (field === "amount") {
        item.amount = IsfUtils.sanitizeMoney(target.value, 0);
      }
      if (field === "annualRate") {
        const parsedRate = parseSavingsAnnualRateInput(target.value, draftInputs.annualSavingsYield);
        if (parsedRate === null) {
          delete item.annualRate;
        } else {
          item.annualRate = parsedRate;
        }
      }
      markPendingChanges();
    });

    dom.savingsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.savings.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.savings.items.length <= 1) {
        return;
      }
      state.itemEditors.savings.items = state.itemEditors.savings.items.filter((item) => item.id !== removeId);
      renderSavingsList(state.itemEditors.savings.items, { editing: true });
      renderSavingsTotalHint(
        IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.savings.items)),
        state.itemEditors.savings.items.length,
      );
      setItemEditorUi("savings", true);
    });
  }

  if (dom.investList) {
    dom.investList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }

      if (state.itemEditors.invest.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.invest.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          item.name = target.value.slice(0, 24);
        }
        if (field === "amount") {
          item.amount = IsfUtils.sanitizeMoney(target.value, 0);
        }
        if (field === "group") {
          item.group = normalizeAllocationGroupName(target.value);
        }
        if (field === "maturityMonth") {
          const normalized = normalizeMaturityMonth(target.value);
          if (!normalized) {
            delete item.maturityMonth;
          } else {
            item.maturityMonth = normalized;
          }
        }
        renderInvestTotalHint(
          IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.invest.items)),
          state.itemEditors.invest.items.length,
        );
        setItemEditorUi("invest", true);
        return;
      }

      const itemId = target.dataset.investId;
      if (!itemId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const item = draftInputs.investItems.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      item.amount = IsfUtils.sanitizeMoney(target.value, 0);
      markPendingChanges();
    });

    dom.investList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.invest.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.invest.items.length <= 1) {
        return;
      }
      state.itemEditors.invest.items = state.itemEditors.invest.items.filter((item) => item.id !== removeId);
      renderInvestList(state.itemEditors.invest.items, { editing: true });
      renderInvestTotalHint(
        IsfUtils.toWon(getMonthlyAllocationTotalMan(state.itemEditors.invest.items)),
        state.itemEditors.invest.items.length,
      );
      setItemEditorUi("invest", true);
    });
  }

  if (dom.editExpenseItems) {
    dom.editExpenseItems.addEventListener("click", () => {
      if (state.itemEditors.expense.active) {
        cancelItemEditor("expense");
      } else {
        startItemEditor("expense");
      }
    });
  }

  if (dom.editSavingsItems) {
    dom.editSavingsItems.addEventListener("click", () => {
      if (state.itemEditors.savings.active) {
        cancelItemEditor("savings");
      } else {
        startItemEditor("savings");
      }
    });
  }

  if (dom.editInvestItems) {
    dom.editInvestItems.addEventListener("click", () => {
      if (state.itemEditors.invest.active) {
        cancelItemEditor("invest");
      } else {
        startItemEditor("invest");
      }
    });
  }

  if (dom.addExpenseItem) {
    dom.addExpenseItem.addEventListener("click", () => addItemToEditor("expense"));
  }
  if (dom.addSavingsItem) {
    dom.addSavingsItem.addEventListener("click", () => addItemToEditor("savings"));
  }
  if (dom.addInvestItem) {
    dom.addInvestItem.addEventListener("click", () => addItemToEditor("invest"));
  }

  if (dom.applyExpenseItems) {
    dom.applyExpenseItems.addEventListener("click", () => applyItemEditor("expense"));
  }
  if (dom.applySavingsItems) {
    dom.applySavingsItems.addEventListener("click", () => applyItemEditor("savings"));
  }
  if (dom.applyInvestItems) {
    dom.applyInvestItems.addEventListener("click", () => applyItemEditor("invest"));
  }

  if (dom.cancelExpenseItems) {
    dom.cancelExpenseItems.addEventListener("click", () => cancelItemEditor("expense"));
  }
  if (dom.cancelSavingsItems) {
    dom.cancelSavingsItems.addEventListener("click", () => cancelItemEditor("savings"));
  }
  if (dom.cancelInvestItems) {
    dom.cancelInvestItems.addEventListener("click", () => cancelItemEditor("invest"));
  }

  if (dom.mobileEditorAdd) {
    dom.mobileEditorAdd.addEventListener("click", () => {
      const activeGroupKey = getActiveItemEditorGroupKey();
      if (!activeGroupKey) {
        return;
      }
      addItemToEditor(activeGroupKey);
    });
  }
  if (dom.mobileEditorApply) {
    dom.mobileEditorApply.addEventListener("click", () => {
      const activeGroupKey = getActiveItemEditorGroupKey();
      if (!activeGroupKey) {
        return;
      }
      applyItemEditor(activeGroupKey);
    });
  }
  if (dom.mobileEditorCancel) {
    dom.mobileEditorCancel.addEventListener("click", () => {
      const activeGroupKey = getActiveItemEditorGroupKey();
      if (!activeGroupKey) {
        return;
      }
      cancelItemEditor(activeGroupKey);
    });
  }

  

  if (dom.loadSample) {
    dom.loadSample.addEventListener("click", async () => {
      closeActionMenus();
      const link = await buildShareLink({ ...SAMPLE_INPUTS }, { viewMode: true });
      if (link) {
        window.location.href = link;
      }
    });
  }

  if (dom.resetInputs) {
    dom.resetInputs.addEventListener("click", () => {
      closeActionMenus();
      if (state.isViewMode) {
        IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드에서는 초기화를 사용할 수 없습니다.");
        return;
      }
      if (hasPendingChanges() && !window.confirm("적용하지 않은 변경사항이 있습니다. 무시하고 모든 입력값을 초기화할까요?")) {
        return;
      }
      if (!window.confirm("현재 입력한 항목 구조는 유지하고 모든 금액을 0으로 초기화합니다. 계속할까요?")) {
        return;
      }
      commitImmediateInputs(createResetInputs(getVisibleInputs()));
      IsfFeedback.showFeedback(dom.applyFeedback, "모든 금액을 초기화했습니다.");
    });
  }

  if (dom.easterEgg) {
    dom.easterEgg.addEventListener("click", () => {
      closeActionMenus();
      IsfFeedback.showFeedback(dom.applyFeedback, "🐣 이스터에그를 발견하셨습니다! (준비중)");
    });
  }

  if (dom.applyChanges) {
    dom.applyChanges.addEventListener("click", () => {
      if (!hasPendingChanges()) {
        state.draftInputs = null;
        setPendingBarVisible(false);
        return;
      }
      state.inputs = sanitizeInputs(state.draftInputs);
      state.draftInputs = null;
      setPendingBarVisible(false);
      refreshInputsPanel(state.inputs);
      persistPrimaryState(state.inputs);
      renderAll();
      IsfFeedback.showFeedback(dom.applyFeedback, "변경사항이 적용되었습니다.");
    });
  }

  if (dom.cancelChanges) {
    dom.cancelChanges.addEventListener("click", () => {
      if (!state.draftInputs) {
        return;
      }
      state.draftInputs = null;
      setPendingBarVisible(false);
      refreshInputsPanel(state.inputs);
      renderAll();
    });
  }

  if (dom.appTitle) {
    dom.appTitle.style.cursor = "pointer";
    dom.appTitle.title = "내 로컬 데이터로 돌아가기";
    dom.appTitle.addEventListener("click", () => {
      const hasUrlParams = window.location.search || window.location.hash;
      if (!hasUrlParams) {
        return;
      }
      if (hasPendingChanges() && !state.isViewMode && !window.confirm("적용하지 않은 변경사항이 있습니다. 무시하고 내 데이터로 돌아갈까요?")) {
        return;
      }
      window.location.href = window.location.pathname;
    });
  }

  if (dom.jumpToInputs) {
    dom.jumpToInputs.addEventListener("click", () => {
      const summarySectionTitle = document.getElementById("cardsTitle");
      if (summarySectionTitle) {
        summarySectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (dom.jumpToTop) {
    dom.jumpToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (dom.sankeyWrap) {
    dom.sankeyWrap.addEventListener("mouseleave", hideSankeyTooltip);
  }

  window.addEventListener("hashchange", () => {
    syncViewModeUi();
    syncViewModeGuideUi();
    if (state.isApplyingHashState) {
      return;
    }
    const hashInputs = IsfShare.decodePayloadFromHash(new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM), SHARE_STATE_KEY);
    if (!hashInputs) {
      return;
    }
    const nextInputs = sanitizeInputs({ ...DEFAULT_INPUTS, ...hashInputs });
    if (areInputsEqual(nextInputs, state.inputs)) {
      if (!state.isViewMode) {
        history.replaceState(null, "", window.location.pathname);
      }
      return;
    }
    state.isApplyingHashState = true;
    try {
      state.inputs = nextInputs;
      state.draftInputs = null;
      setPendingBarVisible(false);
      refreshInputsPanel(state.inputs);
      persistPrimaryState(state.inputs);
      renderAll();
      IsfFeedback.showFeedback(dom.applyFeedback, "링크 상태를 불러왔습니다.");
      if (!state.isViewMode) {
        history.replaceState(null, "", window.location.pathname);
      }
    } finally {
      state.isApplyingHashState = false;
    }
  });

  window.addEventListener("resize", debounce(() => {
    if (state.snapshot) {
      renderSankey(state.snapshot);
    }
  }, 120));

  window.addEventListener("popstate", () => {
    syncViewModeUi();
    syncViewModeGuideUi();
  });
}

function bindMobileLayoutWatcher() {
  if (!mobileLayoutMediaQuery) {
    return;
  }
  const handleMobileLayoutChange = () => {
    if (!mobileLayoutMediaQuery.matches) {
      state.mobileInputsCollapsed = false;
      if (state.activeAdvancedTab === "rates") {
        setActiveAdvancedTab("expense");
      }
    }
    syncMobileInputsPanelVisibility();
    syncAdvancedTabBlockVisibility();
    syncAllItemEditorUi();
    
  };
  if (typeof mobileLayoutMediaQuery.addEventListener === "function") {
    mobileLayoutMediaQuery.addEventListener("change", handleMobileLayoutChange);
    return;
  }
  if (typeof mobileLayoutMediaQuery.addListener === "function") {
    mobileLayoutMediaQuery.addListener(handleMobileLayoutChange);
  }
}

function syncMobileInputsPanelVisibility() {
  const isMobile = mobileLayoutMediaQuery.matches;
  const isCollapsed = isMobile && state.mobileInputsCollapsed;

  if (dom.inputsPanelContent) {
    dom.inputsPanelContent.hidden = isCollapsed;
  }
  if (dom.toggleInputsMobile) {
    dom.toggleInputsMobile.hidden = !isMobile;
    dom.toggleInputsMobile.textContent = isCollapsed ? "펼치기" : "접기";
    dom.toggleInputsMobile.setAttribute("aria-expanded", String(!isCollapsed));
  }
  if (dom.controlsPanel) {
    dom.controlsPanel.classList.toggle("is-mobile-collapsed", isCollapsed);
  }
}

function syncViewModeUi() {
  const wasViewMode = state.isViewMode;
  const isViewModeByUrl = IsfShare.detectViewMode();
  state.isViewMode = isViewModeByUrl;
  if (!isViewModeByUrl || (!wasViewMode && isViewModeByUrl)) {
    state.viewModeGuideClosedTemporarily = false;
  }
  const isViewLink = isViewModeByUrl && hasShareState();
  if (dom.saveViewToLocal) {
    dom.saveViewToLocal.hidden = !isViewLink;
    dom.saveViewToLocal.disabled = !isViewLink;
  }
  syncBackupUi();
  
}

function syncViewModeGuideUi() {
  if (!dom.viewModeGuide) {
    return;
  }
  dom.viewModeGuide.hidden = !shouldShowViewModeGuide();
}

function shouldShowViewModeGuide() {
  return state.isViewMode
    && hasShareState()
    && !isViewModeGuideDismissed()
    && !state.viewModeGuideClosedTemporarily;
}

function isViewModeGuideDismissed() {
  try {
    return localStorage.getItem(VIEW_MODE_GUIDE_DISMISSED_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function dismissViewModeGuide() {
  const dontShowAgain = Boolean(
    dom.viewModeGuideDontShow instanceof HTMLInputElement
      ? dom.viewModeGuideDontShow.checked
      : false,
  );
  try {
    if (dontShowAgain) {
      localStorage.setItem(VIEW_MODE_GUIDE_DISMISSED_KEY, "1");
    } else {
      localStorage.removeItem(VIEW_MODE_GUIDE_DISMISSED_KEY);
    }
  } catch (_error) {
    // Ignore storage errors; guide will show again next time.
  }
  state.viewModeGuideClosedTemporarily = true;
  syncViewModeGuideUi();
}

function hasShareState() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const sid = normalizeShareId(searchParams.get(IsfShare.SHARE_ID_QUERY_PARAM));
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return Boolean(sid) || Boolean(hashParams.get(HASH_STATE_PARAM));
  } catch (_error) {
    return false;
  }
}

function switchToNormalMode() {
  state.isViewMode = false;
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete(IsfShare.VIEW_MODE_QUERY_PARAM);
  const searchText = searchParams.toString();
  const nextUrl = `${window.location.pathname}${searchText ? `?${searchText}` : ""}${window.location.hash}`;
  history.replaceState(null, "", nextUrl);
  syncViewModeUi();
  syncViewModeGuideUi();
}

function bindReadonlyAdvancedNavigation() {
  if (!Array.isArray(dom.jumpAdvancedFields) || dom.jumpAdvancedFields.length === 0) {
    return;
  }

  dom.jumpAdvancedFields.forEach((field) => {
    if (!(field instanceof HTMLInputElement)) {
      return;
    }
    field.addEventListener("click", () => {
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
  });
}

function normalizeItemSortMode(mode) {
  const safeMode = String(mode || "").trim().toLowerCase();
  if (Object.values(ITEM_SORT_MODES).includes(safeMode)) {
    return safeMode;
  }
  return ITEM_SORT_MODES.DEFAULT;
}

function clusterAllocationItemsByGroup(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const grouped = new Map();
  const groupOrder = [];
  const ungrouped = [];

  safeItems.forEach((item) => {
    const groupName = normalizeAllocationGroupName(item?.group);
    if (!groupName) {
      ungrouped.push(item);
      return;
    }
    if (!grouped.has(groupName)) {
      grouped.set(groupName, []);
      groupOrder.push(groupName);
    }
    grouped.get(groupName).push(item);
  });

  const groupedItems = groupOrder.flatMap((groupName) => grouped.get(groupName) || []);
  return [...groupedItems, ...ungrouped];
}

function getGroupOptionListId(groupKey) {
  const map = {
    expense: "expenseGroupOptions",
    savings: "savingsGroupOptions",
    invest: "investGroupOptions",
  };
  return map[groupKey] || "";
}

function getGroupOptionListElement(groupKey) {
  const map = {
    expense: dom.expenseGroupOptions,
    savings: dom.savingsGroupOptions,
    invest: dom.investGroupOptions,
  };
  return map[groupKey] || null;
}

function collectGroupNames(items) {
  const set = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const groupName = normalizeAllocationGroupName(item?.group);
    if (groupName) {
      set.add(groupName);
    }
  });
  return [...set];
}

function getGroupItemsForSuggestions(groupKey) {
  const inputs = getVisibleInputs();
  const fieldMap = {
    expense: "expenseItems",
    savings: "savingsItems",
    invest: "investItems",
  };
  const field = fieldMap[groupKey];
  if (!field) {
    return [];
  }
  const sources = [];
  if (Array.isArray(inputs[field])) {
    sources.push(...inputs[field]);
  }
  const editor = state.itemEditors[groupKey];
  if (editor && editor.active && Array.isArray(editor.items)) {
    sources.push(...editor.items);
  }
  return sources;
}

function syncGroupOptionsFor(groupKey) {
  const dataList = getGroupOptionListElement(groupKey);
  if (!(dataList instanceof HTMLDataListElement)) {
    return;
  }
  const names = collectGroupNames(getGroupItemsForSuggestions(groupKey))
    .sort((left, right) => left.localeCompare(right, "ko-KR", { sensitivity: "base" }));

  dataList.innerHTML = "";
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    dataList.appendChild(option);
  });
}

function syncGroupOptionsAll() {
  syncGroupOptionsFor("expense");
  syncGroupOptionsFor("savings");
  syncGroupOptionsFor("invest");
}

function sortAllocationItemsForRender(groupKey, items) {
  const safeItems = Array.isArray(items) ? [...items] : [];
  const mode = normalizeItemSortMode(state.itemSortModes?.[groupKey]);
  if (mode === ITEM_SORT_MODES.DEFAULT) {
    return clusterAllocationItemsByGroup(safeItems);
  }

  const byNameAsc = (left, right) => {
    const leftName = String(left?.name || "").trim();
    const rightName = String(right?.name || "").trim();
    return leftName.localeCompare(rightName, "ko-KR", { sensitivity: "base" });
  };
  const byAmountAsc = (left, right) => IsfUtils.sanitizeMoney(left?.amount, 0) - IsfUtils.sanitizeMoney(right?.amount, 0);

  if (mode === ITEM_SORT_MODES.AMOUNT_ASC) {
    safeItems.sort((left, right) => byAmountAsc(left, right) || byNameAsc(left, right));
  } else if (mode === ITEM_SORT_MODES.AMOUNT_DESC) {
    safeItems.sort((left, right) => byAmountAsc(right, left) || byNameAsc(left, right));
  } else if (mode === ITEM_SORT_MODES.NAME_ASC) {
    safeItems.sort((left, right) => byNameAsc(left, right) || byAmountAsc(left, right));
  } else if (mode === ITEM_SORT_MODES.NAME_DESC) {
    safeItems.sort((left, right) => byNameAsc(right, left) || byAmountAsc(left, right));
  }

  return safeItems;
}

function setItemSortMode(groupKey, mode) {
  const safeMode = normalizeItemSortMode(mode);
  if (!["expense", "savings", "invest"].includes(groupKey)) {
    return;
  }
  state.itemSortModes[groupKey] = safeMode;
  syncItemSortModeUi();
  const inputs = getVisibleInputs();
  if (groupKey === "expense") {
    renderExpenseList(inputs.expenseItems, { editing: state.itemEditors.expense.active });
  }
  if (groupKey === "savings") {
    renderSavingsList(inputs.savingsItems, { editing: state.itemEditors.savings.active });
  }
  if (groupKey === "invest") {
    renderInvestList(inputs.investItems, { editing: state.itemEditors.invest.active });
  }
}

function syncItemSortModeUi() {
  if (dom.expenseSortMode) {
    dom.expenseSortMode.value = normalizeItemSortMode(state.itemSortModes.expense);
  }
  if (dom.savingsSortMode) {
    dom.savingsSortMode.value = normalizeItemSortMode(state.itemSortModes.savings);
  }
  if (dom.investSortMode) {
    dom.investSortMode.value = normalizeItemSortMode(state.itemSortModes.invest);
  }
}

function setActiveAdvancedTab(groupKey) {
  const safeGroupKey = ["expense", "savings", "invest", "rates"].includes(groupKey) ? groupKey : "expense";
  state.activeAdvancedTab = safeGroupKey;

  const tabMap = {
    expense: dom.advancedTabExpense,
    savings: dom.advancedTabSavings,
    invest: dom.advancedTabInvest,
    rates: dom.advancedTabRates,
  };
  Object.entries(tabMap).forEach(([key, button]) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const active = key === safeGroupKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  syncAdvancedTabBlockVisibility();
}

function syncAdvancedTabBlockVisibility() {
  const isMobile = mobileLayoutMediaQuery.matches;
  const isRatesActive = state.activeAdvancedTab === "rates";
  const blockMap = {
    expense: dom.expenseAdvancedBlock,
    savings: dom.savingsAdvancedBlock,
    invest: dom.investAdvancedBlock,
  };

  Object.entries(blockMap).forEach(([key, block]) => {
    if (!(block instanceof HTMLElement)) {
      return;
    }
    const isActive = key === state.activeAdvancedTab;
    block.classList.toggle("is-active", isActive);
    block.hidden = !isActive;
  });

  if (dom.ratesAdvancedBlock instanceof HTMLElement) {
    const showRates = isMobile ? isRatesActive : true;
    dom.ratesAdvancedBlock.classList.toggle("is-active", showRates);
    dom.ratesAdvancedBlock.hidden = !showRates;
  }
}

function navigateToAdvancedGroup(groupKey, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const shouldScroll = safeOptions.scroll !== false;
  const shouldFocusEditButton = safeOptions.focusEditButton !== false;
  const shouldShowFeedback = safeOptions.showFeedback !== false;

  const map = {
    expense: {
      block: dom.expenseAdvancedBlock,
      button: dom.editExpenseItems,
      label: "생활비 상세 항목",
    },
    savings: {
      block: dom.savingsAdvancedBlock,
      button: dom.editSavingsItems,
      label: "저축 상세 항목",
    },
    invest: {
      block: dom.investAdvancedBlock,
      button: dom.editInvestItems,
      label: "투자 상세 항목",
    },
    rates: {
      block: dom.ratesAdvancedBlock,
      button: null,
      label: "수익률 설정",
    },
  };
  const target = map[groupKey];
  if (!target) {
    return;
  }

  setActiveAdvancedTab(groupKey);
  if (dom.advancedSettings && !dom.advancedSettings.open) {
    dom.advancedSettings.open = true;
  }

  if (shouldScroll && target.block) {
    target.block.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (shouldScroll && dom.advancedSettings) {
    dom.advancedSettings.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (shouldFocusEditButton) {
    window.setTimeout(() => {
      if (target.button instanceof HTMLElement) {
        target.button.focus({ preventScroll: true });
      }
    }, 240);
  }

  if (shouldShowFeedback) {
    IsfFeedback.showFeedback(dom.applyFeedback, `${target.label}으로 이동했습니다.`);
  }
}

function normalizeSankeySortMode(mode) {
  const safeMode = String(mode ?? "").trim().toLowerCase();
  if (Object.values(SANKEY_SORT_MODES).includes(safeMode)) {
    return safeMode;
  }
  return SANKEY_SORT_MODES.GROUP;
}

function setSankeySortMode(nextMode) {
  const safeMode = normalizeSankeySortMode(nextMode);
  if (state.sankeySortMode === safeMode) {
    syncSankeySortModeUi();
    return;
  }
  state.sankeySortMode = safeMode;
  syncSankeySortModeUi();
  if (state.snapshot) {
    renderSankey(state.snapshot);
  }
}

function syncSankeySortModeUi() {
  if (dom.sankeySortMode) {
    dom.sankeySortMode.value = normalizeSankeySortMode(state.sankeySortMode);
  }
}

function normalizeSankeyValueMode(mode) {
  const safeMode = String(mode ?? "").trim();
  if (safeMode === SANKEY_VALUE_MODES.PERCENT) {
    return SANKEY_VALUE_MODES.PERCENT;
  }
  return SANKEY_VALUE_MODES.AMOUNT;
}

function setSankeyValueMode(nextMode) {
  const safeMode = normalizeSankeyValueMode(nextMode);
  if (state.sankeyValueMode === safeMode) {
    syncSankeyValueModeUi();
    return;
  }
  state.sankeyValueMode = safeMode;
  syncSankeyValueModeUi();
  if (state.snapshot) {
    renderSankey(state.snapshot);
  }
}

function syncSankeyValueModeUi() {
  const currentMode = normalizeSankeyValueMode(state.sankeyValueMode);
  const buttons = [dom.sankeyViewAmount, dom.sankeyViewPercent];
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const buttonMode = normalizeSankeyValueMode(button.dataset.sankeyView);
    const isActive = buttonMode === currentMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function normalizeSankeyZoom(zoom) {
  const safeZoom = Number(zoom);
  if (!Number.isFinite(safeZoom)) {
    return 1;
  }
  return roundTo(Math.min(SANKEY_ZOOM_MAX, Math.max(SANKEY_ZOOM_MIN, safeZoom)), 1);
}

function getEffectiveSankeyZoom(isMobileViewport = window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
  const baseZoom = normalizeSankeyZoom(state.sankeyZoom);
  if (!isMobileViewport) {
    return baseZoom;
  }
  return roundTo(baseZoom * SANKEY_MOBILE_BASE_ZOOM, 2);
}

function setSankeyZoom(nextZoom) {
  const safeZoom = normalizeSankeyZoom(nextZoom);
  if (safeZoom === state.sankeyZoom) {
    syncSankeyZoomUi();
    return;
  }
  state.sankeyZoom = safeZoom;
  syncSankeyZoomUi();
  if (state.snapshot) {
    renderSankey(state.snapshot);
  }
}

function syncSankeyZoomUi() {
  const isMobileViewport = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  const safeZoom = normalizeSankeyZoom(state.sankeyZoom);
  const displayZoom = isMobileViewport ? getEffectiveSankeyZoom(true) : safeZoom;
  if (dom.sankeyZoomLabel) {
    dom.sankeyZoomLabel.textContent = `${Math.round(displayZoom * 100)}%`;
  }
  if (dom.sankeyZoomOut) {
    dom.sankeyZoomOut.disabled = safeZoom <= SANKEY_ZOOM_MIN;
  }
  if (dom.sankeyZoomIn) {
    dom.sankeyZoomIn.disabled = safeZoom >= SANKEY_ZOOM_MAX;
  }
}

function ensureDraftInputs() {
  if (state.draftInputs) {
    return state.draftInputs;
  }
  state.draftInputs = cloneInputs(state.inputs);
  return state.draftInputs;
}

function getVisibleInputs() {
  return state.draftInputs || state.inputs;
}

function getItemGroupMeta(groupKey) {
  const map = {
    expense: {
      label: "생활비",
      field: "expenseItems",
      block: dom.expenseAdvancedBlock,
      renderList: renderExpenseList,
      renderHint: renderExpenseTotalHint,
      editButton: dom.editExpenseItems,
      actionWrap: dom.expenseEditorActions,
      addButton: dom.addExpenseItem,
      applyButton: dom.applyExpenseItems,
      cancelButton: dom.cancelExpenseItems,
      defaultItems: DEFAULT_EXPENSE_ITEMS,
    },
    savings: {
      label: "저축",
      field: "savingsItems",
      block: dom.savingsAdvancedBlock,
      renderList: renderSavingsList,
      renderHint: renderSavingsTotalHint,
      editButton: dom.editSavingsItems,
      actionWrap: dom.savingsEditorActions,
      addButton: dom.addSavingsItem,
      applyButton: dom.applySavingsItems,
      cancelButton: dom.cancelSavingsItems,
      defaultItems: DEFAULT_SAVINGS_ITEMS,
    },
    invest: {
      label: "투자",
      field: "investItems",
      block: dom.investAdvancedBlock,
      renderList: renderInvestList,
      renderHint: renderInvestTotalHint,
      editButton: dom.editInvestItems,
      actionWrap: dom.investEditorActions,
      addButton: dom.addInvestItem,
      applyButton: dom.applyInvestItems,
      cancelButton: dom.cancelInvestItems,
      defaultItems: DEFAULT_INVEST_ITEMS,
    },
  };
  return map[groupKey];
}

function getItemEditorSignature(groupKey, items) {
  const meta = getItemGroupMeta(groupKey);
  if (!meta) {
    return "";
  }
  const fallbackSavingsRate = getVisibleInputs().annualSavingsYield;
  const normalizedItems = groupKey === "savings"
    ? sanitizeSavingsItems(items, 0, fallbackSavingsRate)
    : sanitizeAllocationItems(
      items,
      meta.defaultItems,
      0,
      groupKey,
      meta.label,
      { allowMaturity: groupKey === "invest" },
    );
  return JSON.stringify(normalizedItems.map((item, index) => ({
    id: String(item.id || "").trim(),
    name: normalizeAllocationName(item.name, meta.label, index),
    amount: IsfUtils.sanitizeMoney(item.amount, 0),
    group: normalizeAllocationGroupName(item.group),
    ...(groupKey === "savings" || groupKey === "invest"
      ? { maturityMonth: normalizeMaturityMonth(item.maturityMonth) }
      : {}),
    ...(groupKey === "savings"
      ? { annualRate: sanitizeSavingsAnnualRate(item.annualRate, fallbackSavingsRate) }
      : {}),
  })));
}

function hasItemEditorChanges(groupKey) {
  const editor = state.itemEditors[groupKey];
  if (!editor || !editor.active) {
    return false;
  }
  const currentSignature = getItemEditorSignature(groupKey, editor.items);
  return currentSignature !== editor.baselineSignature;
}

function getActiveItemEditorGroupKey() {
  const groupKeys = ["expense", "savings", "invest"];
  return groupKeys.find((groupKey) => Boolean(state.itemEditors[groupKey]?.active)) || "";
}

function syncMobileItemEditorFab() {
  if (!(dom.mobileEditorFab instanceof HTMLElement)) {
    return;
  }
  const activeGroupKey = getActiveItemEditorGroupKey();
  const isMobile = mobileLayoutMediaQuery.matches;
  const shouldShow = isMobile && Boolean(activeGroupKey);
  dom.mobileEditorFab.hidden = !shouldShow;
  if (!shouldShow) {
    if (dom.mobileEditorFabLabel) {
      dom.mobileEditorFabLabel.textContent = "";
    }
    return;
  }

  const meta = getItemGroupMeta(activeGroupKey);
  const editor = state.itemEditors[activeGroupKey];
  if (!meta || !editor) {
    dom.mobileEditorFab.hidden = true;
    return;
  }

  const canAddItem = editor.items.length < MAX_ALLOCATION_ITEMS;
  const hasChanges = hasItemEditorChanges(activeGroupKey);
  if (dom.mobileEditorFabLabel) {
    dom.mobileEditorFabLabel.textContent = `${meta.label} 항목 편집 중`;
  }
  if (dom.mobileEditorAdd) {
    dom.mobileEditorAdd.disabled = !canAddItem;
  }
  if (dom.mobileEditorApply) {
    dom.mobileEditorApply.disabled = !hasChanges;
  }
}

function syncItemEditorModeState() {
  const isItemEditorActive = Boolean(getActiveItemEditorGroupKey());
  if (dom.controlsPanel instanceof HTMLElement) {
    dom.controlsPanel.classList.toggle("is-item-editor-active", isItemEditorActive);
  }
  if (document.body instanceof HTMLElement) {
    document.body.classList.toggle("is-item-editor-active", isItemEditorActive);
  }
}

function syncAllItemEditorUi() {
  ["expense", "savings", "invest"].forEach((groupKey) => {
    const editor = state.itemEditors[groupKey];
    setItemEditorUi(groupKey, Boolean(editor?.active));
  });
}

function setItemEditorUi(groupKey, active) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta) {
    return;
  }
  const isMobile = mobileLayoutMediaQuery.matches;
  const hasChanges = Boolean(active && editor && hasItemEditorChanges(groupKey));
  if (meta.actionWrap) {
    meta.actionWrap.hidden = !active || isMobile;
  }
  if (meta.editButton) {
    meta.editButton.hidden = isMobile && active;
    meta.editButton.textContent = active ? "편집 닫기" : "항목 편집";
  }
  if (meta.addButton) {
    meta.addButton.hidden = !active || isMobile;
    meta.addButton.disabled = active ? (editor?.items?.length ?? 0) >= MAX_ALLOCATION_ITEMS : false;
  }
  if (meta.applyButton) {
    meta.applyButton.hidden = !active || isMobile;
    meta.applyButton.disabled = active ? !hasChanges : false;
  }
  if (meta.cancelButton) {
    meta.cancelButton.hidden = !active || isMobile;
  }
  if (meta.block) {
    meta.block.classList.toggle("is-editor-active", Boolean(active));
  }
  syncGroupOptionsFor(groupKey);
  syncItemEditorModeState();
  syncMobileItemEditorFab();
}

function startItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor) {
    return;
  }

  closeAllItemEditors(groupKey);

  const inputs = getVisibleInputs();
  const sourceItems = Array.isArray(inputs[meta.field]) && inputs[meta.field].length > 0
    ? inputs[meta.field]
    : meta.defaultItems;

  editor.active = true;
  editor.items = sourceItems.map((item, index) => {
    const baseItem = {
      id: typeof item?.id === "string" && item.id.trim()
        ? item.id.trim()
        : createAllocationItemId(groupKey, index),
      name: normalizeAllocationName(item?.name, meta.label, index),
      amount: IsfUtils.sanitizeMoney(item?.amount, 0),
      ...(normalizeAllocationGroupName(item?.group) ? { group: normalizeAllocationGroupName(item?.group) } : {}),
    };
    if (groupKey === "savings") {
      const parsedRate = parseSavingsAnnualRateInput(item?.annualRate, inputs.annualSavingsYield);
      if (parsedRate !== null) {
        baseItem.annualRate = parsedRate;
      }
      const maturityMonth = normalizeMaturityMonth(item?.maturityMonth);
      if (maturityMonth) {
        baseItem.maturityMonth = maturityMonth;
      }
    }
    if (groupKey === "invest") {
      const maturityMonth = normalizeMaturityMonth(item?.maturityMonth);
      if (maturityMonth) {
        baseItem.maturityMonth = maturityMonth;
      }
    }
    return baseItem;
  });
  editor.baselineSignature = getItemEditorSignature(groupKey, editor.items);

  meta.renderList(editor.items, { editing: true });
  meta.renderHint(IsfUtils.toWon(getMonthlyAllocationTotalMan(editor.items)), editor.items.length);
  setItemEditorUi(groupKey, true);
}

function addItemToEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor || !editor.active || editor.items.length >= MAX_ALLOCATION_ITEMS) {
    return;
  }

  const item = {
    id: createAllocationItemId(groupKey, editor.items.length),
    name: `${meta.label} ${editor.items.length + 1}`,
    amount: 0,
    group: "",
    ...(groupKey === "savings" || groupKey === "invest" ? { maturityMonth: "" } : {}),
  };
  editor.items.push(item);

  meta.renderList(editor.items, { editing: true });
  meta.renderHint(IsfUtils.toWon(getMonthlyAllocationTotalMan(editor.items)), editor.items.length);
  setItemEditorUi(groupKey, true);
}

function applyItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor || !editor.active) {
    return;
  }

  const draftInputs = ensureDraftInputs();
  const normalizedItems = groupKey === "savings"
    ? sanitizeSavingsItems(editor.items, 0, draftInputs.annualSavingsYield)
    : sanitizeAllocationItems(
      editor.items,
      meta.defaultItems,
      0,
      groupKey,
      meta.label,
      { allowMaturity: groupKey === "invest" },
    );
  draftInputs[meta.field] = clusterAllocationItemsByGroup(normalizedItems);
  state.draftInputs = sanitizeInputs(draftInputs);

  editor.active = false;
  editor.items = [];
  editor.baselineSignature = "";
  setItemEditorUi(groupKey, false);

  meta.renderList(state.draftInputs[meta.field]);
  markPendingChanges();
}

function cancelItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor) {
    return;
  }

  editor.active = false;
  editor.items = [];
  editor.baselineSignature = "";
  setItemEditorUi(groupKey, false);

  const inputs = getVisibleInputs();
  const items = inputs[meta.field] || [];
  meta.renderList(items);
  meta.renderHint(IsfUtils.toWon(getMonthlyAllocationTotalMan(items)), items.length);
}

function closeAllItemEditors(exceptGroupKey = "") {
  ["expense", "savings", "invest"].forEach((groupKey) => {
    if (groupKey === exceptGroupKey) {
      return;
    }
    const editor = state.itemEditors[groupKey];
    if (editor && editor.active) {
      cancelItemEditor(groupKey);
    } else {
      setItemEditorUi(groupKey, false);
    }
  });
}

function markPendingChanges() {
  if (!state.draftInputs) {
    return;
  }
  syncDerivedMonthlyInputs(state.draftInputs);
  renderInputHints(state.draftInputs);
  if (!hasPendingChanges()) {
    state.draftInputs = null;
    setPendingBarVisible(false);
    return;
  }
  setPendingBarVisible(true);
}

function setPendingBarVisible(visible) {
  if (!visible) {
    if (dom.pendingBar) {
      dom.pendingBar.hidden = true;
    }
    if (dom.pendingSummary) {
      dom.pendingSummary.textContent = "";
    }
    return;
  }

  const shouldShow = hasPendingChanges();
  if (dom.pendingBar) {
    dom.pendingBar.hidden = !shouldShow;
  }
  if (dom.pendingSummary) {
    dom.pendingSummary.textContent = shouldShow && state.draftInputs
      ? getPendingSummaryText(state.draftInputs)
      : "";
  }
}

function withSuspendedInputTracking(fn) {
  state.suspendInputTracking = true;
  try {
    return fn();
  } finally {
    state.suspendInputTracking = false;
  }
}

function hasPendingChanges() {
  return Boolean(state.draftInputs) && !areInputsEqual(state.draftInputs, state.inputs);
}

function areInputsEqual(a, b) {
  const left = buildInputSignature(a);
  const right = buildInputSignature(b);
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildInputSignature(inputs) {
  const safe = sanitizeInputs(cloneInputs(inputs));
  return {
    incomes: safe.incomes.map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 24),
      amount: IsfUtils.sanitizeMoney(item?.amount, 0),
    })),
    expenseItems: safe.expenseItems.map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 24),
      amount: IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
    })),
    savingsItems: safe.savingsItems.map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 24),
      amount: IsfUtils.sanitizeMoney(item?.amount, 0),
      annualRate: sanitizeSavingsAnnualRate(item?.annualRate, safe.annualSavingsYield),
      group: normalizeAllocationGroupName(item?.group),
      maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    })),
    investItems: safe.investItems.map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 24),
      amount: IsfUtils.sanitizeMoney(item?.amount, 0),
      group: normalizeAllocationGroupName(item?.group),
      maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    })),
    monthlyDebtPayment: safe.monthlyDebtPayment,
    startCash: safe.startCash,
    startSavings: safe.startSavings,
    startInvest: safe.startInvest,
    startDebt: safe.startDebt,
    annualIncomeGrowth: safe.annualIncomeGrowth,
    annualExpenseGrowth: safe.annualExpenseGrowth,
    annualSavingsYield: safe.annualSavingsYield,
    annualInvestReturn: safe.annualInvestReturn,
    annualDebtInterest: safe.annualDebtInterest,
    horizonYears: safe.horizonYears,
  };
}

function getPendingSummaryText(inputs) {
  const monthlyIncome = IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyOutflowMan = inputs.monthlyExpense + inputs.monthlySavings + inputs.monthlyInvest + inputs.monthlyDebtPayment;
  return `미적용 변경사항 · 월 수입 ${formatCurrency(monthlyIncome)} / 월 배분 ${formatCurrency(IsfUtils.toWon(monthlyOutflowMan))}`;
}

function syncDerivedMonthlyInputs(inputs) {
  inputs.monthlyExpense = getMonthlyAllocationTotalMan(inputs.expenseItems);
  inputs.monthlySavings = getMonthlyAllocationTotalMan(inputs.savingsItems);
  inputs.monthlyInvest = getMonthlyAllocationTotalMan(inputs.investItems);
  syncMonthlyExpenseField(inputs.monthlyExpense);
  syncMonthlySavingsField(inputs.monthlySavings);
  syncMonthlyInvestField(inputs.monthlyInvest);
}

function renderInputHints(inputs) {
  renderIncomeTotalHint(IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes)), inputs.incomes.length);
  renderExpenseTotalHint(IsfUtils.toWon(inputs.monthlyExpense), inputs.expenseItems.length);
  renderSavingsTotalHint(IsfUtils.toWon(inputs.monthlySavings), inputs.savingsItems.length);
  renderInvestTotalHint(IsfUtils.toWon(inputs.monthlyInvest), inputs.investItems.length);
}

function refreshInputsPanel(inputs) {
  closeAllItemEditors();
  withSuspendedInputTracking(() => {
    applyInputsToForm(inputs);
    renderIncomeList(inputs.incomes);
    renderExpenseList(inputs.expenseItems);
    renderSavingsList(inputs.savingsItems);
    renderInvestList(inputs.investItems);
    syncDerivedMonthlyInputs(inputs);
    renderInputHints(inputs);
    syncGroupOptionsAll();
  });
}

function commitImmediateInputs(nextInputs, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  state.inputs = sanitizeInputs(nextInputs);
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs, {
    skipAutoBackup: Boolean(safeOptions.skipAutoBackup),
    reason: safeOptions.reason || "commit",
  });
  renderAll();
  return true;
}


function renderAll() {
  syncDerivedMonthlyInputs(state.inputs);

  const snapshot = buildMonthlySnapshot(state.inputs);
  const projection = simulateProjection(state.inputs);
  const cards = buildSummaryCards(snapshot, projection, state.inputs.horizonYears);

  state.snapshot = snapshot;

  renderCards(cards, state.inputs.horizonYears);
  renderSankey(snapshot);
  renderProjectionTable(projection, state.inputs.horizonYears, state.inputs.annualExpenseGrowth);
  renderInputHints(state.inputs);
}

function buildMonthlySnapshot(inputs) {
  const income = IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const incomeBreakdown = (Array.isArray(inputs.incomes) ? inputs.incomes : [])
    .map((item, index) => ({
      id: `income-${item?.id || index + 1}`,
      label: String(item?.name || `수입 ${index + 1}`),
      tone: "income",
      value: IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)),
    }))
    .filter((item) => item.value > 0);
  const expenseBreakdown = (Array.isArray(inputs.expenseItems) ? inputs.expenseItems : [])
    .map((item, index) => ({
      id: `expense-${item?.id || index + 1}`,
      label: String(item?.name || `생활비 ${index + 1}`),
      tone: "expense",
      value: IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const savingsBreakdown = (Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [])
    .map((item, index) => ({
      id: `savings-${item?.id || index + 1}`,
      label: String(item?.name || `저축 ${index + 1}`),
      tone: "savings",
      value: IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const investBreakdown = (Array.isArray(inputs.investItems) ? inputs.investItems : [])
    .map((item, index) => ({
      id: `invest-${item?.id || index + 1}`,
      label: String(item?.name || `투자 ${index + 1}`),
      tone: "invest",
      value: IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)),
      group: normalizeAllocationGroupName(item?.group),
    }))
    .filter((item) => item.value > 0);
  const expense = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);
  const savings = savingsBreakdown.reduce((sum, item) => sum + item.value, 0);
  const invest = investBreakdown.reduce((sum, item) => sum + item.value, 0);
  const debtPayment = IsfUtils.toWon(inputs.monthlyDebtPayment);

  const requiredOutflow = expense + savings + invest + debtPayment;
  const netCashflow = income - requiredOutflow;
  const surplus = Math.max(0, netCashflow);
  const deficit = Math.max(0, -netCashflow);

  const targets = [
    { id: "expense", label: "생활비", tone: "expense", value: expense },
    { id: "savings", label: "저축", tone: "savings", value: savings },
    { id: "invest", label: "투자", tone: "invest", value: invest },
    { id: "debt", label: "부채상환", tone: "debt", value: debtPayment },
  ].filter((item) => item.value > 0);

  if (surplus > 0) {
    targets.push({ id: "surplus", label: "잉여현금", tone: "surplus", value: surplus });
  }

  return {
    income,
    incomeBreakdown,
    expense,
    expenseBreakdown,
    savingsBreakdown,
    investBreakdown,
    savings,
    invest,
    debtPayment,
    requiredOutflow,
    netCashflow,
    surplus,
    deficit,
    targets,
  };
}

function allocateByWeights(totalAmount, weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return [];
  }

  const safeTotal = Math.max(0, Number(totalAmount) || 0);
  if (safeTotal <= 0) {
    return weights.map(() => 0);
  }

  const safeWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) {
    const equal = safeTotal / safeWeights.length;
    return safeWeights.map(() => equal);
  }

  return safeWeights.map((weight) => safeTotal * (weight / weightTotal));
}

function buildSavingsBuckets(inputs) {
  const fallbackRate = sanitizeSavingsAnnualRate(inputs.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield);
  const savingsItems = Array.isArray(inputs.savingsItems) && inputs.savingsItems.length > 0
    ? inputs.savingsItems
    : DEFAULT_SAVINGS_ITEMS;
  const monthlyTargets = savingsItems.map((item) => IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)));
  const initialBalances = allocateByWeights(IsfUtils.toWon(inputs.startSavings), monthlyTargets);

  return savingsItems.map((item, index) => ({
    id: typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : createAllocationItemId("savings", index),
    monthlyTarget: monthlyTargets[index] || 0,
    annualRate: sanitizeSavingsAnnualRate(item?.annualRate, fallbackRate),
    monthlyFactor: toMonthlyFactor(sanitizeSavingsAnnualRate(item?.annualRate, fallbackRate)),
    balance: initialBalances[index] || 0,
    maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    maturityMonthIndex: getMaturityMonthIndex(item?.maturityMonth),
    closed: false,
  }));
}

function buildInvestBuckets(inputs) {
  const investItems = Array.isArray(inputs.investItems) && inputs.investItems.length > 0
    ? inputs.investItems
    : DEFAULT_INVEST_ITEMS;
  const monthlyTargets = investItems.map((item) => IsfUtils.toWon(IsfUtils.sanitizeMoney(item?.amount, 0)));
  const initialBalances = allocateByWeights(IsfUtils.toWon(inputs.startInvest), monthlyTargets);
  const monthlyFactor = toMonthlyFactor(inputs.annualInvestReturn);

  return investItems.map((item, index) => ({
    id: typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : createAllocationItemId("invest", index),
    monthlyTarget: monthlyTargets[index] || 0,
    monthlyFactor,
    balance: initialBalances[index] || 0,
    maturityMonth: normalizeMaturityMonth(item?.maturityMonth),
    maturityMonthIndex: getMaturityMonthIndex(item?.maturityMonth),
    closed: false,
  }));
}

function simulateProjection(inputs) {
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12;
  const monthlyIncomeBase = IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyExpenseBase = IsfUtils.toWon(inputs.monthlyExpense);
  const monthlySavings = IsfUtils.toWon(inputs.monthlySavings);
  const monthlyInvest = IsfUtils.toWon(inputs.monthlyInvest);
  const monthlyDebtPayment = IsfUtils.toWon(inputs.monthlyDebtPayment);

  const incomeFactor = toMonthlyFactor(inputs.annualIncomeGrowth);
  const expenseFactor = toMonthlyFactor(inputs.annualExpenseGrowth);
  const debtFactor = toMonthlyFactor(inputs.annualDebtInterest);
  const purchasingPowerFactor = toMonthlyFactor(inputs.annualExpenseGrowth);

  const savingsBuckets = buildSavingsBuckets(inputs);
  const investBuckets = buildInvestBuckets(inputs);

  let cash = IsfUtils.toWon(inputs.startCash);
  let savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  let debt = IsfUtils.toWon(inputs.startDebt);

  savingsBuckets.forEach((bucket) => {
    if (bucket.maturityMonthIndex !== null && bucket.maturityMonthIndex <= 0 && !bucket.closed) {
      cash += bucket.balance;
      bucket.balance = 0;
      bucket.closed = true;
    }
  });
  investBuckets.forEach((bucket) => {
    if (bucket.maturityMonthIndex !== null && bucket.maturityMonthIndex <= 0 && !bucket.closed) {
      cash += bucket.balance;
      bucket.balance = 0;
      bucket.closed = true;
    }
  });
  savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);
  invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

  const records = [
    buildProjectionRecord({
      monthIndex: 0,
      monthlyIncome: monthlyIncomeBase,
      monthlyExpense: monthlyExpenseBase,
      debtInterest: 0,
      actualDebtPayment: 0,
      newBorrowing: 0,
      cash,
      savings,
      invest,
      debt,
      realDiscountFactor: 1,
    }),
  ];

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex += 1) {
    const monthlyIncome = monthlyIncomeBase * Math.pow(incomeFactor, monthIndex - 1);
    const monthlyExpense = monthlyExpenseBase * Math.pow(expenseFactor, monthIndex - 1);
    const debtInterest = debt * (debtFactor - 1);
    let debtBalance = debt + debtInterest;
    let nextCash = cash + monthlyIncome;
    nextCash -= monthlyExpense;

    const payableCash = Math.max(0, nextCash);
    const actualDebtPayment = Math.min(debtBalance, monthlyDebtPayment, payableCash);
    nextCash -= actualDebtPayment;
    debtBalance -= actualDebtPayment;

    const activeSavingsTargets = savingsBuckets.map((bucket) => (bucket.closed ? 0 : bucket.monthlyTarget));
    const maxSavingsAdd = activeSavingsTargets.reduce((sum, target) => sum + target, 0);
    const savingsAdd = Math.min(Math.max(0, nextCash), monthlySavings, maxSavingsAdd);
    nextCash -= savingsAdd;

    const savingsAddsByItem = allocateByWeights(savingsAdd, activeSavingsTargets);
    savingsBuckets.forEach((bucket, index) => {
      if (bucket.closed) {
        return;
      }
      const addAmount = savingsAddsByItem[index] || 0;
      bucket.balance += addAmount;
      bucket.balance *= bucket.monthlyFactor;
      if (bucket.maturityMonthIndex !== null && monthIndex >= bucket.maturityMonthIndex) {
        nextCash += bucket.balance;
        bucket.balance = 0;
        bucket.closed = true;
      }
    });
    savings = savingsBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

    const activeInvestTargets = investBuckets.map((bucket) => (bucket.closed ? 0 : bucket.monthlyTarget));
    const maxInvestAdd = activeInvestTargets.reduce((sum, target) => sum + target, 0);
    const investAdd = Math.min(Math.max(0, nextCash), monthlyInvest, maxInvestAdd);
    nextCash -= investAdd;

    const investAddsByItem = allocateByWeights(investAdd, activeInvestTargets);
    investBuckets.forEach((bucket, index) => {
      if (bucket.closed) {
        return;
      }
      const addAmount = investAddsByItem[index] || 0;
      bucket.balance += addAmount;
      bucket.balance *= bucket.monthlyFactor;
      if (bucket.maturityMonthIndex !== null && monthIndex >= bucket.maturityMonthIndex) {
        nextCash += bucket.balance;
        bucket.balance = 0;
        bucket.closed = true;
      }
    });
    invest = investBuckets.reduce((sum, bucket) => sum + bucket.balance, 0);

    let newBorrowing = 0;
    if (nextCash < 0) {
      newBorrowing = -nextCash;
      debtBalance += newBorrowing;
      nextCash = 0;
    }

    cash = nextCash;
    debt = debtBalance;

    records.push(
      buildProjectionRecord({
        monthIndex,
        monthlyIncome,
        monthlyExpense,
        debtInterest,
        actualDebtPayment,
        newBorrowing,
        cash,
        savings,
        invest,
        debt,
        realDiscountFactor: Math.pow(purchasingPowerFactor, monthIndex),
      }),
    );
  }

  return records;
}

function buildProjectionRecord({
  monthIndex,
  monthlyIncome,
  monthlyExpense,
  debtInterest = 0,
  actualDebtPayment = 0,
  newBorrowing = 0,
  cash,
  savings,
  invest,
  debt,
  realDiscountFactor = 1,
}) {
  const netAsset = cash + savings + invest - debt;
  const realNetAsset = netAsset / Math.max(realDiscountFactor, 1e-9);

  return {
    monthIndex,
    monthlyIncome,
    monthlyExpense,
    debtInterest,
    actualDebtPayment,
    newBorrowing,
    cash,
    savings,
    invest,
    debt,
    netAsset,
    realNetAsset,
  };
}

function buildSummaryCards(snapshot, projection, horizonYears) {
  const current = projection[0];
  const last = projection[projection.length - 1];
  const debtProbe = projection[1] || current;
  const deltaNet = last.netAsset - current.netAsset;
  const futureAllocation = snapshot.savings + snapshot.invest;
  const savingsRate = snapshot.income > 0 ? futureAllocation / snapshot.income : 0;
  const debtFreeMonth = projection.find((row) => row.monthIndex > 0 && row.debt <= 1);

  let debtFreeText = "부채 없음";
  let debtSub = "";

  if (current.debt > 0) {
    if (debtFreeMonth) {
      debtFreeText = formatMonthSpan(debtFreeMonth.monthIndex);
      debtSub = `시점: ${debtFreeMonth.monthIndex}개월`; 
    } else {
      debtFreeText = `${horizonYears}년 내 미소진`;
      debtSub = `말 잔여부채 ${formatCurrency(last.debt)}`;
    }
  }

  const cards = [
    {
      label: "월 수입",
      value: formatCurrency(snapshot.income),
      sub: `연 ${formatCurrency(snapshot.income * 12)}`,
      variant: "positive",
    },
    {
      label: "월 총 배분",
      value: formatCurrency(snapshot.requiredOutflow),
      sub: `생활비+저축+투자+부채상환`,
      variant: "",
    },
    {
      label: "월 순현금흐름",
      value: formatSignedCurrency(snapshot.netCashflow),
      sub: snapshot.netCashflow >= 0 ? "흑자" : "적자(현금 부족분은 부채 증가)",
      variant: snapshot.netCashflow >= 0 ? "positive" : "negative",
    },
    {
      label: "당월 부채이자",
      value: formatCurrency(debtProbe.debtInterest),
      sub: debtProbe.monthIndex > 0 ? `${debtProbe.monthIndex}개월차 기준` : "현재 기준",
      variant: debtProbe.debtInterest > 0 ? "negative" : "positive",
      metric: debtProbe.debtInterest,
      hideIfZero: true,
    },
    {
      label: "당월 실제상환",
      value: formatCurrency(debtProbe.actualDebtPayment),
      sub: `설정 상환 ${formatCurrency(snapshot.debtPayment)}`,
      variant: debtProbe.actualDebtPayment > 0 ? "positive" : "",
      metric: debtProbe.actualDebtPayment,
      hideIfZero: true,
    },
    {
      label: "당월 부채증가분",
      value: formatCurrency(debtProbe.newBorrowing),
      sub: debtProbe.newBorrowing > 0 ? "현금 부족분이 부채로 전환됨" : "부채 증가분 없음",
      variant: debtProbe.newBorrowing > 0 ? "negative" : "positive",
      metric: debtProbe.newBorrowing,
      hideIfZero: true,
    },
    {
      label: "현재 순자산",
      value: formatCurrency(current.netAsset),
      sub: `현금 ${formatCurrency(current.cash)} · 부채 ${formatCurrency(current.debt)}`,
      variant: current.netAsset >= 0 ? "positive" : "negative",
    },
    {
      label: `${horizonYears}년 후 순자산`,
      value: formatCurrency(last.netAsset),
      sub: `변화 ${formatSignedCurrency(deltaNet)}`,
      variant: deltaNet >= 0 ? "positive" : "negative",
    },
    {
      label: "미래자산 투입률",
      value: formatPercent(savingsRate * 100),
      sub: `월 저축+투자 ${formatCurrency(futureAllocation)}`,
      variant: "positive",
    },
    {
      label: "부채 소진 예상",
      value: debtFreeText,
      sub: debtSub || "초기 부채가 없습니다.",
      variant: debtFreeMonth || current.debt === 0 ? "positive" : "negative",
      metric: current.debt,
      hideIfZero: true,
    },
  ];

  return cards.filter((card) => {
    if (!card.hideIfZero) {
      return true;
    }
    return Math.abs(Number(card.metric) || 0) > 0;
  });
}

function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) {
    return;
  }

  dom.summaryCards.innerHTML = "";
  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = `card ${card.variant || ""}`.trim();

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = card.label;

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = card.value;

    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = card.sub;

    item.append(label, value, sub);
    dom.summaryCards.appendChild(item);
  });

  if (dom.cardMeta) {
    dom.cardMeta.textContent = `동일 엔진 계산 · ${horizonYears}년 예측 포함 · 적자 시 저축/투자 자동 축소`;
  }
}

function sortBreakdownItemsForSankey(items) {
  const safeItems = Array.isArray(items) ? [...items] : [];
  const mode = normalizeSankeySortMode(state.sankeySortMode);
  const byNameAsc = (left, right) => String(left?.label || "")
    .localeCompare(String(right?.label || ""), "ko-KR", { sensitivity: "base" });
  const byValueAsc = (left, right) => (Number(left?.value) || 0) - (Number(right?.value) || 0);

  if (mode === SANKEY_SORT_MODES.AMOUNT_DESC) {
    safeItems.sort((left, right) => byValueAsc(right, left) || byNameAsc(left, right));
    return safeItems;
  }
  if (mode === SANKEY_SORT_MODES.AMOUNT_ASC) {
    safeItems.sort((left, right) => byValueAsc(left, right) || byNameAsc(left, right));
    return safeItems;
  }
  if (mode === SANKEY_SORT_MODES.NAME_ASC) {
    safeItems.sort((left, right) => byNameAsc(left, right) || byValueAsc(right, left));
    return safeItems;
  }
  return clusterAllocationItemsByGroup(safeItems);
}

function buildSankeyData(snapshot) {
  const level1Targets = snapshot.targets.filter((item) => item.value > 0);
  if (!level1Targets.length) {
    return null;
  }

  const totalTarget = level1Targets.reduce((sum, item) => sum + item.value, 0);
  const incomeSources = (snapshot.incomeBreakdown || []).filter((item) => item.value > 0);
  const showIncomeInflow = incomeSources.length >= 2;

  const toGroupNodeId = (parentId, groupLabel, index) => {
    const slug = String(groupLabel || "")
      .toLowerCase()
      .replace(/[^a-z0-9\uac00-\ud7a3]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const safeSlug = slug || `group-${index + 1}`;
    return `${parentId}-group-${safeSlug}-${index + 1}`;
  };

  const splitConfigs = [
    {
      parentId: "expense",
      tone: "expense",
      breakdown: sortBreakdownItemsForSankey((snapshot.expenseBreakdown || []).filter((item) => item.value > 0)),
    },
    {
      parentId: "savings",
      tone: "savings",
      breakdown: sortBreakdownItemsForSankey((snapshot.savingsBreakdown || []).filter((item) => item.value > 0)),
    },
    {
      parentId: "invest",
      tone: "invest",
      breakdown: sortBreakdownItemsForSankey((snapshot.investBreakdown || []).filter((item) => item.value > 0)),
    },
  ];
  const splitGroups = splitConfigs
    .map((config) => {
      const parent = level1Targets.find((item) => item.id === config.parentId);
      if (!parent || !config.breakdown.length) {
        return null;
      }

      const groupedMap = new Map();
      const ungrouped = [];
      config.breakdown.forEach((item) => {
        const groupName = normalizeAllocationGroupName(item.group);
        if (!groupName) {
          ungrouped.push(item);
          return;
        }
        if (!groupedMap.has(groupName)) {
          groupedMap.set(groupName, []);
        }
        groupedMap.get(groupName).push(item);
      });

      const grouped = Array.from(groupedMap.entries()).map(([groupLabel, items], index) => ({
        label: groupLabel,
        nodeId: toGroupNodeId(config.parentId, groupLabel, index),
        tone: config.tone,
        items,
        value: items.reduce((sum, item) => sum + item.value, 0),
      }));

      return {
        ...config,
        parentLabel: parent.label,
        grouped,
        ungrouped,
      };
    })
    .filter(Boolean);

  const hasGroupLayer = splitGroups.some((group) => Array.isArray(group.grouped) && group.grouped.length > 0);
  const sourceColumn = showIncomeInflow ? 1 : 0;
  const targetColumn = showIncomeInflow ? 2 : 1;
  const groupColumn = targetColumn + 1;
  const detailColumn = targetColumn + (hasGroupLayer ? 2 : 1);

  const nodes = [
    ...(showIncomeInflow
      ? incomeSources.map((item) => ({
        id: item.id,
        label: item.label,
        tone: "income",
        value: item.value,
        column: 0,
      }))
      : []),
    { id: "fund", label: "월 배분총액", tone: "income", value: totalTarget, column: sourceColumn },
    ...level1Targets.map((item) => ({
      id: item.id,
      label: item.label,
      tone: item.tone,
      value: item.value,
      column: targetColumn,
    })),
  ];

  splitGroups.forEach((group) => {
    if (hasGroupLayer) {
      nodes.push(
        ...group.grouped.map((entry) => ({
          id: entry.nodeId,
          label: entry.label,
          tone: group.tone,
          value: entry.value,
          column: groupColumn,
        })),
      );
    }

    const detailNodes = hasGroupLayer
      ? [...group.ungrouped, ...group.grouped.flatMap((entry) => entry.items)]
      : group.breakdown;

    nodes.push(
      ...detailNodes.map((item) => ({
        id: `${group.parentId}-detail-${item.id}`,
        label: item.label,
        tone: group.tone,
        value: item.value,
        column: detailColumn,
      })),
    );
  });

  const links = [
    ...(showIncomeInflow
      ? incomeSources.map((source) => ({
        source: source.id,
        target: "fund",
        value: source.value,
        tone: "income",
      }))
      : []),
    ...level1Targets.map((target) => ({
      source: "fund",
      target: target.id,
      value: target.value,
      tone: target.tone,
    })),
  ];

  splitGroups.forEach((group) => {
    if (hasGroupLayer) {
      links.push(
        ...group.grouped.map((entry) => ({
          source: group.parentId,
          target: entry.nodeId,
          value: entry.value,
          tone: group.tone,
        })),
      );
      links.push(
        ...group.grouped.flatMap((entry) => entry.items.map((item) => ({
          source: entry.nodeId,
          target: `${group.parentId}-detail-${item.id}`,
          value: item.value,
          tone: group.tone,
        }))),
      );
      links.push(
        ...group.ungrouped.map((item) => ({
          source: group.parentId,
          target: `${group.parentId}-detail-${item.id}`,
          value: item.value,
          tone: group.tone,
        })),
      );
      return;
    }

    links.push(
      ...group.breakdown.map((item) => ({
        source: group.parentId,
        target: `${group.parentId}-detail-${item.id}`,
        value: item.value,
        tone: group.tone,
      })),
    );
  });

  return {
    nodes,
    links,
    splitGroups,
    hasGroupLayer,
    totalValue: totalTarget,
    topLevelTargetIds: level1Targets.map((item) => item.id),
    hasIncomeInflow: showIncomeInflow,
  };
}

function renderSankey(snapshot) {
  if (!dom.sankeySvg || !dom.sankeyWrap) {
    return;
  }

  hideSankeyTooltip();

  const data = buildSankeyData(snapshot);
  dom.sankeySvg.innerHTML = "";
  dom.sankeyLegend.innerHTML = "";

  if (!data || !data.links.length) {
    dom.sankeyEmpty.hidden = false;
    if (dom.sankeyMeta) {
      dom.sankeyMeta.textContent = "수입/배분 데이터가 없습니다.";
    }
    return;
  }

  dom.sankeyEmpty.hidden = true;
  const valueMode = normalizeSankeyValueMode(state.sankeyValueMode);
  const sortMode = normalizeSankeySortMode(state.sankeySortMode);
  const sortModeTextMap = {
    [SANKEY_SORT_MODES.GROUP]: "정렬 그룹묶음",
    [SANKEY_SORT_MODES.AMOUNT_DESC]: "정렬 금액큰순",
    [SANKEY_SORT_MODES.AMOUNT_ASC]: "정렬 금액작은순",
    [SANKEY_SORT_MODES.NAME_ASC]: "정렬 이름순",
  };

  if (dom.sankeyMeta) {
    const splitCount = Array.isArray(data.splitGroups)
      ? data.splitGroups.reduce((sum, group) => sum + group.breakdown.length, 0)
      : 0;
    const splitText = splitCount > 0 ? ` · 상세 분기 ${splitCount}개` : "";
    const valueModeText = valueMode === SANKEY_VALUE_MODES.PERCENT ? "표시 %" : "표시 금액";
    const sortText = sortModeTextMap[sortMode] || sortModeTextMap[SANKEY_SORT_MODES.GROUP];
    const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;
    const zoomText = isMobileViewport ? ` · 확대 ${Math.round(getEffectiveSankeyZoom(true) * 100)}%` : "";
    dom.sankeyMeta.textContent = `수입 ${formatCurrency(snapshot.income)} · 배분 ${formatCurrency(snapshot.requiredOutflow)} · 순현금흐름 ${formatSignedCurrency(snapshot.netCashflow)}${splitText} · ${valueModeText} · ${sortText}${zoomText}`;
  }

  const columns = [...new Set(data.nodes.map((node) => node.column))].sort((a, b) => a - b);
  const columnCount = columns.length;
  const firstColumn = columns[0];
  const lastColumn = columns[columns.length - 1];
  const hasIncomeInflow = Boolean(data.hasIncomeInflow);
  const hasGroupLayer = Boolean(data.hasGroupLayer);
  const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;
  const effectiveSankeyZoom = getEffectiveSankeyZoom(isMobileViewport);
  const nodeWidth = isMobileViewport ? 16 : 18;
  const labelGap = isMobileViewport ? 8 : 10;
  const labelFontSize = isMobileViewport ? 11 : 12;
  const valueFontSize = isMobileViewport ? 10 : 11;
  const overlapPadding = hasGroupLayer ? 14 : 0;
  const minColumnStep = isMobileViewport
    ? (hasIncomeInflow ? SANKEY_MOBILE_MIN_COLUMN_STEP_WITH_INFLOW : SANKEY_MOBILE_MIN_COLUMN_STEP) + overlapPadding
    : 140 + overlapPadding;

  const getNodeTextWidth = (node) => Math.max(
    measureSankeyTextWidth(node?.label, labelFontSize, 700),
    measureSankeyTextWidth(formatCurrency(node?.value), valueFontSize, 400),
  );

  const leftLabelColumn = hasIncomeInflow && columnCount > 1 ? columns[1] : firstColumn;
  const leftLabelWidth = data.nodes
    .filter((node) => node.column === leftLabelColumn)
    .reduce((max, node) => Math.max(max, getNodeTextWidth(node)), 0);
  const rightLabelWidth = data.nodes
    .filter((node) => node.column === lastColumn)
    .reduce((max, node) => Math.max(max, getNodeTextWidth(node)), 0);

  const marginLeft = Math.max(64, Math.ceil(leftLabelWidth + labelGap + 12));
  const marginRight = Math.max(64, Math.ceil(rightLabelWidth + labelGap + 12));
  const flowMinWidth = nodeWidth + Math.max(0, columnCount - 1) * minColumnStep;
  const minWidth = Math.ceil(marginLeft + flowMinWidth + marginRight);
  const wrapWidth = Math.max(0, dom.sankeyWrap.clientWidth - (isMobileViewport ? 12 : 20));
  const widthTarget = isMobileViewport
    ? Math.ceil(wrapWidth * SANKEY_MOBILE_WIDTH_SCALE)
    : wrapWidth;
  const width = Math.max(minWidth, widthTarget);
  const maxCountPerColumn = columns.reduce((max, column) => {
    const count = data.nodes.filter((node) => node.column === column).length;
    return Math.max(max, count);
  }, 1);
  const nodeHeightUnit = isMobileViewport
    ? (hasGroupLayer ? 50 : 42)
    : (hasGroupLayer ? 56 : 46);
  const baseHeight = Math.max(
    isMobileViewport ? 320 : 360,
    (isMobileViewport ? 230 : 260) + maxCountPerColumn * nodeHeightUnit,
  );
  const mobileAspectHeight = isMobileViewport ? Math.round(width * SANKEY_MOBILE_HEIGHT_RATIO) : 0;
  const height = Math.max(baseHeight, mobileAspectHeight);
  const marginTop = isMobileViewport ? 20 : 26;
  const marginBottom = isMobileViewport ? 20 : 26;
  const nodeGap = isMobileViewport
    ? (hasGroupLayer ? 14 : 12)
    : (hasGroupLayer ? 18 : 14);

  dom.sankeySvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  dom.sankeySvg.style.width = `${Math.round(effectiveSankeyZoom * 100)}%`;
  dom.sankeySvg.style.maxWidth = "none";
  dom.sankeySvg.style.margin = isMobileViewport ? "0 auto" : "0";

  const inTotals = new Map();
  const outTotals = new Map();
  data.links.forEach((link) => {
    outTotals.set(link.source, (outTotals.get(link.source) || 0) + link.value);
    inTotals.set(link.target, (inTotals.get(link.target) || 0) + link.value);
  });

  const layoutNodes = data.nodes.map((node) => {
    const incoming = inTotals.get(node.id) || 0;
    const outgoing = outTotals.get(node.id) || 0;
    return {
      ...node,
      displayValue: Math.max(node.value || 0, incoming, outgoing),
    };
  });

  const scaleCandidates = columns.map((column) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnValue = nodesInColumn.reduce((sum, node) => sum + node.displayValue, 0);
    const available = height - marginTop - marginBottom - nodeGap * Math.max(0, nodesInColumn.length - 1);
    return columnValue > 0 ? available / columnValue : Number.POSITIVE_INFINITY;
  });
  const scale = Math.min(...scaleCandidates);

  if (!Number.isFinite(scale) || scale <= 0) {
    dom.sankeyEmpty.hidden = false;
    return;
  }

  const usableWidth = Math.max(nodeWidth, width - marginLeft - marginRight - nodeWidth);
  const step = columnCount > 1 ? usableWidth / (columnCount - 1) : 0;

  const positionedNodes = [];
  columns.forEach((column, index) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnHeight = nodesInColumn.reduce((sum, node) => sum + node.displayValue * scale, 0)
      + nodeGap * Math.max(0, nodesInColumn.length - 1);
    let y = (height - columnHeight) / 2;
    const x = marginLeft + index * step;

    nodesInColumn.forEach((node) => {
      const h = node.displayValue * scale;
      positionedNodes.push({ ...node, x, y, h });
      y += h + nodeGap;
    });
  });

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));

  const orderedLinks = [...data.links].sort((a, b) => {
    const sourceA = nodeMap.get(a.source);
    const sourceB = nodeMap.get(b.source);
    const targetA = nodeMap.get(a.target);
    const targetB = nodeMap.get(b.target);
    const bySourceY = (sourceA?.y || 0) - (sourceB?.y || 0);
    if (bySourceY !== 0) return bySourceY;
    return (targetA?.y || 0) - (targetB?.y || 0);
  });

  const sourceOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));
  const targetOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));

  orderedLinks.forEach((link) => {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target) {
      return;
    }

    const thickness = link.value * scale;
    const sourceOffset = sourceOffsets.get(source.id) || 0;
    const targetOffset = targetOffsets.get(target.id) || 0;

    const y0 = source.y + sourceOffset;
    const y1 = y0 + thickness;
    const y2 = target.y + targetOffset;
    const y3 = y2 + thickness;

    sourceOffsets.set(source.id, sourceOffset + thickness);
    targetOffsets.set(target.id, targetOffset + thickness);

    const path = createSvgElement("path", {
      d: buildBandPath(source.x + nodeWidth, y0, y1, target.x, y2, y3),
      class: `sankey-path tone-${link.tone}`,
    });

    path.addEventListener("mousemove", (event) => {
      const splitGroup = (data.splitGroups || []).find((group) => link.target === group.parentId);
      const detailText = splitGroup
        ? formatAllocationBreakdownText(splitGroup.breakdown, data.totalValue, valueMode)
        : "";
      showSankeyTooltip(
        event,
        `${source.label} → ${target.label} · ${formatSankeyDisplayValue(link.value, data.totalValue, valueMode)}${detailText ? `\n${detailText}` : ""}`,
      );
    });
    path.addEventListener("mouseleave", hideSankeyTooltip);

    dom.sankeySvg.appendChild(path);
  });

  positionedNodes.forEach((node) => {
    const side = (hasIncomeInflow && node.column === firstColumn) || node.column === lastColumn
      ? "target"
      : "source";
    drawNode(node, side, nodeWidth, labelGap, data.totalValue, valueMode);
  });

  renderSankeyLegend(data, valueMode);
}

function drawNode(node, side, nodeWidth, labelGap = 10, totalValue = 0, valueMode = SANKEY_VALUE_MODES.AMOUNT) {
  const rect = createSvgElement("rect", {
    x: node.x,
    y: node.y,
    width: nodeWidth,
    height: Math.max(1, node.h),
    class: `sankey-node tone-${node.tone}`,
  });
  dom.sankeySvg.appendChild(rect);

  const labelX = side === "source" ? node.x - labelGap : node.x + nodeWidth + labelGap;
  const anchor = side === "source" ? "end" : "start";
  const centerY = node.y + node.h / 2;
  const showValue = node.h >= 22;
  const labelY = showValue ? centerY - 6 : centerY;

  const label = createSvgElement("text", {
    x: labelX,
    y: labelY,
    class: "sankey-label",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  label.textContent = node.label;

  dom.sankeySvg.appendChild(label);
  if (showValue) {
    const value = createSvgElement("text", {
      x: labelX,
      y: centerY + 10,
      class: "sankey-value",
      "text-anchor": anchor,
      "dominant-baseline": "middle",
    });
    value.textContent = formatSankeyDisplayValue(node.value, totalValue, valueMode);
    dom.sankeySvg.appendChild(value);
  }
}

function renderSankeyLegend(data, valueMode = SANKEY_VALUE_MODES.AMOUNT) {
  const targetIdSet = new Set(Array.isArray(data.topLevelTargetIds) ? data.topLevelTargetIds : []);
  const items = data.nodes
    .filter((node) => targetIdSet.has(node.id))
    .map((node) => ({
      id: node.id,
      label: node.label,
      tone: node.tone,
      value: node.value,
    }));

  const splitGroupMap = new Map();
  (data.splitGroups || []).forEach((group) => {
    splitGroupMap.set(group.parentId, group);
  });

  items.forEach((item) => {
    const groupWrap = document.createElement("div");
    groupWrap.className = "legend-group";

    const chip = document.createElement("span");
    chip.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = TONE_COLORS[item.tone] || "#999";

    const label = document.createElement("span");
    label.textContent = `${item.label} ${formatSankeyDisplayValue(item.value, data.totalValue, valueMode)}`;

    chip.append(dot, label);
    groupWrap.appendChild(chip);

    const splitGroup = splitGroupMap.get(item.id);
    if (splitGroup && Array.isArray(splitGroup.breakdown) && splitGroup.breakdown.length > 0) {
      const groupedTexts = Array.isArray(splitGroup.grouped)
        ? splitGroup.grouped
          .map((groupEntry) => {
            const childrenText = (groupEntry.items || [])
              .map((entry) => `${entry.label} ${formatSankeyDisplayValue(entry.value, data.totalValue, valueMode)}`)
            .join(", ");
            return childrenText ? `${groupEntry.label}: ${childrenText}` : "";
          })
          .filter(Boolean)
        : [];
      const groupedSummaryTexts = Array.isArray(splitGroup.grouped)
        ? splitGroup.grouped
          .map((groupEntry) => `${groupEntry.label} ${formatSankeyDisplayValue(groupEntry.value, data.totalValue, valueMode)}`)
          .filter(Boolean)
        : [];
      const ungroupedTexts = Array.isArray(splitGroup.ungrouped)
        ? splitGroup.ungrouped
          .map((entry) => `${entry.label} ${formatSankeyDisplayValue(entry.value, data.totalValue, valueMode)}`)
        : [];

      if (groupedSummaryTexts.length > 0) {
        const details = document.createElement("details");
        details.className = "legend-group-toggle";

        const summary = document.createElement("summary");
        summary.className = "legend-group-summary";
        const collapsedParts = [...groupedSummaryTexts, ...ungroupedTexts];
        summary.textContent = collapsedParts.join(" · ");

        const detail = document.createElement("p");
        detail.className = "legend-group-details";
        detail.textContent = [...groupedTexts, ...ungroupedTexts].join(" · ");

        details.append(summary, detail);
        groupWrap.appendChild(details);
      } else {
        const detail = document.createElement("p");
        detail.className = "legend-group-details";
        detail.textContent = ungroupedTexts.join(" · ");
        groupWrap.appendChild(detail);
      }
    }

    dom.sankeyLegend.appendChild(groupWrap);
  });
}

function renderProjectionTable(records, horizonYears, annualBaseRate) {
  if (!dom.projectionTableBody) {
    return;
  }

  const yearlyRows = records.filter((row) => row.monthIndex % 12 === 0);
  dom.projectionTableBody.innerHTML = "";

  yearlyRows.forEach((row) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.monthIndex === 0 ? "현재" : `${row.monthIndex / 12}년`}</td>
      <td>${formatCurrency(row.monthlyIncome)}</td>
      <td>${formatCurrency(row.monthlyExpense)}</td>
      <td>${formatCurrency(row.debtInterest)}</td>
      <td>${formatCurrency(row.actualDebtPayment)}</td>
      <td>${formatCurrency(row.newBorrowing)}</td>
      <td>${formatCurrency(row.cash)}</td>
      <td>${formatCurrency(row.savings)}</td>
      <td>${formatCurrency(row.invest)}</td>
      <td>${formatCurrency(row.debt)}</td>
      <td>${formatCurrency(row.netAsset)}</td>
      <td>${formatCurrency(row.realNetAsset)}</td>
    `;

    dom.projectionTableBody.appendChild(tr);
  });

  if (dom.projectionMeta) {
    const firstMonth = records.find((row) => row.monthIndex === 1);
    const debtHint = firstMonth && firstMonth.debtInterest > firstMonth.actualDebtPayment
      ? " 첫 달 기준 이자 > 실제상환이면 부채가 증가할 수 있습니다."
      : "";
    dom.projectionMeta.textContent = `월 계산 ${records.length - 1}회를 연 단위(${horizonYears}년)로 요약했습니다. 할인 기준금리: ${formatPercent(annualBaseRate)}.${debtHint}`;
  }
}

function renderIncomeList(incomes) {
  if (!dom.incomeList) {
    return;
  }

  dom.incomeList.innerHTML = "";

  incomes.forEach((income, index) => {
    const row = document.createElement("div");
    row.className = "income-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "수입명";
    nameInput.value = income.name;
    nameInput.setAttribute("aria-label", `수입 항목 ${index + 1} 이름`);
    nameInput.dataset.incomeId = income.id;
    nameInput.dataset.field = "name";

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(income.amount);
    amountInput.setAttribute("aria-label", `수입 항목 ${index + 1} 금액`);
    amountInput.dataset.incomeId = income.id;
    amountInput.dataset.field = "amount";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost btn-sm income-remove";
    removeButton.setAttribute("aria-label", `수입 항목 ${index + 1} 삭제`);
    removeButton.innerHTML = `
      <svg class="income-remove-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z"></path>
      </svg>
      <span class="income-remove-text">삭제</span>
    `;
    removeButton.dataset.removeIncome = income.id;
    removeButton.disabled = incomes.length <= 1;

    row.append(nameInput, amountInput, removeButton);
    dom.incomeList.appendChild(row);
  });

  if (dom.addIncomeItem) {
    dom.addIncomeItem.disabled = incomes.length >= MAX_INCOME_ITEMS;
  }
}

function renderIncomeTotalHint(monthlyIncomeWon, count) {
  if (!dom.incomeTotalHint) {
    return;
  }
  dom.incomeTotalHint.textContent = `현재 수입 항목 ${count}개 · 월 수입 합계 ${formatCurrency(monthlyIncomeWon)}`;
}

function createEditorField(labelText, control, className = "") {
  const field = document.createElement("label");
  field.className = `editor-field${className ? ` ${className}` : ""}`;

  const caption = document.createElement("span");
  caption.className = "editor-field-label";
  caption.textContent = labelText;

  field.append(caption, control);
  return field;
}

function renderExpenseList(expenseItems, options = {}) {
  if (!dom.expenseList) {
    return;
  }

  dom.expenseList.innerHTML = "";
  const editing = Boolean(options.editing);
  const sortedItems = sortAllocationItemsForRender("expense", expenseItems);

  sortedItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `expense-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "expense-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = createEditorField("항목명", nameInput, "editor-field--name");
    } else {
      const wrap = document.createElement("div");
      wrap.className = "allocation-label";
      const name = document.createElement("span");
      name.className = "expense-name";
      name.textContent = item.name;
      wrap.appendChild(name);
      const metaText = buildAllocationMetaText(item);
      if (metaText) {
        const meta = document.createElement("span");
        meta.className = "allocation-meta";
        meta.textContent = metaText;
        wrap.appendChild(meta);
      }
      nameElement = wrap;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.expenseId = item.id;
    }
    amountInput.dataset.index = String(index);

    if (editing) {
      row.append(nameElement, createEditorField("금액(만원)", amountInput, "editor-field--amount"));
    } else {
      row.append(nameElement, amountInput);
    }

    if (editing) {
      const groupInput = document.createElement("input");
      groupInput.type = "text";
      groupInput.maxLength = 16;
      groupInput.placeholder = "그룹(선택)";
      groupInput.setAttribute("list", getGroupOptionListId("expense"));
      groupInput.value = normalizeAllocationGroupName(item.group);
      groupInput.dataset.editorId = item.id;
      groupInput.dataset.field = "group";
      groupInput.dataset.index = String(index);
      groupInput.setAttribute("aria-label", `${item.name} 그룹`);
      row.appendChild(createEditorField("그룹", groupInput, "editor-field--group"));
    }

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.expenseList.appendChild(row);
  });
}

function renderSavingsList(savingsItems, options = {}) {
  if (!dom.savingsList) {
    return;
  }

  dom.savingsList.innerHTML = "";
  const editing = Boolean(options.editing);
  const fallbackRate = getVisibleInputs().annualSavingsYield;
  const fallbackRatePlaceholder = getSavingsFallbackRatePlaceholder(fallbackRate);
  const sortedItems = sortAllocationItemsForRender("savings", savingsItems);

  sortedItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `savings-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "savings-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = createEditorField("항목명", nameInput, "editor-field--name");
    } else {
      const wrap = document.createElement("div");
      wrap.className = "allocation-label";
      const name = document.createElement("span");
      name.className = "savings-name";
      name.textContent = item.name;
      wrap.appendChild(name);
      const metaText = buildAllocationMetaText(item, { showMaturity: true });
      if (metaText) {
        const meta = document.createElement("span");
        meta.className = "allocation-meta";
        meta.textContent = metaText;
        wrap.appendChild(meta);
      }
      nameElement = wrap;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.savingsId = item.id;
      amountInput.dataset.field = "amount";
    }
    amountInput.dataset.index = String(index);

    const rateInput = document.createElement("input");
    rateInput.type = "number";
    rateInput.min = "0";
    rateInput.max = "20";
    rateInput.step = "0.1";
    rateInput.placeholder = fallbackRatePlaceholder;
    rateInput.title = fallbackRatePlaceholder;
    const parsedRate = parseSavingsAnnualRateInput(item?.annualRate, fallbackRate);
    rateInput.value = parsedRate === null ? "" : String(parsedRate);
    rateInput.setAttribute("aria-label", `${item.name} 연 이자율`);
    if (editing) {
      rateInput.dataset.editorId = item.id;
      rateInput.dataset.field = "annualRate";
    } else {
      rateInput.dataset.savingsId = item.id;
      rateInput.dataset.field = "annualRate";
    }
    rateInput.dataset.index = String(index);

    if (editing) {
      row.append(
        nameElement,
        createEditorField("금액(만원)", amountInput, "editor-field--amount"),
        createEditorField("연 이자율(%)", rateInput, "editor-field--rate"),
      );
    } else {
      row.append(nameElement, amountInput, rateInput);
    }

    if (editing) {
      const maturityInput = document.createElement("input");
      maturityInput.type = "month";
      maturityInput.placeholder = "만기월";
      maturityInput.value = normalizeMaturityMonth(item?.maturityMonth);
      maturityInput.dataset.editorId = item.id;
      maturityInput.dataset.field = "maturityMonth";
      maturityInput.dataset.index = String(index);
      maturityInput.setAttribute("aria-label", `${item.name} 만기 해지월`);
      row.appendChild(createEditorField("만기 해지월", maturityInput, "editor-field--maturity"));

      const groupInput = document.createElement("input");
      groupInput.type = "text";
      groupInput.maxLength = 16;
      groupInput.placeholder = "그룹(선택)";
      groupInput.setAttribute("list", getGroupOptionListId("savings"));
      groupInput.value = normalizeAllocationGroupName(item.group);
      groupInput.dataset.editorId = item.id;
      groupInput.dataset.field = "group";
      groupInput.dataset.index = String(index);
      groupInput.setAttribute("aria-label", `${item.name} 그룹`);
      row.appendChild(createEditorField("그룹", groupInput, "editor-field--group"));
    }

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.savingsList.appendChild(row);
  });
}

function getSavingsFallbackRatePlaceholder(rate) {
  const safeRate = sanitizeSavingsAnnualRate(rate, DEFAULT_INPUTS.annualSavingsYield);
  const displayRate = Number.isInteger(safeRate)
    ? String(safeRate)
    : roundTo(safeRate, 1).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${displayRate}%(저축기본수익률)`;
}

function updateSavingsRateInputHints(baseRate) {
  if (!dom.savingsList) {
    return;
  }
  const placeholderText = getSavingsFallbackRatePlaceholder(baseRate);
  const rateInputs = dom.savingsList.querySelectorAll("input[data-field='annualRate']");
  rateInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.placeholder = placeholderText;
    input.title = placeholderText;
  });
}

function renderInvestList(investItems, options = {}) {
  if (!dom.investList) {
    return;
  }

  dom.investList.innerHTML = "";
  const editing = Boolean(options.editing);
  const sortedItems = sortAllocationItemsForRender("invest", investItems);

  sortedItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `invest-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "invest-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = createEditorField("항목명", nameInput, "editor-field--name");
    } else {
      const wrap = document.createElement("div");
      wrap.className = "allocation-label";
      const name = document.createElement("span");
      name.className = "invest-name";
      name.textContent = item.name;
      wrap.appendChild(name);
      const metaText = buildAllocationMetaText(item, { showMaturity: true });
      if (metaText) {
        const meta = document.createElement("span");
        meta.className = "allocation-meta";
        meta.textContent = metaText;
        wrap.appendChild(meta);
      }
      nameElement = wrap;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.investId = item.id;
    }
    amountInput.dataset.index = String(index);

    if (editing) {
      row.append(nameElement, createEditorField("금액(만원)", amountInput, "editor-field--amount"));
    } else {
      row.append(nameElement, amountInput);
    }

    if (editing) {
      const maturityInput = document.createElement("input");
      maturityInput.type = "month";
      maturityInput.placeholder = "만기월";
      maturityInput.value = normalizeMaturityMonth(item?.maturityMonth);
      maturityInput.dataset.editorId = item.id;
      maturityInput.dataset.field = "maturityMonth";
      maturityInput.dataset.index = String(index);
      maturityInput.setAttribute("aria-label", `${item.name} 만기 해지월`);
      row.appendChild(createEditorField("만기 해지월", maturityInput, "editor-field--maturity"));

      const groupInput = document.createElement("input");
      groupInput.type = "text";
      groupInput.maxLength = 16;
      groupInput.placeholder = "그룹(선택)";
      groupInput.setAttribute("list", getGroupOptionListId("invest"));
      groupInput.value = normalizeAllocationGroupName(item.group);
      groupInput.dataset.editorId = item.id;
      groupInput.dataset.field = "group";
      groupInput.dataset.index = String(index);
      groupInput.setAttribute("aria-label", `${item.name} 그룹`);
      row.appendChild(createEditorField("그룹", groupInput, "editor-field--group"));
    }

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.investList.appendChild(row);
  });
}

function renderExpenseTotalHint(monthlyExpenseWon, count) {
  if (!dom.expenseTotalHint) {
    return;
  }
  dom.expenseTotalHint.textContent = `생활비 항목 ${count}개 · 월 생활비 합계 ${formatCurrency(monthlyExpenseWon)}`;
}

function renderSavingsTotalHint(monthlySavingsWon, count) {
  if (!dom.savingsTotalHint) {
    return;
  }
  dom.savingsTotalHint.textContent = `저축 항목 ${count}개 · 월 저축 합계 ${formatCurrency(monthlySavingsWon)}`;
}

function renderInvestTotalHint(monthlyInvestWon, count) {
  if (!dom.investTotalHint) {
    return;
  }
  dom.investTotalHint.textContent = `투자 항목 ${count}개 · 월 투자 합계 ${formatCurrency(monthlyInvestWon)}`;
}

function syncMonthlyExpenseField(monthlyExpenseMan) {
  const field = dom.inputsForm?.elements?.monthlyExpense;
  if (field) {
    field.value = String(IsfUtils.sanitizeMoney(monthlyExpenseMan, 0));
  }
}

function syncMonthlySavingsField(monthlySavingsMan) {
  const field = dom.inputsForm?.elements?.monthlySavings;
  if (field) {
    field.value = String(IsfUtils.sanitizeMoney(monthlySavingsMan, 0));
  }
}

function syncMonthlyInvestField(monthlyInvestMan) {
  const field = dom.inputsForm?.elements?.monthlyInvest;
  if (field) {
    field.value = String(IsfUtils.sanitizeMoney(monthlyInvestMan, 0));
  }
}

function readInputsFromForm(baseInputs = state.inputs) {
  const raw = {
    incomes: baseInputs.incomes,
    expenseItems: baseInputs.expenseItems,
    savingsItems: baseInputs.savingsItems,
    investItems: baseInputs.investItems,
    monthlyExpense: baseInputs.monthlyExpense,
    monthlySavings: baseInputs.monthlySavings,
    monthlyInvest: baseInputs.monthlyInvest,
  };

  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    raw[key] = Number(field?.value);
  });

  return raw;
}

function applyInputsToForm(inputs) {
  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    if (field) {
      field.value = String(inputs[key]);
    }
  });
}

function sanitizeInputs(raw) {
  const monthlyIncomeFallback = IsfUtils.sanitizeMoney(raw.monthlyIncome, getMonthlyIncomeTotalMan(DEFAULT_INPUTS.incomes));
  const monthlyExpenseFallback = IsfUtils.sanitizeMoney(raw.monthlyExpense, getMonthlyAllocationTotalMan(DEFAULT_EXPENSE_ITEMS));
  const monthlySavingsFallback = IsfUtils.sanitizeMoney(raw.monthlySavings, getMonthlyAllocationTotalMan(DEFAULT_SAVINGS_ITEMS));
  const monthlyInvestFallback = IsfUtils.sanitizeMoney(raw.monthlyInvest, getMonthlyAllocationTotalMan(DEFAULT_INVEST_ITEMS));
  const annualSavingsYield = IsfUtils.sanitizeRate(raw.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20);
  const expenseItems = sanitizeExpenseItems(raw.expenseItems, monthlyExpenseFallback);
  const savingsItems = sanitizeSavingsItems(raw.savingsItems, monthlySavingsFallback, annualSavingsYield);
  const investItems = sanitizeInvestItems(raw.investItems, monthlyInvestFallback);

  return {
    incomes: sanitizeIncomeItems(raw.incomes, monthlyIncomeFallback),
    expenseItems,
    savingsItems,
    investItems,
    monthlyExpense: getMonthlyAllocationTotalMan(expenseItems),
    monthlySavings: getMonthlyAllocationTotalMan(savingsItems),
    monthlyInvest: getMonthlyAllocationTotalMan(investItems),
    monthlyDebtPayment: IsfUtils.sanitizeMoney(raw.monthlyDebtPayment, DEFAULT_INPUTS.monthlyDebtPayment),
    startCash: IsfUtils.sanitizeMoney(raw.startCash, DEFAULT_INPUTS.startCash),
    startSavings: IsfUtils.sanitizeMoney(raw.startSavings, DEFAULT_INPUTS.startSavings),
    startInvest: IsfUtils.sanitizeMoney(raw.startInvest, DEFAULT_INPUTS.startInvest),
    startDebt: IsfUtils.sanitizeMoney(raw.startDebt, DEFAULT_INPUTS.startDebt),
    annualIncomeGrowth: IsfUtils.sanitizeRate(raw.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: IsfUtils.sanitizeRate(raw.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield,
    annualInvestReturn: IsfUtils.sanitizeRate(raw.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: IsfUtils.sanitizeRate(raw.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: sanitizeInteger(raw.horizonYears, DEFAULT_INPUTS.horizonYears, 1, 40),
  };
}

function sanitizeIncomeItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
  }

  const sanitized = items
    .map((item, index) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const safeName = normalizeIncomeName(safeItem.name, index);
      const safeAmount = IsfUtils.sanitizeMoney(safeItem.amount, 0);
      const safeId = typeof safeItem.id === "string" && safeItem.id.trim()
        ? safeItem.id.trim()
        : createIncomeId();
      return {
        id: safeId,
        name: safeName,
        amount: safeAmount,
      };
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_INCOME_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
}

function normalizeIncomeName(name, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `수입 ${index + 1}`;
  }
  return text.slice(0, 24);
}

function createIncomeId() {
  return `income-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createIncomeItem({ id, name, amount } = {}) {
  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createIncomeId(),
    name: normalizeIncomeName(name, 0),
    amount: IsfUtils.sanitizeMoney(amount, 0),
  };
}

function getMonthlyIncomeTotalMan(incomes) {
  if (!Array.isArray(incomes)) {
    return 0;
  }
  return incomes.reduce((sum, income) => sum + IsfUtils.sanitizeMoney(income?.amount, 0), 0);
}

function sanitizeExpenseItems(items, fallbackAmount) {
  return sanitizeAllocationItems(items, DEFAULT_EXPENSE_ITEMS, fallbackAmount, "expense", "생활비");
}

function sanitizeSavingsAnnualRate(value, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const safeFallback = IsfUtils.sanitizeRate(fallbackRate, DEFAULT_INPUTS.annualSavingsYield, 20);
  return IsfUtils.sanitizeRate(value, safeFallback, 20);
}

function parseSavingsAnnualRateInput(value, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return sanitizeSavingsAnnualRate(text, fallbackRate);
}

function sanitizeSavingsItems(items, fallbackAmount, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const safeFallbackRate = sanitizeSavingsAnnualRate(fallbackRate, DEFAULT_INPUTS.annualSavingsYield);
  const normalized = sanitizeAllocationItems(
    items,
    DEFAULT_SAVINGS_ITEMS,
    fallbackAmount,
    "savings",
    "저축",
    { allowMaturity: true },
  );
  const rateById = new Map();

  if (Array.isArray(items)) {
    items.forEach((rawItem) => {
      const safeItem = rawItem && typeof rawItem === "object" ? rawItem : null;
      if (!safeItem) {
        return;
      }
      const itemId = typeof safeItem.id === "string" ? safeItem.id.trim() : "";
      if (!itemId || rateById.has(itemId)) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(safeItem, "annualRate")) {
        return;
      }
      rateById.set(itemId, parseSavingsAnnualRateInput(safeItem.annualRate, safeFallbackRate));
    });
  }

  return normalized.map((item) => {
    const parsedRate = rateById.has(item.id)
      ? rateById.get(item.id)
      : parseSavingsAnnualRateInput(item?.annualRate, safeFallbackRate);

    if (parsedRate === null) {
      const { annualRate: _annualRate, ...rest } = item;
      return rest;
    }

    return {
      ...item,
      annualRate: parsedRate,
    };
  });
}

function sanitizeInvestItems(items, fallbackAmount) {
  return sanitizeAllocationItems(
    items,
    DEFAULT_INVEST_ITEMS,
    fallbackAmount,
    "invest",
    "투자",
    { allowMaturity: true },
  );
}

function sanitizeAllocationItems(
  items,
  defaultItems,
  fallbackAmount,
  prefix = "allocation",
  label = "항목",
  options = {},
) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const allowMaturity = Boolean(safeOptions.allowMaturity);
  if (!Array.isArray(items) || items.length === 0) {
    return scaleDefaultAllocationItemsToTotal(defaultItems, fallbackAmount);
  }

  const usedIds = new Set();
  const sanitized = items
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      let safeId = typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createAllocationItemId(prefix, index);
      if (usedIds.has(safeId)) {
        safeId = createAllocationItemId(prefix, index);
      }
      usedIds.add(safeId);

      const normalizedItem = {
        id: safeId,
        name: normalizeAllocationName(item.name, label, index),
        amount: IsfUtils.sanitizeMoney(item.amount, 0),
      };
      const normalizedGroup = normalizeAllocationGroupName(item.group);
      if (normalizedGroup) {
        normalizedItem.group = normalizedGroup;
      }
      if (Object.prototype.hasOwnProperty.call(item, "annualRate")) {
        normalizedItem.annualRate = item.annualRate;
      }
      if (allowMaturity) {
        const normalizedMaturityMonth = normalizeMaturityMonth(item.maturityMonth);
        if (normalizedMaturityMonth) {
          normalizedItem.maturityMonth = normalizedMaturityMonth;
        }
      }
      return normalizedItem;
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_ALLOCATION_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return scaleDefaultAllocationItemsToTotal(defaultItems, fallbackAmount);
}

function createAllocationItemId(prefix, index = 0) {
  return `${prefix}-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeAllocationName(name, label, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `${label} ${index + 1}`;
  }
  return text.slice(0, 24);
}

function normalizeAllocationGroupName(groupName) {
  const text = String(groupName ?? "").trim();
  if (!text) {
    return "";
  }
  return text.slice(0, 16);
}

function normalizeMaturityMonth(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return "";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return "";
  }
  if (year < 2000 || year > 2200) {
    return "";
  }
  if (month < 1 || month > 12) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function getMaturityMonthIndex(maturityMonth, startDate = new Date()) {
  const normalized = normalizeMaturityMonth(maturityMonth);
  if (!normalized) {
    return null;
  }
  const [yearText, monthText] = normalized.split("-");
  const targetYear = Number(yearText);
  const targetMonth = Number(monthText) - 1;
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const monthGap = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1;
  if (!Number.isFinite(monthGap) || monthGap <= 0) {
    return 0;
  }
  return monthGap;
}

function formatMaturityMonthLabel(maturityMonth) {
  const normalized = normalizeMaturityMonth(maturityMonth);
  return normalized ? `${normalized} 만기` : "";
}

function buildAllocationMetaText(item, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const parts = [];
  const groupName = normalizeAllocationGroupName(item?.group);
  if (groupName) {
    parts.push(`그룹 ${groupName}`);
  }
  if (safeOptions.showMaturity) {
    const maturityLabel = formatMaturityMonthLabel(item?.maturityMonth);
    if (maturityLabel) {
      parts.push(maturityLabel);
    }
  }
  return parts.join(" · ");
}

function scaleDefaultAllocationItemsToTotal(defaultItems, totalAmount) {
  const safeTotal = IsfUtils.sanitizeMoney(totalAmount, getMonthlyAllocationTotalMan(defaultItems));
  const baseTotal = getMonthlyAllocationTotalMan(defaultItems);

  if (baseTotal <= 0) {
    return defaultItems.map((item) => ({ ...item, amount: 0 }));
  }

  const factor = safeTotal / baseTotal;
  const scaled = defaultItems.map((item) => {
    const safeItem = item && typeof item === "object" ? item : {};
    return {
      ...safeItem,
      id: safeItem.id,
      name: safeItem.name,
      amount: IsfUtils.sanitizeMoney(safeItem.amount * factor, 0),
    };
  });

  const currentTotal = getMonthlyAllocationTotalMan(scaled);
  const diff = safeTotal - currentTotal;
  const targetIndex = scaled.length - 1;
  scaled[targetIndex].amount = Math.max(0, scaled[targetIndex].amount + diff);

  return scaled;
}

function getMonthlyAllocationTotalMan(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((sum, item) => sum + IsfUtils.sanitizeMoney(item?.amount, 0), 0);
}



function sanitizeInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}


function toMonthlyFactor(annualPercent) {
  const annualRate = Number(annualPercent) / 100;
  return Math.pow(1 + annualRate, 1 / 12);
}

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(Math.round(safeValue));
}

function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) {
    return formatCurrency(0);
  }
  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }
  return `+${formatCurrency(value)}`;
}

function formatPercent(percent) {
  const safe = Number.isFinite(percent) ? percent : 0;
  return `${roundTo(safe, 1).toLocaleString("ko-KR")} %`;
}

function formatMonthSpan(months) {
  const year = Math.floor(months / 12);
  const month = months % 12;

  if (year <= 0) {
    return `${month}개월`;
  }
  if (month === 0) {
    return `${year}년`;
  }
  return `${year}년 ${month}개월`;
}

function formatSankeyDisplayValue(value, totalValue, valueMode = SANKEY_VALUE_MODES.AMOUNT) {
  const safeValue = Math.max(0, Number(value) || 0);
  if (normalizeSankeyValueMode(valueMode) === SANKEY_VALUE_MODES.PERCENT) {
    const safeTotal = Math.max(0, Number(totalValue) || 0);
    if (safeTotal <= 0) {
      return "0 %";
    }
    const percent = roundTo((safeValue / safeTotal) * 100, 1);
    return `${percent.toLocaleString("ko-KR")} %`;
  }
  return formatCurrency(safeValue);
}

function formatAllocationBreakdownText(items, totalValue, valueMode = SANKEY_VALUE_MODES.AMOUNT) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return items
    .map((item) => {
      const groupName = normalizeAllocationGroupName(item?.group);
      const label = groupName ? `${groupName}/${item.label}` : item.label;
      return `${label} ${formatSankeyDisplayValue(item.value, totalValue, valueMode)}`;
    })
    .join("\n");
}

function buildBandPath(x0, y0, y1, x1, y2, y3) {
  const curve = Math.max(40, (x1 - x0) * 0.42);
  return [
    `M ${x0} ${y0}`,
    `C ${x0 + curve} ${y0}, ${x1 - curve} ${y2}, ${x1} ${y2}`,
    `L ${x1} ${y3}`,
    `C ${x1 - curve} ${y3}, ${x0 + curve} ${y1}, ${x0} ${y1}`,
    "Z",
  ].join(" ");
}

function createSvgElement(tagName, attrs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });
  return element;
}

function measureSankeyTextWidth(text, fontSizePx = 12, fontWeight = 400) {
  const content = String(text ?? "");
  if (!content) {
    return 0;
  }

  const bodyFont = window.getComputedStyle(document.body).fontFamily || "sans-serif";
  if (!sankeyTextMeasureContext) {
    return content.length * Math.max(8, fontSizePx * 0.95);
  }

  sankeyTextMeasureContext.font = `${fontWeight} ${fontSizePx}px ${bodyFont}`;
  const metrics = sankeyTextMeasureContext.measureText(content);
  if (!Number.isFinite(metrics.width)) {
    return content.length * Math.max(8, fontSizePx * 0.95);
  }
  return metrics.width;
}

function showSankeyTooltip(event, text) {
  if (!dom.sankeyTooltip || !dom.sankeyWrap) {
    return;
  }
  if (!text || !String(text).trim()) {
    hideSankeyTooltip();
    return;
  }
  if (dom.sankeyEmpty && !dom.sankeyEmpty.hidden) {
    hideSankeyTooltip();
    return;
  }
  const target = event?.target;
  if (!(target instanceof SVGPathElement) || !target.classList.contains("sankey-path")) {
    hideSankeyTooltip();
    return;
  }

  const wrapRect = dom.sankeyWrap.getBoundingClientRect();
  if (wrapRect.width <= 0 || wrapRect.height <= 0) {
    hideSankeyTooltip();
    return;
  }
  const tooltip = dom.sankeyTooltip;

  tooltip.hidden = false;
  tooltip.textContent = text;

  const maxX = Math.max(20, wrapRect.width - 250);
  const maxY = Math.max(20, wrapRect.height - 70);
  const x = Math.min(maxX, event.clientX - wrapRect.left + 12);
  const y = Math.min(maxY, event.clientY - wrapRect.top + 12);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideSankeyTooltip() {
  if (dom.sankeyTooltip) {
    dom.sankeyTooltip.hidden = true;
  }
}

function resolveInitialInputs() {
  const sid = IsfShare.getShareIdFromUrl();
  const hashInputs = IsfShare.decodePayloadFromHash(new URLSearchParams(window.location.hash.replace(/^#/, "")).get(IsfShare.HASH_STATE_PARAM), SHARE_STATE_KEY);
  if (hashInputs) {
    return sanitizeInputs({ ...DEFAULT_INPUTS, ...hashInputs });
  }
  if (sid && IsfShare.detectViewMode()) {
    return sanitizeInputs({ ...DEFAULT_INPUTS });
  }
  return sanitizeInputs({ ...DEFAULT_INPUTS, ...loadPersistedInputs() });
}












function persistPrimaryState(inputs, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  if (!state.isViewMode) {
    persistInputs(inputs);
    if (!safeOptions.skipAutoBackup) {
      void IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, inputs, SHARE_STATE_KEY).then(r => { if(r.created) { state.backupEntries = r.nextEntries; syncBackupUi(); } });
    }
    void persistStep1BridgeSnapshot(inputs);
  }
  return true;
}

function getHubStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  const hub = window.IsfHubStorage;
  if (!hub || typeof hub !== "object") {
    return null;
  }
  if (typeof hub.saveStep1Snapshot !== "function" || typeof hub.saveBridgeStep1ToStep2 !== "function") {
    return null;
  }
  return hub;
}

function buildStep1BridgePayload(inputs) {
  const safeInputs = sanitizeInputs(cloneInputs(inputs));
  return {
    monthlyInvestCapacity: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.monthlyInvest, 0)),
    currentCash: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startCash, 0)),
    currentInvest: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startInvest, 0)),
    currentSavings: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startSavings, 0)),
    timestamp: new Date().toISOString(),
  };
}

async function persistStep1BridgeSnapshot(inputs) {
  const hub = getHubStorage();
  if (!hub || state.isViewMode) {
    return;
  }
  try {
    const safeInputs = sanitizeInputs(cloneInputs(inputs));
    const snapshot = await hub.saveStep1Snapshot(safeInputs);
    if (!snapshot || !snapshot.id) {
      return;
    }
    const payload = buildStep1BridgePayload(safeInputs);
    await hub.saveBridgeStep1ToStep2(snapshot.id, payload);
  } catch (_error) {
    // Ignore bridge snapshot failures to keep Step1 flow functional.
  }
}

function normalizeShareId(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  if (!/^[a-zA-Z0-9_-]{8,48}$/.test(text)) {
    return "";
  }
  return text;
}


function createShareId(length = 12) {
  const safeLength = Math.max(8, Math.min(48, Number.parseInt(String(length), 10) || 12));
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const buffer = new Uint8Array(safeLength);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(buffer);
  } else {
    for (let index = 0; index < safeLength; index += 1) {
      buffer[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, (byte) => chars[byte % chars.length]).join("");
}

function canResolveShareSidAcrossDevices() {
  return false;
}

async function buildShareLink(inputs, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const searchParams = new URLSearchParams(window.location.search);
  if (safeOptions.viewMode) {
    searchParams.set(IsfShare.VIEW_MODE_QUERY_PARAM, IsfShare.VIEW_MODE_QUERY_VALUE);
  } else {
    searchParams.delete(IsfShare.VIEW_MODE_QUERY_PARAM);
  }

  let sid = "";
  sid = await saveShareSnapshot(inputs);
  if (sid) {
    searchParams.set(IsfShare.SHARE_ID_QUERY_PARAM, sid);
  } else {
    searchParams.delete(IsfShare.SHARE_ID_QUERY_PARAM);
  }

  const shouldUseHashFallback = !sid || !canResolveShareSidAcrossDevices();
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (shouldUseHashFallback) {
    const encoded = IsfShare.encodePayloadForHash(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, inputs));
    if (!encoded) {
      return "";
    }
    params.set(HASH_STATE_PARAM, encoded);
  } else {
    params.delete(HASH_STATE_PARAM);
  }
  const searchText = searchParams.toString();
  const hashText = params.toString();
  return `${window.location.origin}${window.location.pathname}${searchText ? `?${searchText}` : ""}${hashText ? `#${hashText}` : ""}`;
}



function cloneInputs(inputs) {
  if (typeof structuredClone === "function") {
    return structuredClone(inputs);
  }
  return JSON.parse(JSON.stringify(inputs));
}

function persistInputs(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (_error) {
    // Ignore storage errors to keep UI functional.
  }
}

function loadPersistedInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}


function isIndexedDbAvailable() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}
















function getShareDb() {
  if (!IsfBackupManager.isIndexedDbAvailable()) {
    return Promise.reject(new Error("indexeddb-not-supported"));
  }
  if (shareDbPromise) {
    return shareDbPromise;
  }

  shareDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_DB_STORE)) {
        const store = db.createObjectStore(SHARE_DB_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        shareDbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      shareDbPromise = null;
      reject(request.error || new Error("share-indexeddb-open-failed"));
    };

    request.onblocked = () => {
      shareDbPromise = null;
      reject(new Error("share-indexeddb-open-blocked"));
    };
  });

  return shareDbPromise;
}

function idbRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Transaction aborted"));
  });
}

async function saveShareSnapshot(inputs) {
  if (!IsfBackupManager.isIndexedDbAvailable()) {
    return "";
  }
  try {
    const db = await getShareDb();
    const sid = createShareId();
    const entry = {
      id: sid,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      data: sanitizeInputs(cloneInputs(inputs)),
    };
    const transaction = db.transaction(SHARE_DB_STORE, "readwrite");
    transaction.objectStore(SHARE_DB_STORE).put(entry);
    await idbTransactionDone(transaction);
    return sid;
  } catch (_error) {
    return "";
  }
}

async function loadShareSnapshotById(sid) {
  const safeSid = normalizeShareId(sid);
  if (!safeSid || !IsfBackupManager.isIndexedDbAvailable()) {
    return null;
  }
  try {
    const db = await getShareDb();
    const transaction = db.transaction(SHARE_DB_STORE, "readonly");
    const request = transaction.objectStore(SHARE_DB_STORE).get(safeSid);
    const entry = await idbRequestToPromise(request);
    if (!entry || !entry.data || typeof entry.data !== "object") {
      return null;
    }
    return sanitizeInputs({ ...DEFAULT_INPUTS, ...entry.data });
  } catch (_error) {
    return null;
  }
}

async function initializeInputsFromShareId() {
  const sid = IsfShare.getShareIdFromUrl();
  const hasHash = window.location.hash.includes(HASH_STATE_PARAM);

  if (sid) {
    const sidInputs = await loadShareSnapshotById(sid);
    if (sidInputs && !areInputsEqual(sidInputs, state.inputs)) {
      commitImmediateInputs(sidInputs, { reason: "share-sid-load" });
      IsfFeedback.showFeedback(dom.applyFeedback, "공유 포인터(sid) 데이터를 불러왔습니다.");
    }
  }

  if (!state.isViewMode && (sid || hasHash)) {
    history.replaceState(null, "", window.location.pathname);
  }
}

function initializeBackupStore() {
  if (!IsfBackupManager.isIndexedDbAvailable()) {
    state.backupStoreError = true;
    state.backupStoreReady = false;
    syncBackupUi();
    return;
  }

  void (async () => {
    const loadedEntries = await IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY);
    if (loadedEntries === null) {
      state.backupStoreError = true;
      state.backupStoreReady = false;
      syncBackupUi();
      return;
    }

    state.backupEntries = loadedEntries;
    state.backupStoreError = false;
    state.backupStoreReady = true;
    syncBackupUi();

    const res = await IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, state.inputs || state.portfolio, SHARE_STATE_KEY); if(res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }
  })();
}














function formatBackupTimestamp(dateText) {
  const parsed = Date.parse(String(dateText || ""));
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return backupTimestampFormatter.format(new Date(parsed));
}

function formatBackupTimestampCompact(dateText) {
  const parsed = Date.parse(String(dateText || ""));
  if (!Number.isFinite(parsed)) {
    return "--:--";
  }
  const safeDate = new Date(parsed);
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const hour = String(safeDate.getHours()).padStart(2, "0");
  const minute = String(safeDate.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function formatBackupOptionText(entry, index = 0) {
  const modeLabel = entry.type === "manual" ? "수동" : "자동";
  const sourceLabel = entry.source === "view-save" ? "보기" : "일반";
  const sequence = index + 1;
  return `#${sequence} ${modeLabel} ${formatBackupTimestampCompact(entry.createdAt)} ${sourceLabel}`;
}

function buildBackupTooltipText(entries) {
  if (state.backupStoreError) {
    return "백업 저장소 초기화에 실패했습니다. 브라우저 설정(시크릿 모드/스토리지 차단)을 확인하세요.";
  }

  if (!state.backupStoreReady) {
    return "백업 저장소를 준비 중입니다. 잠시 후 자동/수동 백업을 사용할 수 있습니다.";
  }

  const parts = [
    "저장 위치: 이 브라우저 IndexedDB",
    `보관 정책: 최신 ${MAX_BACKUP_ENTRIES}개`,
    "자동 백업: 12시간 간격(일 2회)",
    "수동 백업: 1분당 1개(1분 내 재저장 시 덮어쓰기)",
    `현재 백업: ${entries.length}개`,
  ];

  if (state.isViewMode) {
    parts.push("보기 모드에서는 자동/수동 백업이 중지됩니다. 좌측 하단 저장 아이콘으로 일반 모드 전환 후 사용하세요.");
  }

  if (Array.isArray(entries) && entries.length > 0) {
    const latest = entries[0];
    const latestMode = latest.type === "manual" ? "수동" : "자동";
    parts.push(`최신 백업: ${latestMode} ${formatBackupTimestamp(latest.createdAt)}`);
  }

  return parts.join(" · ");
}

function syncBackupUi() {
  const entries = Array.isArray(state.backupEntries) ? state.backupEntries : [];
  const hasEntries = entries.length > 0;

  if (dom.backupSelect instanceof HTMLSelectElement) {
    const previousValue = dom.backupSelect.value;
    dom.backupSelect.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    if (!state.backupStoreReady && !state.backupStoreError) {
      placeholderOption.textContent = "백업 준비중";
    } else if (state.backupStoreError) {
      placeholderOption.textContent = "백업 사용 불가";
    } else {
      placeholderOption.textContent = hasEntries ? "백업 선택" : "백업 없음";
    }
    dom.backupSelect.appendChild(placeholderOption);

    entries.forEach((entry, index) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = formatBackupOptionText(entry, index);
      dom.backupSelect.appendChild(option);
    });

    if (hasEntries) {
      const selectedValue = entries.some((entry) => entry.id === previousValue)
        ? previousValue
        : entries[0].id;
      dom.backupSelect.value = selectedValue;
    } else {
      dom.backupSelect.value = "";
    }
  }

  const selectedBackupId = dom.backupSelect instanceof HTMLSelectElement ? dom.backupSelect.value : "";
  const canUseBackupActions = state.backupStoreReady && !state.isViewMode && hasEntries;

  if (dom.backupNow) {
    dom.backupNow.disabled = !state.backupStoreReady || state.isViewMode;
  }

  if (dom.backupSelect instanceof HTMLSelectElement) {
    dom.backupSelect.disabled = !state.backupStoreReady || state.isViewMode || !hasEntries;
  }

  if (dom.restoreBackup) {
    dom.restoreBackup.disabled = !canUseBackupActions || !selectedBackupId;
  }

  if (dom.backupHelp) {
    const tooltipText = buildBackupTooltipText(entries);
    dom.backupHelp.setAttribute("data-tooltip", tooltipText);
    dom.backupHelp.setAttribute("title", tooltipText);
  }
}



async function restoreSelectedBackup() {
  if (!state.backupStoreReady) {
    IsfFeedback.showFeedback(dom.applyFeedback, "백업 저장소가 아직 준비되지 않았습니다.");
    return;
  }

  if (state.isViewMode) {
    IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드에서는 복원을 사용할 수 없습니다. 로컬 저장 후 일반 모드에서 복원하세요.");
    return;
  }

  if (!(dom.backupSelect instanceof HTMLSelectElement)) {
    return;
  }

  const backupId = String(dom.backupSelect.value || "").trim();
  if (!backupId) {
    IsfFeedback.showFeedback(dom.applyFeedback, "복원할 백업을 선택하세요.");
    return;
  }

  const entry = (Array.isArray(state.backupEntries) ? state.backupEntries : [])
    .find((item) => item.id === backupId);
  if (!entry) {
    IsfFeedback.showFeedback(dom.applyFeedback, "선택한 백업을 찾을 수 없습니다.");
    syncBackupUi();
    return;
  }

  const confirmed = window.confirm(
    `선택한 백업(${formatBackupTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 복원 전에 수동 백업됩니다.`,
  );
  if (!confirmed) {
    return;
  }

  const res = await IsfBackupManager.createBackupEntry(state.backupEntries, state.inputs, { type: "manual", source: "normal", allowDuplicate: true , appKey: SHARE_STATE_KEY}); if(res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }
  commitImmediateInputs(entry.data, { skipAutoBackup: true });
  IsfFeedback.showFeedback(dom.applyFeedback, "선택한 백업으로 복원했습니다.");
}

function roundTo(value, digit) {
  const factor = 10 ** digit;
  return Math.round(value * factor) / factor;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

