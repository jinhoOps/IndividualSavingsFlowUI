/**
 * Step 2 Data Bridge (Step 1 -> Step 2)
 */
import { state, markDirty, getHubStorage } from "./state.js";
import { dom } from "./dom.js";
import { formatCurrency, formatDateTime } from "./calculator.js";
import { renderDraft } from "./renderers.js";

// Local reference for shared utilities (v0.5.12 Standard)
const utils = window.IsfUtils || {
  sanitizeWeight: n => parseFloat(n) || 0,
  sanitizeMoney: v => parseInt(v) || 0,
  formatMoney: v => v,
  formatTimestamp: t => t,
  toWon: v => v * 10000,
  toMan: v => Math.floor(v / 10000),
  escapeHtml: s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])),
  createId: p => (p || "id") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2)
};

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
    state.draft.totalMonthlyInvestCapacity = Number(p.monthlyInvestCapacity) || 0;
    
    // Step 1의 투자 항목 연동 (계좌 매핑)
    if (Array.isArray(p.investItems) && p.investItems.length > 0) {
      const totalInvestAmount = p.investItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      if (totalInvestAmount > 0) {
        const nextAccounts = [...(state.draft.accounts || [])];
        
        p.investItems.forEach(item => {
          const weight = Math.round(((Number(item.amount) || 0) / totalInvestAmount) * 1000) / 10;
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
    }

    renderDraft();
    markDirty();
    IsfFeedback.showFeedback(dom.applyFeedback, "데이터 가져오기 완료");
  }
}
