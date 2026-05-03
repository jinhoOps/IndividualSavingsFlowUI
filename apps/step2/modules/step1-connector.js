
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";


export async function checkStep1SyncData() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const p = res.snapshot?.payload;

  if (p && p.monthlyInvestCapacity > 0) {

    state.draft.totalMonthlyInvestCapacity = Number(p.monthlyInvestCapacity);
    state.isSyncedWithStep1 = true;
    
    renderDraft();
    markDirty();


    if (dom.step1SyncBanner) {
      dom.step1SyncBanner.hidden = false;
      if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(p.timestamp);
      if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
      

      if (dom.importStep1Data) dom.importStep1Data.textContent = "동기화 완료";
    }
    console.log("checkStep1SyncData: Step 1 data automatically synced.");
  }
}


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


