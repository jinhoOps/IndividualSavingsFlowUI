/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.0
 * 
 * 파일 역할: 공유 유틸리티 연결 및 폴백 제공 (Utility Bridge)
 */

export const utils = window.IsfUtils || {
  sanitizeMoney: (v, min = 0) => {
    const raw = String(v || "0").replace(/[^0-9.-]/g, "");
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(min, parsed) : min;
  },
  formatMoney: v => {
    if (typeof IsfUtils !== "undefined" && IsfUtils.formatMoney) return IsfUtils.formatMoney(v);
    return (v || 0).toLocaleString() + "원";
  },
  formatTimestamp: t => {
    if (typeof IsfUtils !== "undefined" && IsfUtils.formatTimestamp) return IsfUtils.formatTimestamp(t);
    return t ? new Date(t).toLocaleString() : "-";
  },
  toWon: v => Math.round(Number(v || 0) * 10000),
  toMan: v => Number(v || 0) / 10000,
  escapeHtml: s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])),
  createId: p => (p || "id") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2)
};
