/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.2
 * 
 * 파일 역할: 통합 저장소를 통한 Step 1 데이터 동기화 (Step 1 Data Sync)
 */
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";

/**
 * 통합 저장소에서 Step 1의 최신 데이터를 확인하고 동기화 배너를 표시합니다.
 */
export async function checkStep1SyncData() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const p = res.snapshot?.payload;
  if (p && p.monthlyInvestCapacity !== state.draft.totalMonthlyInvestCapacity) {
    if (dom.step1SyncBanner) {
      dom.step1SyncBanner.hidden = false;
      if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(p.timestamp);
      if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
    }
  }
}

/**
 * 통합 저장소(Storage Hub)에서 Step 1의 최신 스냅샷을 가져와 필요한 데이터를 추출합니다.
 */
export async function resolveLatestStep1Snapshot(hub) { 
  if (!hub) return { snapshot: null }; 
  try { 
    const s1 = await hub.getLatestStep1Snapshot();
    if (!s1 || !s1.data) return { snapshot: null };
    
    return {
      snapshot: {
        id: s1.id,
        payload: {
          monthlyInvestCapacity: Number(s1.data.monthlyInvest) || 0,
          timestamp: new Date(s1.updatedAt).toISOString()
        }
      }
    };
  } catch (_e) { 
    return { snapshot: null }; 
  } 
}

/**
 * Step 1의 최신 데이터를 현재 드래프트에 적용합니다.
 */
export async function importLatestStep1Data() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  if (res.snapshot?.payload) {
    const p = res.snapshot.payload;
    state.draft.totalMonthlyInvestCapacity = Number(p.monthlyInvestCapacity) || 0;
    
    renderDraft();
    markDirty();
    IsfFeedback.showFeedback(dom.applyFeedback, "Step 1 데이터 동기화 완료");
    
    if (dom.step1SyncBanner) dom.step1SyncBanner.hidden = true;
  }
}

