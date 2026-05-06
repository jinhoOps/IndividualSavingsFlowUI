
import { IsfUtils } from "../../../shared/core/utils.js";

const isf = IsfUtils || {};

export const utils = {
  sanitizeMoney: isf.sanitizeMoney || ((v, min = 0) => {
    const raw = String(v || "0").replace(/[^0-9.-]/g, "");
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(min, parsed) : min;
  }),
  sanitizeRate: isf.sanitizeRate || ((v, fallback = 0, limit = 100) => {
    const raw = String(v || "0").replace(/[^0-9.-]/g, "");
    let parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.round(Math.min(limit, parsed) * 100) / 100;
  }),
  formatMoney: v => isf.formatMoney ? isf.formatMoney(v) : (Math.round(Number(v || 0) / 10000).toLocaleString() + " 만원"),
  formatTimestamp: t => isf.formatTimestamp ? isf.formatTimestamp(t) : (t ? new Date(t).toLocaleString() : "-"),
  toWon: isf.toWon || (v => Math.round(Number(v || 0) * 10000)),
  toMan: isf.toMan || (v => Number(v || 0) / 10000),
  roundTo: isf.roundTo || ((v, d) => {
    const factor = Math.pow(10, d);
    return Math.round(v * factor) / factor;
  }),
  escapeHtml: isf.escapeHtml || (s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m]))),
  createId: p => isf.createId ? isf.createId(p) : ((p || "id") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
  getFinancialIncomeStatus: isf.getFinancialIncomeStatus || (() => "normal")
};


