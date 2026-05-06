
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";


export async function checkStep1SyncData() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const p = res.snapshot?.payload;

  const currentVal = state.draft.totalMonthlyInvestCapacity || 0;
  const newVal = p ? Number(p.monthlyInvestCapacity) : 0;

  // Case 1: Step 1에 유효한 데이터가 있음
  if (p && newVal > 0) {
    // 데이터가 이미 일치하고 동기화된 상태라면 배너를 숨김
    if (currentVal === newVal) {
      state.isSyncedWithStep1 = true;
      if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
      return;
    }

    // 데이터가 다르거나 처음인 경우
    // 자동 반영은 하되, 사용자에게 알림 (첫 방문이거나 값이 0인 경우)
    if (currentVal === 0) {
      state.draft.totalMonthlyInvestCapacity = newVal;
      state.isSyncedWithStep1 = true;
      renderDraft();
      // 처음 가져온 것이라면 배너를 보여주어 출처를 알림
      if (dom.step1SyncBanner) {
        dom.step1SyncBanner.hidden = false;
        if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(p.timestamp);
        if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
        if (dom.importStep1Data) dom.importStep1Data.textContent = "동기화됨";
      }
    } else {
      // 값이 이미 있는데 Step 1과 다른 경우 -> 배너를 보여주고 수동 업데이트 유도
      if (dom.step1SyncBanner) {
        dom.step1SyncBanner.hidden = false;
        if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(p.timestamp);
        if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
        if (dom.importStep1Data) dom.importStep1Data.textContent = "업데이트";
        
        const textEl = dom.step1SyncBanner.querySelector('.sync-banner__text');
        if (textEl) textEl.textContent = "Step 1의 투자 여력 데이터가 변경되었습니다. 시뮬레이션에 반영할까요?";
      }
    }
  } else {
    // Case 2: Step 1 데이터가 없거나 0인 경우 (실패 혹은 미설정)
    // 기존에 설정된 값이 없다면(0이라면) 안내를 위해 배너를 보여줌
    if (currentVal === 0 && dom.step1SyncBanner) {
      dom.step1SyncBanner.hidden = false;
      const textEl = dom.step1SyncBanner.querySelector('.sync-banner__text');
      if (textEl) textEl.textContent = "Step 1 데이터가 없거나 0원입니다. 자산 흐름을 먼저 설정해 주세요.";
      if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = "0 만원";
      if (dom.importStep1Data) {
        dom.importStep1Data.textContent = "Step 1로 이동";
        // Note: 실제 이동 로직은 bindEvents에서 처리하거나 여기서 location.href 변경
      }
    } else {
      // 이미 값이 있는 상태에서 Step 1 로딩만 안된 거라면 굳이 방해하지 않음
      if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
    }
  }
}


export async function resolveLatestStep1Snapshot(hub) { 
  if (!hub) return { snapshot: null }; 
  try { 
    const s1 = await hub.getLatestStep1Snapshot();
    if (!s1) return { snapshot: null };
    
    // Modernized storage (IsfStore) returns the state directly or in a slightly different format
    // Legacy storage (hub-storage) returns { id, data, updatedAt }
    const payloadData = s1.data || s1;
    
    return {
      snapshot: {
        id: s1.id || "recent",
        payload: {
          monthlyInvestCapacity: Number(payloadData.monthlyInvest) || 0,
          timestamp: new Date(s1.updatedAt || Date.now()).toISOString()
        }
      }
    };
  } catch (_e) { 
    return { snapshot: null }; 
  } 
}


export async function importLatestStep1Data() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  if (res.snapshot?.payload) {
    const p = res.snapshot.payload;
    state.draft.totalMonthlyInvestCapacity = Number(p.monthlyInvestCapacity) || 0;
    
    renderDraft();
    markDirty();
    window.IsfFeedback.showFeedback(dom.applyFeedback, "Step 1 데이터 동기화 완료");
    
    if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
  }
}


