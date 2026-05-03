
export const dom = {
  appHeader: null,
  dataHubModal: null,
  step1SyncBanner: null,
  dismissSyncBanner: null,
  importStep1Data: null,
  syncTimestamp: null,
  syncInvestCapacity: null,
  totalMonthlyInvestCapacity: null,
  applyFeedback: null,
  toggleSimInputs: null,
  simInputsContainer: null,
  simDividendYield: null,
  simDividendGrowth: null,
  simCapitalGrowth: null,
  simHorizonYears: null,
  simDrip: null,
  simChartSvg: null,
  simChartTooltip: null,
  simTable: null,
  simYearsTabs: null,
};

export function initDom() {
  const selectors = {
    appHeader: "app-header",
    dataHubModal: "data-hub-modal",
    step1SyncBanner: "step1SyncBanner",
    dismissSyncBanner: "dismissSyncBanner",
    importStep1Data: "importStep1Data",
    syncTimestamp: "syncTimestamp",
    syncInvestCapacity: "syncInvestCapacity",
    totalMonthlyInvestCapacity: "totalMonthlyInvestCapacity",
    applyFeedback: "applyFeedback",
    toggleSimInputs: "toggleSimInputs",
    simInputsContainer: "simInputsContainer",
    simDividendYield: "simDividendYield",
    simDividendGrowth: "simDividendGrowth",
    simCapitalGrowth: "simCapitalGrowth",
    simHorizonYears: "simHorizonYears",
    simDrip: "simDrip",
    simChartSvg: "simChartSvg",
    simChartTooltip: "simChartTooltip",
    simYearsTabs: "simYearsTabs",
  };

  for (const [key, id] of Object.entries(selectors)) {
    dom[key] = document.getElementById(id) || document.querySelector(id);
  }
  dom.simTable = document.querySelector("#simTable tbody");
}


