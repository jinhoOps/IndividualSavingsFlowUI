
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";

const STEP1_PRIMARY_STORAGE_KEY = "isf-rebuild-v1";

function readLocalStep1Inputs() {
  try {
    const hubLocal = getHubStorage()?.loadLocal?.(STEP1_PRIMARY_STORAGE_KEY);
    if (hubLocal) return hubLocal;
  } catch (_e) {}

  try {
    const raw = localStorage.getItem(STEP1_PRIMARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function normalizeStep1Payload(snapshot) {
  const payload = snapshot?.payload;
  if (!payload) return null;
  return {
    id: snapshot.id || "recent",
    timestamp: payload.timestamp || new Date(Date.now()).toISOString(),
    totalInitialAsset: utils.toWon(payload.totalInitialAsset),
    totalMonthlyInvestCapacity: utils.toWon(payload.monthlyInvestCapacity),
    horizonYears: Number(payload.horizonYears) || 0,
  };
}

function hasStep1SourceValue(source) {
  return Boolean(source && (source.totalInitialAsset > 0 || source.totalMonthlyInvestCapacity > 0));
}

function cacheStep1Source(source) {
  if (!source) return;
  state.step1Source = {
    id: source.id,
    timestamp: source.timestamp,
    totalInitialAsset: source.totalInitialAsset,
    totalMonthlyInvestCapacity: source.totalMonthlyInvestCapacity,
    horizonYears: source.horizonYears,
    importedAt: Date.now()
  };
}

function applyStep1SourceToDraft(source) {
  if (!source || !state.draft) return false;
  state.draft.totalMonthlyInvestCapacity = source.totalMonthlyInvestCapacity;
  state.draft.totalInitialAsset = source.totalInitialAsset;
  if (source.horizonYears > 0) {
    if (!state.draft.dividendSim) state.draft.dividendSim = {};
    state.draft.dividendSim.years = source.horizonYears;
  }
  state.draft.updatedAt = Date.now();
  state.isSyncedWithStep1 = true;
  cacheStep1Source(source);
  return true;
}

function renderSyncBanner(source, options = {}) {
  if (!dom.step1SyncBanner) return;
  const { hidden = false, actionText = "동기화됨", message = "Main에서 새로운 투자 여력 데이터를 가져왔습니다. 시뮬레이션에 적용할까요?" } = options;
  dom.step1SyncBanner.hidden = hidden;
  const textEl = dom.step1SyncBanner.querySelector('.sync-banner__text');
  if (textEl) textEl.textContent = message;
  if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(source?.timestamp);
  if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(source?.totalMonthlyInvestCapacity || 0);
  if (dom.importStep1Data) dom.importStep1Data.textContent = actionText;
  if (dom.importStep1Data) dom.importStep1Data.dataset.mode = actionText === "Main으로 이동" ? "go-main" : "import";
  if (dom.importStep1DataPrimary) {
    dom.importStep1DataPrimary.textContent = actionText === "Main으로 이동" ? "Step 1에서 먼저 입력하기" : "Step 1 데이터 가져오기";
    dom.importStep1DataPrimary.dataset.mode = actionText === "Main으로 이동" ? "go-main" : "import";
  }
}

export async function checkStep1SyncData() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const source = normalizeStep1Payload(res.snapshot);

  const currentInvestVal = state.draft.totalMonthlyInvestCapacity || 0;
  const currentInitialVal = state.draft.totalInitialAsset || 0;
  const hasLoadedStep2Override = Boolean(state.currentSimulationId) || state.dirty;

      // Case 1: Main에 유효한 데이터가 있음
  if (hasStep1SourceValue(source)) {
    cacheStep1Source(source);
    // 데이터가 이미 일치하고 동기화된 상태라면 배너를 숨김
    if (currentInvestVal === source.totalMonthlyInvestCapacity && currentInitialVal === source.totalInitialAsset) {
      state.isSyncedWithStep1 = true;
      if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
      return;
    }

    // 데이터가 다르거나 처음인 경우. 저장/세션으로 불러온 Step 2 값은 의도적 override로 보존한다.
    if (!hasLoadedStep2Override && currentInvestVal === 0 && currentInitialVal === 0) {
      applyStep1SourceToDraft(source);
      renderDraft();
      // 처음 가져온 것이라면 배너를 보여주어 출처를 알림
      renderSyncBanner(source, { hidden: false, actionText: "동기화됨" });
    } else {
      // 값이 이미 있는데 Main과 다른 경우 -> 배너를 보여주고 수동 업데이트 유도
      renderSyncBanner(source, {
        hidden: false,
        actionText: "업데이트",
        message: "Main의 자산/투자 데이터가 변경되었습니다. 시뮬레이션에 반영할까요?"
      });
    }
  } else {
    // Case 2: Main 데이터가 없거나 0인 경우 (실패 혹은 미설정)
    if (currentInvestVal === 0 && currentInitialVal === 0 && dom.step1SyncBanner) {
      dom.step1SyncBanner.hidden = false;
      const textEl = dom.step1SyncBanner.querySelector('.sync-banner__text');
      if (textEl) textEl.textContent = "Main 데이터가 없거나 0원입니다. 자산 흐름을 먼저 설정해 주세요.";
      if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = "0원";
      if (dom.importStep1Data) {
        dom.importStep1Data.textContent = "Main으로 이동";
        dom.importStep1Data.dataset.mode = "go-main";
      }
      if (dom.importStep1DataPrimary) {
        dom.importStep1DataPrimary.textContent = "Step 1에서 먼저 입력하기";
        dom.importStep1DataPrimary.dataset.mode = "go-main";
      }
    } else {
      if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
    }
  }
}


export async function resolveLatestStep1Snapshot(hub) { 
  const localInputs = readLocalStep1Inputs();
  try { 
    const s1 = hub?.getLatestStep1Snapshot ? await hub.getLatestStep1Snapshot() : null;
    const payloadData = s1?.data || s1 || localInputs;
    if (!payloadData) return { snapshot: null };
    
    return {
      snapshot: {
        id: s1?.id || "recent",
        payload: {
          totalInitialAsset: Number(payloadData.startInvest) || 0,
          monthlyInvestCapacity: Number(payloadData.monthlyInvest) || 0,
          horizonYears: Number(payloadData.horizonYears) || 0,
          timestamp: new Date(s1?.updatedAt || payloadData.updatedAt || Date.now()).toISOString()
        }
      }
    };
  } catch (_e) { 
    if (localInputs) {
      return {
        snapshot: {
          id: "local-current",
          payload: {
            totalInitialAsset: Number(localInputs.startInvest) || 0,
            monthlyInvestCapacity: Number(localInputs.monthlyInvest) || 0,
            horizonYears: Number(localInputs.horizonYears) || 0,
            timestamp: new Date(localInputs.updatedAt || Date.now()).toISOString()
          }
        }
      };
    }
    return { snapshot: null }; 
  } 
}


export async function importLatestStep1Data() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const source = normalizeStep1Payload(res.snapshot);
  if (hasStep1SourceValue(source)) {
    applyStep1SourceToDraft(source);
    renderDraft();
    markDirty();
    window.IsfFeedback.showFeedback(dom.applyFeedback, "Main 데이터 동기화 완료");
    
    if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
  }
}

export async function reimportOriginalStep1Source() {
  const hub = getHubStorage();
  const latest = normalizeStep1Payload((await resolveLatestStep1Snapshot(hub)).snapshot);
  const source = hasStep1SourceValue(latest) ? latest : state.step1Source;
  if (!hasStep1SourceValue(source)) return false;
  const applied = applyStep1SourceToDraft(source);
  if (applied) {
    renderDraft();
    if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
  }
  return applied;
}


