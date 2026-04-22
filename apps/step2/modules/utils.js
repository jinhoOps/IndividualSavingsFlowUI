/**
 * Step 2 Utility Bridge
 * Centralizes the reference to shared IsfUtils and provides fallbacks.
 * (v0.5.12 Standardized)
 */

export const utils = window.IsfUtils || {
  sanitizeWeight: n => {
    const numeric = parseFloat(n);
    if (!Number.isFinite(numeric)) return 0;
    const rounded = Math.round(numeric * 100) / 100;
    return Math.max(0, Math.min(100, rounded));
  },
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
