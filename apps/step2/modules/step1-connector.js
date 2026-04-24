/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.3
 * 
 * 파일 역할: 통합 저장소를 통한 Step 1 데이터 동기화 (Step 1 Data Sync)
 */
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";

/**
 * 통합 저장소에서 Step 1의 최신 데이터를 확인하고 자동으로 동기화합니다. (Sync by Default)
 */
export async function checkStep1SyncData() {
  const hub = getHubStorage();
  const res = await resolveLatestStep1Snapshot(hub);
  const p = res.snapshot?.payload;

  if (p && p.monthlyInvestCapacity > 0) {
    // 1) Step 1 데이터가 존재하면 무조건 자동으로 반영 (그래프 즉시 갱신)
    state.draft.totalMonthlyInvestCapacity = Number(p.monthlyInvestCapacity);
    state.isSyncedWithStep1 = true; // 동기화됨을 표시
    
    renderDraft();
    markDirty();

    // 2) 동기화 완료 알림 (배너는 안내용으로 사용)
    if (dom.step1SyncBanner) {
      dom.step1SyncBanner.hidden = false;
      if (dom.syncTimestamp) dom.syncTimestamp.textContent = formatDateTime(p.timestamp);
      if (dom.syncInvestCapacity) dom.syncInvestCapacity.textContent = formatCurrency(p.monthlyInvestCapacity);
      
      // '가져오기' 버튼 텍스트를 '연동됨'으로 변경하거나 숨김 처리 고려
      if (dom.importStep1Data) dom.importStep1Data.textContent = "동기화 완료";
    }
    console.log("checkStep1SyncData: Step 1 data automatically synced.");
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

