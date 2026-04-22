/**
 * Step 2 Data Bridge (Step 1 -> Step 2)
 */
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";

/**
 * Checks for new data from Step 1 and shows the bridge banner if available
 */
export async function checkBridgeData() {
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

/**
 * Resolves the latest bridge payload from HubStorage
 */
export async function resolveLatestBridgePayload(hub) { 
  if (!hub) return { bridge: null }; 
  try { 
    const b = await hub.getLatestBridgeStep1ToStep2(); 
    return b?.payload ? { bridge: b } : { bridge: null }; 
  } catch (_e) { 
    return { bridge: null }; 
  } 
}

/**
 * Imports the latest bridge data into the current draft
 */
export async function importLatestBridgeIntoDraft() {
  const hub = getHubStorage();
  const res = await resolveLatestBridgePayload(hub);
  if (res.bridge?.payload) {
    const p = res.bridge.payload;
    // Step1에서 이미 원 단위로 넘어오므로 그대로 저장
    const capacity = Number(p.monthlyInvestCapacity) || 0;
    state.draft.totalMonthlyInvestCapacity = capacity;
    
    // Step 1의 투자 및 저축 항목 연동 (계좌 매핑)
    const allItems = [
      ...(Array.isArray(p.investItems) ? p.investItems : []),
      ...(Array.isArray(p.savingsItems) ? p.savingsItems : [])
    ];

    if (allItems.length > 0) {
      const nextAccounts = [...(state.draft.accounts || [])];
      const denominator = capacity || 1;
      
      allItems.forEach(item => {
        // 비중 계산: 전체 여력 대비 해당 항목의 금액 (1000 곱하고 10 나눠서 소수점 한자리 유지)
        const weight = Math.round(((Number(item.amount) || 0) / denominator) * 1000) / 10;
        const existing = nextAccounts.find(acc => acc.name === item.name);
        
        if (existing) {
          existing.accountWeight = weight;
        } else {
          nextAccounts.push({
            id: utils.createId("acc"),
            name: item.name,
            accountWeight: weight,
            allocations: [],
            isOpen: true
          });
        }
      });
      
      state.draft.accounts = nextAccounts;
    }

    renderDraft();
    markDirty();
    IsfFeedback.showFeedback(dom.applyFeedback, "데이터 가져오기 완료");
  }
}
