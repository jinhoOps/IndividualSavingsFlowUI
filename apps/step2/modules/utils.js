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
  sanitizeRate: (v, fallback = 0, limit = 100) => {
    const raw = String(v || "0").replace(/[^0-9.-]/g, "");
    let parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.round(Math.min(limit, parsed) * 100) / 100;
  },
  formatMoney: v => {
    if (typeof IsfUtils !== "undefined" && IsfUtils.formatMoney) return IsfUtils.formatMoney(v);
    const manValue = Number(v || 0) / 10000;
    return Number(manValue.toFixed(2)).toLocaleString() + " 만원";
  },
  formatTimestamp: t => {
    if (typeof IsfUtils !== "undefined" && IsfUtils.formatTimestamp) return IsfUtils.formatTimestamp(t);
    return t ? new Date(t).toLocaleString() : "-";
  },
  toWon: v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? Math.round(n * 10000) : 0;
  },
  toMan: v => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n / 10000 : 0;
  },
  roundTo: (v, d) => {
    const factor = Math.pow(10, d);
    return Math.round(v * factor) / factor;
  },
  escapeHtml: s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])),
  createId: p => {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    const randomText = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return (p || "id") + "-" + Date.now() + "-" + randomText;
  }
};
