export const IsfUtils = (function initIsfUtils(global) {
  "use strict";

  const backupTimestampFormatter = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function formatMoney(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) {
      return "0 만원";
    }
    const manValue = Math.round(numericValue / 10000);
    
    if (manValue >= 10000) {
      const eok = Math.floor(manValue / 10000);
      const remainMan = manValue % 10000;
      if (remainMan === 0) {
        return `${eok.toLocaleString("ko-KR")} 억원`;
      }
      return `${eok.toLocaleString("ko-KR")} 억 ${remainMan.toLocaleString("ko-KR")} 만원`;
    }
    
    const formatted = manValue.toLocaleString("ko-KR");
    return `${formatted} 만원`;
  }

  const FINANCIAL_INCOME_WARN_THRESHOLD_WON = 19200000;
  const FINANCIAL_INCOME_CRIT_THRESHOLD_WON = 32640000;

  const TAX_CONFIG = {
    SEPARATE_TAXATION_LIMIT_WON: 20000000,
    SEPARATE_TAXATION_RATE: 0.14,
    LOCAL_INCOME_TAX_RATE_MULTIPLIER: 1.1,
    PROGRESSIVE_BRACKETS: [
      { limit: 14000000, rate: 0.06, deduction: 0 },
      { limit: 50000000, rate: 0.15, deduction: 1260000 },
      { limit: 88000000, rate: 0.24, deduction: 5760000 },
      { limit: 150000000, rate: 0.35, deduction: 15440000 },
      { limit: 300000000, rate: 0.38, deduction: 19940000 },
      { limit: 500000000, rate: 0.40, deduction: 25940000 },
      { limit: 1000000000, rate: 0.42, deduction: 35940000 },
      { limit: Infinity, rate: 0.45, deduction: 65940000 },
    ],
  };

  function getFinancialIncomeStatus(annualIncomeWon) {
    const income = Number(annualIncomeWon || 0);
    if (income > FINANCIAL_INCOME_CRIT_THRESHOLD_WON) return "crit";
    if (income > FINANCIAL_INCOME_WARN_THRESHOLD_WON) return "warn";
    return "normal";
  }

  function getProgressiveTax(amount) {
    const bracket = TAX_CONFIG.PROGRESSIVE_BRACKETS.find((b) => amount <= b.limit);
    return amount * bracket.rate - bracket.deduction;
  }

  function calculateIncomeTax(taxableIncomeWon) {
    const income = Math.max(0, Number(taxableIncomeWon || 0));

    if (income <= TAX_CONFIG.SEPARATE_TAXATION_LIMIT_WON) {
      const baseTax = income * TAX_CONFIG.SEPARATE_TAXATION_RATE;
      return Math.round(baseTax * TAX_CONFIG.LOCAL_INCOME_TAX_RATE_MULTIPLIER);
    }

    const taxGeneral =
      getProgressiveTax(income - TAX_CONFIG.SEPARATE_TAXATION_LIMIT_WON) +
      TAX_CONFIG.SEPARATE_TAXATION_LIMIT_WON * TAX_CONFIG.SEPARATE_TAXATION_RATE;
    const taxComparison = income * TAX_CONFIG.SEPARATE_TAXATION_RATE;

    const baseTax = Math.max(taxGeneral, taxComparison);
    return Math.round(baseTax * TAX_CONFIG.LOCAL_INCOME_TAX_RATE_MULTIPLIER);
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return "-";
    let parsed = Number(timestamp);
    if (Number.isNaN(parsed)) {
      parsed = Date.parse(timestamp);
    }
    if (!Number.isFinite(parsed)) return "-";
    return backupTimestampFormatter.format(new Date(parsed));
  }

  function sanitizeMoney(value, fallback = 0, min = 0) {
    const raw = String(value ?? "").replace(/[^0-9.-]/g, "");
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, parsed);
  }

  function sanitizeRate(value, fallback = 0, limit = 100) {
    const raw = String(value || "0").replace(/[^0-9.-]/g, "");
    let parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    if (parsed > limit) {
      parsed = limit;
    }
    return Math.round(parsed * 100) / 100;
  }

  function createId(prefix) {
    const safePrefix = String(prefix || "id").trim() || "id";
    const bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    const randomText = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return safePrefix + "-" + Date.now() + "-" + randomText;
  }

  function escapeHtml(unsafe) {
    const str = String(unsafe || "");
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return str.replace(/[&<>"']/g, (match) => entities[match]);
  }

  function toWon(amountInUnit) {
    if (!Number.isFinite(Number(amountInUnit))) {
      return 0;
    }
    return Math.round(Number(amountInUnit) * 10000);
  }
  function toMan(amountInWon) {
    if (!Number.isFinite(Number(amountInWon))) {
      return 0;
    }
    return Math.round(Number(amountInWon) / 10000);
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }

  function roundTo(value, digit) {
    const factor = 10 ** digit;
    return Math.round(value * factor) / factor;
  }

  function idbRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error("Transaction aborted"));
    });
  }

  const result = {
    APP_VERSION: (typeof __APP_VERSION__ !== "undefined") ? __APP_VERSION__ : "0.9.50",
    formatMoney,
    getFinancialIncomeStatus,
    calculateIncomeTax,
    formatTimestamp,
    sanitizeMoney,
    sanitizeRate,
    toWon,
    toMan,
    createId,
    escapeHtml,
    debounce,
    roundTo,
    idbRequestToPromise,
    idbTransactionDone,
  };

  if (global) {
    global.IsfUtils = result;
  }

  return result;
})((typeof window !== "undefined" ? window : null));

