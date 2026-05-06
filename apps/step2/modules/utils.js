

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
    if (typeof window.IsfUtils !== "undefined" && window.IsfUtils.formatMoney) return window.IsfUtils.formatMoney(v);
    const numericValue = Number(v || 0);
    const manValue = Math.round(numericValue / 10000);
    if (manValue >= 10000) {
      const eok = Math.floor(manValue / 10000);
      const remainMan = manValue % 10000;
      return remainMan === 0 ? `${eok.toLocaleString("ko-KR")} 억원` : `${eok.toLocaleString("ko-KR")} 억 ${remainMan.toLocaleString("ko-KR")} 만원`;
    }
    return manValue.toLocaleString("ko-KR") + " 만원";
  },
  formatTimestamp: t => {
    if (typeof window.IsfUtils !== "undefined" && window.IsfUtils.formatTimestamp) return window.IsfUtils.formatTimestamp(t);
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
    if (typeof window.IsfUtils !== "undefined" && window.IsfUtils.createId) {
      return window.IsfUtils.createId(p);
    }
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    const randomText = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return (p || "id") + "-" + Date.now() + "-" + randomText;
  }
};


